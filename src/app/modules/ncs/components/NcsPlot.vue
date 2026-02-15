<template>
    <div data-component="ncs-plot" ref="wrapper">
        <div ref="plot" class="plot"
            @pointerdown.prevent="handlePointerdown"
            @pointermove.prevent="handleTouchmove"
            @pointerup="handlePointerleave"
            @touchend="handleTouchend"
            @touchstart.prevent="handleTouchstart/* Prevent scrolling with touch move or channel selections won't work. */"
            @wheel="handleWheelEvent"
            @contextmenu.prevent="null/* Prevent context menu or dragging with the right mouse button won't work. */"
        ></div>
        <span v-for="(chan, idx) of RESOURCE.channels"
            :key="`ncs-plot-channel-label-${idx}`"
            class="channel-label"
            :style="{
                bottom: `calc(${chan.offset.baseline*100}% + 0.5em)`,
                color: settingsColorToRgba(SETTINGS.trace.color as SettingsColor),
                left: '0.5em',
                opacity: 0.67,
                position: 'absolute',
            }"
        >
            {{ chan.label }}
        </span>
    </div>
</template>

<script lang="ts">
/**
 * EMG recording plot.
 */
import { defineComponent, PropType, Ref, ref } from "vue"
import { T } from "#i18n"
import type { BiosignalChannel, MontageChannel, SettingsColor } from "@epicurrents/core/types"
import { useStore } from "vuex"
import { settingsColorToRgba, shouldDisplayChannel } from "@epicurrents/core/util"
import { NUMERIC_ERROR_VALUE } from "@epicurrents/core/util"
import { PointerInteraction } from "#types/interface"
import { useNcsContext } from "#app/modules/ncs"
import { NO_POINTER_BUTTON_DOWN } from "#util"
import type {
    OverlayPointerEventMeta,
    PointerEventOverlay,
} from "#app/overlays/PointerEventOverlay.vue"
import { WebGlPlot, PlotColor, WebGlPlotTrace } from "#components"
import { WebGlPlotConfig } from "#types/plot"

const DOUBLE_CLICK_THRESHOLD = 250
const SWIPE_RANGE_THRESHOLD = 100 // pixels
const WHEEL_TRIGGER_THRESHOLD = 150

