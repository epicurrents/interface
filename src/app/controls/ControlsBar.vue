<template>
    <div data-component="controls-bar">
        <div class="sidebar-controls">
            <wa-button
                appearance="epicv"
                id="toggle-dataset-button"
                variant="brand"
                @click="toggleNavigation"
            >
                <app-icon name="bars"></app-icon>
            </wa-button>
            <wa-tooltip for="toggle-dataset-button">
                {{ $t('Toggle dataset') }}
            </wa-tooltip>
            <wa-button
                appearance="epicv"
                :disabled="!hasPrevResource"
                id="previous-resource-button"
                variant="brand"
                @click="hasPrevResource ? openPrevResource() : null"
            >
                <app-icon name="chevron-up"></app-icon>
            </wa-button>
            <wa-tooltip :disabled="!hasPrevResource" for="previous-resource-button">
                {{ $t('Previous resource') }}
            </wa-tooltip>
            <wa-button
                appearance="epicv"
                :disabled="!hasNextResource"
                id="next-resource-button"
                variant="brand"
                @click="hasNextResource ? openNextResource() : null"
            >
                <app-icon name="chevron-down"></app-icon>
            </wa-button>
            <wa-tooltip :disabled="!hasNextResource" for="next-resource-button">
                {{ $t('Next resource') }}>
            </wa-tooltip>
        </div>
        <div v-if="hasActiveResource" class="module-controls">
            <template v-for="(control, idx) of controlsLeft" :key="`control-${control.id}-${control.version}`">
                <component :is="`${control.type}-control`"
                    :id="control.id"
                    :enabled="control.enabled"
                    :firstInRow="idx === 0"
                    :groups="control.groups"
                    :iconName="control.iconName"
                    :joinLeft="control.joinLeft"
                    :joinRight="control.joinRight"
                    :label="control.label"
                    :navButtons="control.navButtons"
                    :options="control.options"
                    :onclick="control.onclick"
                    :placeholder="control.placeholder"
                    :prefix="control.prefix"
                    :reloadOn="control.reloadOn"
                    :suffix="control.suffix"
                    :value="control.value"
                    :style="`flex-basis:${control.width}`"
                    v-on:reload="$emit('reload', control)"
                    v-on:selected="$emit('selected', $event)"
                >
                </component>
            </template>
            <div class="separator"></div>
            <template v-for="(control, idx) of controlsRight" :key="`control-${control.id}-${control.version}`">
                <component :is="`${control.type}-control`"
                    :id="control.id"
                    :enabled="control.enabled"
                    :firstInRow="idx === 0"
                    :groups="control.groups"
                    :iconName="control.iconName"
                    :joinLeft="control.joinLeft"
                    :joinRight="idx === controlsRight.length - 1"
                    :label="control.label"
                    :navButtons="control.navButtons"
                    :options="control.options"
                    :onclick="control.onclick"
                    :placeholder="control.placeholder"
                    :prefix="control.prefix"
                    :reloadOn="control.reloadOn"
                    :suffix="control.suffix"
                    :value="control.value"
                    :style="`flex-basis:${control.width}`"
                    v-on:reload="$emit('reload', control)"
                    v-on:selected="$emit('selected', $event)"
                >
                </component>
            </template>
        </div>
    </div>
</template>

<script lang="ts">
/**
 * This component is responsible for displaying all the tools and other control elements
 * of the interface.
 */
import { defineComponent, reactive, ref, PropType } from "vue"
import { T } from "#i18n"
//import { useStore } from "vuex"
import { DataResource } from "@epicurrents/core/types"
import type { ControlElement } from '#types/interface'

// Child components.
// These have to be imported directly to avoid race-condition issues when the component is loaded for the first time.
import ButtonControl from '#app/controls/ButtonControl.vue'
import DropdownControl from '#app/controls/DropdownControl.vue'
import OnOffControl from '#app/controls/OnOffControl.vue'
const CONTROLS = {
    ButtonControl,
    DropdownControl,
    OnOffControl,
}

