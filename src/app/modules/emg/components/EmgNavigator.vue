<template>
    <div data-component="emg-navigator">
        <div class="time">
            <div class="seconds">{{ timeValue[0] }}.</div>
            <div class="fraction">{{ timeValue[1] }}</div>
        </div>
        <div class="timeline">
            <canvas ref="navigator"
                :height="canvasHeight"
                :width="canvasWidth"
                @dblclick="handleNavigatorDblClick"
            ></canvas>
            <canvas ref="viewbox"
                :height="canvasHeight"
                style="pointer-events: none;"
                :width="canvasWidth"
            ></canvas>
            <navigator-timeline
                :duration="RESOURCE.totalDuration"
                :startTime="getTimeAtPosition(0)"
                :stepSize="timelineStepSize"
                :width="canvasWidth"
            />
        </div>
        <div class="controls">
            <wa-button
                appearance="epicv"
                :disabled="audioPlaying || undefined"
                @click="rewind"
            >
                <app-icon name="backward-fast" variant="regular"></app-icon>
            </wa-button>
            <wa-button
                appearance="epicv"
                @click="play"
            >
                <app-icon :name="audioPlaying ? 'pause' : 'play'" variant="regular"></app-icon>
            </wa-button>
            <wa-button
                appearance="plain"
                @click="$emit('backward')"
            >
                <app-icon name="chevron-left" variant="light"></app-icon>
            </wa-button>
            <wa-button
                appearance="plain"
                @click="$emit('forward')"
            >
                <app-icon name="chevron-right" variant="light"></app-icon>
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
import { settingsColorToRgba } from "@epicurrents/core/util"
import { useEmgContext } from "#app/modules/emg"
import { useStore } from "vuex"
import { SettingsColor } from "@epicurrents/core/types"
import { SignalSelectionLimit } from "#types/interface"

// Child components
import NavigatorTimeline from './EmgNavigatorTimeline.vue'

