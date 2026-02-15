<template>
    <div data-component="signal-cursor-tool" ref="wrapper">
        <signal-tool
            :data="data"
            :height="svgHeight"
            :selected="selected"
            :width="svgWidth"
            :y-padding="yPadding"
            v-bind:signalProps="signalProps"
        >
            <g v-if="cursorX !== NUMERIC_ERROR_VALUE">
                <rect
                    :x="timeStart" y="0"
                    :width="timeEnd - timeStart" :height="height"
                    :fill="settingsColorToRgba(SETTINGS.tools.highlightArea.color)"
                    stroke-width="0"
                />
                <polyline
                    shape-rendering="crispEdges"
                    :stroke="settingsColorToRgba(
                        SETTINGS.tools.cursorLine.color
                    )"
                    :stroke-dasharray="settingsDashArrayToSvgStrokeDasharray(
                        SETTINGS.tools.cursorLine.dasharray
                    )"
                    :stroke-width="SETTINGS.tools.cursorLine.width"
                    :points="
                        `${cursorX - 0.5*SETTINGS.tools.cursorLine.width},0
                         ${cursorX - 0.5*SETTINGS.tools.cursorLine.width},${height}`
                    "
                />
            </g>
        </signal-tool>
        <div ref="overlay"
            :class="[
                'overlay',
                { 'outside': cursorFromSelection !== 0 },
            ]"
            @dblclick="handleDoubleClick"
            @pointerdown="handlePointerdown"
            @pointermove="handlePointermove"
            @pointerleave="handlePointerLeave"
            @contextmenu.prevent=""
        >
            <div v-if="cursorFromSelection < 0">
                <span>
                    <app-icon class="inline" name="chevron-left"></app-icon>
                    {{ $t('Cursor is outside the selected range.') }}
                </span>
            </div>
            <div v-if="cursorFromSelection > 0">
                <span>
                    {{ $t('Cursor is outside the selected range.') }}
                    <app-icon class="inline" name="chevron-right"></app-icon>
                </span>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
/**
 * Tool for basig signal selection properties.
 */
import { defineComponent, reactive, ref, Ref, PropType } from "vue"
import { T } from "#i18n"
import { settingsColorToRgba, settingsDashArrayToSvgStrokeDasharray } from "@epicurrents/core/util"
import type { PlotTraceSelection } from "#types/plot"
import { useStore } from "vuex"
import { useEegContext } from "#app/modules/eeg"
import { NUMERIC_ERROR_VALUE } from "@epicurrents/core/util"
import { NO_POINTER_BUTTON_DOWN } from "#util"
import { PointerInteraction } from "#types/interface"
import { Log } from "scoped-event-log"

import SignalTool from './SignalTool.vue'

type SignalProperties = {
    points: string
    res: number
    xPerPoint: number
}

const CURSOR_MARGIN = 5
const PAD_AMOUNT = 1

