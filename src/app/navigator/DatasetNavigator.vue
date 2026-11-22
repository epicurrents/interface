<template>
    <div data-component="dataset-navigator"
        :is="SETTINGS.isMainComponent ? 'aside' : 'div'"
    >
        <dataset-selector
            v-on:create-dataset="$emit('create-dataset')"
        ></dataset-selector>
        <wa-scroller class="items" orientation="vertical" ref="scroller">
            <div class="rows" ref="rowList" role="list"
                @focusin="focusEntered"
                @focusout="focusLeft"
            >
                <template v-for="item of layout" :key="item.key">
                    <div v-if="item.kind === 'gap'"
                        aria-hidden="true"
                        class="spacer"
                        :style="{ height: `${item.height}px` }"
                    ></div>
                    <div v-else
                        role="listitem"
                        :aria-posinset="item.index + 1"
                        :aria-setsize="rows.length"
                        :class="['row', { first: item.row.first }]"
                        :data-row="item.key"
                    >
                        <div v-if="item.row.kind === 'header'" class="header">{{ item.row.header }}</div>
                        <navigator-entry v-else
                            :disclosure="item.row.disclosure"
                            :resource="item.row.resource"
                        />
                    </div>
                </template>
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
 * Only the rows within reach of the viewport are mounted, with spacers standing for the rest. A row's height is
 * estimated until it has been laid out once, and measured from then on; a row measured above the scroll position
 * moves the scroll position by the difference, so the rows in view stay where they are. Two rows stay mounted
 * wherever the list is scrolled: the one holding the keyboard focus, which would otherwise be lost with its row, and
 * the active member's, which is scrolled into view when the member is activated while out of it.
 *
 * What is kept per row, a measured height and a member's disclosure state, lasts for as long as the row is in the
 * active dataset.
 */
import { defineComponent, reactive, ref, Ref } from "vue"
import { T } from "#i18n"
import { DatasetResourceContext } from "@epicurrents/core/types"
import { useStore } from 'vuex'
import { useAppContext } from '../../config'
import {
    rowGaps,
    rowOffsets,
    rowRange,
    scrollShiftFor,
    scrollTopToShow,
    shownIndexes,
    type EntryDisclosure,
    type NavigatorRow,
} from './rows'
// Child components
import DatasetSelector from './DatasetSelector.vue'
import NavigatorEntry from './NavigatorEntry.vue'
import SystemFooter from '#app/footers/SystemFooter.vue'

/** How far past each edge of the viewport rows stay mounted, in pixels. */
const OVERSCAN = 300

/**
 * The heights of the rows in rem, which estimate a row that has not been laid out yet. An item's buttons take the
 * fixed height WebAwesome's `native.css` gives a plain button, 2.7em of the button's own font size rounded to a pixel,
 * so a member or a child is 2.7rem and the disclosure row, at 0.7rem and drawn 0.125rem into the row above it,
 * adds 1.75rem at a 16px root. The paddings and line heights in NavigatorItem's styles do not add up to these.
 */
const ESTIMATE = {
    child: 2.7,
    disclosure: 1.75,
    firstHeader: 1.5,
    header: 1.75,
    member: 2.7,
}

/** The scroller element, whose `content` part is the scroll container. */
type Scroller = HTMLElement & { content: HTMLElement, updateComplete: Promise<boolean> }

