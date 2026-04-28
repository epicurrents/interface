<template>
    <div data-component="channel-highlights" ref="component">
        <template v-for="(highlight, idx) of highlights" :key="`highlight-${idx}`">
            <template v-if="highlight.background">
                <div v-for="(chan, idy) in highlight.channels" :key="`hl-${idx}-chan-${idy}`"
                    :id="`hl-element-${idx}`"
                    class="highlight-area"
                    :style="`position:absolute;${getBackgroundProperties(highlight, chan)}`"
                    :title="highlight.label"
                ></div>
            </template>
        </template>
        <template v-for="(annotation, idx) of annotations" :key="`annotation-${idx}`">
            <div v-for="(chan, idy) in annotation.channels" :key="`hl-${idx}-chan-${idy}`"
                :id="`hl-element-${idx}`"
                class="highlight-area"
                :style="`position:absolute;${getBackgroundProperties(annotation, chan)}`"
                :title="annotation.label"
            ></div>
        </template>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType, reactive, Ref, ref } from "vue"
import { T } from "#i18n"
import { settingsColorToRgba } from "@epicurrents/core/util"
import { SettingsColor } from "@epicurrents/core/types"
import { useStore } from "vuex"
import { useBiosignalContext } from "#config"
import type { PointerEventOverlay } from "#app/overlays/PointerEventOverlay.vue"
import { HighlightContext, SignalHighlight } from "#types/plot"

