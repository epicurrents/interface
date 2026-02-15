<template>
    <div data-component="signal-crop-tool"
        ref="component"
        @dblclick="handleDoubleClick"
        @pointerdown.prevent.stop="handlePointerdown"
        @pointerenter.stop="handlePointerEnter"
        @pointermove.prevent.stop="handlePointermove"
        @pointerleave.stop="handlePointerLeave"
        @contextmenu.prevent=""
    >
        <signal-tool
            :data="data"
            :height="svgHeight"
            :selected="selected"
            :width="svgWidth"
            :y-padding="yPadding"
            v-bind:signalProps="signalProps"
        >
            <g v-if="activeIsValid"
                shape-rendering="crispEdges"
                :fill="settingsColorToRgba(
                    SETTINGS.tools.excludeArea.color, 0.5
                )"
                :stroke="settingsColorToRgba(
                    SETTINGS.tools.excludeArea.color
                )"
                :stroke-dasharray="settingsDashArrayToSvgStrokeDasharray(
                    SETTINGS.tools.excludeArea.dasharray
                )"
                :stroke-width="SETTINGS.tools.excludeArea.width"
            >
                <polyline
                    :points="
                        `${-SETTINGS.tools.excludeArea.width},${-SETTINGS.tools.excludeArea.width}
                        ${(startX || 0) - SETTINGS.tools.excludeArea.width},${-SETTINGS.tools.excludeArea.width}
                        ${(startX || 0) - SETTINGS.tools.excludeArea.width},${svgHeight + SETTINGS.tools.excludeArea.width}
                        ${-SETTINGS.tools.excludeArea.width},${svgHeight + SETTINGS.tools.excludeArea.width}
                        `
                    "
                />
                <polyline
                    :points="
                        `${svgWidth + SETTINGS.tools.excludeArea.width},${-SETTINGS.tools.excludeArea.width}
                        ${(endX || svgWidth)},${-SETTINGS.tools.excludeArea.width}
                        ${(endX || svgWidth)},${svgHeight + SETTINGS.tools.excludeArea.width}
                        ${svgWidth + SETTINGS.tools.excludeArea.width},${svgHeight + SETTINGS.tools.excludeArea.width}
                        `
                    "
                />
            </g>
        </signal-tool>
        <app-icon ref="gripstart"
            appearance="brand"
            class="grip"
            name="grip-dots-vertical"
            :style="
                `left:calc(${(startX || 0)}px - 0.375rem);` +
                `opacity:${(pointerOverSignal && !dragging) ? '1' : '0'}`
            "
            variant="solid"
        ></app-icon>
        <app-icon ref="gripend"
            appearance="brand"
            class="grip"
            name="grip-dots-vertical"
            :style="
                `left:calc(${(endX || svgWidth) - SETTINGS.tools.excludeArea.width/2}px - 0.375rem);` +
                `opacity:${(pointerOverSignal && !dragging) ? '1' : '0'}`
            "
            variant="solid"
        ></app-icon>
        <pointer-overlay ref="overlay"
            @pointerdown.stop="null/* Prevent dispatched event from causing an infinite loop. */"
        ></pointer-overlay>
    </div>
</template>

<script lang="ts">
/**
 * Tool for basig signal selection properties.
 */
import { defineComponent, reactive, ref, Ref, PropType } from "vue"
import { T } from "#i18n"
import { settingsColorToRgba, settingsDashArrayToSvgStrokeDasharray } from "@epicurrents/core/util"
import type { Modify } from "@epicurrents/core/types"
import type { PlotTraceSelection } from "#types/plot"
import { useStore } from "vuex"
import { useEegContext } from "#app/modules/eeg"
import { NUMERIC_ERROR_VALUE } from "@epicurrents/core/util"
import { NO_POINTER_BUTTON_DOWN } from "#util"
import type { PointerInteraction } from "#types/interface"
import PointerOverlay, {
//    type OverlayPointerEventMeta,
    type PointerEventOverlay,
} from "#app/overlays/PointerEventOverlay.vue"

import SignalTool from './SignalTool.vue'

type SignalProperties = {
    points: string
    res: number
    xPerPoint: number
}

type AugmentedTraceSelection = Modify<PlotTraceSelection, { crop: number[] }>

const CURSOR_MARGIN = 8
const PAD_AMOUNT = 1

