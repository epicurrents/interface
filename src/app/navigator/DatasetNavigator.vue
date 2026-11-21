<template>
    <div data-component="dataset-navigator"
        :is="SETTINGS.isMainComponent ? 'aside' : 'div'"
    >
        <dataset-selector
            v-on:create-dataset="$emit('create-dataset')"
        ></dataset-selector>
        <wa-scroller class="items" orientation="vertical">
            <template v-for="group of groups" :key="`nav-group-${group.key}`">
                <div v-if="group.header" class="header">{{ group.header }}</div>
                <navigator-entry v-for="ctx in group.resources"
                    :key="`navigator-entry-${ctx.resource.id}`"
                    :resource="ctx.resource"
                />
            </template>
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
 */
import { defineComponent, ref, Ref } from "vue"
import { T } from "#i18n"
import { DatasetResourceContext } from "@epicurrents/core/types"
import { useStore } from 'vuex'
import { useAppContext } from '../../config'
// Child components
import DatasetSelector from './DatasetSelector.vue'
import NavigatorEntry from './NavigatorEntry.vue'
import SystemFooter from '#app/footers/SystemFooter.vue'

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
        return {
            SETTINGS,
            updateCounter,
            // DOM
            wrapper,
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
    },
    beforeUnmount () {
        this.$store.state.removeAllEventListeners(this.$options.name || 'AppNavigator')
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
.header {
    color: var(--epicv-text-minor);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    line-height: 1rem;
    padding: 0.5rem 0.5rem 0.25rem 1.25rem;
    text-transform: uppercase;
}
    .header:first-child {
        padding-top: 0.25rem;
    }
</style>
