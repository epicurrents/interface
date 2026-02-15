<template>
    <div data-component="power-spectrum-tool" ref="component">
        <frequency-band-plot :key="`fbp-${powerTS}`"
            :header="$t('Signal power spectrum (visible page)')"
            :width="svgWidth"
            :height="svgHeight"
            :maxX="maxHz"
            :maxY="maxPower"
            :lines="powers"
            v-on:set-max-x="setMaxHz"
        />
        <div v-if="indices.includes(0)"
            class="index"
        >
            <div class="header">{{ $t('Bands') }}</div>
            <div class="title">dt/ab (R)</div>
            <div :class="[
                    'value',
                    { 'epicv-disabled': loadingWelch > 0 },
                ]"
            >
                {{ dtabR.toFixed(2).substring(0, 4) }}
            </div>
            <div class="title">dt/ab (L)</div>
            <div :class="[
                    'value',
                    { 'epicv-disabled': loadingWelch > 0 },
                ]"
            >
                {{ dtabL.toFixed(2).substring(0, 4) }}
            </div>
            <div class="title">dt/ab (&Delta;)</div>
            <div :class="[
                    'value',
                    { 'epicv-disabled': loadingWelch > 0 },
                ]"
            >
                {{ dtabD.toFixed(2).substring(0, 4) }}
            </div>
            <div class="title">t/a (R)</div>
            <div :class="[
                    'value',
                    { 'epicv-disabled': loadingWelch > 0 },
                ]"
            >
                {{ tarR.toFixed(2).substring(0, 4) }}
            </div>
            <div class="title">t/a (L)</div>
            <div :class="[
                    'value',
                    { 'epicv-disabled': loadingWelch > 0 },
                ]"
            >
                {{ tarL.toFixed(2).substring(0, 4) }}
            </div>
            <div class="title">t/a (&Delta;)</div>
            <div :class="[
                    'value',
                    { 'epicv-disabled': loadingWelch > 0 },
                ]"
            >
                {{ tarD.toFixed(2).substring(0, 4) }}
            </div>
        </div>
        <div v-if="indices.includes(1)"
            class="index"
        >
            <div class="header">{{ $t('BSI') }}</div>
            <div v-for="(band, idx) in rBSI" :key="`rbsi-band-${idx}`">
                <div class="title">r-BSI-{{ band.symbol }}</div>
                <div :class="[
                        'value',
                        { 'epicv-disabled': loadingRBSI > 0 },
                    ]"
                >
                    {{ band.value.toFixed(2).substring(0, 4) }}
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
/**
 * Tool for signal power spectrum calculation.
 */
import { defineComponent, ref, Ref } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import { useEegContext } from "#app/modules/eeg"
import {
    safeObjectFrom,
    settingsColorToRgba,
    shouldDisplayChannel,
} from "@epicurrents/core/util"
import { Log } from "scoped-event-log"

import FrequencyBandPlot from './FrequencyBandPlot.vue'

import psdScript from '#app/modules/eeg/scripts/psd.py?raw'