export default defineComponent({
    name: 'SignalCropTool',
    components: {
        PointerOverlay,
        SignalTool,
    },
    props: {
        data: {
            type: Array as PropType<AugmentedTraceSelection[]>,
            required: true,
        },
        height: {
            type: Number,
            required: true,
        },
        selected: {
            type: Number,
            required: true,
        },
        yPadding: {
            type: Number,
            default: 0.2,
        },
        width: {
            type: Number,
            required: true,
        },
    },
    setup (props) {
        // Determine signal bounds
        for (const selection of props.data) {
            if (!selection.signal) {
                continue
            }
            // Assign initial crop values if they are not set
            if (!selection.crop.length) {
                selection.crop[0] = 0
                selection.crop[1] = selection.signal.data.length - 1
            }
        }
        // Construct signal props array
        const signalProps = reactive(props.data.map(() => {
            return {
                points: '',
                res: 0,
                xPerPoint: 0,
            }
        }))
        const activeProps = ref(null as SignalProperties | null)
        const activeSelection = ref(null as AugmentedTraceSelection | null)
        const cropStart = ref(0)
        const cropEnd = ref(1)
        const dragging = ref(false)
        const pointerButton = ref(NO_POINTER_BUTTON_DOWN)
        const pointerEventHandlers = reactive({
            drag: []
        } as { [operation in PointerInteraction]: ((event?: PointerEvent) => void)[] })
        const pointerOverSignal = ref(false)
        const svgHeight = ref(0)
        const svgWidth = ref(0)
        // DOM.
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const gripstart = ref<SVGImageElement>() as Ref<SVGImageElement>
        const gripend = ref<SVGImageElement>() as Ref<SVGImageElement>
        const overlay = ref<PointerEventOverlay>() as Ref<PointerEventOverlay>
        return {
            activeProps,
            activeSelection,
            component,
            cropEnd,
            cropStart,
            dragging,
            gripend,
            gripstart,
            pointerButton,
            pointerEventHandlers,
            pointerOverSignal,
            overlay,
            signalProps,
            svgHeight,
            svgWidth,
            // Imported methods
            settingsColorToRgba,
            settingsDashArrayToSvgStrokeDasharray,
            // Shorthands
            ...useEegContext(useStore()),
        }
    },
    watch: {
        data () {
            this.redraw()
        },
        height () {
            this.redraw()
        },
        selected () {
            this.redraw()
        },
        width () {
            this.redraw()
        },
    },
    computed: {
        activeIsValid () {
            if (!this.activeProps || !this.activeSelection?.signal) {
                return false
            }
            if (this.signalProps.indexOf(this.activeProps) !== this.data.indexOf(this.activeSelection)) {
                return false
            }
            return true
        },
        endX (): number {
            return this.cropEnd*this.svgWidth
        },
        startX (): number {
            return this.cropStart*this.svgWidth
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
        addPointerEventHandler (operation: PointerInteraction, handler: (event?: PointerEvent) => void) {
            this.pointerEventHandlers[operation].push(handler)
        },
        cancelPointerEventHandlers (operation: PointerInteraction, event?: PointerEvent) {
            while (this.pointerEventHandlers[operation].length) {
                const handler = this.pointerEventHandlers[operation].shift()
                if (handler) {
                    handler(event)
                }
            }
        },
        /**
         * Get nearest true signal data point index at given x.
         */
        getNearestPoint (x: number) {
            if (!this.activeProps || !this.activeSelection?.signal) {
                return NUMERIC_ERROR_VALUE
            }
            const sigX = x - PAD_AMOUNT*this.activeProps.xPerPoint
            const sigIdx = Math.round(sigX/this.activeProps.xPerPoint)
            if (sigIdx < 0 || sigIdx >= this.activeSelection.signal.data.length) {
                return NUMERIC_ERROR_VALUE
            }
            return sigIdx
        },
        handleDoubleClick (event: MouseEvent) {
            if (!this.activeProps || !this.activeSelection?.signal) {
                return
            }
            const contLeft = this.overlay.getBoundingClientRect().left
            const clickX = event.clientX - contLeft
            // Get the nearest true data point
            const nearestPoint = this.getNearestPoint(clickX)
            // For the first half of the selection, set crop start, and for the latter half crop end,
            // as long as it doesn't overlap with the other selection
            if (
                nearestPoint <= this.activeSelection.signal.data.length/2 &&
                nearestPoint < this.activeSelection.crop[1]
            ) {
                this.activeSelection.crop[0] = nearestPoint
            } else if (nearestPoint > this.activeSelection.crop[0]) {
                this.activeSelection.crop[1] = nearestPoint
            } else {
                this.activeSelection.crop[0] = nearestPoint
            }
            this.redraw()
            this.overlay.style.cursor = 'pointer'
        },
        handlePointerdown (event: PointerEvent) {
            if (!this.activeProps || !this.activeSelection?.signal) {
                return
            }
            const contLeft = this.overlay.getBoundingClientRect().left
            const pointerX = event.clientX - contLeft
            for (let i=0; i<this.activeSelection.crop.length; i++) {
                const crop = this.activeSelection.crop[i]
                const cursorX = !crop ? 0 : crop === this.width ? this.width
                                : (crop + PAD_AMOUNT)*this.activeProps.xPerPoint
                if (pointerX >= cursorX - CURSOR_MARGIN && pointerX <= cursorX + CURSOR_MARGIN) {
                    // Reset cursor with right click
                    if (!this.dragging && event.button === 2) {
                        this.activeSelection.crop[i] = i ? this.activeSelection.signal.data.length - 1 : 0
                        this.redraw()
                        return
                    }
                    this.dragging = true
                    this.pointerButton = event.button
                    const move = (left: number) => {
                        if (!this.activeProps || !this.activeSelection) {
                            return
                        }
                        // Move the cursor between actual data points.
                        const nearestPoint = this.getNearestPoint(left)
                        if (nearestPoint === NUMERIC_ERROR_VALUE) {
                            return
                        }
                        // Check that we're not overlapping with the other crop area.
                        if (
                            (!i && nearestPoint > this.activeSelection.crop[1]) ||
                            (i && nearestPoint < this.activeSelection.crop[0])
                        ) {
                            return
                        }
                        this.activeSelection.crop[i] = Math.max(0, nearestPoint)
                        this.redraw()
                    }
                    const up = () => {
                        this.dragging = false
                    }
                    this.overlay.trackPointer(event, { move, up },
                        document.querySelector('[data-component="window-dialog"]')!.shadowRoot!.querySelector('.dialog__overlay')!
                    )
                    return
                }
            }
        },
        handlePointerEnter (_event: PointerEvent) {
            this.pointerOverSignal = true
        },
        handlePointerLeave (event: PointerEvent) {
            this.pointerOverSignal = false
            // Execute possible stored drag event handlers
            this.cancelPointerEventHandlers('drag', event)
        },
        handlePointermove (event: PointerEvent) {
            if (!this.activeSelection || this.dragging) {
                return
            }
            const contLeft = this.overlay.getBoundingClientRect().left
            // Display pointer if pointer is above the cursor line
            const pointerX = event.clientX - contLeft + 1 // 1 for border.
            if (
                (pointerX >= this.startX - CURSOR_MARGIN && pointerX <= this.startX + CURSOR_MARGIN) ||
                (pointerX >= this.endX - CURSOR_MARGIN && pointerX <= this.endX + CURSOR_MARGIN)
            ) {
                this.component.style.cursor = 'pointer'
                return
            }
            this.component.style.cursor = 'initial'
        },
        removePointerEventHandler (operation: PointerInteraction, handler: (event?: PointerEvent) => void) {
            for (let i=0; i<this.pointerEventHandlers[operation].length; i++) {
                if (this.pointerEventHandlers[operation][i] === handler) {
                    this.pointerEventHandlers[operation].splice(i, 1)
                }
            }
        },
        redraw (isRetry = false) {
            if (!this.component.offsetWidth) {
                // DOM hasn't updated yet, retry once.
                if (!isRetry) {
                    // $nextTick doesn't work here for some reason, have to use timeout.
                    setTimeout(() => {
                        this.redraw(true)
                    }, 1)
                }
                return
            }
            // Remove border size.
            this.svgWidth = this.width - 2
            this.svgHeight = this.height - 2
            for (let i=0; i<this.data.length; i++) {
                const selection = this.data[i]
                if (!selection.signal) {
                    continue
                }
                const props = this.signalProps[i]
                props.res = (selection.signal?.data.length || 0)/this.svgWidth
            }
            this.activeProps = this.signalProps[this.selected]
            this.activeSelection = this.data[this.selected]
            if (!this.activeProps || !this.activeSelection?.signal) {
                return
            }
            if (!this.activeSelection.crop) {
                this.cropStart = 0
                this.cropEnd = 1
                return
            }
            this.cropStart = Math.max(
                (this.activeSelection.crop[0] + PAD_AMOUNT)/this.activeSelection.signal.data.length,
                0
            )
            this.cropEnd = Math.min(
                (this.activeSelection.crop[1] - PAD_AMOUNT + 1)/this.activeSelection.signal.data.length,
                1
            )
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
        this.redraw()
    },
})
</script>

<style scoped>
[data-component="signal-crop-tool"] {
    flex: 3 3 0px;
    position: relative;
    display: flex;
    flex-wrap: nowrap;
    overflow: hidden;
}
    [data-component="signal-crop-tool"] svg {
        flex-grow: 1;
        border: solid 1px var(--epicv-border-faint);
        pointer-events: none;
    }
    .grip {
        color: var(--epicv-icon-active);
        height: 1.5rem;
        position: absolute;
        top: calc(50% - 0.7rem - 1px);
        width: 1rem;
        padding: 0.2rem 0;
        border: solid 1px var(--epicv-border-faint);
        border-radius: 0.2rem;
        background-color: var(--epicv-background);
        opacity: 0;
        transition: opacity ease 0.5s;
        pointer-events: none;
    }
</style>