/** What the row list renders: a mounted row, or the height standing for the rows not mounted before one. */
type LayoutItem = { height: number, key: string, kind: 'gap' }
                  | { index: number, key: string, kind: 'row', row: NavigatorRow }

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
        /** Key of the row that holds the keyboard focus, or empty. */
        const focusedKey = ref('')
        const scrollTop = ref(0)
        const viewportHeight = ref(0)
        return {
            SETTINGS,
            focusedKey,
            layoutCounter,
            scrollTop,
            updateCounter,
            viewportHeight,
            // DOM
            rowList,
            scroller,
            wrapper,
            // Not reactive
            /** The dataset whose rows are listed, which tells a change of dataset from a change within one. */
            dataset: null as unknown,
            /** The disclosure state of each member of the active dataset, by resource id. */
            disclosures: new Map<string, EntryDisclosure>(),
            /** The pending animation frame of a scroll update. */
            frame: 0,
            /** The measured height of each row of the active dataset that has been laid out, by row key. */
            heights: new Map<string, number>(),
            /** The row elements being measured. */
            observed: new WeakSet<Element>(),
            /** Whether the active row is still to be scrolled into view, once the navigator has a height. */
            revealPending: false,
            /** The root font size in pixels, which converts the estimates. */
            rem: 16,
            rowObserver: null as ResizeObserver | null,
            viewportObserver: null as ResizeObserver | null,
        }
    },
    computed: {
        /** Key of the active member's row, or empty with no member active. */
        activeKey (): string {
            return this.rows.find(row => row.kind === 'member' && row.resource.isActive)?.key ?? ''
        },
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
        /** The mounted rows in list order, each preceded by the height of the rows not mounted before it. */
        layout (): LayoutItem[] {
            const items = [] as LayoutItem[]
            const gaps = rowGaps(this.offsets, this.shown)
            this.shown.forEach((index, position) => {
                const row = this.rows[index]
                if (gaps[position] > 0) {
                    items.push({ height: gaps[position], key: `gap-${position}`, kind: 'gap' })
                }
                items.push({ index, key: row.key, kind: 'row', row })
            })
            if (gaps[gaps.length - 1] > 0) {
                items.push({ height: gaps[gaps.length - 1], key: 'gap-after', kind: 'gap' })
            }
            return items
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
        /** The index of each row in the list, by row key. */
        rowIndex (): Map<string, number> {
            return new Map(this.rows.map((row, index) => [row.key, index]))
        },
        /** Indexes of the rows that are mounted: those within reach of the viewport, and the pinned ones. */
        shown (): number[] {
            const pinned = [this.activeKey, this.focusedKey].map(key => this.rowIndex.get(key) ?? -1)
            return shownIndexes(this.range, pinned, this.rows.length)
        },
        /** The rows that are mounted. */
        shownRows (): NavigatorRow[] {
            return this.shown.map(index => this.rows[index])
        },
    },
    watch: {
        rows () {
            this.pruneRows()
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
        /**
         * Note the row the keyboard focus entered, which stays mounted while it holds the focus.
         * @param event - A focus event from within the row list.
         */
        focusEntered (event: FocusEvent) {
            const row = (event.target as Element | null)?.closest?.('[data-row]') as HTMLElement | null
            this.focusedKey = row?.dataset.row ?? ''
        },
        /**
         * Release the focused row when the focus leaves the row list.
         * @param event - A focus event from within the row list.
         */
        focusLeft (event: FocusEvent) {
            const next = event.relatedTarget as Node | null
            if (!next || !this.rowList?.contains(next)) {
                this.focusedKey = ''
            }
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
        /**
         * Forget what is kept for rows the list no longer has: a measured height, a member's disclosure state and
         * the focus.
         */
        pruneRows () {
            const members = new Set<string>()
            for (const row of this.rows) {
                if (row.kind === 'member') {
                    members.add(row.resource.id)
                }
            }
            for (const id of [...this.disclosures.keys()]) {
                if (!members.has(id)) {
                    this.disclosures.delete(id)
                }
            }
            for (const key of [...this.heights.keys()]) {
                if (!this.rowIndex.has(key)) {
                    this.heights.delete(key)
                }
            }
            if (this.focusedKey && !this.rowIndex.has(this.focusedKey)) {
                this.focusedKey = ''
            }
        },
        /** Start the list of another dataset from nothing kept and from its top. */
        resetRows () {
            this.disclosures.clear()
            this.heights.clear()
            this.focusedKey = ''
            this.revealPending = false
            const content = this.scroller?.content
            if (content) {
                content.scrollTop = 0
            }
            this.scrollTop = 0
            this.layoutCounter++
        },
        /**
         * Scroll the active member's row into view when no part of it is. A navigator that is hidden has no viewport
         * to scroll, so the row is shown once it has one.
         */
        revealActiveRow () {
            const content = this.scroller?.content
            const index = this.rowIndex.get(this.activeKey)
            if (!content || index === undefined) {
                this.revealPending = false
                return
            }
            if (!content.clientHeight) {
                this.revealPending = true
                return
            }
            this.revealPending = false
            const top = scrollTopToShow(this.offsets, index, content.scrollTop, content.clientHeight)
            if (top !== null) {
                content.scrollTop = top
                this.scrollTop = content.scrollTop
            }
        },
        /**
         * Record the measured heights of rows, and lay the list out again if any changed. A row that lies above the
         * scroll position moves the rows in view by the change in its height, so the list is scrolled by as much.
         */
        rowsResized (entries: ResizeObserverEntry[]) {
            const content = this.scroller?.content
            const offsets = this.offsets
            const top = content?.scrollTop ?? this.scrollTop
            let changed = false
            let shift = 0
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
                    shift += scrollShiftFor(offsets, this.rowIndex.get(key) ?? -1, height, top)
                    this.heights.set(key, height)
                    changed = true
                }
            }
            if (changed) {
                this.layoutCounter++
                if (shift && content) {
                    content.scrollTop = top + shift
                    this.scrollTop = content.scrollTop
                }
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
        this.dataset = this.$store.state.APP.activeDataset
        this.$store.state.addEventListener([
            'add-resource',
            'remove-resource',
            'set-active-dataset',
            'set-active-resource',
        ], () => {
            const dataset = this.$store.state.APP.activeDataset
            if (dataset !== this.dataset) {
                this.dataset = dataset
                this.resetRows()
            }
            // I would REALLY like to avoid this, but it doesn't seem possible at the moment.
            this.updateCounter++
        }, this.$options.name || 'AppNavigator')
        this.$store.state.addEventListener(['set-active-resource'], () => {
            // After the rows have been computed again and the active member's row mounted.
            this.$nextTick(this.revealActiveRow)
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
                if (this.revealPending && content.clientHeight) {
                    this.revealActiveRow()
                }
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
    /* The navigator moves the scroll position itself when a row above it changes height; the browser's own
       anchoring on top of that would move it twice. */
    overflow-anchor: none;
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
