<template>
    <div data-component="dataset-navigator"
        :is="SETTINGS.isMainComponent ? 'aside' : 'div'"
    >
        <dataset-selector
            v-on:create-dataset="$emit('create-dataset')"
        ></dataset-selector>
        <wa-scroller class="items" orientation="vertical">
            <template v-for="([key, value]) of sortedResources.entries()" :key="`nav-group-${key}`">
                <!-- Sorting by type -->
                <div v-if="key === 'htm'" class="header">{{ $t('Pages') }}</div>
                <div v-else-if="key === 'pdf'" class="header">{{ $t('Documents') }}</div>
                <div v-else-if="key === 'eeg'" class="header">{{ $t('EEG') }}</div>
                <div v-else-if="key === 'meg'" class="header">{{ $t('MEG') }}</div>
                <div v-else-if="key === 'emg'" class="header">{{ $t('EMG') }}</div>
                <div v-else-if="key === 'ncs'" class="header">{{ $t('NCS') }}</div>
                <navigator-item v-for="(ctx, idx) in value"
                    :key="`navigator-item-${idx}`"
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
import NavigatorItem from './NavigatorItem.vue'
import SystemFooter from '#app/footers/SystemFooter.vue'

export default defineComponent({
    name: 'AppNavigator',
    components: {
        DatasetSelector,
        NavigatorItem,
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
        sortedResources (): Map<string, DatasetResourceContext[]> {
            const sortedResources = new Map<string, DatasetResourceContext[]>()
            const activeSet = this.$store.state.APP.activeDataset
            this.updateCounter
            if (activeSet instanceof Promise) {
                // Wait for fulfillment
                return sortedResources
            }
            if (!activeSet) {
                return sortedResources
            }
            const activeSetResources = activeSet.resources
            if (!activeSetResources.length) {
                return sortedResources
            }
            if (
                activeSet.resourceSorting.scheme === 'modality'
            ) {
                for (const [key, resources] of activeSet.sortedResources.entries()) {
                    sortedResources.set(key, resources)
                }
                return sortedResources
            } else if (
                activeSet.resourceSorting.scheme === 'alphabetical' ||
                activeSet.resourceSorting.scheme === 'id'
            ) {
                const resourceList = []
                for (const [_key, resources] of activeSet.sortedResources.entries()) {
                    resourceList.push(...resources)
                }
                sortedResources.set('@', resourceList)
            }
            return activeSet.sortedResources
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
        this.$store.state.addEventListener(['add-resource', 'set-active-dataset', 'set-active-resource'], () => {
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
    gap: 0.25rem;
    padding: 0.25rem;
}
.items {
    border-right: solid 1px var(--epicv-border);
    flex: 1;
    overflow: auto;
}
.header {
    height: 2rem;
    line-height: 2rem;
    padding: 0 5px;
    background-color: var(--epicv-background-highlight);
    font-variant: small-caps;
}
</style>
