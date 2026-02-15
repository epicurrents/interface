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
                    name="ellipsis-vertical"
                    variant="regular"
                    @click="toggleControls"
                ></app-icon>
            </div>
            <wa-button
                appearance="epicv"
                @click="$emit('backward', 0)"
            >
                <app-icon name="chevrons-left" variant="regular"></app-icon>
            </wa-button>
            <wa-button
                appearance="plain"
                @click="$emit('backward', 1)"
            >
                <app-icon name="chevron-left" variant="light"></app-icon>
            </wa-button>
            <wa-button
                appearance="plain"
                @click="$emit('forward', 1)"
            >
                <app-icon name="chevron-right" variant="light"></app-icon>
            </wa-button>
            <wa-button
                appearance="epicv"
                @click="$emit('forward', 0)"
            >
                <app-icon name="chevrons-right" variant="regular"></app-icon>
            </wa-button>
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
                this.drawNavigator()
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
            const eventRows = new Map<number, number>()
            for (let i=0; i<this.RESOURCE.events.length; i++) {
                const event = this.RESOURCE.events[i]
                let evtColor = settingsColorToRgba(this.SETTINGS.navigator.annotationColor)
                for (const evtClass of Object.values(this.SETTINGS.annotations.classes)) {
                    if (event.class === evtClass.name) {
                        evtColor = settingsColorToRgba(evtClass.color as SettingsColor)
                        break
                    }
                }
                for (const [id, color] of Object.entries(this.SETTINGS.annotations.typeColors)) {
                    if (event.id?.startsWith(id)) {
                        evtColor = settingsColorToRgba(color as SettingsColor)
                        break
                    }
                }
                context.fillStyle = evtColor
                const xPos = Math.floor(event.start*durWidth)
                const xEnd = Math.floor(event.duration*durWidth)
                // Determine next available row to avoid overlap
                const overlapRows = [] as number[]
                for (let j=0; j<i; j++) {
                    const otherEvt = this.RESOURCE.events[j]
                    if (!otherEvt.duration) {
                        continue
                    }
                    if (otherEvt.start + otherEvt.duration <= event.start) {
                        continue
                    }
                    overlapRows.push(eventRows.get(j) || 0)
                }
                overlapRows.sort((a, b) => a - b)
                let nextRow = 0
                while (overlapRows.length) {
                    const nextTaken = overlapRows.shift()
                    if (nextTaken === undefined) {
                        break
                    }
                    if (nextTaken > nextRow) {
                        break
                    } else {
                        nextRow = nextTaken + 1
                    }
                }
                eventRows.set(i, nextRow)
                context.fillRect(
                    xPos,
                    nextRow*5,
                    xEnd || 1,
                    xEnd ? 5 : this.canvasHeight
                )
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
            //this.RESOURCE.activeMontage?.onPropertyChange('highlights', this.updateHighlights, this.ID)
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
            /* Signal highlights are a concept under re-evaluation.
            this.highlights.splice(0)
            const montage = this.RESOURCE.activeMontage
            if (!montage) {
                return
            }
            const curHl = [NUMERIC_ERROR_VALUE, 0] as [number, number]
            // Check which highlights are in range and only display those
            for (const [_source, context] of Object.entries(montage.highlights)) {
                if (!context.visible || !context.naviDisplay) {
                    continue
                }
                const hlCtx = [] as [number, number][]
                let i = 0
                for (const highlight of context.highlights) {
                    if (!highlight.visible) {
                        continue
                    }
                    const thisVal = 0.5*(highlight.value || 0)/(context.naviDisplay.ref || 1)
                    const interval = typeof context.naviDisplay.interval === 'function'
                                     ? context.naviDisplay.interval(i)
                                     : context.naviDisplay.interval || 0
                    if (curHl[0] === NUMERIC_ERROR_VALUE) {
                        curHl[0] = highlight.start
                        curHl[1] = thisVal
                    } else if (highlight.start - curHl[0] >= interval) {
                        hlCtx.push([curHl[0], curHl[1]])
                        curHl[0] = highlight.start
                        curHl[1] = 0
                    } else if (thisVal > curHl[1]) {
                        curHl[1] = thisVal
                    }
                    i++
                }
                hlCtx.push(curHl)
                this.highlights.push({
                    color: context.naviDisplay.color,
                    highlights: hlCtx,
                    interval: typeof context.naviDisplay.interval === 'number'
                              ? context.naviDisplay.interval
                              : 1
                })
            }
            this.drawNavigator()
            */
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
        //this.RESOURCE.activeMontage?.onPropertyChange('highlights', this.updateHighlights, this.ID)
        // ONNX watchers
        //this.$store.state.SERVICES.get('ONNX')?.onPropertyChange('results', this.drawNavigator, this.ID)
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
    }
    .controls > .toggle {
        flex: 0 0 20px;
        height: 45px;
        font-size: 1.25rem;
        line-height: 48px;
        padding: 0 0.75rem 0 0;
        position: relative;
        left: -8px;
        text-align: center;
        cursor: pointer;
        overflow: hidden;
    }
    .controls > wa-button {
        flex: 0 0 calc(25% - 5px);
        min-width: calc(25% - 5px);
        padding: 0;
        margin-right: 5px;
        font-size: 1.25rem;
        height: 45px;
        line-height: 45px;
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