export default defineComponent({
    name: 'PowerSpectrumTool',
    components: {
        FrequencyBandPlot,
    },
    props: {
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
    setup () {
        const store = useStore()
        const { RESOURCE, SETTINGS } = useEegContext(store)
        const cursorPos = ref(0)
        const cursorValue = ref('')
        const dtabD = ref(0)
        const dtabL = ref(0)
        const dtabR = ref(0)
        const frequencies = ref([] as number[])
        const frequencyBandLines = ref([] as { value: number, x: number }[])
        const indexColWidth = 80
        const indices = ref([0, 1])
        const loadingIndices = ref(0)
        const loadingWelch = ref(0)
        const loadingRBSI = ref(0)
        const maxHz = ref(30)
        const maxPower = ref(0)
        const montage = RESOURCE.activeMontage
        const channels = []
        if (montage) {
            channels.push(
                ...new Set(
                    montage.channels.filter((ch) => shouldDisplayChannel(ch, false, SETTINGS))
                )
            )
        }
        const periodogram = ref([] as number[][])
        const powers = ref([] as {
                color: string
                fillColor: string
                points: number[][]
                width: number
            }[]
        )
        /**
         * The last time(stamp) frequency powers have been updated.
         * The frequency power plot won't update merely by changing the `powers` contents, we must change the component key as well.
         */
        const powerTS = ref(0)
        const rBSI = ref([] as { symbol: string, value: number }[])
        const selected = ref(-1)
        const tarD = ref(0)
        const tarL = ref(0)
        const tarR = ref(0)
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const error = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const placeholder = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const series = ref<HTMLOrSVGImageElement>() as Ref<HTMLOrSVGImageElement>
        const psd = ref<HTMLOrSVGImageElement>() as Ref<HTMLOrSVGImageElement>
        return {
            channels,
            cursorPos,
            cursorValue,
            dtabD,
            dtabL,
            dtabR,
            frequencies,
            frequencyBandLines,
            indexColWidth,
            indices,
            loadingIndices,
            loadingWelch,
            loadingRBSI,
            maxHz,
            maxPower,
            periodogram,
            powers,
            powerTS,
            rBSI,
            selected,
            tarD,
            tarL,
            tarR,
            // DOM elements
            component,
            error,
            placeholder,
            series,
            psd,
            // Imported methods
            settingsColorToRgba,
            // Shorthands
            ...useEegContext(store),
        }
    },
    computed: {
        hzValuePos (): number {
            if (this.cursorPos < this.width - 70) {
                return this.cursorPos + 5
            } else {
                return this.cursorPos - 65
            }
        },
        indexColCssFlex (): string {
            return `${this.indexColWidth}px 0 0`
        },
        svgHeight (): number {
            // Remove border widths.
            return this.height - 10
        },
        svgWidth (): number {
            // Reduce side panel and border widths.
            return this.width - this.indexColWidth*this.indices.length - 2
        },
    },
    watch: {
        index (value) {
            if (!value) {
                this.calculateIndices()
            } else if (value === 1) {
                this.calculateRBSI()
            }
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
        calculateIndices () {
            if (!this.periodogram?.length || !this.frequencies?.length) {
                return
            }
            this.loadingIndices = Date.now()
            // Band power ratio calculations.
            const bandPowers = this.SETTINGS.frequencyBands.map((b) => {
                return {
                    left: [] as number[],
                    right: [] as number[],
                    symbol: b.symbol,
                    upperLimit: b.upperLimit,
                }
            })
            for (let i=0; i<this.periodogram.length; i++) {
                const recChan = this.channels[i]
                for (let j=0; j<this.frequencies.length; j++) {
                    const curFr = this.frequencies[j]
                    if (curFr > this.maxHz) {
                        break
                    }
                    if (curFr === 0) {
                        // DC.
                        continue
                    }
                    for (const band of bandPowers) {
                        if (curFr <= band.upperLimit) {
                            if (recChan.laterality === 'd') {
                                band.right.push(this.periodogram[i][j])
                            } else if (recChan.laterality === 's') {
                                band.left.push(this.periodogram[i][j])
                            }
                        }
                    }
                }
            }
            // Band power ratios.
            const deltaL = bandPowers[0].left.reduce((a, c) => a + c, 0)
            const deltaR = bandPowers[0].right.reduce((a, c) => a + c, 0)
            const thetaL = bandPowers[1].left.reduce((a, c) => a + c, 0)
            const thetaR = bandPowers[1].right.reduce((a, c) => a + c, 0)
            const alphaL = bandPowers[2].left.reduce((a, c) => a + c, 0)
            const alphaR = bandPowers[2].right.reduce((a, c) => a + c, 0)
            const betaL = bandPowers[3].left.reduce((a, c) => a + c, 0)
            const betaR = bandPowers[3].right.reduce((a, c) => a + c, 0)
            this.dtabL = (deltaL + thetaL)/(alphaL + betaL)
            this.dtabR = (deltaR + thetaR)/(alphaR + betaR)
            this.dtabD = (this.dtabR - this.dtabL)/(this.dtabR + this.dtabL)
            this.tarL = (thetaL - alphaL)/(thetaL + alphaL)
            this.tarR = (thetaR - alphaR)/(thetaR + alphaR)
            this.tarD = (this.tarR - this.tarL)/(this.tarR + this.tarL)
            if (this.loadingIndices) {
                Log.debug(`Basic indices calculation took ${Date.now() - this.loadingIndices} ms.`, this.$options.name || '')
                this.loadingIndices = 0
            }
        },
        async calculateRBSI () {
            if (!this.periodogram?.length || !this.frequencies?.length) {
                return
            }
            this.loadingRBSI = Date.now()
            if (this.periodogram) {
                // Sum coeffs of each hemisphere.
                const rCoeffs = this.SETTINGS.frequencyBands.map((b) => {
                    return {
                        coeffs: [] as number[],
                        frequencies: [] as number[],
                        symbol: b.symbol,
                        upperLimit: b.upperLimit,
                    }
                })
                const lCoeffs = this.SETTINGS.frequencyBands.map((b) => {
                    return {
                        coeffs: [] as number[],
                        frequencies: [] as number[],
                        upperLimit: b.upperLimit,
                    }
                })
                // All of the signals must have the same frequency.
                for (let i=0; i<this.frequencies.length; i++) {
                    if (this.frequencies[i] > this.maxHz) {
                        break
                    }
                    const r = [] as number[]
                    const l = [] as number[]
                    for (let j=0; j<this.periodogram.length; j++) {
                        if (this.channels[j].laterality === 'd') {
                            r.push(this.periodogram[j][i])
                        } else if (this.channels[j].laterality === 's') {
                            l.push(this.periodogram[j][i])
                        }
                    }
                    for (const band of rCoeffs) {
                        if (this.frequencies[i] <= band.upperLimit) {
                            band.coeffs.push((r.reduce((a, c) => a + c, 0)/r.length))
                            band.frequencies.push(this.frequencies[i])
                            break
                        }
                    }
                    for (const band of lCoeffs) {
                        if (this.frequencies[i] <= band.upperLimit) {
                            band.coeffs.push((l.reduce((a, c) => a + c, 0)/l.length))
                            band.frequencies.push(this.frequencies[i])
                            break
                        }
                    }
                }
                // Calculate the mean symmetry between hemispheres for each frequency bin.
                this.rBSI.splice(0)
                for (let i=0; i<rCoeffs.length; i++) {
                    const coeffBand = rCoeffs[i]
                    const symm = [] as number[]
                    for (let j=0; j<coeffBand.coeffs.length; j++) {
                        const rc = coeffBand.coeffs[j]
                        const lc = lCoeffs[i].coeffs[j]
                        symm.push(Math.abs((rc - lc)/(rc + lc)))
                    }
                    this.rBSI[i] = {
                        symbol: coeffBand.symbol,
                        value: symm.reduce((a, c) => a + c, 0)/symm.length,
                    }
                }
                if (this.loadingRBSI) {
                    Log.debug(`r-BSI calculation took ${Date.now() - this.loadingRBSI} ms.`, this.$options.name || '')
                    this.loadingRBSI = 0
                }
            }
        },
        handlePointerLeave () {
            this.cursorPos = 0
            this.cursorValue = ''
        },
        handlePointermove (event: PointerEvent) {
            const contLeft = this.psd.getBoundingClientRect().left
            this.cursorPos = Math.max(event.clientX - contLeft, 0)
            this.cursorValue = (this.maxHz*this.cursorPos/this.width).toFixed(2)
        },
        async loadPeriodogram () {
            if (!this.PYODIDE || !this.RESOURCE.samplingRate) {
                return
            }
            const wglPlot = this.$store.getters.getBiosignalPlot()
            const sigData = [] as Float32Array[]
            for (let i=0; i<wglPlot.traces.length; i++) {
                if (
                    this.channels[i].modality !== 'eeg' ||
                    this.channels[i].samplingRate !== this.RESOURCE.samplingRate
                ) {
                    continue
                }
                const trace = wglPlot.traces[i]
                const data = trace.getData()
                sigData.push(data)
            }
            // Loading time debugging.
            this.loadingWelch = Date.now()
            const response = await this.PYODIDE.service.runCode(
                'psd_welch_periodogram()',
                safeObjectFrom({
                    data: sigData,
                    fs: this.RESOURCE.samplingRate,
                })
            ) as any
            this.powers.splice(0)
            if (response.success && response.result) {
                const result = JSON.parse(response.result)
                this.periodogram = result.channels
                const maxPower = Math.max(...result.channels.map((p: number[]) => Math.max(...p)))
                // Apply a small gap to the top of the plot.
                this.maxPower = Math.log10(maxPower*1.5)
                this.frequencies = result.fs
                const points = [] as {
                        color: string
                        fillColor: string
                        points: number[][]
                        width: number
                    }[]
                // Remember last Y-value for closing the svg shape.
                let lastY = 0
                // Create the points for each channel.
                for (let i=0; i<result.channels.length; i++) {
                    const chan = [] as number[][]
                    // Draw the flequency plot.
                    for (let j=0; j<this.frequencies.length; j++) {
                        const curFr = this.frequencies[j]
                        const relPower = Math.log10(result.channels[i][j] + 1)/this.maxPower
                        const pointYVal = (1 - Math.max(relPower, 0))
                        if (curFr > this.maxHz) {
                            lastY = pointYVal
                            break
                        }
                        const pointXPos = (curFr/this.maxHz)
                        chan.push([pointXPos, pointYVal])
                    }
                    // Close the shape.
                    const lastPower = Math.log10(result.channels[i][0] + 1)
                    chan.push([2, lastY])
                    chan.push([2, 2])
                    chan.push([-1, 2])
                    chan.push([-1, (1 - lastPower/this.maxPower)])
                    chan.push([(this.frequencies[0]/this.maxHz), (1 - lastPower/this.maxPower)])
                    const colorValue = this.channels[i].laterality === 'd'
                                       ? this.SETTINGS.tools.signals[0].color
                                       : this.channels[i].laterality === 's'
                                         ? this.SETTINGS.tools.signals[1].color
                                         : this.SETTINGS.tools.signals[2].color
                    const widthValue = this.channels[i].laterality === 'd'
                                       ? this.SETTINGS.tools.signals[0].width
                                       : this.channels[i].laterality === 's'
                                         ? this.SETTINGS.tools.signals[1].width
                                         : this.SETTINGS.tools.signals[2].width
                    points.push({
                        color: settingsColorToRgba(
                            colorValue,
                            (i !== this.selected ? 0.5 : 1)
                        ),
                        fillColor: settingsColorToRgba(
                            colorValue,
                            0.1 * (i !== this.selected ? 0.5 : 1)
                        ),
                        points: chan,
                        width: widthValue || 1
                    })
                }
                this.powers.push(...points)
                this.powerTS = Date.now()
            }
            if (this.loadingWelch) {
                Log.debug(`Periodogram loading took ${Date.now() - this.loadingWelch} ms.`, this.$options.name || '')
                this.loadingWelch = 0
            }
            if (this.indices.includes(0)) {
                this.calculateIndices()
            }
            if (this.indices.includes(1)) {
                this.calculateRBSI()
            }
        },
        setMaxHz (value: number) {
            this.maxHz = Math.max(0, Math.min(50, value))
            this.loadPeriodogram()
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    async mounted () {
        if (this.RESOURCE.activeMontage) {
            this.PYODIDE?.service.runScript('psd', psdScript, {}).then(() => {
                this.loadPeriodogram()
            })
        }
    },
})
</script>

<style scoped>
[data-component="power-spectrum-tool"] {
    flex: 1 1 0px;
    position: relative;
    display: flex;
    flex-wrap: nowrap;
    overflow: hidden;
}
.index {
    flex: v-bind(indexColCssFlex);
    padding-left: 10px;
}
    .index .header {
        height: 25px;
        line-height: 25px;
        font-variant: small-caps;
    }
    .index .title {
        height: 25px;
        line-height: 25px;
    }
    .index .value {
        height: 1.5em;
        line-height: 1.5em;
        margin-bottom: 0.5em;
        font-size: 1.25em;
    }
</style>
