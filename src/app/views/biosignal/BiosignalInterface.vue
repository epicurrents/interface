<template>
    <div data-component="biosignal-interface"
        :id="`epicurrents-biosignal-interface-${$store.state.APP.id}`"
        ref="interface"
    >
        <component v-if="$store.state.APP.uiComponentVisible.controls && !$store.state.INTERFACE.app.isExpanded"
            class="controls"
            :is="CONTROLS[$store.state.APP.activeModality || 'default']"
            :key="`biosignal-controls-${$store.state.APP.activeModality}`"
            ref="controls"
            v-on:set-cursor-tool="setCursorTool"
            v-on:set-open-drawer="setOpenDrawer"
            v-on:toggle-navigation="$emit('toggle-navigation')"
        >
        </component>
        <component :is="SETTINGS.isMainComponent ? 'main' : 'div'"
            class="viewer"
            :key="`biosignal-viewer-${$store.state.APP.activeModality}`"
            ref="viewer"
            :style="viewerStyles"
        >
            <!-- Scoped view -->
            <template v-for="resource in activeResources" :key="`viewer-${resource.id}`">
                <component :is="VIEWERS[resource.modality]" ref="viewer"
                    :viewerSize="singleViewerSize"
                />
            </template>
        </component>
        <component v-if="$store.state.APP.uiComponentVisible.footer && !$store.state.INTERFACE.app.isExpanded"
            class="footer"
            :is="FOOTERS[$store.state.APP.activeModality || 'default']"
            :key="`biosignal-footer-${$store.state.APP.activeModality}`"
            ref="footer"
        >
        </component>
    </div>
</template>

<script lang="ts">
import { defineComponent, reactive, ref, Ref, ComponentPublicInstance } from "vue"
import { T } from "#i18n"
import type { DataResource } from "@epicurrents/core/types"
import { useStore } from "vuex"

// Child components
import ControlsBar from '#app/controls/ControlsBar.vue'
import BiosignalFooter from './footers/BiosignalFooter.vue'
import { useContext } from "#root/src/config"

