<template>
    <div data-component="signal-properties-tool" ref="wrapper">
        <signal-tool
            :data="data"
            :height="svgHeight"
            :selected="selected"
            :width="svgWidth"
            :y-padding="yPadding"
            v-bind:signalProps="signalProps"
        >
            <g v-if="activeIsValid && activeProps"
                shape-rendering="crispEdges"
                :fill="settingsColorToRgba(
                    SETTINGS.tools.excludeArea.color, 0.5
                )"
                :stroke="settingsColorToRgba(
                    SETTINGS.tools.excludeArea.color
                )"
                :stroke-width="SETTINGS.tools.excludeArea.width"
            >
                <polyline
                    :points="`
                        ${-SETTINGS.tools.excludeArea.width},${-SETTINGS.tools.excludeArea.width}
                        ${svgWidth + SETTINGS.tools.excludeArea.width},${-SETTINGS.tools.excludeArea.width}
                        ${svgWidth + SETTINGS.tools.excludeArea.width},${activeProps.upperLimitY - SETTINGS.tools.excludeArea.width}
                        ${-SETTINGS.tools.excludeArea.width},${activeProps.upperLimitY - SETTINGS.tools.excludeArea.width}
                        ${-SETTINGS.tools.excludeArea.width},${-SETTINGS.tools.excludeArea.width}
                    `"
                />
                <polyline
                    :points="`
                        ${-SETTINGS.tools.excludeArea.width},${svgHeight + SETTINGS.tools.excludeArea.width}
                        ${svgWidth + SETTINGS.tools.excludeArea.width},${svgHeight + SETTINGS.tools.excludeArea.width}
                        ${svgWidth + SETTINGS.tools.excludeArea.width},${activeProps.lowerLimitY + SETTINGS.tools.excludeArea.width}
                        ${-SETTINGS.tools.excludeArea.width},${activeProps.lowerLimitY + SETTINGS.tools.excludeArea.width}
                        ${-SETTINGS.tools.excludeArea.width},${svgHeight + SETTINGS.tools.excludeArea.width}
                    `"
                />
            </g>
        </signal-tool>
        <div class="signal-info">
            <div v-if="activeIsValid && activeSelection && activeSelection.signal" class="row">
                <span class="label">{{ $t('Duration') }}</span>
                <span class="value">
                    {{ (1000*activeSelection.signal.data.length/activeSelection.signal.samplingRate).toFixed() }} ms
                </span>
            </div>
            <div v-if="activeIsValid && activeSelection" class="row">
                <span class="label">{{ $t('Minimum') }}</span>
                <span class="value">
                    {{ $t('{value} {unit}', { value: selectionBounds.min.toFixed(1), unit: $t(activeSelection.channel.unit) }) }}
                </span>
            </div>
            <div v-if="activeIsValid && activeSelection" class="row">
                <span class="label">{{ $t('Maximum') }}</span>
                <span class="value">
                    {{ $t('{value} {unit}', { value: selectionBounds.max.toFixed(1), unit: $t(activeSelection.channel.unit) }) }}
                </span>
            </div>
            <div v-if="activeIsValid && activeSelection" class="row">
                <span class="label">{{ $t('Amplitude') }}</span>
                <span class="value">
                    {{ $t('{value} {unit}', { value: (selectionBounds.max - selectionBounds.min).toFixed(1), unit: $t(activeSelection.channel.unit) }) }}
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

import SignalTool from './SignalTool.vue'

type SignalProperties = {
    lowerLimitY: number
    points: string
    upperLimitY: number
    xPerPoint: number
}

const PAD_AMOUNT = 1

export default defineComponent({
    name: 'SignalPropertiesTool',
    components: {
        SignalTool,
    },
    props: {
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
        const store = useStore()
        // Construct signal props array
        const signalProps = reactive(props.data.map(() => {
            return {
                lowerLimitY: 0,
                points: '',
                upperLimitY: 0,
                xPerPoint: 0,
            } as SignalProperties
        }))
        const activeProps = ref(null as SignalProperties | null)
        const activeSelection = ref(null as PlotTraceSelection | null)
        const signal = ref<SVGElement>() as Ref<SVGElement>
        const svgHeight = ref(0)
        const svgWidth = ref(0)
        const wrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            activeProps,
            activeSelection,
            signal,
            signalProps,
            svgHeight,
            svgWidth,
            wrapper,
            // Constants
            NUMERIC_ERROR_VALUE,
            // Imported methods
            settingsColorToRgba,
            settingsDashArrayToSvgStrokeDasharray,
            // Shorthands
            ...useEegContext(store),
        }
    },
    watch: {
        data () {
            this.resize()
        },
        height () {
            this.resize()
        },
        selected (value: number) {
            this.activeProps = this.signalProps[value] as SignalProperties
            this.activeSelection = this.data[value] as PlotTraceSelection
        },
        width () {
            this.resize()
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
        selectionBounds (): { min: number, max: number } {
            if (!this.activeSelection) {
                return { min: 0, max: 0 }
            }
            return this.getSelectionBounds(this.data.indexOf(this.activeSelection))
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
        calculateAreaProperties () {
            for (let i=0; i<this.data.length; i++) {
                const selection = this.data[i]
                if (!selection.signal) {
                    continue
                }
                const { min, max } = this.getSelectionBounds(i)
                const props = this.signalProps[i]
                // Display baseline in the middle and pad according to the maximum absolute peak
                const signalAbsMax = Math.max(max, Math.abs(min))
                const displayAbsMax = (1 + this.yPadding)*signalAbsMax
                const pxPeruV = displayAbsMax ? this.svgHeight/(2*displayAbsMax) : 0
                // Default to channel specific polarity.
                // If that is zero (undefined), try default EEG polarity, and finally just positive polarity.
                const sigPol = selection.channel.displayPolarity || this.SETTINGS.displayPolarity
                props.lowerLimitY = this.svgHeight/2 + (sigPol === 1 ? -min*pxPeruV : max*pxPeruV)
                props.upperLimitY = this.svgHeight/2 + (sigPol === 1 ? -max*pxPeruV : min*pxPeruV)
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
                // Convert from volts to microvolts.
                min: Math.min(...data)*1e6,
                max: Math.max(...data)*1e6,
            }
        },
        resize (isRetry = false) {
            if (!this.wrapper.offsetWidth) {
                // DOM hasn't updated yet, retry once on next tick.
                if (!isRetry) {
                    this.$nextTick(() => {
                        this.resize(true)
                    })
                }
                return
            }
            // Remove signal info size and border size.
            this.svgWidth = this.width - 200 - 2
            this.svgHeight = this.height - 2
            this.$nextTick(() => {
                this.calculateAreaProperties()
            })
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
        this.activeProps = this.signalProps[this.selected]
        this.activeSelection = this.data[this.selected]
        this.resize()
    },
})
</script>

<style scoped>
[data-component="signal-properties-tool"] {
    flex: 3 3 0px;
    display: flex;
    flex-wrap: nowrap;
    overflow: hidden;
}
    [data-component="signal-properties-tool"] svg {
        border: solid 1px var(--epicv-border-faint);
        flex-grow: 1;
    }
.signal-info {
    flex: 200px 0 0;
}
    .signal-info > .header {
        width: calc(100% - 10px);
        height: 24px;
        line-height: 24px;
        border-bottom: 1px solid var(--epicv-border-faint);
        margin: 0 0 5px 10px;
        font-variant: small-caps;
    }
    .signal-info > .row {
        height: 25px;
        line-height: 25px;
        padding: 0 10px;
    }
    .signal-info > .row > .label {
        display: inline-block;
        width: 50%;
    }
    .signal-info > .row > .value {
        display: inline-block;
        width: 50%;
    }
        .signal-info > .row > .value.bold {
            font-weight: bold;
        }
</style>
