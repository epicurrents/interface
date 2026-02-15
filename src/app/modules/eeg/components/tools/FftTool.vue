<template>
    <div data-component="fft-tool">
        <div
            class="hzvalue"
            :style="cursorStyles"
        >{{ cursorValue }} <span v-if="cursorValue">Hz</span></div>
        <svg ref="fft"
            :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
            class="fft"
            @pointermove="handleFftPointermove"
            @pointerleave="handleFftPointerleave"
        >
            <g v-for="(line, idx) in frequencyBandLines" :key="`fft-band-line-${idx}`">
                <line :x1="line.x" y1="0" :x2="line.x" :y2="svgHeight"
                    shape-rendering="crispEdges"
                    :stroke="settingsColorToRgba(
                        SETTINGS.tools.guideLine.color
                    )"
                    :stroke-width="SETTINGS.tools.guideLine.width"
                />
            </g>
            <g v-for="(band, idx) of SETTINGS.frequencyBands" :key="`fft-band-symbol-${idx}`">
                <text v-if="band.symbol"
                    :x="frequencyBandLines[idx-1] ? frequencyBandLines[idx-1].x + 5 : 5" y="15"
                    :fill="settingsColorToRgba(
                        SETTINGS.tools.guideLineSymbol.color
                    )"
                >{{ band.symbol }}</text>
            </g>
            <g v-for="(signal, idx) in signalProps" :key="`fft-signal-${idx}`">
                <polyline
                    :fill="settingsColorToRgba(
                        SETTINGS.tools.signals[idx].color,
                        0.1 * (idx !== selected ? 0.25 : 1)
                    )"
                    :stroke="settingsColorToRgba(
                        SETTINGS.tools.signals[idx].color,
                        (idx !== selected ? 0.25 : 1)
                    )"
                    :stroke-width="SETTINGS.tools.signals[idx].width"
                    :points="signal.points"
                />
            </g>
            <g v-if="cursorPos">
                <line :x1="cursorPos" y1="0" :x2="cursorPos" :y2="svgHeight"
                    shape-rendering="crispEdges"
                    :stroke="settingsColorToRgba(
                        SETTINGS.tools.cursorLine.color
                    )"
                    :stroke-width="SETTINGS.tools.cursorLine.width"
                />
            </g>
        </svg>
        <div ref="fftinfo" class="fftinfo">
            <div class="header">
                {{ $t('Band') }}
            </div>
            <template v-if="activeSelection">
                <div class="row" v-for="(band, idx) in activeSelection.frequencyBandProperties" :key="`fft-power-density-row-${idx}`">
                    <span class="label">{{ $t(band.name, {}, true) }}</span>
                    <span :class="[
                        'value',
                        { 'bold': band.topAbsolute },
                    ]">{{  `${(band.relativeAbsolute*100).toFixed(1)} %` }}</span>
                    <span :class="[
                        'value',
                        { 'bold': band.topFrequency },
                    ]">{{ band.peakFrequency ? `${(band.peakFrequency).toFixed(1)} Hz` : band.topFrequency ? 'DC' : '' }}</span>
                </div>
            </template>
        </div>
    </div>
</template>

<script lang="ts">
/**
 * FFT analysis tool.
 */
import { defineComponent, reactive, ref, Ref, PropType } from "vue"
import { T } from "#i18n"
import { fftAnalysis } from "@epicurrents/core/util"
import { BiosignalChannel } from "@epicurrents/core/types"
import { settingsColorToRgba, settingsDashArrayToSvgStrokeDasharray } from "@epicurrents/core/util"
import type { PlotTraceSelection } from "#types/plot"
import { useStore } from "vuex"
import { useEegContext } from "#app/modules/eeg"

type SignalProperties = {
    channel: BiosignalChannel
    data: Float32Array
    frequencyBandProperties: {
        name: string
        absolute: number
        average: number
        peakFrequency: number
        relativeAbsolute: number
        relativeAverage: number
        topAbsolute: boolean
        topAverage: boolean
        topFrequency: boolean
    }[]
    points: string
}

