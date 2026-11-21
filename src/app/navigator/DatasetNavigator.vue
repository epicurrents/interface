<template>
    <div data-component="dataset-navigator"
        :is="SETTINGS.isMainComponent ? 'aside' : 'div'"
    >
        <dataset-selector
            v-on:create-dataset="$emit('create-dataset')"
        ></dataset-selector>
        <wa-scroller class="items" orientation="vertical" ref="scroller">
            <div class="rows" ref="rowList">
                <div class="spacer above"></div>
                <div v-for="row of shownRows" :key="row.key"
                    :class="['row', { first: row.first }]"
                    :data-row="row.key"
                >
                    <div v-if="row.kind === 'header'" class="header">{{ row.header }}</div>
                    <navigator-entry v-else
                        :disclosure="row.disclosure"
                        :resource="row.resource"
                    />
                </div>
                <div class="spacer below"></div>
            </div>
        </wa-scroller>
        <div :class="[
                'footer',
                { 'epicv-hidden': !$store.state.APP.uiComponentVisible.footer
                                  || $store.state.INTERFACE.app.isExpanded
                },
            ]"
        >
            <system-footer
                v-on:toggle-dialog="$emit('toggle-dialog', $event)"
            ></system-footer>
        </div>
    </div>
</template>

<script lang="ts">
/**
 * Navigator component to display next to the main viewer.
 *
 * Only the rows within reach of the viewport are mounted, between two spacers that stand for the rest. A row's height
 * is estimated until it has been laid out once, and measured from then on, so the list settles as it is scrolled.
 */
import { defineComponent, reactive, ref, Ref } from "vue"
import { T } from "#i18n"
import { DatasetResourceContext } from "@epicurrents/core/types"
import { useStore } from 'vuex'
import { useAppContext } from '../../config'
import { rowOffsets, rowRange, type EntryDisclosure, type NavigatorRow } from './rows'
// Child components
import DatasetSelector from './DatasetSelector.vue'
import NavigatorEntry from './NavigatorEntry.vue'
import SystemFooter from '#app/footers/SystemFooter.vue'

/** How far past each edge of the viewport rows stay mounted, in pixels. */
const OVERSCAN = 300

/** The heights of the rows in rem, which estimate a row that has not been laid out yet. */
const ESTIMATE = {
    child: 2.7,
    disclosure: 1.75,
    firstHeader: 1.5,
    header: 1.75,
    member: 2.7,
}

/** The scroller element, whose `content` part is the scroll container. */
type Scroller = HTMLElement & { content: HTMLElement, updateComplete: Promise<boolean> }