export default defineComponent({
    name: 'AnnotationLabels',
    props: {
        overlay: {
            type: Object as PropType<PointerEventOverlay>,
            required: true,
        },
        secPerPage: {
            type: Number,
            required: true,
        },
        SETTINGS: {
            type: Object,
            required: true,
        },
        viewRange: {
            type: Number,
            required: true,
        },
    },
    setup () {
        const store = useStore()
        const annotations = reactive([] as SignalHighlight[])
        const highlights = reactive([] as SignalHighlight[])
        // Template refs
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        // Unsubscribe from store mutations
        const unsubscribe = ref(null as (() => void) | null)
        return {
            annotations,
            highlights,
            // Template refs
            component,
            // Imported methods
            settingsColorToRgba,
            // Scope properties.
            ...useBiosignalContext(store, 'ChannelHighlights'),
            // Unsubscribers
            unsubscribe,
        }
    },
    watch: {
        msPerPage () {
            this.updateHighlights()
        },
    },
    computed: {
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
        getBackgroundProperties (highlight: SignalHighlight, chanIdx: number) {
            const montage = this.RESOURCE.activeMontage
            if (!montage) {
                return ''
            }
            const channel = montage.channels[chanIdx]
            if (!channel) {
                return ''
            }
            if (!highlight.color) {
                return
            }
            const range = [highlight.start, highlight.end]
            const overlayW = this.overlay.getOffsetWidth()
            const startX = (Math.max(range[0] - this.RESOURCE.viewStart, 0)/this.viewRange)*overlayW
            const endX = (Math.min(range[1] - this.RESOURCE.viewStart, this.viewRange)/this.viewRange)*overlayW
            const left = `${startX}px`
            const right = `${overlayW - endX}px`
            const top = `${100*(1 - channel.offset.top)}%`
            const bottom = `${100*channel.offset.bottom}%`
            // Color
            const bg = Array.isArray(highlight.opacity)
                       ? `background-image: linear-gradient(to right, ${settingsColorToRgba(highlight.color, highlight.opacity[0])},${settingsColorToRgba(highlight.color, highlight.opacity[1])})`
                       : `background-color:${settingsColorToRgba(highlight.color, highlight.opacity)}`
            return `top: ${top}; bottom: ${bottom}; left: ${left}; right: ${right}; ${bg}`
        },
        getPagePosition (startTime: number): number {
            return (startTime - this.RESOURCE.viewStart)/this.secPerPage
        },
        highlightColorToBgColor (color: SettingsColor) {
            const bgColor = [
                color[0],
                color[1],
                color[2],
                color[3]/10,
            ] as SettingsColor
            return settingsColorToRgba(bgColor)
        },
        montageChanged () {
            // Recording clears all update handlers from the previous montage,
            // we just need to add them to the new one.
            this.RESOURCE.activeMontage?.onPropertyChange('highlights', this.updateHighlights, this.ID)
            this.updateAnnotations()
            this.updateHighlights()
        },
        updateAnnotations () {
            this.annotations.splice(0)
            const montage = this.RESOURCE.activeMontage
            if (!montage) {
                return
            }
            /* Check which highlights are in range and only display those
            for (const anno of this.RESOURCE.annotations) {
                if (anno.visible === false) {
                    continue
                }
                const viewStart = this.RESOURCE.viewStart
                const viewEnd = this.RESOURCE.viewStart + this.viewRange
                const annoEnd = anno.start + anno.duration
                if (anno.start >= viewEnd || annoEnd <= viewStart) {
                    continue
                }
                const montChannels = [] as number[]
                for (const chan of anno.channels) {
                    for (let i=0; i<montage.channels.length; i++) {
                        const montChan = montage.channels[i]
                        if (montChan.active === chan) {
                            montChannels.push(i)
                        }
                    }
                }
                const chanAnno = {
                    channels: montChannels,
                    color: this.SETTINGS.annotations.classes.default.color,
                    end: annoEnd,
                    label: anno.label,
                    opacity: 0.15,
                    start: anno.start,
                    visible: anno.visible !== undefined ? anno.visible : true,
                } as SignalHighlight
                for (const [annoClass, props] of Object.entries(this.SETTINGS.annotations.classes)) {
                    if (anno.class === annoClass) {
                        chanAnno.color = (props as any).color as SettingsColor
                        break
                    }
                }
                for (const [typeName, color] of Object.entries(this.SETTINGS.annotations.typeColors)) {
                    if (anno.type?.startsWith(typeName)) {
                        chanAnno.color = color as SettingsColor
                        break
                    }
                }
                this.annotations.push(chanAnno)
            }
            */
        },
        updateHighlights () {
            this.highlights.splice(0)
            const montage = this.RESOURCE.activeMontage
            if (!montage) {
                return
            }
            const viewStart = this.RESOURCE.viewStart
            const viewEnd = this.RESOURCE.viewStart + this.viewRange
            for (const [_source, ctx] of Object.entries(montage.highlights) as [string, HighlightContext][]) {
                if (!ctx.visible) {
                    continue
                }
                for (const highlight of ctx.highlights) {
                    if (!highlight.visible) {
                        continue
                    }
                    // Highlights are sorted by start — anything past viewEnd means
                    // all subsequent entries are also out of range.
                    if (highlight.start >= viewEnd) {
                        break
                    }
                    if (highlight.end <= viewStart) {
                        continue
                    }
                    // Resolve display colour without mutating the source highlight.
                    // Priority: classColors lookup → own color → plotDisplay fallback.
                    // The mode (uniform vs by-class) is encoded in which classColors map is
                    // stored on the context, so no separate colorMode check is needed.
                    let color: SettingsColor | undefined = highlight.color
                    if (!color && highlight.class) {
                        const classColor = ctx.classColors?.[highlight.class]
                        if (classColor) {
                            color = classColor
                        }
                    }
                    if (!color) {
                        if (!ctx.plotDisplay) {
                            continue
                        }
                        color = ctx.plotDisplay.color
                    }
                    this.highlights.push({ ...highlight, color })
                }
            }
        },
        viewStartChanged () {
            this.updateAnnotations()
            this.updateHighlights()
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
        // Add property update handlers
        this.RESOURCE.onPropertyChange('activeMontage', this.montageChanged, this.ID)
        this.RESOURCE.onPropertyChange('displayViewStart', this.viewStartChanged, this.ID)
        this.RESOURCE.activeMontage?.onPropertyChange('highlights', this.updateHighlights, this.ID)
        this.$nextTick(() => {
            this.updateAnnotations()
            this.updateHighlights()
        })
    },
    beforeUnmount () {
        // Remove property update handlers
        this.RESOURCE.removeAllEventListeners(this.ID)
        this.RESOURCE.activeMontage?.removeAllEventListeners(this.ID)
        this.$store.state.SERVICES.get('ONNX')?.removeAllEventListeners(this.ID)
    }
})
</script>

<style scoped>
[data-component="channel-highlights"] {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
</style>
