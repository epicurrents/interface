<template>
    <svg data-component="signal-tool"
        ref="signal"
        :viewBox="`0 0 ${width} ${height}`"
        @contextmenu.prevent=""
    >
        <slot
            :signal="signal"
            :signalProps="signalProps"
        ></slot>
        <line x1="0" :y1="baseline" :x2="width" :y2="baseline"
            shape-rendering="crispEdges"
            :stroke="settingsColorToRgba(
                SETTINGS.tools.signalBaseline.color
            )"
            :stroke-dasharray="settingsDashArrayToSvgStrokeDasharray(
                SETTINGS.tools.signalBaseline.dasharray
            )"
            :stroke-width="SETTINGS.tools.signalBaseline.width"
        />
        <polyline v-if="activeSelection && activeProps"
            fill="none"
            :stroke="settingsColorToRgba(
                SETTINGS.tools.signals[selected].color
            )"
            :stroke-width="SETTINGS.tools.signals[selected].width"
            :points="activeProps.points"
        />
    </svg>
</template>

<script lang="ts">
/**
 * Tool for basig signal selection properties.
 */
import { defineComponent, ref, Ref, PropType } from "vue"
import { T } from "#i18n"
import { settingsColorToRgba, settingsDashArrayToSvgStrokeDasharray } from "@epicurrents/core/util"
import type { PlotTraceSelection } from "#types/plot"
import { useStore } from "vuex"
import { useEegContext } from "#app/modules/eeg"
import { NUMERIC_ERROR_VALUE } from "@epicurrents/core/util"
import { Log } from "scoped-event-log"

type SignalProperties = {
    points: string
    xPerPoint: number
}

const PAD_AMOUNT = 1

export default defineComponent({
    name: 'SignalTool',
    props: {
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
        signalProps: {
            type: Array as PropType<SignalProperties[]>,
            default: [],
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
        // Add half a pixel to the baseline to avoid antialiasing
        const baseline = ref(Math.floor(props.height/2) + 0.5)
        const activeProps = ref(null as SignalProperties | null)
        const activeSelection = ref(null as PlotTraceSelection | null)
        const signal = ref<SVGElement>() as Ref<SVGElement>
        return {
            activeProps,
            activeSelection,
            baseline,
            signal,
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
        // Redraw the signal if any properties change.
        data () {
            this.drawSignal()
        },
        height () {
            this.drawSignal()
        },
        selected () {
            this.drawSignal()
        },
        width () {
            this.drawSignal()
        }
    },
    computed: {
        selectionEnd (): number {
            if (!this.activeSelection) {
                return NUMERIC_ERROR_VALUE
            }
            return this.RESOURCE.viewStart + this.activeSelection.range[1]
        },
        selectionStart (): number {
            if (!this.activeSelection) {
                return NUMERIC_ERROR_VALUE
            }
            return this.RESOURCE.viewStart + this.activeSelection.range[0]
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
        drawSignal (isRetry = false) {
            if (!this.signal.clientWidth) {
                // DOM hasn't updated yet, retry once on next tick.
                if (!isRetry) {
                    this.$nextTick(() => {
                        this.drawSignal(true)
                    })
                }
                return
            }
            for (let i=0; i<this.data.length; i++) {
                const props = this.signalProps[i]
                if (!props) {
                    // In the future, allow dynamically expanding or pruning the selections array?
                    Log.error(`Length of signal properties array (${this.signalProps.length}) does not match signal selection array length (${this.data.length}).`, this.$options.name as string)
                }
                // Length of the line that can be drawn between signal data points is
                // the length of the signal - 1.
                props.xPerPoint = this.width/((this.data[i].signal?.data.length || 0) - 1 + 2*PAD_AMOUNT)
            }
            this.activeProps = this.signalProps[this.selected]
            this.activeSelection = this.data[this.selected]
            // Draw baseline.
            this.baseline = Math.floor(this.height/2) + 0.5
            // Draw the actual signal.
            for (let i=0; i<this.data.length; i++) {
                const selection = this.data[i]
                if (!selection.signal) {
                    continue
                }
                const props = this.signalProps[i]
                const { min, max } = this.getSelectionBounds(i)
                // Display baseline in the middle and pad according to the maximum absolute peak.
                const signalAbsMax = Math.max(max || 0, Math.abs(min || 0))
                const displayAbsMax = (1 + this.yPadding)*signalAbsMax
                // Add one for padding at the end.
                // Construct signal display SVG coordinate pairs from signal data.
                const points = [] as string[]
                // Start with one datapoint of padding.
                let x = props.xPerPoint*PAD_AMOUNT
                const polarity = selection.channel.displayPolarity
                               ? selection.channel.displayPolarity*this.SETTINGS.displayPolarity
                               : 1
                for (const y of selection.signal.data) {
                    points.push(`${x},${(this.height/2)*(1 + polarity*y/displayAbsMax)}`)
                    x += props.xPerPoint
                }
                props.points = points.join(', ')
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
        getSelectionBounds (index: number) {
            const selection =  this.data[index]
            if (!selection?.signal) {
                return { min: 0, max: 0 }
            }
            const data = Array.from(selection.signal.data)
            return {
                min: Math.min(...data),
                max: Math.max(...data),
            }
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        //this.$store.dispatch('add-component-styles', { component: this.$options.name, styles: this.$options.__scopeId })
    },
    mounted () {
        this.activeProps = this.signalProps[this.selected]
        this.activeSelection = this.data[this.selected]
        this.drawSignal()
    },
})
</script>

<style scoped>
</style>