export default defineComponent({
    name: 'AppNavigator',
    components: {
        DatasetSelector,
        NavigatorEntry,
        SystemFooter,
    },
    props: {
        visible: {
            type: Boolean,
            default: true,
        },
    },
    setup () {
        const { SETTINGS } = useAppContext(useStore())
        // DOM
        const updateCounter = ref(0)
        const wrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const rowList = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const scroller = ref<Scroller>() as Ref<Scroller>
        /** Bumped when a measured row height changes, since the heights themselves are not reactive. */
        const layoutCounter = ref(0)
        const scrollTop = ref(0)
        const viewportHeight = ref(0)
        return {
            SETTINGS,
            layoutCounter,
            scrollTop,
            updateCounter,
            viewportHeight,
            // DOM
            rowList,
            scroller,
            wrapper,
            // Not reactive
            /** The disclosure state of each member, by resource id. */
            disclosures: new Map<string, EntryDisclosure>(),
            /** The pending animation frame of a scroll update. */
            frame: 0,
            /** The measured height of each row that has been laid out, by row key. */
            heights: new Map<string, number>(),
            /** The row elements being measured. */
            observed: new WeakSet<Element>(),
            /** The root font size in pixels, which converts the estimates. */
            rem: 16,
            rowObserver: null as ResizeObserver | null,
            viewportObserver: null as ResizeObserver | null,
        }
    },
    computed: {
        componentDisplay (): string {
            if (!this.visible) {
                return 'none'
            }
            return 'flex'
        },
        /**
         * The active dataset's members in its sorting. Sorted by modality, each group is headed by the short name of
         * the module registered for it; the other schemes group by initial or by member, and take no header.
         */
        groups (): { header: string, key: string, resources: DatasetResourceContext[] }[] {
            const activeSet = this.$store.state.APP.activeDataset
            this.updateCounter
            if (!activeSet || activeSet instanceof Promise) {
                return []
            }
            const byModality = activeSet.resourceSorting.scheme === 'modality'
            const groups = [] as { header: string, key: string, resources: DatasetResourceContext[] }[]
            for (const [key, resources] of activeSet.sortedResources.entries()) {
                if (!resources.length) {
                    continue
                }
                const header = byModality
                               ? this.$t(this.$store.state.MODULES.get(key)?.moduleName.short || key.toUpperCase())
                               : ''
                groups.push({ header, key, resources })
            }
            return groups
        },
        /** The offset of each row, and the height of the whole list, from measured or estimated row heights. */
        offsets (): number[] {
            this.layoutCounter
            return rowOffsets(this.rows.map(row => this.heights.get(row.key) ?? this.estimateHeight(row)))
        },
        range (): [number, number] {
            return rowRange(this.offsets, this.scrollTop, this.viewportHeight, OVERSCAN)
        },
        /** The groups as one list of rows, a header followed by its members. */
        rows (): NavigatorRow[] {
            const rows = [] as NavigatorRow[]
            for (const group of this.groups) {
                if (group.header) {
                    rows.push({ first: !rows.length, header: group.header, key: `header-${group.key}`, kind: 'header' })
                }
                for (const ctx of group.resources) {
                    rows.push({
                        disclosure: this.disclosureFor(ctx.resource.id),
                        first: !rows.length,
                        key: `member-${ctx.resource.id}`,
                        kind: 'member',
                        resource: ctx.resource,
                    })
                }
            }
            return rows
        },
        /** The rows that are mounted. */
        shownRows (): NavigatorRow[] {
            return this.rows.slice(this.range[0], this.range[1])
        },
        spaceAbove (): string {
            return `${this.offsets[this.range[0]]}px`
        },
        spaceBelow (): string {
            return `${this.offsets[this.offsets.length - 1] - this.offsets[this.range[1]]}px`
        },
    },
    methods: {
        /**
         * Override the default I18n translate method.
         * Returns a component-specific translation (default) or a
         * general translation (fallback) for the given key string.
         */
        $t: function (key: string, params = {}, capitalized = false) {
            return T(key, this.$options.name, params, capitalized)
        },
        /**
         * The disclosure state of a member, created closed on its first use. Each is reactive on its own, and the map
         * holding them is not, so creating one while the rows are computed triggers nothing.
         */
        disclosureFor (id: string): EntryDisclosure {
            let disclosure = this.disclosures.get(id)
            if (!disclosure) {
                disclosure = reactive({ isOpen: false, wasActive: false })
                this.disclosures.set(id, disclosure)
            }
            return disclosure
        },
        /** The height of a row that has not been laid out, in pixels. */
        estimateHeight (row: NavigatorRow) {
            if (row.kind === 'header') {
                return (row.first ? ESTIMATE.firstHeader : ESTIMATE.header) * this.rem
            }
            const children = row.resource.childResources.length
            let height = ESTIMATE.member
            if (children) {
                height += ESTIMATE.disclosure
                if (row.disclosure.isOpen) {
                    height += children * ESTIMATE.child
                }
            }
            return height * this.rem
        },
        /** Start measuring the rows mounted since the last call. */
        observeRows () {
            if (!this.rowObserver || !this.rowList) {
                return
            }
            for (const element of this.rowList.children) {
                if ((element as HTMLElement).dataset.row && !this.observed.has(element)) {
                    this.observed.add(element)
                    this.rowObserver.observe(element)
                }
            }
        },
        /** Record the measured heights of rows, and lay the list out again if any changed. */
        rowsResized (entries: ResizeObserverEntry[]) {
            let changed = false
            for (const entry of entries) {
                const element = entry.target as HTMLElement
                if (!element.isConnected) {
                    this.rowObserver?.unobserve(element)
                    this.observed.delete(element)
                    continue
                }
                const key = element.dataset.row as string
                const height = entry.borderBoxSize?.[0]?.blockSize ?? element.offsetHeight
                // An unmounted row, or any row while the navigator is hidden, reports no height, which is not its
                // height; taking it would bring every row into reach, each of them reporting no height in turn.
                if (!height) {
                    continue
                }
                if (Math.abs((this.heights.get(key) ?? -1) - height) > 0.5) {
                    this.heights.set(key, height)
                    changed = true
                }
            }
            if (changed) {
                this.layoutCounter++
            }
        },
        /** Follow the scroll position, once per frame. */
        scrolled () {
            if (this.frame) {
                return
            }
            this.frame = requestAnimationFrame(() => {
                this.frame = 0
                this.scrollTop = this.scroller.content.scrollTop
            })
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this.$store.state.addEventListener([
            'add-resource',
            'replace-resource',
            'set-active-dataset',
            'set-active-resource',
        ], () => {
            // I would REALLY like to avoid this, but it doesn't seem possible at the moment.
            this.updateCounter++
        }, this.$options.name || 'AppNavigator')
        this.rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
        this.rowObserver = new ResizeObserver(this.rowsResized)
        this.observeRows()
        customElements.whenDefined('wa-scroller').then(() => this.scroller?.updateComplete).then(() => {
            const content = this.scroller?.content
            if (!content || !this.rowObserver) {
                // Unmounted before the scroller was ready.
                return
            }
            content.addEventListener('scroll', this.scrolled, { passive: true })
            this.viewportObserver = new ResizeObserver(() => {
                this.viewportHeight = content.clientHeight
            })
            this.viewportObserver.observe(content)
            this.scrollTop = content.scrollTop
            this.viewportHeight = content.clientHeight
        })
    },
    updated () {
        this.observeRows()
    },
    beforeUnmount () {
        this.$store.state.removeAllEventListeners(this.$options.name || 'AppNavigator')
        this.scroller?.content?.removeEventListener('scroll', this.scrolled)
        this.rowObserver?.disconnect()
        this.rowObserver = null
        this.viewportObserver?.disconnect()
        this.viewportObserver = null
        cancelAnimationFrame(this.frame)
    },
})
</script>

<style scoped>
[data-component="dataset-navigator"] {
    display: v-bind(componentDisplay);
    flex-direction: column;
    height: 100%;
    width: 100%;
}
[data-component="dataset-navigator"] wa-scroller::part(content) {
    display: flex;
    flex-direction: column;
    padding: 0.25rem;
}
.items {
    border-right: solid 1px var(--epicv-border);
    flex: 1;
    overflow: auto;
}
    /* The scroller's content part is the scroll container, so its children must keep their height and overflow
       into the scroll instead of shrinking to fit. */
    .items > * {
        flex-shrink: 0;
    }
.rows {
    display: flex;
    flex-direction: column;
}
    .rows > * {
        flex-shrink: 0;
    }
.spacer.above {
    height: v-bind(spaceAbove);
}
.spacer.below {
    height: v-bind(spaceBelow);
}
.header {
    color: var(--epicv-text-minor);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    line-height: 1rem;
    padding: 0.5rem 0.5rem 0.25rem 1.25rem;
    text-transform: uppercase;
}
    .first > .header {
        padding-top: 0.25rem;
    }
</style>