export default defineComponent({
    name: "BiosignalInterface",
    components: {
        BiosignalFooter,
        ControlsBar,
    },
    props: {
        controlsComponent: {
            type: String,
            default: null,
        },
        footerComponent: {
            type: String,
            default: null,
        },
        navigatorComponent: {
            type: String,
            default: null,
        },
        selectorComponent: {
            type: String,
            default: null,
        },
    },
    setup () {
        //const store = useStore()
        const SETTINGS = useStore().state.SETTINGS.app
        // Expandable list of resource type viewers.
        const CONTROLS: { [name: string]: new () => ComponentPublicInstance<unknown> } = {
            default: ControlsBar,
        }
        const FOOTERS: { [name: string]: new () => ComponentPublicInstance<unknown> } = {
            default: BiosignalFooter,
        }
        const VIEWERS: { [name: string]: new () => ComponentPublicInstance<unknown> } = {}
        const activeResources = reactive([] as DataResource[])
        const rso = null as ResizeObserver | null
        const viewerHeight = ref(0)
        const viewerWidth = ref(0)
        // Unsubscribe from store mutations.
        const unsubscribe = null as null | (() => void)
        // DOM
        const controls = ref<typeof ControlsBar>() as Ref<typeof ControlsBar>
        const footer = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const viewer = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            CONTROLS,
            FOOTERS,
            SETTINGS,
            VIEWERS,
            activeResources,
            rso,
            viewerHeight,
            viewerWidth,
            unsubscribe,
            controls,
            footer,
            viewer,
        }
    },
    computed: {
        sidebarOpen (): boolean {
            // Check for open sidebars.
            return false
        },
        /**
         * The size of a single media container
         */
        singleViewerSize (): number[] {
            return [
                this.viewerWidth/this.activeResources.length,
                this.viewerHeight
            ]
        },
        viewerStyles (): string {
            let styles = ''
            if (!this.$store.state.APP.uiComponentVisible.controls) {
                styles += 'grid-row-start: top-margin;'
            }
            if (!this.$store.state.APP.uiComponentVisible.footer) {
                styles += 'grid-row-end: bottom-edge;'
            }
            return styles
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
         * Update active media resources.
         */
        checkActiveResources () {
            this.activeResources.length = 0
            const activeRes = this.$store.state.APP.activeDataset?.activeResources
            const modality = this.$store.state.APP.activeModality
            if (!activeRes || !modality) {
                return
            }
            // Update active resources and confirm that this is the right interface for the modality.
            const activeResources = [] as DataResource[]
            // There can be multiple resource windows open at the same time.
            for (const res of activeRes.filter(r => r.modality === this.$store.state.APP.activeModality)) {
                activeResources.push(res)
                const viewType = useContext(this.$store, res.modality).SETTINGS.compatibleView
                if (viewType !== 'biosignal') {
                    // This interface is not suitable for this modality.
                    return
                }
            }
            // Select the appropriate control, footer and viewer components.
            if (!Object.hasOwn(this.CONTROLS, modality)) {
                this.CONTROLS[modality] = this.$store.getters.getResourceControls()
            }
            if (!Object.hasOwn(this.FOOTERS, modality)) {
                this.FOOTERS[modality] = this.$store.getters.getResourceFooter()
            }
            if (!Object.hasOwn(this.VIEWERS, modality)) {
                this.VIEWERS[modality] = this.$store.getters.getResourceViewer()
            }
            this.activeResources.push(...activeResources)
        },
        setCursorTool (value: string | null) {
            this.$store.dispatch('set-cursor-tool', value)
        },
        setOpenDrawer (value: string | null) {
            this.$store.dispatch('set-open-drawer', value)
        },
        //footerUpdate (update: [any, any]) {
            //this.footer?.update(update)
        //},
        viewerResized (elements?: ResizeObserverEntry[]) {
            // Check that the element still exists (this method may also fired when the component is destroyed).
            if (!elements?.length) {
                this.viewerWidth = this.viewer?.offsetWidth || 0
                this.viewerHeight = this.viewer?.offsetHeight || 0
            } else {
                this.viewerWidth = elements[0].borderBoxSize[0].inlineSize
                this.viewerHeight = elements[0].borderBoxSize[0].blockSize
            }
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this.unsubscribe = this.$store.subscribe(async (mutation) => {
            if (mutation.type === 'set-active-resource' || mutation.type === 'set-active-dataset') {
                // Update active resources list and resize observer when the active resource changes.
                if (!mutation.payload) {
                    // Disconnect the observer from the old viewer element.
                    this.rso?.disconnect()
                    this.rso = null
                    this.checkActiveResources()
                } else {
                    this.$nextTick(() => {
                        if (this.viewer) {
                            this.checkActiveResources()
                            this.viewerResized()
                            // Reconnect the observer.
                            this.rso = new ResizeObserver(this.viewerResized)
                            this.rso.observe(this.viewer)
                        }
                    })
                }
            }
        })
        // Set up resize observer for the media container.
        this.rso = new ResizeObserver(this.viewerResized)
        this.rso.observe(this.viewer)
        this.$store.dispatch('display-viewer')
        this.checkActiveResources()
    },
    beforeUnmount () {
        if (this.unsubscribe) {
            this.unsubscribe()
        }
        this.rso?.disconnect()
    },
})
</script>

<style scoped>
[data-component="biosignal-interface"] {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background-color: var(--epicv-background);
}
.controls {
    position: relative;
    flex-basis: calc(2.25rem + 1px);
    max-height: calc(2.25rem + 1px);
}
.viewer {
    position: relative;
    flex: 1;
    overflow: hidden;
}
.footer {
    position: relative;
    flex-basis: calc(1.5rem + 1px);
}
</style>