export default defineComponent({
    name: 'CursorTool',
    components: {
        SignalTool,
    },
    props: {
        cursorPos: {
            type: Number,
            required: true,
        },
        data: {
            type: Array as PropType<PlotTraceSelection[]>,
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
        seriesSpan: {
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
        //Topomap timeline edges
        const timeStart = ref(0)
        const timeEnd = ref(0)
        // Construct signal props array.
        const signalProps = reactive(props.data.map(() => {
            return {
                points: '',
                res: 0,
                xPerPoint: 0,
            }
        }))
        const activeProps = ref(null as SignalProperties | null)
        const activeSelection = props.data[props.selected] as PlotTraceSelection
        const cursorX = ref(NUMERIC_ERROR_VALUE)
        const dragging = ref(false)
        const pointerButton = ref(NO_POINTER_BUTTON_DOWN)
        const pointerEventHandlers = reactive({
            drag: []
        } as { [operation in PointerInteraction]: ((event?: PointerEvent) => void)[] })
        const svgHeight = ref(0)
        const svgWidth = ref(0)
        const overlay = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const wrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            activeProps,
            activeSelection,
            cursorX,
            dragging,
            pointerButton,
            pointerEventHandlers,
            overlay,
            signalProps,
            svgHeight,
            svgWidth,
            timeEnd,
            timeStart,
            wrapper,
            // Constants
            NUMERIC_ERROR_VALUE,
            // Imported methods
            settingsColorToRgba,
            settingsDashArrayToSvgStrokeDasharray,
            // Shorthands
            ...useEegContext(useStore()),
        }
    },
    watch: {
        cursorPos () {
            this.resize()
        },
        data () {
            this.resize()
        },
        height () {
            this.resize()
        },
        selected () {
            this.resize()
        },
        seriesSpan () {
            this.resize()
        },
        width () {
            this.resize()
        },
    },
    computed: {
        /**
         * Returns cursor distance from nearest edge of the selection range. Returned value is:
         * * < 0, if the cursor position is smaller than selection start
         * * \> 0 if it is greater than selection range end
         * * 0 otherwise.
         */
        cursorFromSelection (): number {
            const selection = this.data[this.selected]
            if (!selection) {
                return 0
            }
            if (this.cursorPos < selection.range[0]) {
                return this.cursorPos - selection.range[0]
            }
            if (this.cursorPos > selection.range[1]) {
                return this.cursorPos - selection.range[1]
            }
            return 0
        },
        selectionEnd (): number {
            if (!this.activeSelection) {
                return NUMERIC_ERROR_VALUE
            }
            return this.activeSelection.range[1]
        },
        selectionStart (): number {
            if (!this.activeSelection) {
                return NUMERIC_ERROR_VALUE
            }
            return this.activeSelection.range[0]
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
         * Get the data point index of the selected signal nearest to given recording time.
         * @param time - Time in seconds (including previous interruptions).
         */
        getNearestPointToTime (time: number) {
            const signal = this.data[this.selected]?.signal
            if (!signal) {
                return NUMERIC_ERROR_VALUE
            }
            const dataIdx = Math.round(time*signal.samplingRate)
            return dataIdx
        },
        /**
         * Get nearest true signal data point index at given x.
         * @param x - X-axis coordinate of the point (from pointer event).
         */
        getNearestPointToX (x: number) {
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
        /**
         * Get the recording time corresponding to given data index of the selected signal.
         * @param index - Data point index.
         */
        getTimeAtDataIndex (index: number) {
            const signal = this.data[this.selected]?.signal
            if (!signal) {
                return NUMERIC_ERROR_VALUE
            }
            return index/signal.samplingRate
        },
        handleDoubleClick (event: MouseEvent) {
            if (!this.activeProps || !this.activeSelection) {
                return
            }
            const secPerX = (this.selectionEnd-this.selectionStart)/this.width
            const contLeft = this.overlay.getBoundingClientRect().left
            const clickX = event.clientX - contLeft
            // Get the nearest true data point
            const nearestPoint = this.getNearestPointToX(clickX)
            const pointX = (nearestPoint + PAD_AMOUNT)*this.activeProps.xPerPoint
            this.$emit('set-cursor-pos', this.selectionStart + pointX*secPerX)
            this.overlay.style.cursor = 'pointer'
        },
        handleKeydown (event: KeyboardEvent) {
            // We want to allow single data point precision navigation from the cursor tool.
            if (event.code === 'ArrowRight') {
                // We don't want this to also trigger forward navigation.
                event.stopPropagation()
                const curIdx = this.getNearestPointToTime(this.cursorPos)
                const newTime = this.getTimeAtDataIndex(curIdx + 1)
                this.$emit('set-cursor-pos', Math.min(newTime, this.RESOURCE.totalDuration))
            } else if (event.code === 'ArrowLeft') {
                // We don't want this to also trigger forward navigation.
                event.stopPropagation()
                const curIdx = this.getNearestPointToTime(this.cursorPos)
                const newTime = this.getTimeAtDataIndex(curIdx - 1)
                this.$emit('set-cursor-pos', Math.max(newTime, 0))
            }
        },
        handlePointerdown (event: PointerEvent) {
            const secPerX = (this.selectionEnd-this.selectionStart)/this.width
            const contLeft = this.overlay.getBoundingClientRect().left
            const pointerX = event.clientX - contLeft
            if (pointerX >= this.cursorX - CURSOR_MARGIN && pointerX <= this.cursorX + CURSOR_MARGIN) {
                this.dragging = true
                this.pointerButton = event.button
                const pointerMove = (event: PointerEvent) => {
                    if (!this.activeProps || !this.activeSelection) {
                        return
                    }
                    const moveX = event.clientX - contLeft
                    // Drag the cursor
                    const nearestPoint = this.getNearestPointToX(moveX)
                    if (nearestPoint === NUMERIC_ERROR_VALUE) {
                        return
                    }
                    const pointX = (nearestPoint + PAD_AMOUNT)*this.activeProps.xPerPoint
                    this.$emit('set-cursor-pos', this.selectionStart + pointX*secPerX)
                }
                const pointerUp = (event: PointerEvent) => {
                    // Only end drag event if the original button is released
                    if (event.button !== this.pointerButton) {
                        return
                    }
                    removeHandlers()
                    this.removePointerEventHandler('drag', removeHandlers)
                }
                const removeHandlers = () => {
                    this.dragging = false
                    this.pointerButton = NO_POINTER_BUTTON_DOWN
                    this.overlay.removeEventListener('pointermove', pointerMove)
                    this.overlay.removeEventListener('pointerup', pointerUp)
                }
                this.overlay.addEventListener('pointermove', pointerMove)
                this.overlay.addEventListener('pointerup', pointerUp)
                // Add removeHandlers to pointerEventHandlers so it will executed if the operation in cancelled
                this.addPointerEventHandler('drag', removeHandlers)
                return
            }
        },
        handlePointerLeave (event: PointerEvent) {
            // Execute possible stored drag event handlers
            this.cancelPointerEventHandlers('drag', event)
        },
        handlePointermove (event: PointerEvent) {
            if (!this.activeSelection || this.dragging) {
                return
            }
            const contLeft = this.overlay.getBoundingClientRect().left
            // Display pointer icon if pointer is above the cursor line
            const pointerX = event.clientX - contLeft
            // 10px area to pick up the cursor
            if (pointerX >= this.cursorX - CURSOR_MARGIN && pointerX <= this.cursorX + CURSOR_MARGIN) {
                this.overlay.style.cursor = 'pointer'
                return
            }
            this.overlay.style.cursor = 'initial'
        },
        removePointerEventHandler (operation: PointerInteraction, handler: (event?: PointerEvent) => void) {
            for (let i=0; i<this.pointerEventHandlers[operation].length; i++) {
                if (this.pointerEventHandlers[operation][i] === handler) {
                    this.pointerEventHandlers[operation].splice(i, 1)
                }
            }
        },
        resize (isRetry = false) {
            if (!this.wrapper.offsetWidth) {
                // DOM hasn't updated yet, retry once.
                if (!isRetry) {
                    // $nextTick doesn't work here for some reason, it has to use timeout.
                    setTimeout(() => {
                        this.resize(true)
                    }, 1)
                }
                return
            }
            // Remove border size.
            this.svgWidth = this.width - 2
            this.svgHeight = this.height - 2
            for (let i=0; i<this.data.length; i++) {
                const props = this.signalProps[i]
                if (!props) {
                    // In the future, allow dynamically expanding or pruning the selections array?
                    Log.error(`Length of signal properties array (${this.signalProps.length}) does not match signal selection array length (${this.data.length}).`, this.$options.name as string)
                }
                // Length of the line that can be drawn between signal data points is
                // the length of the signal - 1
                props.xPerPoint = this.width/((this.data[i].signal?.data.length || 0) - 1 + 2*PAD_AMOUNT)
                props.res = (this.data[i].signal?.data.length || 0)/this.width
            }
            this.activeProps = this.signalProps[this.selected]
            this.activeSelection = this.data[this.selected]
            // Update cursor position.
            if (this.cursorPos >= this.selectionStart && this.cursorPos < this.selectionEnd) {
                const selLen = this.selectionEnd - this.selectionStart
                const xPerSec = this.width/selLen
                const relPos = this.cursorPos - this.selectionStart
                this.cursorX = relPos*xPerSec
                // Timeline start and end
                this.timeStart = (Math.max(relPos - 0.0004*this.seriesSpan, 0))*xPerSec
                this.timeEnd = (Math.min(relPos + 0.0004*this.seriesSpan, selLen))*xPerSec
            } else {
                this.cursorX = NUMERIC_ERROR_VALUE
            }
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
        // Capture event to allow for preventing triggering additional effects in the viewer component.
        window.addEventListener('keydown', this.handleKeydown, true)
    },
    mounted () {
        this.resize()
    },
    beforeUnmount () {
        window.removeEventListener('keydown', this.handleKeydown, true)
    },
})
</script>

<style scoped>
[data-component="signal-cursor-tool"] {
    flex: 3 3 0px;
    position: relative;
    display: flex;
    flex-wrap: nowrap;
    overflow: hidden;
}
    [data-component="signal-cursor-tool"] svg {
        flex-grow: 1;
        border: solid 1px var(--epicv-border-faint);
    }
    .overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }
        .overlay.outside {
            background-color: var(--epicv-background);
            opacity: 0.5;
        }
        .overlay > div {
            font-size: 1.5em;
            font-weight: 700;
            pointer-events: none;
        }
</style>
