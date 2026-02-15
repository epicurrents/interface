<template>
    <div data-component="examine-tool">
        <svg ref="svg" :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
            class="signal"
            @pointerdown="handlePointerdown"
            @pointermove="handlePointermove"
            @pointerleave="handlePointerLeave"
            @contextmenu.prevent=""
        >
            <g v-if="activeProps">
                <line v-if="activeProps.baseline > 0" x1="0" :y1="activeProps.baseline" :x2="svgWidth" :y2="activeProps.baseline"
                    shape-rendering="crispEdges"
                    :stroke="settingsColorToRgba(SETTINGS.tools.signalBaseline.color)"
                    :stroke-dasharray="settingsDashArrayToSvgStrokeDasharray(
                        SETTINGS.tools.signalBaseline.dasharray
                    )"
                    :stroke-width="SETTINGS.tools.signalBaseline.width"
                />
            </g>
            <g v-if="activeProps">
                <polyline
                    fill="none"
                    :stroke="settingsColorToRgba(SETTINGS.tools.signals[selected].color)"
                    :stroke-dasharray="settingsDashArrayToSvgStrokeDasharray(
                        SETTINGS.tools.signals[selected].dasharray
                    )"
                    :stroke-width="SETTINGS.tools.signals[selected].width"
                    :points="activeProps.points"
                />
            </g>
            <!-- Spike triangle -->
            <g v-if="activeProps && info==='spike' && activeSelection.markers.length >= 3"
                class="spiketriangle"
            >
                <polyline
                    fill="none"
                    :stroke="'rgba(160,0,0,0.4)'"
                    :stroke-width="2"
                    :points="`
                        ${xForMarker(activeSelection.markers[0])},${yForMarker(activeSelection.markers[0])}
                        ${xForMarker(activeSelection.markers[1])},${yForMarker(activeSelection.markers[1])}
                        ${xForMarker(activeSelection.markers[2])},${yForMarker(activeSelection.markers[2])}
                        ${xForMarker(activeSelection.markers[0])},${yForMarker(activeSelection.markers[0])}
                    `"
                />
            </g>
            <!-- Markers for each point of interest. -->
            <template v-if="activeProps">
                <g v-for="marker of activeSelection.markers" :key="`examine-tool-poi-cursor-${marker.id}`">
                    <line :x1="xForMarker(marker)" y1="0" :x2="xForMarker(marker)" :y2="height"
                        shape-rendering="crispEdges"
                        class="marker"
                        :stroke="settingsColorToRgba(SETTINGS.tools.poiMarkerLine.color)"
                        :stroke-dasharray="settingsDashArrayToSvgStrokeDasharray(
                            SETTINGS.tools.poiMarkerLine.dasharray
                        )"
                        :stroke-width="SETTINGS.tools.poiMarkerLine.width"
                    />
                </g>
            </template>
            <!-- Circles for each point of interest -->
            <template v-if="activeProps">
                <g v-for="marker of activeSelection.markers" :key="`examine-tool-poi-circle-${marker.id}`">
                    <circle :cx="xForMarker(marker)" :cy="yForMarker(marker)" :r="SETTINGS.tools.poiMarkerCircle.radius"
                        fill="none"
                        :stroke="settingsColorToRgba(SETTINGS.tools.poiMarkerCircle.color)"
                        :stroke-dasharray="settingsDashArrayToSvgStrokeDasharray(
                            SETTINGS.tools.poiMarkerCircle.dasharray
                        )"
                        :stroke-width="SETTINGS.tools.poiMarkerCircle.width"
                    />
                </g>
            </template>
        </svg>
        <div class="signal-info">
            <div class="header">
                <span class="epicv-link-alike" @click="displayInfo('markers')">{{ $t('Markers') }}</span>
                <!--| <span class="epicv-link-alike" @click="displayInfo('spike')">{{ $t('Spike') }}</span>-->
                <span :class="[
                        'epicv-link-alike',
                        'right',
                    ]"
                    @click="clearMarkers()"
                >{{ $t('Clear') }}</span>
            </div>
            <template v-if="activeProps && activeSelection.signal && info==='markers'">
                <div class="row">
                    <span class="order">#</span>
                    <span class="double">{{ $t('Time / &Delta; (ms)') }}</span>
                    <!-- &Delta; does not work in I18n parameter replacement string for some reason -->
                    <span class="double">{{ $t('Voltage / Δ ({unit})', { unit: $t(activeSelection.channel.unit) }) }}</span>
                </div>
                <div v-for="(cursor, idx) of activeSelection.markers" :key="`examine-tool-cursor-info-${idx}`" class="row">
                    <span class="order">{{ idx+1 }}</span>
                    <span class="value">{{
                        cursor.index >= 0 && cursor.index < activeSelection.signal.data.length
                            ? (1000*cursor.index/activeSelection.channel.samplingRate).toFixed() : ''
                    }}</span>
                    <span class="value">
                        {{ idx ? (1000*(cursor.index-activeSelection.markers[idx-1].index)/activeSelection.channel.samplingRate).toFixed() : '' }}
                    </span>
                    <span class="value">
                        {{
                            cursor.value !== undefined
                            ? Math.abs(getScaledValue(cursor)) < 1000
                                ? getScaledValue(cursor).toFixed(1)
                                : getScaledValue(cursor).toFixed()
                            : ''
                        }}
                    </span>
                    <span class="value">
                        {{
                            idx
                            ? Math.abs(getScaledValue(cursor) - getScaledValue(activeSelection.markers[idx-1])) < 1000
                                ? (getScaledValue(cursor) - getScaledValue(activeSelection.markers[idx-1])).toFixed(1)
                                : (getScaledValue(cursor) - getScaledValue(activeSelection.markers[idx-1])).toFixed()
                            : ''
                        }}
                    </span>
                </div>
                <div v-if="activeProps && markerFrequency" class="separator"></div>
                <div v-if="activeProps && markerFrequency" class="row">
                    <span class="double">{{ $t('Frequency') }}</span>
                    <span class="semi">~{{ markerFrequency.mean.toFixed(1) }} Hz</span>
                    <span class="epicv-inactive semi">({{ markerFrequency.min.toFixed(1) }}-{{ markerFrequency.max.toFixed(1) }})</span>

                </div>
            </template>
            <template v-if="activeProps && info==='spike'">
                <div v-if="activeSelection.markers.length >= 2" class="row" :key="`examine-tool-spike-incl-${version}`">
                    <span class="double">{{ $t('Inclination') }}</span>
                    <span class="semi">{{ getDistanceBetween(activeSelection.markers[0], activeSelection.markers[1]).toFixed(1) }} mm</span>
                    <span class="semi">{{ getAngleBetween(activeSelection.markers[0], activeSelection.markers[1]).toFixed(1) }} &deg;</span>
                </div>
                <div v-if="activeSelection.markers.length >= 3" class="row" :key="`examine-tool-spike-decl-${version}`">
                    <span class="double">{{ $t('Declination') }}</span>
                    <span class="semi">{{ getDistanceBetween(activeSelection.markers[1], activeSelection.markers[2]).toFixed(1) }} mm</span>
                    <span class="semi">{{ getAngleBetween(activeSelection.markers[1], activeSelection.markers[2]).toFixed(1) }} &deg;</span>
                </div>
                <div v-if="activeSelection.markers.length >= 3" class="row" :key="`examine-tool-spike-duration-${version}`">
                    <span class="double">{{ $t('Duration') }}</span>
                    <span class="double">{{ getTimeBetween(activeSelection.markers[0], activeSelection.markers[2]).toFixed() }} ms</span>
                </div>
            </template>
        </div>
    </div>
</template>

<script lang="ts">
/**
 * Signal selection examination tool.
 */
import { defineComponent, reactive, ref, Ref, PropType } from "vue"
import { T } from "#i18n"
import { getSignalScale, settingsColorToRgba, settingsDashArrayToSvgStrokeDasharray } from "@epicurrents/core/util"
import { PointerInteraction } from "#types/interface"
import { NUMERIC_ERROR_VALUE } from "@epicurrents/core/util"
import { PlotTraceSelection, SignalPoI } from "#types/plot"
import { useEegContext } from "#app/modules/eeg"
import { NO_POINTER_BUTTON_DOWN } from "#util"
import { useStore } from "vuex"

type SignalProperties = {
    baseline: number
    margin: number
    points: string
    res: number
    xPerPoint: number
}

const CURSOR_MARGIN = 5
const PAD_AMOUNT = 1

export default defineComponent({
    name: 'ExamineTool',
    props: {
        cmPerSec: {
            type: Number,
            required: true,
        },
        data: {
            type: Object as PropType<PlotTraceSelection[]>,
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
        width: {
            type: Number,
            required: true,
        },
    },
    setup (props) {
        const points = ref('')
        const baseline = ref(0)
        const maxMarkers = ref(8)
        const cursorId = ref(0)
        const info = ref('markers')
        const signalProps = reactive([] as SignalProperties[])
        const activeProps = ref(null as SignalProperties | null)
        const activeSelection = props.data[props.selected] as PlotTraceSelection
        const pointerButton = ref(NO_POINTER_BUTTON_DOWN)
        const pointerEventHandlers = reactive({
            drag: []
        } as { [operation in PointerInteraction]: ((event?: PointerEvent) => void)[] })
        const dragging = ref(false)
        const svg = ref<SVGElement>() as Ref<SVGElement>
        // Version counter to force updates
        const version = ref(0)
        return {
            activeProps,
            activeSelection,
            baseline,
            cursorId,
            dragging,
            info,
            maxMarkers,
            pointerButton,
            pointerEventHandlers,
            points,
            signalProps,
            svg,
            version,
            // Imported methods
            settingsColorToRgba,
            settingsDashArrayToSvgStrokeDasharray,
            // Shorthands
            ...useEegContext(useStore(), 'ExamineTool'),
        }
    },
    watch: {
        data: {
            handler () {
                this.calculateSignalProperties(true)
            },
            deep: true,
        },
        dragging (value: boolean) {
            if (value) {
                this.svg.style.cursor = 'pointer'
            } else {
                this.updateSvgCursorStyle()
            }
        },
        selected (value: number) {
            this.activeProps = this.signalProps[value]
            this.activeSelection = this.data[value]
        },
    },
    computed: {
        markerFrequency (): { mean: number, min: number, max: number } | null {
            if (!this.activeProps) {
                return null
            }
            const markerPositions = this.activeSelection?.markers.map(mark => mark.index) || []
            if (markerPositions.length < 3) {
                return null
            }
            let minHz = 0
            let maxHz = 0
            for (let i=1; i<markerPositions.length; i++) {
                const intrvlHz = (this.activeSelection?.channel.samplingRate || 0)/(markerPositions[i] - markerPositions[i - 1])
                if (!minHz || intrvlHz < minHz) {
                    minHz = intrvlHz
                }
                if (!maxHz || intrvlHz > maxHz) {
                    maxHz = intrvlHz
                }
            }
            const maxPos = Math.max(...markerPositions)
            const minPos = Math.min(...markerPositions)
            return {
                min: minHz,
                mean: (this.activeSelection?.channel.samplingRate || 0)/((maxPos - minPos)/(markerPositions.length - 1)),
                max: maxHz
            }
        },
        svgHeight (): number {
            // Remove half a rem.
            return this.height - 8
        },
        svgWidth (): number {
            // Reduce side panel and border widths.
            return this.width - 300 - 2
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
        calculateSignalProperties (onlyActive = false) {
            for (let i=0; i<this.data.length; i++) {
                const selection = this.data[i]
                if (!selection.signal || (onlyActive && i !== this.selected)) {
                    continue
                }
                const croppedSignal = selection.crop.length === 2
                                      ? selection.signal.data.subarray(selection.crop[0], selection.crop[1])
                                      : selection.signal.data
                // Length of the line that can be drawn between signal data points is
                // the length of the signal - 1
                const xPerPoint = this.svgWidth/((croppedSignal.length || 0) - 1 + 2*PAD_AMOUNT)
                // Create props if they don't exist yet
                const props = this.signalProps[i] || {}
                props.res = (croppedSignal.length || 0)/this.svgWidth
                props.xPerPoint = xPerPoint
                this.signalProps[i] = props
                const sigArray = Array.from(croppedSignal)
                const minValue = Math.min(...sigArray)
                const maxValue = Math.max(...sigArray)
                // First determine signal bounds
                props.margin = (maxValue - minValue)*0.2
                const displayMax = maxValue + props.margin
                const displayMin = minValue - props.margin
                // Update baseline
                props.baseline = Math.floor(this.svgHeight*(-1*displayMin)/(displayMax - displayMin)) + 0.5
                // Construct signal display SVG coordinate pairs from signal data
                const points = [] as string[]
                // Add padding
                let x = PAD_AMOUNT*props.xPerPoint
                for (const y of croppedSignal) {
                    points.push(`${x},${this.svgHeight*((y - displayMin)/(displayMax - displayMin))}`)
                    x += props.xPerPoint
                }
                props.points = points.join(', ')
            }
        },
        cancelPointerEventHandlers (operation: PointerInteraction, event?: PointerEvent) {
            while (this.pointerEventHandlers[operation].length) {
                const handler = this.pointerEventHandlers[operation].shift()
                if (handler) {
                    handler(event)
                }
            }
        },
        clearMarkers () {
            this.activeSelection?.markers.splice(0)
        },
        displayInfo (info: string) {
            this.info = info
        },
        /**
         * Force update on elements that are keyed to the version.
         */
        forceUpdate () {
            this.version++
        },
        /**
         * Get the angle between two points of interest. This method will return the
         * angle between the line from `pointA` to `pointB` and the straight vertical line
         * through `pointB` (essentially, the part of the spike tip angle on either the
         * inclination or declination side).
         */
        getAngleBetween (pointA: SignalPoI, pointB: SignalPoI) {
            const dx = this.xForMarker(pointB) - this.xForMarker(pointA)
            const dy = this.yForMarker(pointB) - this.yForMarker(pointA)
            var theta = Math.atan2(dy, dx)
            theta *= 180 / Math.PI // Radians to degrees
            if (theta < 0) {
                // This is a "rising" angle
                theta += 90
            } else {
                // This is a "declining" angle
                theta = 90 - theta
            }
            return theta
        },
        /**
         * Get the distance between `pointA` and `pointB` in millimeters.
         */
        getDistanceBetween (pointA: SignalPoI, pointB: SignalPoI) {
            if (!this.activeSelection) {
                return 0
            }
            const sensitivity = this.activeSelection.channel.sensitivity || this.RESOURCE.sensitivity || 1
            // Use millimeters
            const dx = 10*this.cmPerSec*(pointB.index - pointA.index)/this.activeSelection.channel.samplingRate
            const dy = 10*(pointB.value - pointA.value)/sensitivity
            return Math.sqrt(dx**2 + dy**2)
        },
        /**
         * Get nearest true signal data point x value at given x.
         */
        getNearestX (x: number) {
            if (!this.activeProps ||!this.activeSelection?.signal) {
                return NUMERIC_ERROR_VALUE
            }
            const sigIdx = Math.round(x/this.activeProps.xPerPoint) + (this.activeSelection.crop[0] || 0) - PAD_AMOUNT
            if (sigIdx < 0 || sigIdx >= this.activeSelection.signal.data.length) {
                return NUMERIC_ERROR_VALUE
            }
            return sigIdx
        },
        /**
         * Get a scaled value for the given cursor (appropriate for the signal's unit).
         * @param cursor - The cursor to fetch the value from.
         */
        getScaledValue (cursor: SignalPoI) {
            if (!this.activeSelection) {
                return 0
            }
            return cursor.value/getSignalScale(this.activeSelection.channel.unit)
        },
        /**
         * Get the amount of time elapsed between `pointA` and `pointB` in milliseconds.
         */
        getTimeBetween (pointA: SignalPoI, pointB: SignalPoI) {
            if (!this.activeSelection) {
                return 0
            }
            const dt = 1000*(pointB.index - pointA.index)/this.activeSelection.channel.samplingRate
            return dt
        },
        /**
         * Handle pointer down event on the SVG.
         */
        handlePointerdown (event: PointerEvent) {
            // Don't register pointer events if no signal is selected
            if (!this.activeProps || !this.activeSelection?.signal) {
                return
            }
            // Cancel drag if right pointer button is pressed while left button is dragging
            if (this.pointerButton === 0 && event.button === 2) {
                this.cancelPointerEventHandlers('drag', event)
                return
            }
            // Prevent additional pointer events (like pressing down a second pointer button) during drag
            if (this.pointerButton !== NO_POINTER_BUTTON_DOWN) {
                return
            }
            this.pointerButton = event.button
            const contLeft = this.svg.getBoundingClientRect().left
            // Check if there are any markers at this position.
            // Invert the array so the last cursor is picked up first.
            let i = 0
            for (const marker of this.activeSelection.markers) {
                const pointerX = event.clientX - contLeft
                // 10px area to pick up the cursor
                const markerX = this.xForMarker(marker)
                if (pointerX >= markerX - CURSOR_MARGIN && pointerX <= markerX + CURSOR_MARGIN) {
                    // Remove point on interest if this is a right click
                    if (event.button === 2) {
                        this.activeSelection.markers.splice(i, 1)
                        this.pointerButton = NO_POINTER_BUTTON_DOWN
                        this.updateSvgCursorStyle()
                        return
                    }
                    this.dragging = true
                    const pointerMove = (event: PointerEvent) => {
                        if (!this.activeProps || !this.activeSelection?.signal) {
                            return
                        }
                        const moveX = event.clientX - contLeft
                        // Drag the cursor
                        const nearestX = this.getNearestX(moveX)
                        marker.index = nearestX
                        marker.value = this.activeSelection.signal.data[nearestX]
                        this.sortMarkers()
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
                        this.svg.removeEventListener('pointermove', pointerMove)
                        this.svg.removeEventListener('pointerup', pointerUp)
                    }
                    this.svg.addEventListener('pointermove', pointerMove)
                    this.svg.addEventListener('pointerup', pointerUp)
                    // Add removeHandlers to pointerEventHandlers so it will executed if the operation in cancelled
                    this.addPointerEventHandler('drag', removeHandlers)
                    return
                }
                i++
            }
            // Only respond to left mouse button and limit maximum number of markers
            if (event.button !== 0 || this.activeSelection.markers.length >= this.maxMarkers) {
                this.pointerButton = NO_POINTER_BUTTON_DOWN
                return
            }
            this.dragging = true
            // Add a visible circle over the signal
            let tempCursor = true
            const pointerX = event.clientX - contLeft
            const nearestX = this.getNearestX(pointerX)
            this.activeSelection.markers.push({
                color: settingsColorToRgba(this.SETTINGS.tools.poiMarkerCircle.color),
                id: this.cursorId++,
                index: nearestX,
                value: this.activeSelection.signal.data[nearestX],
            })
            // This HAS to be fetched from the array for some reason...
            const newCursor = this.activeSelection.markers[this.activeSelection.markers.length - 1]
            const pointerMove = (event: PointerEvent) => {
                if (!this.activeProps || !this.activeSelection?.signal) {
                    return
                }
                const moveX = event.clientX - contLeft
                const nearestX = this.getNearestX(moveX)
                newCursor.index = nearestX
                newCursor.value = this.activeSelection.signal.data[nearestX]
                this.sortMarkers()
            }
            const pointerUp = (event: PointerEvent) => {
                // Only end drag event if the original button is released
                if (event.button !== this.pointerButton) {
                    return
                }
                // Leave new cursor where it is
                tempCursor = false
                removeHandlers()
                this.removePointerEventHandler('drag', removeHandlers)
                this.updateSvgCursorStyle()
            }
            const removeHandlers = () => {
                this.dragging = false
                this.pointerButton = NO_POINTER_BUTTON_DOWN
                this.svg.removeEventListener('pointermove', pointerMove)
                this.svg.removeEventListener('pointerup', pointerUp)
                if (this.activeSelection && tempCursor) {
                    // Don't leave the temporary cursor
                    this.activeSelection.markers.pop()
                }
            }
            this.svg.addEventListener('pointermove', pointerMove)
            this.svg.addEventListener('pointerup', pointerUp)
            // Add removeHandlers to pointerEventHandlers so it will executed if the operation in cancelled
            this.addPointerEventHandler('drag', removeHandlers)
            this.sortMarkers()
        },
        handlePointerLeave (event: PointerEvent) {
            // Execute possible stored drag event handlers
            this.cancelPointerEventHandlers('drag', event)
        },
        handlePointermove (event: PointerEvent) {
            if (!this.activeSelection || this.dragging) {
                return
            }
            const contLeft = this.svg.getBoundingClientRect().left
            // Display pointer if cursor is above one of the points of interest (or their cursor line)
            for (const marker of this.activeSelection.markers) {
                const pointerX = event.clientX - contLeft
                // 10px area to pick up the cursor
                const markerX = this.xForMarker(marker)
                if (pointerX >= markerX - CURSOR_MARGIN && pointerX <= markerX + CURSOR_MARGIN) {
                    this.svg.style.cursor = 'pointer'
                    return
                }
            }
            this.updateSvgCursorStyle()
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
        selectActiveSignal (index: number) {
            if (index < 0 || index >= this.data.length) {
                return
            }
            this.activeProps = this.signalProps[index]
            this.activeSelection = this.data[index]
        },
        sortMarkers () {
            this.activeSelection?.markers.sort((a, b) => (a.index > b.index) ? 1 : -1)
        },
        updateSvgCursorStyle () {
            if (this.dragging) {
                return
            }
            if (this.activeSelection && this.activeSelection.markers.length < this.maxMarkers) {
                this.svg.style.cursor = 'pointer'
            } else {
                this.svg.style.cursor = 'initial'
            }
        },
        xForMarker (marker: SignalPoI) {
            if (!this.activeProps ||!this.activeSelection?.signal) {
                return NUMERIC_ERROR_VALUE
            }
            return (marker.index - (this.activeSelection.crop[0] || 0) + PAD_AMOUNT)*this.activeProps.xPerPoint
        },
        yForMarker (marker: SignalPoI) {
            if (!this.activeProps ||!this.activeSelection?.signal) {
                return NUMERIC_ERROR_VALUE
            }
            if (marker.index === NUMERIC_ERROR_VALUE) {
                // Lift te circle high enough to hide it
                return -2*this.SETTINGS.tools.poiMarkerCircle.radius
            }
            const dataArray = Array.from(this.activeSelection.crop.length === 2
                                         ? this.activeSelection.signal.data.subarray(
                                             this.activeSelection.crop[0], this.activeSelection.crop[1]
                                         )
                                         : this.activeSelection.signal.data
                              )
            const displayMax = Math.max(...dataArray) + this.activeProps.margin
            const displayMin = Math.min(...dataArray) - this.activeProps.margin
            return this.svgHeight*((this.activeSelection.signal.data[marker.index] - displayMin)/(displayMax - displayMin))
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
        this.RESOURCE.onPropertyChange('sensitivity', this.forceUpdate, this.ID)
        // Add 2 pixels per dimension for borders
        this.svg.style.width = `${this.svgWidth + 2}px`
        this.svg.style.height = `${this.svgHeight + 2}px`
        if (this.maxMarkers) {
            this.svg.style.cursor = 'pointer'
        }
        this.activeSelection = this.data[this.selected]
        this.calculateSignalProperties()
        this.activeProps = this.signalProps[this.selected]
    },
    beforeUnmount () {
        this.RESOURCE.removeAllEventListeners(this.ID)
    },
})
</script>

<style scoped>
[data-component="examine-tool"] {
    flex: 7 7 0px;
    display: flex;
    flex-wrap: nowrap;
    position: relative;
    overflow: hidden;
}
.signal {
    border: solid 1px var(--epicv-border-faint);
}
    .signal * {
        pointer-events: none;
    }
    .signal .marker {
        display: none;
    }
        .signal:hover .marker {
            display: initial;
        }
.signal-info {
    flex: 300px 0 0;
}
    .signal-info > .header {
        width: calc(100% - 10px);
        height: 1.5rem;
        line-height: 1.5rem;
        border-bottom: 1px solid var(--epicv-border-faint);
        margin: 0 0 0.25rem 0.5rem;
        font-variant: small-caps;
    }
        .signal-info > .header > .right {
            float: right;
        }
    .signal-info > .row {
        height: 1.5rem;
        line-height: 1.5rem;
        padding: 0 0.5rem;
        font-size: 0.9rem;
    }
    .signal-info > .row > .order {
        display: inline-block;
        width: 10%;
    }
    .signal-info > .row > .double {
        display: inline-block;
        width: 40%;
    }
    .signal-info > .row > .semi {
        display: inline-block;
        width: 30%;
    }
    .signal-info > .row > .value {
        display: inline-block;
        width: 20%;
    }
        .signal-info > .row > .value.bold {
            font-weight: bold;
        }
    .signal-info .separator {
        border-bottom: 1px solid var(--epicv-border-faint);
        margin: 0.5rem 0.5rem 0.25rem;
    }
</style>
