<template>
    <div data-component="eeg-navigator">
        <div class="time">
            <div class="cursor-time">
                <span v-if="timeValue.length > 3">{{ timeValue[3] }}:</span>
                <span v-if="timeValue.length > 2">{{ timeValue[2] }}:</span>
                <span class="seconds">{{ timeValue[1] }}</span>
                <span class="fraction">{{ timeValue[0] }}</span>
            </div>
            <div :class="[
                    'cursor-day',
                    { 'epicv-disabled': getDayNumber(0) === getDayNumber(RESOURCE.totalDuration) }
                ]"
            >
                {{ $t(`Day {d}`, { d: getDayNumber(cursorPos)}) }}
            </div>
        </div>
        <div class="timeline">
            <canvas ref="navigator"
                :height="canvasHeight"
                :width="canvasWidth"
                @dblclick="handleNavigatorDblClick"
            ></canvas>
            <navigator-timeline
                :duration="RESOURCE.totalDuration"
                :startTime="getTimeAtPosition(0)"
                :stepSize="timelineStepSize"
                :width="canvasWidth"
            />
        </div>
        <div :class="{
                controls: true,
                open: isControlsOpen,
            }"
        >
            <div class="toggle">
                <app-icon
                    id="epicv-eeg-navigation-toggle"
                    name="ellipsis-vertical"
                    variant="regular"
                    @click="toggleControls"
                ></app-icon>
                <wa-tooltip
                    for="epicv-eeg-navigation-toggle"
                    placement="bottom"
                >
                    {{ isControlsOpen ? $t('Hide controls') : $t('Show controls') }}
                </wa-tooltip>
            </div>
            <wa-button
                appearance="epicv"
                id="epicv-eeg-navigation-backward"
                @click="$emit('backward', 0)"
            >
                <app-icon name="chevrons-left" variant="regular"></app-icon>
            </wa-button>
            <wa-tooltip
                for="epicv-eeg-navigation-backward"
                placement="bottom"
            >
                {{ $t('Page backward') }}
            </wa-tooltip>
            <wa-button
                appearance="plain"
                id="epicv-eeg-navigation-backward-step"
                @click="$emit('backward', 1)"
            >
                <app-icon name="chevron-left" variant="light"></app-icon>
            </wa-button>
            <wa-tooltip
                for="epicv-eeg-navigation-backward-step"
                placement="bottom"
            >
                {{ $t('Step backward') }}
            </wa-tooltip>
            <wa-button
                appearance="plain"
                id="epicv-eeg-navigation-forward-step"
                @click="$emit('forward', 1)"
            >
                <app-icon name="chevron-right" variant="light"></app-icon>
            </wa-button>
            <wa-tooltip
                for="epicv-eeg-navigation-forward-step"
                placement="bottom"
            >
                {{ $t('Step forward') }}
            </wa-tooltip>
            <wa-button
                appearance="epicv"
                id="epicv-eeg-navigation-forward"
                @click="$emit('forward', 0)"
            >
                <app-icon name="chevrons-right" variant="regular"></app-icon>
            </wa-button>
            <wa-tooltip
                for="epicv-eeg-navigation-forward"
                placement="bottom"
            >
                {{ $t('Page forward') }}
            </wa-tooltip>
        </div>
    </div>
</template>

<script lang="ts">
/**
 * EEG navigator.
 */
import { defineComponent, reactive, Ref, ref, PropType } from "vue"
import { T } from "#i18n"
import { padTime, secondsToTimeString, settingsColorToRgba } from "@epicurrents/core/util"
import { useEegContext } from "#app/modules/eeg"
import { useStore } from "vuex"
import { SettingsColor } from "@epicurrents/core/types"
import { HighlightContext } from "#types/plot"
import { SignalSelectionLimit } from "#types/interface"

// Child components
import NavigatorTimeline from './EegNavigatorTimeline.vue'

