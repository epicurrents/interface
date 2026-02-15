<template>
    <div data-component="settings-calibrator">
        <svg ref="svg" :viewBox="`0 0 ${svgWidth} ${height}`"
            @pointerdown="handlePointerdown"
            @pointerleave="handlePointerLeave"
            @pointermove="handlePointermove"
        >
            <line
                :x1="svgLeftPad" :x2="rulerLength + svgLeftPad"
                :y1="0.9*height" :y2="0.9*height"
                stroke="currentColor"
                stroke-width="1"
            />
            <line v-for="i in 5" :key="`screen-ppi-major-line-${i}`"
                :x1="(i-1)*rulerLength/5 + svgLeftPad"
                :x2="(i-1)*rulerLength/5 + svgLeftPad"
                :y1="0.1*height" :y2="0.9*height"
                stroke="currentColor"
                stroke-width="2"
            />
            <line :key="`screen-ppi-major-line-end`"
                :x1="rulerLength + svgLeftPad"
                :x2="rulerLength + svgLeftPad"
                :y1="0.1*height" :y2="0.9*height"
                stroke="currentColor"
                :stroke-width="pointerOverDragZone ? 4 : 2"
            />
            <line v-for="i in 5" :key="`screen-ppi-minor-line-${i}`"
                :x1="(i-0.5)*rulerLength/5 + svgLeftPad"
                :x2="(i-0.5)*rulerLength/5 + svgLeftPad"
                :y1="0.5*height" :y2="0.9*height"
                stroke="currentColor"
                stroke-width="1"
            />
        </svg>
        <div ref="subtitle"
            class="subtitle"
        >
            {{ $t("PPI:") }}
            <wa-input type="number" size="small" step="1" :value="screenPPI" @input="inputPPI"></wa-input>
        </div>
    </div>
</template>

<script lang="ts">
/**
 * Calibrator for screen PPI.
 */
import { defineComponent, reactive, ref, Ref } from "vue"
import { T } from "#i18n"
import { NO_POINTER_BUTTON_DOWN } from "#util"

const CURSOR_MARGIN = 10

export default defineComponent({
    name: 'ScreenCalibrator',
    components: {
    },
    props: {
        default: {
            type: Number,
            default: 96,
        },
        height: {
            type: Number,
            default: 50,
        },
    },
    setup (props) {
        const dragging = ref(false)
        const pointerButton = ref(NO_POINTER_BUTTON_DOWN)
        const pointerDragHandlers = reactive([] as ((event?: PointerEvent) => void)[])
        const pointerOverDragZone = ref(false)
        /** Store temporary PPI value here and update settings only after drag end. */
        const screenPPI = ref(props.default)
        /** The padding between ruler end and SVG left edge. */
        const svgLeftPad = 4
        const svgWidth = ref(600)
        const subtitle = ref<SVGElement>() as Ref<SVGElement>
        const svg = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            dragging,
            pointerButton,
            pointerDragHandlers,
            pointerOverDragZone,
            screenPPI,
            svgLeftPad,
            svgWidth,
            subtitle,
            svg,
        }
    },
    computed: {
        rulerLength (): number {
            return 10*this.screenPPI/2.54 + this.svgLeftPad
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
        addPointerDragHandler (handler: ((event?: PointerEvent) => void)) {
            this.pointerDragHandlers.push(handler)
        },
        cancelPointerDrag (event?: PointerEvent) {
            while (this.pointerDragHandlers.length) {
                const handler = this.pointerDragHandlers.shift()
                if (handler) {
                    handler(event)
                }
            }
            this.screenPPI = this.$store.state.INTERFACE.app.screenPPI
        },
        endPointerDrag (_event?: PointerEvent) {
            this.pointerDragHandlers = []
            this.dragging = false
            this.$emit('value-changed', this.screenPPI)
        },
        /**
         * Handle pointer down event on the SVG.
         */
        handlePointerdown (event: PointerEvent) {
            // Cancel drag if right mouse button is pressed while left button is dragging
            if (this.pointerButton === 0 && event.button === 2) {
                this.cancelPointerDrag()
                return
            }
            // Prevent additional pointer events (like pressing down a second pointer button) during drag
            if (this.pointerButton !== NO_POINTER_BUTTON_DOWN) {
                return
            }
            // Only respond to left mouse button
            if (event.button !== 0) {
                this.pointerButton = NO_POINTER_BUTTON_DOWN
                return
            }
            this.pointerButton = event.button
            const contLeft = this.svg.getBoundingClientRect().left
            // Check if cursor is close to the ruler end.
            const pointerX = event.clientX - contLeft
            const rulerEndX = this.rulerLength + this.svgLeftPad
            if (pointerX >= rulerEndX - CURSOR_MARGIN && pointerX <= rulerEndX + CURSOR_MARGIN) {
                this.dragging = true
                const startOffset = pointerX - rulerEndX
                const pointerMove = (event: PointerEvent) => {
                    const moveX = event.clientX - contLeft
                    this.screenPPI = Math.round(2.54*(moveX - startOffset - this.svgLeftPad)/10)
                }
                const pointerUp = (event: PointerEvent) => {
                    // Only end drag event if the original button is released
                    if (event.button !== this.pointerButton) {
                        return
                    }
                    removeHandlers()
                    this.endPointerDrag()
                }
                const removeHandlers = () => {
                    this.dragging = false
                    this.pointerButton = NO_POINTER_BUTTON_DOWN
                    this.svg.removeEventListener('pointermove', pointerMove)
                    this.svg.removeEventListener('pointerup', pointerUp)
                }
                this.svg.addEventListener('pointermove', pointerMove)
                this.svg.addEventListener('pointerup', pointerUp)
                // Add removeHandlers to pointerDragHandlers so it will executed if the operation in cancelled
                this.addPointerDragHandler(removeHandlers)
            }
        },
        handlePointerLeave (event: PointerEvent) {
            this.pointerOverDragZone = false
            // Execute possible stored drag event handlers
            this.cancelPointerDrag(event)
        },
        handlePointermove (event: PointerEvent) {
            const contLeft = this.svg.getBoundingClientRect().left
            // Check if cursor is close to the ruler end and update cursor accordingly.
            const pointerX = event.clientX - contLeft
            const rulerEndX = this.rulerLength + this.svgLeftPad
            if (pointerX >= rulerEndX - CURSOR_MARGIN && pointerX <= rulerEndX + CURSOR_MARGIN) {
                this.pointerOverDragZone = true
                this.svg.style.cursor = 'pointer'
            } else {
                this.pointerOverDragZone = false
                this.svg.style.cursor = 'initial'
            }
        },
        inputPPI (event: CustomEvent) {
            const target = event.target as HTMLInputElement
            if (!target) {
                return
            }
            this.screenPPI = target.value ? parseInt(target.value) : this.default
            this.$emit('value-changed', this.screenPPI)
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
        this.$nextTick(() => {
            this.svgWidth = this.svg.parentElement?.offsetWidth || this.svgWidth
            this.$emit('loaded')
        })
        this.subtitle.style.paddingLeft = `${this.svgLeftPad}px`
    },
})
</script>

<style scoped>
[data-component="settings-calibrator"] {
    width: 100%;
    margin-bottom: 0.5rem;
}
.subtitle {
    color: var(--epicv-text-minor);
}
    .subtitle wa-input {
        display: inline-block;
        vertical-align: middle;
        width: 4.5rem;
    }
.description {
    padding: 10px;
    font-size: 0.9em;
}
</style>
