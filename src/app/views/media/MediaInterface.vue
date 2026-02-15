<template>
    <div data-component="media-interface"
        :id="`epicurrents-media-interface-${$store.state.APP.id}`"
        ref="wrapper"
    >
        <component v-if="$store.state.APP.uiComponentVisible.controls && !$store.state.INTERFACE.app.isExpanded"
            class="controls"
            :is="CONTROLS[$store.state.APP.activeModality || 'default']"
            ref="controls"
            v-on:toggle-navigation="$emit('toggle-navigation')"
        ></component>
        <component :is="SETTINGS.isMainComponent ? 'main' : 'div'"
            ref="viewer"
            class="viewer"
            :style="viewerStyles"
        >
            <!-- Scoped view -->
            <template v-for="resource in activeResources" :key="`viewer-${resource.id}`">
                <component v-if="VIEWERS[resource.modality]" :is="VIEWERS[resource.modality]" ref="viewer"
                    :viewerSize="singleViewerSize"
                />
                <div v-else class="unsupported">
                    <app-icon class="inline" name="triangle-exclamation"></app-icon>
                    {{ $t('Unsupported media format.') }}
                </div>
            </template>
        </component>
        <component v-if="$store.state.APP.uiComponentVisible.footer && !$store.state.INTERFACE.app.isExpanded"
            class="footer"
            :is="FOOTERS[$store.state.APP.activeModality || 'default']"
            ref="footer"
        >
        </component>
    </div>
</template>

<script lang="ts">
import { ComponentPublicInstance, defineComponent, PropType, reactive, ref, Ref } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import type { DataResource } from "@epicurrents/core/types"

// Child components
import ControlsBar from '#app/controls/ControlsBar.vue'
import DefaultFooter from '#app/footers/DefaultFooter.vue'
import { useContext } from "#root/src/config"

export default defineComponent({
    name: "MediaInterface",
    components: {
    },
    props: {
        type: {
            type: String as PropType<'audio' | 'image' | 'video'>,
            default: '',
        },
    },
    setup () {
        const CONTROLS: { [name: string]: new () => ComponentPublicInstance<unknown> } = {
            default: ControlsBar,
        }
        const FOOTERS: { [name: string]: new () => ComponentPublicInstance<unknown> } = {
            default: DefaultFooter,
        }
        const VIEWERS: { [name: string]: new () => ComponentPublicInstance<unknown> } = {}
        const SETTINGS = useStore().state.SETTINGS.app
        const activeResources = reactive([] as DataResource[])
        const rso = null as ResizeObserver | null
        const viewerHeight = ref(0)
        const viewerWidth = ref(0)
        // Unsubscribe from store mutations.
        const unsubscribe = null as null | (() => void)
        // DOM.
        const viewer = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const wrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
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
            viewer,
            wrapper,
        }
    },
    computed: {
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
            this.activeResources.splice(0)
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
                if (viewType !== 'media') {
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
            this.activeResources.splice(0, this.activeResources.length, ...activeResources)
        },
        //footerUpdate (update: [any, any]) {
            //this.footer?.update(update)
        //},
        getMediaElement (resource: DataResource) {
            if (resource.modality === 'audio') {
                return 'audio'
            } else if (resource.modality === 'image') {
                return 'img'
            } else if (resource.modality === 'video') {
                return 'video'
            }
            return null
        },
        viewerResized (elements: ResizeObserverEntry[]) {
            // Resize the viewer to fit the wrapper.
            if (elements.length > 0) {
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
        this.unsubscribe = this.$store.subscribe(mutation => {
            if (mutation.type === 'set-active-resource' || mutation.type === 'set-active-dataset') {
                this.$nextTick(() => {
                    this.checkActiveResources()
                })
            }
        })
        // Set up resize observer for the media container
        this.rso = new ResizeObserver(this.viewerResized)
        this.rso.observe(this.viewer)
        this.$store.dispatch('display-viewer')
        this.checkActiveResources()
    },
    beforeUnmount () {
        // Remove all listeners and observers.
        this.rso?.disconnect()
        if (this.unsubscribe) {
            this.unsubscribe()
        }
    },
})
</script>

<style scoped>
[data-component="media-interface"] {
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
    align-items: center;
    display: flex;
    flex: 1;
    justify-content: center;
    overflow: hidden;
}
.unsupported {
    font-size: 2rem;
}
    .unsupported sl-icon {
        color: var(--epicv-warning);
    }
.footer {
    position: relative;
    flex-basis: calc(1.5rem + 1px);
}
</style>