export default defineComponent({
    name: 'EegNavigator',
    components: {
        NavigatorTimeline,
    },
    props: {
        cursorPos: {
            type: Number,
            required: true,
        },
        height: {
            type: Number,
            required: true,
        },
        selectionBound: {
            type: Object as PropType<SignalSelectionLimit | null>,
            default: null,
        },
        visibleRange: {
            type: Number,
            required: true,
        },
        width: {
            type: Number,
            required: true,
        },
    },
    setup () {
        const highlights = ref([] as { color: SettingsColor, highlights: [number, number][], interval: number }[])
        const isTouchScreen = 'ontouchstart' in window || window.navigator.maxTouchPoints > 0
        const isControlsOpen = ref(isTouchScreen) // Controls are open by default on touch devices.
        const navigator = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>
        const timeValue = reactive([] as string[])
        const unsubscribe = ref(null as (() => void) | null)
        return {
            highlights,
            isControlsOpen,
            navigator,
            timeValue,
            // Unsubscribers
            unsubscribe,
            ...useEegContext(useStore(), 'EegNavigator'),
        }
    },
    computed: {
        canvasHeight (): number {
            return this.height - 30
        },
        /** Width available for the timeline in pixels. */
        canvasWidth (): number {
            return this.isControlsOpen
                ? this.width - 290
                : this.width - 110
        },
        /** A reasonable step size for timeline ticks. */
        timelineStepSize (): number {
            const labelWidth = 50
            // Calculate maximum possible amount of labels that fit taking label spacing setting into account
            const desiredLabelSpacing = labelWidth*this.SETTINGS.timeline.labelSpacing
            const maxElements = Math.floor(this.width/desiredLabelSpacing)
            // Find the step that displays the most informational labels
            const stepSizes = [
                // Seconds
                1, 5, 10, 30,
                // Minutes
                60, 120, 300, 600, 900, 1800,
                // Hours
                3600, 7200, 10800, 21600, 43200,
                // Days
                86400,
            ]
            // Return the first value that fits
            for (const step of stepSizes) {
                if (this.RESOURCE.totalDuration/step < maxElements) {
                    return step
                }
            }
            // No reasonable step value found
            return 0
        },
    },
    watch: {
        cursorPos () {
            this.parseCursorTime()
        },
        height () {
            this.$nextTick(() => {
                this.drawNavigator()
            })
        },
        selectionBound () {
            this.drawNavigator()
        },
        visibleRange () {
            this.drawNavigator()
        },
        width () {
            this.$nextTick(() => {
                // updateHighlights resamples the rejection curve to the new canvas
                // width, then calls drawNavigator internally.
                this.updateHighlights()
            })
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
         * Draw the navigator.
         */
        drawNavigator () {
            const navWidth = this.navigator.width
            const context = this.navigator.getContext('2d')
            if (!context) {
                return
            }
            const durWidth = navWidth/this.RESOURCE.totalDuration
            const contentHeight = this.canvasHeight - 2 // Leave space for progress bar.
            // Clear previous content
            context.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
            // Draw borders
            context.fillStyle = settingsColorToRgba(this.SETTINGS.navigator.borderColor)
            context.fillRect(0, 0, this.canvasWidth, 1)
            context.fillRect(0, this.canvasHeight - 1, this.canvasWidth, 1)
            context.fillRect(0, 0, 1, this.canvasHeight)
            context.fillRect(this.canvasWidth - 1, 0, 1, this.canvasHeight)
            // Draw timeline ticks if a tick value was found.
            // (Note: A step size of 0 will result in an infinite loop if it's not checked for!)
            if (this.timelineStepSize) {
                const startTime = this.getTimeAtPosition(0)
                const startPos = (this.timelineStepSize - startTime%this.timelineStepSize)
                context.fillStyle = settingsColorToRgba(this.SETTINGS.navigator.tickColor)
                for (let i=startPos; i<this.RESOURCE.totalDuration; i+=this.timelineStepSize) {
                    const xPos = Math.floor(i*durWidth)
                    context.fillRect(xPos, 0, 1, this.canvasHeight)
                }
            }
            // Draw channel highlights
            for (const hlCtx of this.highlights) {
                const padStart = 0.5*hlCtx.interval
                const padEnd = 1.5*hlCtx.interval
                if (hlCtx.highlights.length) {
                    context.strokeStyle = settingsColorToRgba(hlCtx.color as SettingsColor)
                    context.beginPath()
                    const startPoint = Math.max(hlCtx.highlights[0][0] - padStart, 0)
                    context.moveTo(startPoint*durWidth, contentHeight)
                    let lastPoint = startPoint
                    let bestValue = hlCtx.highlights[0][1]
                    for (const hl of hlCtx.highlights) {
                        if (hl[0] >= lastPoint + padStart + padEnd) {
                            context.lineTo((lastPoint + padEnd)*durWidth, contentHeight)
                            context.stroke()
                            context.fillStyle = settingsColorToRgba(hlCtx.color as SettingsColor, 0.5)
                            context.fill()
                            context.beginPath()
                            context.moveTo((hl[0] - padStart)*durWidth, contentHeight)
                            bestValue = hl[1]
                        }
                        context.lineTo((hl[0] + 0.5*hlCtx.interval)*durWidth, (0.9 - hl[1])*contentHeight)
                        lastPoint = hl[0]
                        if (bestValue < hl[1]) {
                            bestValue = hl[1]
                        }
                    }
                    const endPoint = Math.min(
                        hlCtx.highlights[hlCtx.highlights.length - 1][0] + padEnd,
                        this.RESOURCE.totalDuration
                    )
                    context.lineTo(endPoint*durWidth, contentHeight)
                    context.stroke()
                    context.fillStyle = settingsColorToRgba(hlCtx.color as SettingsColor, 0.5)
                    context.fill()
                }
            }
            // Draw events
            // Pre-compute color lookups to avoid O(classes × events) inner-loop cost.
            const colorByClass = new Map<string, string>()
            for (const [name, evtClass] of Object.entries(this.SETTINGS.annotations.classes)) {
                colorByClass.set(name, settingsColorToRgba(evtClass.color as SettingsColor))
            }
            const colorByIdPrefix = Object.entries(this.SETTINGS.annotations.typeColors)
                .map(([id, color]) => [id, settingsColorToRgba(color as SettingsColor)] as const)
            const defaultEvtColor = settingsColorToRgba(this.SETTINGS.navigator.annotationColor)
            // Pixel map: x-pixel → row → color.  row = -1 means full-height instant event.
            // Deduplicates events that collapse to the same canvas pixel.
            const pixelMap = new Map<number, Map<number, string>>()
            // Height of a single event row in pixels.
            const rowHeight = 3
            // Row end-time tracker for O(n×r) overlap assignment instead of O(n²).
            const rowEnds = [] as number[]
            for (const event of this.RESOURCE.events) {
                const evtColor = colorByClass.get(event.class)
                    ?? colorByIdPrefix.find(([id]) => event.id?.startsWith(id))?.[1]
                    ?? defaultEvtColor
                const xPos = Math.floor(event.start*durWidth)
                const xWidth = Math.floor(event.duration*durWidth)
                if (!event.duration) {
                    // Instant event: full-height marker, no row stacking.
                    const col = pixelMap.get(xPos) ?? new Map<number, string>()
                    if (!col.has(-1)) {
                        col.set(-1, evtColor)
                    }
                    pixelMap.set(xPos, col)
                    continue
                }
                // Find first row whose last event has already ended.
                let row = 0
                while (row < rowEnds.length && rowEnds[row] > event.start) {
                    row++
                }
                rowEnds[row] = event.start + event.duration
                // Claim pixels for this event; first claimant per (x, row) wins.
                const xEnd = xPos + (xWidth || 1)
                for (let x = xPos; x < xEnd; x++) {
                    const col = pixelMap.get(x) ?? new Map<number, string>()
                    if (!col.has(row)) {
                        col.set(row, evtColor)
                    }
                    pixelMap.set(x, col)
                }
            }
            // Single drawing pass over the pixel map.
            for (const [x, rows] of pixelMap) {
                for (const [row, color] of rows) {
                    context.fillStyle = color
                    if (row === -1) {
                        context.fillRect(x, 0, 1, this.canvasHeight)
                    } else {
                        context.fillRect(x, row*rowHeight, 1, rowHeight)
                    }
                }
            }
            // Draw possible selection bound marker.
            if (this.selectionBound) {
                context.fillStyle = settingsColorToRgba(this.SETTINGS.selectionBound.color)
                context.fillRect(Math.floor(this.selectionBound.position*durWidth), 0, 1, this.canvasHeight)
            }
            // Draw loading progress bar
            const loadedLen = this.RESOURCE.signalCacheStatus[1] - this.RESOURCE.signalCacheStatus[0]
            context.fillStyle = settingsColorToRgba(this.SETTINGS.navigator.loadedColor)
            context.fillRect(0, contentHeight, Math.round(loadedLen*durWidth), 2)
            // Draw cached progress bar
            if (this.RESOURCE.activeMontage?.cacheStatus) {
                const cacheLen = this.RESOURCE.activeMontage?.cacheStatus.end
                                 - this.RESOURCE.activeMontage?.cacheStatus.start
                context.fillStyle = settingsColorToRgba(this.SETTINGS.navigator.cachedColor)
                context.fillRect(0, contentHeight, Math.round(cacheLen*durWidth), 2)
            }
            // Clear everything from interruptions and fill with the proper color.
            for (const {start, duration} of this.RESOURCE.getInterruptions()) {
                const xPos = Math.floor(start*durWidth)
                const xLen = Math.floor(duration*durWidth)
                context.clearRect(xPos, 0, xLen || 1, this.navigator.height)
                context.fillStyle = settingsColorToRgba(this.SETTINGS.navigator.interruptionColor)
                context.fillRect(xPos, 0, xLen || 1, this.navigator.height)
            }
            // Draw viewbox
            const viewStart = this.RESOURCE.viewStart
            const viewLen = Math.min(this.visibleRange, this.RESOURCE.totalDuration - this.RESOURCE.viewStart)
            context.fillStyle = settingsColorToRgba(this.SETTINGS.navigator.viewBoxColor)
            context.fillRect(
                Math.round(viewStart*durWidth),
                1,
                Math.max(Math.round(viewLen*durWidth), 1),
                this.canvasHeight
            )
        },
        getTimeAtPosition (position: number) {
            const startSeconds = this.RESOURCE.startTime ? + this.RESOURCE.startTime.getHours()*60*60
                                                            + this.RESOURCE.startTime.getMinutes()*60
                                                            + this.RESOURCE.startTime.getSeconds()
                                                          : 0
            return startSeconds + position
        },
        /**
         * Get the relative day number (starting from one) at given time.
         * @param time - Timestamp as seconds from recording start.
         */
        getDayNumber (time: number) {
            return this.RESOURCE.getAbsoluteTimeAt(time).day
        },
        /**
         * Handle double-click on the navigator canvas.
         */
        handleNavigatorDblClick (event: MouseEvent) {
            const xPos = event.x - this.navigator.getBoundingClientRect().left
            const recPos = this.RESOURCE.totalDuration*xPos/this.navigator.width
            this.$emit('navigation', recPos)
        },
        montageChanged () {
            this.RESOURCE.activeMontage?.onPropertyChange('highlights', this.updateHighlights, this.ID)
            this.updateHighlights()
        },
        parseCursorTime (relative = false) {
            let time = [] as string[]
            const timeParts = secondsToTimeString(
                                    Math.floor(relative ? this.cursorPos : this.getTimeAtPosition(this.cursorPos)),
                                    true
                                ) as number[]
            if (!relative) {
                // Add hours with possible padding zero if we use absolute time.
                time.push(padTime(timeParts[1]))
            } else if (timeParts[1]) {
                // Only add hours to relative time if they are larger than 0.
                time.push(timeParts[1].toString())
            }
            time.unshift(padTime(timeParts[2]))
            if (relative) {
                time.unshift(padTime(timeParts[3]))
            }
            let fraction = relative ? '.' : `${padTime(timeParts[3])}.`
            // Use greater precision for relative time.
            const fractionDigits = relative ? 3 : 1
            fraction += this.cursorPos.toFixed(fractionDigits).split('.')[1]
            this.timeValue.splice(0)
            this.timeValue.push(fraction, ...time)
        },
        toggleControls () {
            this.isControlsOpen = !this.isControlsOpen
            this.$nextTick(() => {
                // Redraw navigator after controls are toggled.
                this.drawNavigator()
            })
        },
        updateHighlights () {
            this.highlights.splice(0)
            const montage = this.RESOURCE.activeMontage
            if (!montage) {
                this.drawNavigator()
                return
            }
            const totalChannels = montage.channels.length
            const totalDuration = this.RESOURCE.totalDuration
            if (!totalChannels || !totalDuration) {
                this.drawNavigator()
                return
            }
            // Adaptive sample interval: target ~3 samples per navigator pixel so the
            // curve is smooth at any recording length.  Minimum 5 s to avoid spikes
            // from individual short rejected epochs dominating the display.
            const SAMPLE_INTERVAL = Math.max(5, Math.round(totalDuration / this.canvasWidth * 3))
            const nSamples = Math.ceil(totalDuration / SAMPLE_INTERVAL)
            for (const [_source, ctx] of Object.entries(montage.highlights) as [string, HighlightContext][]) {
                if (!ctx.visible || !ctx.plotDisplay || !ctx.highlights.length) {
                    continue
                }
                // Weighted rejection fraction per sample: each highlight contributes
                // (channels in highlight) × (overlap with sample / sample length) / totalChannels.
                // Weighting by overlap fraction smooths short bursts naturally.
                const weightMap = new Float32Array(nSamples)
                for (const hl of ctx.highlights) {
                    if (!hl.visible) {
                        continue
                    }
                    const nChan = hl.channels.length
                    const startIdx = Math.floor(hl.start / SAMPLE_INTERVAL)
                    const endIdx = Math.min(Math.ceil(hl.end / SAMPLE_INTERVAL), nSamples)
                    for (let i = startIdx; i < endIdx; i++) {
                        const sampleStart = i * SAMPLE_INTERVAL
                        const sampleEnd = sampleStart + SAMPLE_INTERVAL
                        const overlap = Math.min(hl.end, sampleEnd) - Math.max(hl.start, sampleStart)
                        if (overlap > 0) {
                            weightMap[i] += nChan * (overlap / SAMPLE_INTERVAL) / totalChannels
                        }
                    }
                }
                // Convert to [time_offset, fraction] pairs, skipping zero samples.
                const series: [number, number][] = []
                for (let i = 0; i < nSamples; i++) {
                    if (weightMap[i] > 0) {
                        series.push([i * SAMPLE_INTERVAL, Math.min(weightMap[i], 1)])
                    }
                }
                if (series.length > 0) {
                    this.highlights.push({
                        color: ctx.plotDisplay.color,
                        highlights: series,
                        interval: SAMPLE_INTERVAL,
                    })
                }
            }
            this.drawNavigator()
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
        this.RESOURCE.onPropertyChange('events', this.drawNavigator, this.ID)
        this.RESOURCE.onPropertyChange('interruptions', this.drawNavigator, this.ID)
        this.RESOURCE.onPropertyChange('displayViewStart', this.drawNavigator, this.ID)
        this.RESOURCE.onPropertyChange('signalCacheStatus', this.drawNavigator, this.ID)
        this.RESOURCE.activeMontage?.onPropertyChange('highlights', this.updateHighlights, this.ID)
        // Trigger element resize in parent component once this component is done loading
        this.$emit('loaded')
        // Trigger first navigator draw
        this.$nextTick(() =>  {
            this.parseCursorTime()
            this.drawNavigator()
        })
    },
    beforeUnmount () {
        // Remove property update handlers
        this.RESOURCE.removeAllEventListeners(this.ID)
        this.RESOURCE.activeMontage?.removeAllEventListeners(this.ID)
        this.$store.state.SERVICES.get('ONNX')?.removeAllEventListeners(this.ID)
    },
})
</script>

<style scoped>
[data-component="eeg-navigator"] {
    display: flex;
    position: relative;
    width: 100%;
    height: 100%;
}
    .time {
        display: flex;
        flex-direction: column-reverse;
        flex: 0 0 80px;
        height: 100%;
        padding-bottom: 17px;
    }
        .cursor-day {
            padding: 0.125rem 0.5rem;
            font-size: 0.9rem;
            text-align: right;
        }
        .cursor-time {
            line-height: 0.75rem;
            padding: 0.125rem 0.5rem;
            text-align: right;
        }
        .cursor-time > span {
            /* Pseudo-monospace */
            display: inline-block;
            width: 1.35rem;
        }

        .cursor-time > span.seconds {
            width: 1.2rem;
        }
        .cursor-time > span.fraction {
            width: 100%;
            font-size: 0.7em;
        }
.timeline {
    flex: 1 1 auto;
    padding-top: 10px;
}
.controls {
    bottom: 20px;
    display: flex;
    flex: 0 0 20px;
    height: 45px;
    max-width: 200px;
    overflow: hidden;
    position: absolute;
    right: 0;
}
    .controls:not(.open) > *:not(.toggle) {
        display: none;
    }
    .controls.open {
        flex: 0 0 200px;
        overflow: visible;
    }
    .controls > .toggle {
        flex: 0 0 20px;
        height: 45px;
        font-size: 1.25rem;
        line-height: 48px;
        padding: 0 0.75rem 0 0;
        position: relative;
        left: -10px;
        text-align: center;
        cursor: pointer;
        overflow: hidden;
    }
    .controls > wa-button {
        flex: 0 0 calc(25% - 5px);
        font-size: 1.25rem;
        height: 45px;
        line-height: 45px;
        margin-right: 5px;
        min-width: calc(25% - 5px);
        padding: 0;
        position: relative;
        top: -2px;
    }
        .controls > wa-button::part(base) {
            height: 42px;
            line-height: 42px;
            width: calc(25% - 5px);
        }
        .controls > wa-button wa-icon {
            color: var(--epicv-text-emphasis);
        }
    .controls > wa-button[appearance=plain] {
        flex: 0 0 calc(20% - 5px);
        min-width: calc(20% - 5px);
        font-size: 1rem;
        height: 32px;
    }
        .controls > wa-button[appearance=plain]::part(base) {
            height: 32px;
            width: calc(20% - 5px);
        }
</style>