export default defineComponent({
    name: 'NcsPlot',
    props: {
        dimensions: {
            type: Array as PropType<number[]>,
            required: true,
        },
        horizontalDivs: {
            type: Number,
            required: true,
        },
        isPlayback: {
            type: Boolean,
            default: false,
        },
        overlay: {
            type: Object as PropType<PointerEventOverlay>,
            required: true,
        },
        secPerPage: {
            type: Number,
            default: 0,
        },
        verticalDivs: {
            type: Number,
            required: true,
        },
        visibleRange: {
            type: Number,
            required: true,
        },
    },
    setup () {
        const store = useStore()
        const cacheHasData = ref(false)
        const canvas = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>
        const clickCountResetTimer = 0
        const consecutiveClickCount = ref(0)
        const delayedRefresh = ref(0)
        const destroyed = ref(false)
        const lastWidth = ref(0)
        const lastHeight = ref(0)
        const newSignalData = ref(false)
        const nextAnimationFrame = ref(0)
        const plot = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const plotRefreshResolve = ref(null as ((value: boolean) => void) | null)
        const pointerButton = ref(NUMERIC_ERROR_VALUE)
        const pointerDragRange = ref([NUMERIC_ERROR_VALUE, NUMERIC_ERROR_VALUE])
        const pointerEventHandlers = {
            drag: []
        } as { [operation in PointerInteraction]: ((event?: PointerEvent) => void)[] }
        const start = ref({
            /** Active pointer down event. */
            pointer: null as PointerEvent | null,
            /** Active touch start event. */
            touch: null as TouchEvent | null,
        })
        const startOffset = 0
        const updateOnViewRange = ref(false)
        const updatingPlot = ref(false)
        const viewDataAvailable = ref(false)
        const visibleChannels = ref(0)
        const wheelDelta = ref(0)
        const wglPlot = ref<WebGlPlot | null>(null)
        const wrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        // Unsubscribe from store mutations
        const unsubscribe = ref(null as (() => void) | null)
        return {
            cacheHasData,
            canvas,
            clickCountResetTimer,
            consecutiveClickCount,
            delayedRefresh,
            /** Set to true before component gets destroyed. */
            destroyed,
            lastHeight,
            lastWidth,
            /** Is there new signal data to draw. */
            newSignalData,
            /** Number of the next requested animation frame. */
            nextAnimationFrame,
            pointerButton,
            pointerDragRange,
            pointerEventHandlers,
            /** The plot canvas element. */
            plot,
            /**
             * A resolve method of a promise to be called the next
             * time the plot is refreshed.
             */
            plotRefreshResolve,
            /** Currently active pointer down and/or touch start events. */
            start,
            /** Time offset where audio playback started. */
            startOffset,
            /**
             * Operations relying on DOM element dimensions seem very
             * prone to race conditions, so check and postpone plot
             * construction if viewRange has not updated yet.
             */
            updateOnViewRange,
            updatingPlot,
            /** Has the initial view data been available yet. */
            viewDataAvailable,
            visibleChannels,
            /** How much the pointer wheel has rotated since last triggered event. */
            wheelDelta,
            wglPlot,
            /** Wrapping element around the plot container. */
            wrapper,
            // Scope properties
            ...useNcsContext(store),
            // Unsubscribers
            unsubscribe,
            // Miscellaneous
            settingsColorToRgba,
        }
    },
    watch: {
        dimensions () {
            // Trace heights are "cheap" to update, so do that on every change
            if (this.dimensions[0] !== this.lastWidth) {
                this.resize()
                this.drawPlot()
                this.lastWidth = this.dimensions[0]
            } else if (this.dimensions[1] !== this.lastHeight) {
                this.resize()
                this.updateTraceHeights()
            }
            this.lastHeight = this.dimensions[1]
        },
        viewRange () {
            if (this.updateOnViewRange) {
                this.updateOnViewRange = false
                this.drawPlot()
            } else {
                this.addTraces()
            }
            // When the window is resized very quickly or abruptly, the last change may not trigger this method, so
            // check one more time after a slight delay (250 ms seems about okay).
            if (this.delayedRefresh) {
                window.clearTimeout(this.delayedRefresh)
            }
            this.delayedRefresh = window.setTimeout(() => {
                this.addTraces()
            }, 250)
        },
    },
    computed: {
        pointerDragThreshold (): number {
            // Require at least 5 mm (~0.2 inches) of pointer movement to register a drag event
            return this.$store.state.INTERFACE.app.screenPPI/5
        },
        pxPerSecond () {
            return this.secPerPage ? this.dimensions[0]/this.secPerPage : 0
        },
        viewRange (): number {
            return this.secPerPage
        },
        /** X-axis range in number of datapoints. */
        xAxisRange (): number {
            return Math.floor(this.viewRange*(this.RESOURCE.samplingRate || 0))
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
        /**
         * Add (or reset) all visible plot traces.
         */
        addTraces () {
            if (!this.wglPlot) {
                return
            }
            // Clear possible pre-existing traces
            this.wglPlot.clearAll()
            this.visibleChannels = 0
            // Either use montage configuration or raw configuration
            const channels = this.RESOURCE.activeMontage?.channels || this.RESOURCE.channels
            const useRaw = !this.RESOURCE.activeMontage
            if (useRaw) {
                // Raw montage needs the number of visible channels as a reference for offset calculation
                for (const chan of channels) {
                    if (shouldDisplayChannel(chan, useRaw, this.SETTINGS)) {
                        this.visibleChannels++
                    }
                }
            }
            for (const chan of channels as (BiosignalChannel | MontageChannel)[]) {
                if (!shouldDisplayChannel(chan, useRaw, this.SETTINGS)) {
                    // Skip invisible channels (this also checks for null channel)
                    continue
                }
                const [r, g, b, a] = this.SETTINGS.trace.color as SettingsColor
                const color = new PlotColor(r, g, b, a)
                const dispPol = chan.displayPolarity || this.SETTINGS.displayPolarity
                const sensitivity = chan.sensitivity || this.RESOURCE.sensitivity
                const scale = chan.scale || 0
                const sigLen = this.viewRange*chan.samplingRate
                const samplesPerPx = Math.floor(this.viewRange*chan.samplingRate)/this.plot.offsetWidth
                const line = new WebGlPlotTrace(
                    this.wglPlot,
                    color,
                    sigLen,
                    sensitivity,
                    chan.samplingRate,
                    samplesPerPx,
                    1,
                    dispPol,
                    scale,
                    chan.offset?.baseline || 0
                )
                this.wglPlot.addChannel(line)
            }
            this.updateTraces()
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
         * Draw (or re-draw) the WebGL plot.
         * This is required whenever the configuration of channels is changed.
         */
        drawPlot () {
            if (!this.plot) {
                return
            }
            if (!this.viewRange) {
                this.updateOnViewRange = true
                return
            }
            this.updatingPlot = true
            this.wglPlot = this.$store.getters.getBiosignalPlot() as WebGlPlot
            // Use absolute width
            this.wglPlot.resetWidth()
            // Give pixels per uV as a reference to WebGLPlot.
            this.wglPlot.heightInSensRefUnits = this.verticalDivs
            // Recreate the context if configuration parameters don't match
            if (
                this.wglPlot.configParams?.antialias !== this.SETTINGS.antialiasing
            ) {
                const config = {
                    antialias: this.SETTINGS.antialiasing,
                } as WebGlPlotConfig
                this.wglPlot.recreate(config)
            }
            this.wglPlot.addTo(this.plot)
            this.canvas = this.plot.children[0] as HTMLCanvasElement
            this.addTraces()
        },
        getPointerPosition (event: PointerEvent | Touch) {
            const divBot = this.plot.getBoundingClientRect().bottom
            const yPos = divBot - event.clientY
            const containerH = this.plot.getBoundingClientRect().height
            const relY = yPos/containerH
            const contLeft = this.plot.getBoundingClientRect().left
            const pointerLeft = event.clientX - contLeft
            const position = pointerLeft/this.pxPerSecond + this.RESOURCE.viewStart
            return {
                /** Pointer position in seconds from recording start. */
                position,
                /** Relative y-position as fraction of plot height (from the bottom). */
                relY,
                /** Absolute x-position in pixels from the left of the plot. */
                x: pointerLeft,
                /** Absolute y-position in pixels from the bottom of the plot. */
                y: yPos,
            }
        },
        /**
         * Move the view backward `step` amount of seconds from the current location.
         * @param step - amount of seconds (optional, defaults to page length setting)
         */
        goBackward (step?: number) {
            // Browse left
            if (this.updatingPlot) {
                return
            }
            this.$emit('go-backward', step)
        },
        /**
         * Move the view forward `step` amount of seconds from the current location.
         * @param step - amount of seconds (optional, defaults to page length setting)
         */
        goForward (step?: number) {
            // Browse right
            if (this.updatingPlot) {
                return
            }
            this.$emit('go-forward', step)
        },
        handleKeyup (event: KeyboardEvent) {
            const key = event.key
            if (event.altKey) {
                // Special actions that require the alt (or opt) key to be pressed.
                // For example, up and down arrow keys are used for mouseless navigation so we can't
                // just use them as such.
                if (key === 'ArrowUp') {
                    event.preventDefault()
                    // Try to switch to the next sensitivity setting.
                    const sensVals = this.SETTINGS.sensitivity[this.SETTINGS.sensitivityUnit].availableValues
                    for (let i=0; i<sensVals.length; i++) {
                        if (i && sensVals[i] >= this.RESOURCE.sensitivity) {
                            this.$store.dispatch('set-sensitivity', sensVals[i-1])
                            return
                        }
                    }
                } else if (key === 'ArrowDown') {
                    const sensVals = this.SETTINGS.sensitivity[this.SETTINGS.sensitivityUnit].availableValues
                    for (let i=0; i<sensVals.length; i++) {
                        if (sensVals[i] > this.RESOURCE.sensitivity) {
                            this.$store.dispatch('set-sensitivity', sensVals[i])
                            return
                        } else if (i < sensVals.length - 1) {
                            if (
                                sensVals[i] === this.RESOURCE.sensitivity ||
                                sensVals[i+1] > this.RESOURCE.sensitivity
                            ) {
                                this.$store.dispatch('set-sensitivity', sensVals[i+1])
                                return
                            }
                        }
                    }
                    event.preventDefault()
                }
                // TODO: Left and right arrows to control the page width.
            }
        },
        /**
         * Handle pointer down event on the overlay.
         */
        handlePointerdown (event: PointerEvent, handleTouch = false) {
            const isTouch = event.pointerType === 'touch'
            if (isTouch && !handleTouch) {
                // Not time for this yet.
                this.start.pointer = event
                return
            }
            if (handleTouch && !this.start.touch) {
                return
            }
            if (!event.button && !event.altKey && !event.shiftKey && !event.ctrlKey) {
                if (this.clickCountResetTimer) {
                    window.clearTimeout(this.clickCountResetTimer)
                }
                // Add to the consecutive click count.
                this.consecutiveClickCount++
                this.clickCountResetTimer = window.setTimeout(() => {
                    // Reset the click count after a short delay.
                    this.consecutiveClickCount = 0
                }, DOUBLE_CLICK_THRESHOLD)
            }
            // Only support left and right mouse button events.
            if (![0, 2].includes(event.button) && !isTouch) {
                return
            }
            // Cancel drag if right mouse button is pressed while left button is dragging or vice versa.
            if (
                (this.pointerButton === 0 && event.button === 2) ||
                (this.pointerButton === 2 && event.button === 0)
            ) {
                this.cancelPointerEventHandlers('drag', event)
                return
            }
            // Prevent other pointer events during drag.
            if (this.pointerButton !== NO_POINTER_BUTTON_DOWN) {
                return
            }
            // Save initial pointer down position.
            const initialEvent = event
            const divBot = this.plot.getBoundingClientRect().bottom
            const {
                relY,
                position: initialPos,
                x: initialLeft,
                y: initialY,
            } = this.getPointerPosition(initialEvent)
            // We want to determine, if the user clicked the pointer down on a particular channel.
            // getChannelAtYPosition in recording requires the relative y-location from container bottom.
            const channelProps = initialEvent.shiftKey ? null : this.RESOURCE.getChannelAtYPosition(relY)
            // Check if pointer is over a channel; no need to continue if not.
            if (!initialEvent.shiftKey && !channelProps) {
                const customEv = new CustomEvent('plotmouseclick', {
                    detail: {
                        channelProps: null,
                        pointerButton: event.button,
                        pointerPosition: [initialLeft, initialY],
                        position: initialPos,
                    }
                })
                this.$emit('mouse-click', customEv)
                return
            }
            this.pointerButton = initialEvent.button
            const threshold = this.pointerDragThreshold
            let overThreshold = false
            const pointerMove = (left: number, top: number, _meta?: OverlayPointerEventMeta) => {
                const pointerPos = left/this.pxPerSecond + this.RESOURCE.viewStart
                // Allow drag in both directions
                const dif = left - initialLeft
                // Wait for dif to exceed threshold at least once before considering this a drag action.
                if (!overThreshold) {
                    if (Math.abs(dif) < threshold) {
                        return
                    } else {
                        overThreshold = true
                    }
                }
                const pointerY = divBot - top
                const customEv = new CustomEvent('plotpointerdrag', {
                    detail: {
                        channelProps: channelProps,
                        pointerButton: event.button,
                        pointerPosition: [left, pointerY],
                        position: pointerPos,
                        startPos: initialPos,
                        // Event properties.
                        ctrlKey: event.ctrlKey,
                        shiftKey: event.shiftKey,
                    },
                })
                this.$emit('pointer-drag', customEv)
            }
            const pointerUp = (left: number, _top: number, meta: OverlayPointerEventMeta) => {
                // Only end drag event if the original button is released.
                if (event.button !== this.pointerButton) {
                    return
                }
                this.pointerButton = NO_POINTER_BUTTON_DOWN
                const timePos = left/this.pxPerSecond + this.RESOURCE.viewStart
                const { x, y } = this.getPointerPosition(meta.event!)
                const customEv = new CustomEvent('plotpointerup', {
                    detail: {
                        channelProps: channelProps,
                        pointerButton: event.button,
                        pointerPosition: [x, y],
                        position: timePos,
                        startPos: initialPos,
                        // Event properties.
                        ctrlKey: event.ctrlKey,
                        shiftKey: event.shiftKey,
                    },
                })
                if (!overThreshold) {
                    if (this.consecutiveClickCount > 1) {
                        // If there were multiple clicks, emit a double-click event.
                        this.$emit('double-click', customEv)
                    } else {
                        // Simply report a pointer up event if drag range is insufficient
                        this.$emit('pointer-up', customEv)
                    }
                } else {
                    this.$emit('pointer-drag-end', customEv)
                }
            }
            this.overlay.trackPointer(event, { move: pointerMove, up: pointerUp })
            const customEv = new CustomEvent('plotpointerdown', {
                detail: {
                    channelProps: channelProps,
                    pointerButton: this.pointerButton,
                    position: initialPos,
                    startPos: initialPos,
                    // Event properties.
                    ctrlKey: event.ctrlKey,
                    shiftKey: event.shiftKey,
                },
            })
            this.$emit('pointer-down', customEv)
        },
        handlePointerleave (event: PointerEvent) {
            if (event.pointerType === 'touch') {
                // This is a touch event, do not handle it.
                return
            }
            if (this.pointerButton !== NO_POINTER_BUTTON_DOWN) {
                // Left overlay in the middle of a drag operation
                this.pointerButton = NO_POINTER_BUTTON_DOWN
                this.overlay.style.pointerEvents = 'none'
                // Execute possible stored drag event handlers
                this.cancelPointerEventHandlers('drag', event)
            }
        },
        handleTouchend (event: TouchEvent) {
            if (event.touches.length) {
                // If there are still active touches, do not handle the end event.
                return
            }
            if (event.changedTouches.length !== 1) {
                // If there are multiple touches, do not handle the end event.
                return
            }
            const touch = event.changedTouches[0]
            const start = this.start.touch?.touches[0]
            if (start) {
                // If there is an active touch event, it means that the user has released the touch.
                const relX = touch.clientX - start.clientX
                if (Math.abs(relX) > SWIPE_RANGE_THRESHOLD) {
                    // No significant swipe or drag, just emit a pointer up event.
                    const { relY, position } = this.getPointerPosition(start)
                    const customEv = new CustomEvent('plotpointerup', {
                        detail: {
                            altKey: false,
                            channelProps: this.RESOURCE.getChannelAtYPosition(relY),
                            pointerButton: 0, // Single-touch events always use the left mouse button.
                            pointerPosition: [touch.clientX, touch.clientY],
                            pointerType: 'touch',
                            position,
                            startPos: position,
                            ctrlKey: false,
                            shiftKey: false,
                        },
                    })
                    // Track double-clicks (double-taps).
                    if (this.clickCountResetTimer) {
                        window.clearTimeout(this.clickCountResetTimer)
                    }
                    // Add to the consecutive click count.
                    this.consecutiveClickCount++
                    this.clickCountResetTimer = window.setTimeout(() => {
                        this.consecutiveClickCount = 0
                    }, DOUBLE_CLICK_THRESHOLD)
                    if (this.consecutiveClickCount > 1) {
                        // If there were multiple taps, emit a double-click event.
                        this.$emit('double-click', customEv)
                        this.consecutiveClickCount = 0
                    } else {
                        // Simply report a pointer up event if drag range is insufficient.
                        this.$emit('pointer-up', customEv)
                    }
                } else {
                    // Long-press without swipe.
                    const { relY, position, x, y } = this.getPointerPosition(event.changedTouches[0])
                    const channelProps = this.RESOURCE.getChannelAtYPosition(relY)
                    const timePos = x/this.pxPerSecond + this.RESOURCE.viewStart
                    const customEv = new CustomEvent('plotpointerup', {
                        detail: {
                            channelProps: channelProps,
                            pointerButton: 2, // Simulate right-click.
                            pointerPosition: [x, y],
                            position: timePos,
                            startPos: position,
                        },
                    })
                    this.$emit('pointer-up', customEv)
                }
                this.start.touch = null
            } else {
                // Remove possible drag event handlers.
                this.cancelPointerEventHandlers('drag')
            }
        },
        /**
         * Handle touch move event (technically a pointer move, but this only gets triggered on touch events).
         */
        handleTouchmove (_event: PointerEvent) {
            if (!this.start.touch || !this.start.pointer) {
                // If there is no active touch event, do not handle the move event.
                return
            }
            // If this is too slow for a swipe, handle as move event.
            this.handlePointerdown(this.start.pointer, true)
        },
        handleTouchstart (event: TouchEvent) {
            // Emit an event to signal that the user has touched on the plot.
            this.$emit('touch-start', event)
            if (event.touches.length !== 1 || this.start.touch) {
                // If there are multiple touches, do not handle the start event.
                return
            }
            //const touch = event.touches[0]
            this.start.touch = event
        },
        handleWheelEvent (event: WheelEvent) {
            this.wheelDelta += event.deltaY
            if (Math.abs(this.wheelDelta) >= WHEEL_TRIGGER_THRESHOLD) {
                const step = Math.min(this.SETTINGS.pageLength, Math.floor(this.visibleRange))
                if (event.deltaY > 0) {
                    // Wheel scrolled down -> browse forward.
                    this.goForward(step)
                } else {
                    // Reset the delta.
                    this.goBackward(step)
                }
                this.wheelDelta = 0
            }
        },
        removeAllPointerEventHandlers (operation: PointerInteraction) {
            this.pointerEventHandlers[operation].splice(0)
        },
        removePointerEventHandler (operation: PointerInteraction, handler: (event?: PointerEvent) => void) {
            for (let i=0; i<this.pointerEventHandlers[operation].length; i++) {
                if (this.pointerEventHandlers[operation][i] === handler) {
                    this.pointerEventHandlers[operation].splice(i, 1)
                }
            }
        },
        resize () {
            this.wrapper.style.width = `${this.dimensions[0]}px`
            this.wrapper.style.height = `${this.dimensions[1]}px`
            // Update channel labels
            if (this.SETTINGS.border.left) {
                const borderStyle = this.SETTINGS.border.left.style
                const borderWidth = this.SETTINGS.border.left.width
                const borderColor = settingsColorToRgba(this.SETTINGS.border.left.color)
                this.wrapper.style.borderLeft = `${borderStyle} ${borderWidth}px ${borderColor}`
            } else {
                this.wrapper.style.borderLeft = `none`
            }
            if (this.SETTINGS.border.right) {
                const borderStyle = this.SETTINGS.border.right.style
                const borderWidth = this.SETTINGS.border.right.width
                const borderColor = settingsColorToRgba(this.SETTINGS.border.right.color)
                this.wrapper.style.borderRight = `${borderStyle} ${borderWidth}px ${borderColor}`
            } else {
                this.wrapper.style.borderRight = `none`
            }
            if (this.SETTINGS.border.top) {
                const borderStyle = this.SETTINGS.border.top.style
                const borderWidth = this.SETTINGS.border.top.width
                const borderColor = settingsColorToRgba(this.SETTINGS.border.top.color)
                this.wrapper.style.borderTop = `${borderStyle} ${borderWidth}px ${borderColor}`
            } else {
                this.wrapper.style.borderTop = `none`
            }
            if (this.SETTINGS.border.bottom) {
                const borderStyle = this.SETTINGS.border.bottom.style
                const borderWidth = this.SETTINGS.border.bottom.width
                const borderColor = settingsColorToRgba(this.SETTINGS.border.bottom.color)
                this.wrapper.style.borderBottom = `${borderStyle} ${borderWidth}px ${borderColor}`
            } else {
                this.wrapper.style.borderBottom = `none`
            }
            if (this.wglPlot) {
                this.wglPlot.heightInSensRefUnits = this.verticalDivs
            }
        },
        /**
         * Update trace amplitudes and offsets to fit current plot height.
         */
        updateTraceHeights () {
            this.wglPlot?.update()
        },
        /**
         * Refresh trace data in an already existing WebGL plot.
         */
        updateTraces () {
            if (!this.wglPlot) {
                return
            }
            if (!this.viewRange) {
                return
            }
            if (!this.cacheHasData || !this.viewDataAvailable) {
                // Nothing to draw
                return
            }
            if (!this.updatingPlot) {
                this.updatingPlot = true
            }
            // Y-axis values for each channel
            // TODO: ampScale and sensitivity into trace properties?
            const range = [0]
            const viewEnd = this.RESOURCE.viewStart + this.viewRange
            if (viewEnd < this.RESOURCE.dataDuration) {
                range.push(viewEnd)
            }
            // The method returns raw signals if no montage is set
            this.RESOURCE.getAllSignals(range).then((response) => {
                if (!this.wglPlot || !response || this.destroyed) {
                    // Mostly for TypeScript
                    return
                }
                // Check that component width hasn't changed
                if (this.wglPlot.width !== this.plot.offsetWidth) {
                    this.wglPlot.resetWidth()
                    if (this.pxPerSecond) {
                        // We also need to recreate the traces to fit the new signal length
                        this.addTraces()
                    }
                }
                // Either fetch raw signals or montage signals
                const chans = this.RESOURCE.activeMontage?.channels || this.RESOURCE.channels
                const useRaw = !this.RESOURCE.activeMontage
                let i = 0
                lineloop:
                for (const line of this.wglPlot.traces) {
                    while (!shouldDisplayChannel(chans[i], useRaw, this.SETTINGS)) {
                        i++
                        if (i === response.signals.length) {
                            break lineloop
                        }
                    }
                    const chan = chans[i]
                    if (!chan) {
                        i++
                        if (i === response.signals.length) {
                            break lineloop
                        }
                        continue
                    }
                    // Update properties if needed
                    const dispPol = chan.displayPolarity || this.SETTINGS.displayPolarity
                    if (line.polarity !== dispPol) {
                        line.polarity = dispPol
                    }
                    const scale = chan.scale || 0
                    if (line.scale !== scale) {
                        line.scale = scale
                    }
                    const sensitivity = (chan as MontageChannel).sensitivity || this.RESOURCE.sensitivity
                    if (line.sensitivity !== sensitivity) {
                        line.sensitivity = sensitivity
                    }
                    if (!response.signals[i]?.data.length) {
                        // Error response from worker, set all signals to zero
                        line.setData(0)
                    } else {
                        line.setData(response.signals[i].data)
                    }
                    i++
                }
                this.newSignalData = true
            })
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    async mounted () {
        // Add component styles to shadow root
        // Add overlay event listeners
        // Update filters in case they have been changed since this montage was constructed
        await this.RESOURCE.activeMontage?.updateFilters()
        // Add property update handlers
        this.RESOURCE.onPropertyChange(
            [
                'filters',
                'channels',
                'sensitivity',
                'viewStart',
            ],
            this.updateTraces,
            this.ID
        )
        if ((this.RESOURCE.samplingRate || 0) >= 500) {
        }
        // Handle key press events
        window.addEventListener('keyup', this.handleKeyup, false)
        // Listen to some store state changes
        this.unsubscribe = this.$store.subscribe((mutation) => {
            // Reload plot if certain user settings change.
            const reloadOnFields = [
                'emg.antialiasing',
            ]
            const updateOnFields = [
                'emg.displayPolarity',
                'emg.epochMode.enabled',
                'emg.epochMode.epochLength',
            ]
            if (mutation.type === 'set-settings-value') {
                if (reloadOnFields.includes(mutation.payload.field) && this.wglPlot) {
                    this.$nextTick(() => {
                        this.drawPlot()
                    })
                } else if (
                    mutation.payload.field.startsWith('emg.trace.') ||
                    updateOnFields.includes(mutation.payload.field)
                ) {
                    this.$nextTick(() => {
                        this.addTraces()
                    })
                }
            }
        })
        // Trigger element resize in parent component once this component is done loading
        this.$emit('loaded')
        // Wait for the signals to be cached before loading the first frame.
        if (this.RESOURCE.signalCacheStatus[0] !== this.RESOURCE.signalCacheStatus[1]) {
            this.cacheHasData = true
            this.viewDataAvailable = true
        }
        /**
         * Check if the cache status has changed and if the view data is available.
         */
        const checkCacheState = () => {
            if (this.RESOURCE.signalCacheStatus[0] !== this.RESOURCE.signalCacheStatus[1]) {
                if (!this.cacheHasData) {
                    this.cacheHasData = true
                }
                if (!this.viewDataAvailable) {
                    this.viewDataAvailable = true
                    // Allow a beat for the montage worker to reach to cache status change.
                    this.$nextTick(() => {
                        this.updateTraces()
                    })
                }
            }
        }
        this.RESOURCE.onPropertyChange('signalCacheStatus', checkCacheState, this.ID)
        this.$nextTick(() => {
            this.drawPlot()
            checkCacheState()
        })
        /**
         * Animation frame processor to update the plot if necessary.
         */
        const newFrame = () => {
            if (this.newSignalData) {
                this.wglPlot?.update()
                this.newSignalData = false
                this.updatingPlot = false
                // We need to update the displayed view start so that the navigator will be updated only after the
                // visible signals have updated.
                this.RESOURCE.displayViewStart = this.RESOURCE.viewStart
                this.$emit('plot-updated')
            }
            if (!this.destroyed) {
                this.nextAnimationFrame = requestAnimationFrame(newFrame)
            }
        }
        // Start animation frame loop.
        this.nextAnimationFrame = requestAnimationFrame(newFrame)
    },
    beforeUnmount () {
        // Stop the anomation frame loop.
        cancelAnimationFrame(this.nextAnimationFrame)
        this.destroyed = true
        // Remove all remaining leave handlers
        this.cancelPointerEventHandlers('drag')
        // Remove property update handlers
        this.RESOURCE.removeAllEventListeners(this.ID)
        // Remove key press handlers
        window.removeEventListener('keyup', this.handleKeyup, false)
        // Unsubscribe from store
        if (this.unsubscribe) {
            this.unsubscribe()
        }
    },
})
</script>

<style scoped>
[data-component="ncs-plot"] {
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: content-box !important;
    touch-action: none;
}
    .plot {
        width: 100%;
        height: 100%;
    }
</style>