export default defineComponent({
    name: 'FftTool',
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
        width: {
            type: Number,
            required: true,
        },
    },
    setup (props) {
        const maxHz = ref(30)
        const frequencyBandLines = ref([] as { value: number, x: number }[])
        const cursorPos = ref(0)
        const cursorValue = ref('')
        const activeSelection = null as SignalProperties | null
        // Make a copy of the properties to avoid modifying the original selection.
        const signalProps = reactive(props.data.map(d => {
            return {
                channel: d.channel,
                data: d.signal?.data,
                frequencyBandProperties: [],
                points: '',
            } as SignalProperties
        }) as SignalProperties[])
        const fft = ref<SVGElement>() as Ref<SVGElement>
        const fftinfo = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const window = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            activeSelection,
            fft,
            fftinfo,
            cursorPos,
            cursorValue,
            frequencyBandLines,
            maxHz,
            signalProps,
            window,
            // Imported methods
            settingsColorToRgba,
            settingsDashArrayToSvgStrokeDasharray,
            // Shorthands
            ...useEegContext(useStore()),
        }
    },
    watch: {
        data () {
            this.calculateFfts()
        },
        height () {
            this.calculateFfts()
        },
        selected (value: number) {
            this.activeSelection = this.signalProps[value]
        },
        width () {
            this.calculateFfts()
        },
    },
    computed: {
        cursorStyles (): string {
            let styles = ''
            if (this.cursorPos < this.svgWidth - 70) {
                const cursorEdge = this.cursorPos + this.SETTINGS.tools.cursorLine.width/2
                // Add a little extra padding.
                styles += `left:${cursorEdge + 5}px;`
                styles += `text-align:left;`
            } else {
                const cursorEdge = this.svgWidth - this.cursorPos + this.SETTINGS.tools.cursorLine.width/2
                // Side panel width + SVG border width + extra padding.
                styles += `right:${300 + 1 + cursorEdge + 5}px;`
                styles += `text-align:right;`
            }
            return styles
        },
        svgHeight (): number {
            // Remove border widths.
            return this.height - 2
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
        calculateFfts () {
            // Add guildelines
            this.frequencyBandLines.splice(0)
            for (const band of this.SETTINGS.frequencyBands) {
                // Add guideline if it is within visible plot range
                if (this.maxHz > band.upperLimit) {
                    this.frequencyBandLines.push({
                        value: band.upperLimit,
                        x: (band.upperLimit/this.maxHz)*this.svgWidth,
                    })
                }
            }
            for (const sig of this.signalProps) {
                if (!sig.data) {
                    continue
                }
                // Get FFT for the signal sample
                const fft = fftAnalysis(sig.data, sig.channel.samplingRate)
                if (!fft.frequencyBins.length || !fft.resolution) {
                    continue
                }
                // Include the whole spectrum, in case maximum is outside visible range
                const psdMax = Math.max(...fft.psds)
                const fftMax = 1.25*psdMax
                // Calculate guideline positions and frequency band power densities
                sig.frequencyBandProperties.splice(0)
                // Start with the DC band
                sig.frequencyBandProperties.push({
                    name: this.$t('DC'),
                    absolute: fft.psds[0],
                    average: fft.psds[0],
                    peakFrequency: 0,
                    relativeAbsolute: 0,
                    relativeAverage: 0,
                    topAbsolute: false,
                    topAverage: false,
                    topFrequency: false,
                })
                let totalPower = fft.psds[0]
                let totalAverage = fft.psds[0]
                let startIndex = 1
                let peakFrequency = 0
                let peakPower = fft.psds[0]
                let topAbsolute = fft.psds[0]
                let topAverage = fft.psds[0]
                for (const band of this.SETTINGS.frequencyBands) {
                    let powerDensity = 0
                    let binsInBand = 0
                    let bandPeakFrequency = 0
                    let bandPeakPower = 0
                    const endIndex = Math.ceil(band.upperLimit/fft.resolution)
                    for (let i=startIndex; i<endIndex; i++) {
                        powerDensity += fft.psds[i]
                        totalPower += fft.psds[i]
                        binsInBand++
                        if (fft.psds[i] > bandPeakPower) {
                            bandPeakFrequency = fft.frequencyBins[i]
                            bandPeakPower = fft.psds[i]
                            if (bandPeakPower > peakPower) {
                                peakPower = bandPeakPower
                                peakFrequency = bandPeakFrequency
                            }
                        }
                    }
                    const average = powerDensity/binsInBand
                    sig.frequencyBandProperties.push({
                        name: band.name,
                        absolute: powerDensity,
                        average: average,
                        peakFrequency: bandPeakFrequency,
                        relativeAbsolute: 0,
                        relativeAverage: 0,
                        topAbsolute: false,
                        topAverage: false,
                        topFrequency: false,
                    })
                    if (powerDensity > topAbsolute) {
                        topAbsolute = powerDensity
                    }
                    if (average > topAverage) {
                        topAverage = average
                    }
                    totalAverage += average
                    // Start from current endIndex on next round
                    startIndex = endIndex
                }
                // Calculate relative power densities
                for (const band of sig.frequencyBandProperties) {
                    band.relativeAbsolute = band.absolute/totalPower
                    band.relativeAverage = band.average/totalAverage
                }
                // Mark peak frequency power band
                if (!peakFrequency) {
                    sig.frequencyBandProperties[0].topFrequency = true
                } else {
                    for (let i=1; i<sig.frequencyBandProperties.length; i++) {
                        if (this.SETTINGS.frequencyBands[i-1].upperLimit > peakFrequency) {
                            sig.frequencyBandProperties[i].topFrequency = true
                            break
                        }
                    }
                }
                // Mark top relative power band
                for (const band of sig.frequencyBandProperties) {
                    if (band.average === topAverage) {
                        band.topAverage = true
                    }
                    if (band.absolute === topAbsolute) {
                        band.topAbsolute = true
                    }
                }
                // Construct the SVG plot
                const points = [] as string[]
                for (let i=0; i<fft.frequencyBins.length; i++) {
                    const binXPos = (fft.frequencyBins[i]/this.maxHz)*this.svgWidth
                    const binYVal = this.svgHeight*(1 - fft.psds[i]/fftMax)
                    points.push(`${binXPos},${binYVal}`)
                }
                points.push(`${this.svgWidth + 1},${this.svgHeight*(1 - fft.psds[fft.psds.length - 1]/fftMax)}`)
                points.push(`${this.svgWidth + 1},${this.svgHeight + 1}`)
                points.push(`-1,${this.svgHeight + 1}`)
                points.push(`-1,${this.svgHeight*(1 - fft.psds[0]/fftMax)}`)
                points.push(`${(fft.frequencyBins[0]/this.maxHz)*this.svgWidth},${this.svgHeight*(1 - fft.psds[0]/fftMax)}`)
                sig.points = points.join(', ')
            }
        },
        handleFftPointerleave () {
            this.cursorPos = 0
            this.cursorValue = ''
        },
        handleFftPointermove (event: PointerEvent) {
            const contLeft = this.fft.getBoundingClientRect().left
            this.cursorPos = event.clientX - contLeft
            this.cursorValue = (
                // Prevent fringe values from showing at the edges of the SVG.
                Math.min(
                    Math.max(0, this.maxHz*this.cursorPos/this.svgWidth),
                    this.maxHz
                )
            ).toFixed(2)
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
        this.calculateFfts()
        this.activeSelection = this.signalProps[this.selected]
    },
})
</script>

<style scoped>
[data-component="fft-tool"] {
    flex: 7 7 0px;
    display: flex;
    flex-wrap: nowrap;
    position: relative;
    overflow: hidden;
}
.hzvalue {
    display: inline-block;
    position: absolute;
    top: 0.5rem;
    background-color: var(--epicv-background);
    pointer-events: none;
}
.fft {
    border: solid 1px var(--epicv-border-faint);
}
.fftinfo {
    flex: 300px 0 0;
}
    .fftinfo > .header {
        width: calc(100% - 10px);
        height: 24px;
        line-height: 24px;
        border-bottom: 1px solid var(--epicv-border-faint);
        margin: 0 0 5px 10px;
        font-variant: small-caps;
    }
    .fftinfo > .row {
        height: 25px;
        line-height: 25px;
        padding: 0 10px;
    }
    .fftinfo > .row > .label {
        display: inline-block;
        width: 40%;
    }
    .fftinfo > .row > .value {
        display: inline-block;
        width: 30%;
    }
        .fftinfo > .row > .value.bold {
            font-weight: bold;
        }
</style>