export default defineComponent({
    name: 'EmgNavigator',
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
        const audioPlaying = ref(false)
        const highlights = ref([] as { color: SettingsColor, highlights: [number, number][], interval: number }[])
        const startPosition = null as number | null
        const timeValue = reactive([] as string[])
        const unsubscribe = ref(null as (() => void) | null)
        // Template refs.
        const navigator = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>
        const viewbox = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>
        return {
            audioPlaying,
            highlights,
            startPosition,
            timeValue,
            navigator,
            viewbox,
            // Unsubscribers.
            unsubscribe,
            // Context.
            ...useEmgContext(useStore(), 'EmgNavigator'),
        }
    },
    computed: {
        canvasHeight (): number {
            return this.height - 30
        },
        /** Width available for the timeline in pixels. */
        canvasWidth (): number {
            return this.width - 250
        },
        /** A reasonable step size for timeline ticks. */
        timelineStepSize (): number {
            const labelWidth = 50
            // Calculate maximum possible amount of labels that fit taking label spacing setting into account
            const desiredLabelSpacing = labelWidth*this.SETTINGS.timeline.labelSpacing
            const maxElements = Math.floor(this.width/desiredLabelSpacing)
            // Find the step that displays the most informational labels.
            const stepSizes = [1, 2, 5, 10, 15, 20, 30, 60]
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
            this.drawViewbox()
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
            const navWidth = this.canvasWidth
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
            // Draw signal.
            this.RESOURCE.getAllSignals(this.RESOURCE.signalCacheStatus).then((response) => {
                if (!response) {
                    return
                }
                for (let i=0; i<response.signals.length; i++) {
                    const sig = response.signals[i]
                    context.strokeStyle = settingsColorToRgba(this.SETTINGS.navigator.signalColor)
                    context.beginPath()
                    const downSampleFactor = Math.max(1, Math.floor(0.5*sig.data.length/navWidth))
                    // Half a down-sample factor's range in seconds for placing the min y value at.
                    const halfRange = 0.5*downSampleFactor/(this.RESOURCE.samplingRate || 1)
                    let rangeMin = 0
                    let minUpdated = false
                    let rangeMax = 0
                    let maxUpdated = false
                    // Only use down-sampled values if the factor is greater than two.
                    const useDownSampling = downSampleFactor > 2
                    for (let i=0; i<sig.data.length; i++) {
                        sig.data[i]
                        if (useDownSampling) {
                            if (sig.data[i] < rangeMin) {
                                rangeMin = sig.data[i]
                                minUpdated = true
                            } else if (sig.data[i] > rangeMax) {
                                rangeMax = sig.data[i]
                                maxUpdated = true
                            }
                        } else {
                            rangeMax = sig.data[i]
                        }
                        if (i%downSampleFactor !== 0) {
                            continue
                        }
                        const xTimePos = this.RESOURCE.signalCacheStatus[0] + i/(this.RESOURCE.samplingRate || 1)
                        const xPos = xTimePos*durWidth
                        const heightRef = (this.RESOURCE.sensitivity || 1)*6 // Assume at least 6 vertical divs.
                        const yPos = (0.5 + 0.5*(rangeMax || rangeMin)/heightRef)*contentHeight
                        if (!i) {
                            context.moveTo(xPos, yPos)
                        } else {
                            if (useDownSampling) {
                                if (maxUpdated) {
                                    // If the maximum value has changed, draw the min value between the points.
                                    const minPos = (0.5 + 0.5*rangeMin/heightRef)*contentHeight
                                    context.lineTo(
                                        xPos - halfRange*durWidth,
                                        // If there hasn't been a new min position, draw it between the points.
                                        minPos + (minUpdated ? 0 : (yPos - minPos)/2)
                                    )
                                } else {
                                    // Otherwise draw a point between the previous max and new point.
                                    const maxPos = (0.5 + 0.5*rangeMax/heightRef)*contentHeight
                                    context.lineTo(
                                        xPos - halfRange*durWidth,
                                        maxPos + (yPos - maxPos)/2
                                    )
                                }
                            }
                            context.lineTo(xPos, yPos)
                        }
                        // Reset range values.
                        if (useDownSampling) {
                            const newMin = Math.max(rangeMin, rangeMax)
                            const newMax = Math.min(rangeMin, rangeMax)
                            rangeMin = newMin
                            rangeMax = newMax
                            minUpdated = false
                            maxUpdated = false
                        } else {
                            rangeMax = 0
                        }
                    }
                    context.stroke()
                }
            })
            // Draw event annotations.
            const annoRows = new Map<number, number>()
            for (let i=0; i<this.RESOURCE.events.length; i++) {
                const anno = this.RESOURCE.events[i]
                let annoColor = settingsColorToRgba(this.SETTINGS.navigator.annotationColor)
                for (const annoClass of Object.values(this.SETTINGS.annotations.classes)) {
                    if (anno.class === annoClass.name) {
                        annoColor = settingsColorToRgba(annoClass.color as SettingsColor)
                        break
                    }
                }
                for (const [id, color] of Object.entries(this.SETTINGS.annotations.typeColors)) {
                    if (anno.id?.startsWith(id)) {
                        annoColor = settingsColorToRgba(color as SettingsColor)
                        break
                    }
                }
                context.fillStyle = annoColor
                const xPos = Math.floor(anno.start*durWidth)
                const xEnd = Math.floor(anno.duration*durWidth)
                // Determine next available row to avoid overlap
                const overlapRows = [] as number[]
                for (let j=0; j<i; j++) {
                    const otherAnno = this.RESOURCE.events[j]
                    if (!otherAnno.duration) {
                        continue
                    }
                    if (otherAnno.start + otherAnno.duration <= anno.start) {
                        continue
                    }
                    overlapRows.push(annoRows.get(j) || 0)
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
                annoRows.set(i, nextRow)
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
                context.clearRect(xPos, 0, xLen || 1, this.canvasHeight)
                context.fillStyle = settingsColorToRgba(this.SETTINGS.navigator.interruptionColor)
                context.fillRect(xPos, 0, xLen || 1, this.canvasHeight)
            }
            // Draw viewbox.
            this.drawViewbox()
        },
        drawViewbox () {
            const boxWidth = this.viewbox.width
            const context = this.viewbox.getContext('2d')
            if (!context) {
                return
            }
            const durWidth = boxWidth/this.RESOURCE.totalDuration
            // Clear previous content
            context.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
            const contentHeight = this.canvasHeight - 2 // Leave space for progress bar.
            // Draw the new viewbox.
            const viewStart = this.RESOURCE.viewStart
            const viewLen = Math.min(this.visibleRange, this.RESOURCE.totalDuration - this.RESOURCE.viewStart)
            context.fillStyle = settingsColorToRgba(this.SETTINGS.navigator.viewBoxColor)
            context.fillRect(
                Math.round(viewStart*durWidth),
                1,
                Math.max(Math.round(viewLen*durWidth), 1),
                contentHeight
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
            const recPos = this.RESOURCE.totalDuration*xPos/this.canvasWidth
            this.$emit('navigation', recPos)
        },
        parseCursorTime () {
            const cursorTime = this.cursorPos.toFixed(3).split('.')
            this.timeValue.splice(0)
            this.timeValue.push(...cursorTime)
        },
        play () {
            if (this.RESOURCE.isAudioPlaying) {
                this.RESOURCE.pauseAudio()
            } else {
                // If the start position is set, start playing from there, otherwise resume.
                this.RESOURCE.playAudio(this.startPosition !== null ? this.startPosition : undefined)
            }
        },
        rewind () {
            this.RESOURCE.rewindAudio()
            this.RESOURCE.viewStart = 0
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
        // Add property update handlers.
        // Drawing the navigator is slow, only update it on major property changes.
        this.RESOURCE.onPropertyChange([
            'events',
            'sensitivity',
            'signalCacheStatus',
        ], this.drawNavigator, this.ID)
        // Only update the viewbox on view changes.
        this.RESOURCE.onPropertyChange([
            'displayViewStart',
            'timebase',
            'timebaseUnit',
        ], this.drawViewbox, this.ID)
        this.RESOURCE.onPropertyChange('isAudioPlaying', () => {
            this.audioPlaying = this.RESOURCE.isAudioPlaying
            // Reset start position.
            this.startPosition = null
        }, this.ID)
        this.RESOURCE.onPropertyChange('viewStart', () => {
            // If no audio is playing, set the start position for audio playback to new view start.
            if (!this.audioPlaying) {
                this.startPosition = this.RESOURCE.viewStart
            }
        }, this.ID)
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
div[data-component="emg-navigator"] {
    display: flex;
    position: relative;
    width: 100%;
    height: 100%;
}
    .time {
        display: flex;
        flex: 0 0 60px;
        flex-direction: column;
        padding: 1.25rem 0.5rem;
        text-align: right;
    }
        .time > div.seconds {
            font-size: 1.25rem;
            line-height: 1.25rem;
        }
        .time > div.fraction {
            font-size: 1rem;
            line-height: 1rem;
            color: var(--epicv-text-secondary);
        }
.timeline {
    position: relative;
    flex: 1;
}
    .timeline > canvas {
        position: absolute;
        top: 10px;
    }
.controls {
    display: flex;
    flex: 0 0 175px;
    max-width: 175px;
    padding-top: 10px;
}
    .controls > wa-button {
        flex: 0 0 calc(25% - 5px);
        min-width: calc(25% - 5px);
        padding: 0;
        margin-right: 5px;
        font-size: 1.25rem;
        height: 48px;
        line-height: 45px;
    }
        .controls > wa-button::part(base) {
            height: 45px;
            line-height: 45px;
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