export default defineComponent({
    name: 'AppControls',
    components: {
        ...CONTROLS
    },
    props: {
        controlsLeft: {
            type: Array as PropType<ControlElement[]>,
            default: [],
        },
        controlsRight: {
            type: Array as PropType<ControlElement[]>,
            default: [],
        },
    },
    setup () {
        const allResources = reactive([] as DataResource[])
        const hasActiveResource = ref(false)
        const hasNextResource = ref(false)
        const hasPrevResource = ref(false)
        return {
            allResources,
            hasActiveResource,
            hasNextResource,
            hasPrevResource,
            // Unsubscribers
        }
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
        checkResourcePosition () {
            this.allResources = []
            const sortedResources = this.$store.state.APP.activeDataset?.sortedResources || []
            for (const [_cat, ctx] of sortedResources) {
                this.allResources.push(...ctx.map(c => c.resource))
            }
            const resId = this.$store.getters.getActiveResource()?.id
            if (!resId) {
                this.hasNextResource = false
                this.hasPrevResource = false
            } else {
                const allIds = this.allResources.map(r => r.id)
                this.hasPrevResource = allIds.indexOf(resId) > 0
                this.hasNextResource = allIds.indexOf(resId) < allIds.length - 1
            }
        },
        closeActiveResource () {
            const resource = this.$store.getters.getActiveResource()
            if (!resource) {
                return
            }
            this.$store.dispatch('set-active-resource', null)
        },
        handleKeyup (event: KeyboardEvent) {
            if (event.code === 'Backquote') {
                if (event.altKey) {
                    // Open the next or previous item if alt/cmd key is pressed when toggling dataset.
                    if (event.shiftKey) {
                        this.openPrevResource()
                    } else {
                        this.openNextResource()
                    }
                } else {
                    this.toggleNavigation()
                }
            }
        },
        openNextResource () {
            const resource = this.$store.getters.getActiveResource()
            if (!resource || !this.hasNextResource) {
                return
            }
            const resIdx = this.allResources.map(r => r.id).indexOf(resource.id)
            const nextRes = this.allResources[resIdx + 1]
            this.$store.dispatch('set-active-resource', nextRes)
            /*
            if (nextRes.activeModality === 'doc') {
                const nextIdx = this.$store.state.DOC.resources.map(r => r.id).indexOf(nextRes.id)
                this.$store.dispatch('set-active-doc', nextIdx)
            } else if (nextRes.type === 'eeg') {
                const nextIdx = this.$store.state.EEG.resources.map(r => r.id).indexOf(nextRes.id)
                this.$store.dispatch('set-active-eeg', nextIdx)
            } else if (nextRes.type === 'emg') {
                const nextIdx = this.$store.state.EMG.resources.map(r => r.id).indexOf(nextRes.id)
                this.$store.dispatch('set-active-emg', nextIdx)
            } else if (nextRes.type === 'ncs') {
                const nextIdx = this.$store.state.NCS.resources.map(r => r.id).indexOf(nextRes.id)
                this.$store.dispatch('set-active-ncs', nextIdx)
            }
            */
        },
        openPrevResource () {
            const resource = this.$store.getters.getActiveResource()
            if (!resource || !this.hasPrevResource) {
                return
            }
            const resIdx = this.allResources.map(r => r.id).indexOf(resource.id)
            const prevRes = this.allResources[resIdx - 1]
            this.$store.dispatch('set-active-resource', prevRes)
            /*
            if (prevRes.activeModality === 'doc') {
                const prevIdx = this.$store.state.DOC.resources.map(r => r.id).indexOf(prevRes.id)
                this.$store.dispatch('set-active-doc', prevIdx)
            } else if (prevRes.type === 'eeg') {
                const prevIdx = this.$store.state.EEG.resources.map(r => r.id).indexOf(prevRes.id)
                this.$store.dispatch('set-active-eeg', prevIdx)
            } else if (prevRes.type === 'emg') {
                const prevIdx = this.$store.state.EMG.resources.map(r => r.id).indexOf(prevRes.id)
                this.$store.dispatch('set-active-emg', prevIdx)
            } else if (prevRes.type === 'ncs') {
                const prevIdx = this.$store.state.NCS.resources.map(r => r.id).indexOf(prevRes.id)
                this.$store.dispatch('set-active-ncs', prevIdx)
            }
            */
        },
        toggleNavigation () {
            this.$emit('toggle-navigation')
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
        window.addEventListener('keyup', this.handleKeyup, false)
        this.$store.state.addEventListener('set-active-resource', () => {
            this.hasActiveResource = false
        }, this.$options.name!, 'before')
        this.$store.state.addEventListener('set-active-resource', (newResource: unknown) => {
            this.hasActiveResource = newResource !== null
            this.checkResourcePosition()
        }, this.$options.name!)
        this.$store.state.addEventListener('add-resource', () => {
            this.checkResourcePosition()
        }, this.$options.name!)
        this.hasActiveResource = this.$store.getters.getActiveResource() !== null
        this.checkResourcePosition()
    },
    beforeUnmount () {
        window.removeEventListener('keyup', this.handleKeyup, false)
        this.$store.state.removeAllEventListeners(this.$options.name)
    },
})
</script>

<style scoped>
[data-component="controls-bar"] {
    display: flex;
    position: relative;
    height: 100%;
    border-bottom: solid 1px var(--epicv-border);
    overflow: visible;
    z-index: 6;
}
.sidebar-controls {
    height: 2.25rem;
    flex: 0 0 5rem;
    padding: 0 0.25rem;
    background-color: var(--epicv-background);
}
    .sidebar-controls wa-button::part(base)  {
        border: none;
        border-radius: 0;
        font-size: 0.75rem;
        width: 1.25rem;
        height: 2.25rem;
    }
    .sidebar-controls wa-button::part(label)  {
        font-size: 0.8rem;
    }
    .sidebar-controls wa-button::part(base):focus  {
        outline: none;
        box-shadow: inset 0 0 0.5em var(--epicv-border-active);
    }
.module-controls {
    flex-grow: 1;
    display: flex;
    height: 100%;
    overflow: visible;
}
    .module-controls > * {
        flex-grow: 0;
    }
    .module-controls .separator {
        height: 2.25rem;
        flex-grow: 1 !important;
    }
</style>
