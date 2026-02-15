<template>
    <div data-component="topomap-tool" ref="component">
        <canvas ref="topo" class="topomap"></canvas>
        <canvas ref="series" :class="{
            'series': true,
            'epicv-hidden': !selectedSpan,
        }"></canvas>
        <div
            :class="[
                'topo-overlay',
                { 'epicv-hidden': !loadingTopo || !initialLoadDone },
            ]"
        >
            <wa-spinner></wa-spinner>
        </div>
        <div
            :class="[
                'series-overlay',
                { 'epicv-hidden': !loadingSeries || !selectedSpan || !initialLoadDone },
            ]"
        >
            <wa-spinner></wa-spinner>
        </div>
        <div ref="placeholder"
            :class="[
                'placeholder',
                { 'epicv-hidden': !channels.length || initialLoadDone },
            ]"
        >
            {{ $t('Loading topogram, please wait...') }}<br>
            <div class="first-load" v-if="IS_FIRST_LOAD">{{ $t('First load may take a few seconds.') }}</div>
            <wa-spinner></wa-spinner>
        </div>
        <div ref="error"
            :class="[
                'error',
                { 'epicv-hidden': channels.length },
            ]"
        >
            <app-icon class="inline" name="triangle-exclamation"></app-icon>
            {{ $t('Topogram requires a common reference montage.') }}
        </div>
        <!-- Header elements come after to be placed on top of the image elements. -->
        <div class="topo-header">{{ $t('Voltage field map') }}</div>
        <div class="series-header">
            <span>{{ $t('Field') }}</span>
            <wa-select class="type" :value="seriesType" @change="seriesType = $event.target.value">
                <wa-option value="dev">{{ $t('development') }}</wa-option>
                <wa-option value="avg">{{ $t('average') }}</wa-option>
            </wa-select>
            <span>/</span>
            <wa-select
                class="span"
                :title="$t('Set time span or disable the display.')"
                :value="selectedSpan.toFixed()"
                @change="selectedSpan = parseInt($event.target.value)"
            >
                <wa-option value="50">{{ seriesType === 'avg' ? 50 : 5 }} ms</wa-option>
                <wa-option value="100">{{ seriesType === 'avg' ? 100 : 10 }} ms</wa-option>
                <wa-option value="150">{{ seriesType === 'avg' ? 150 : 15 }} ms</wa-option>
                <wa-option value="200">{{ seriesType === 'avg' ? 200 : 20 }} ms</wa-option>
                <wa-option value="0">{{ $t('disabled') }}</wa-option>
            </wa-select>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, Ref } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import { useEegContext } from "#app/modules/eeg"
import { safeObjectFrom, shouldDisplayChannel } from "@epicurrents/core/util"
import { Log } from "scoped-event-log"

import topomapScript from '#app/modules/eeg/scripts/topomap.py?raw'

let IS_FIRST_LOAD = true

export default defineComponent({
    name: 'TopomapTool',
    props: {
        cursorPos: {
            type: Number,
            required: true,
        },
        selectedChannels: {
            type: Array as PropType<number[]>,
            required: true,
        },
        seriesSpan: {
            type: Number,
            required: true,
        },
    },
    setup (props) {
        const store = useStore()
        const { RESOURCE, SETTINGS } = useEegContext(store)
        const dataSampleLen = 0.2
        const width = 420
        const height = 350
        const initialLoadDone = ref(false)
        const loadingTopo = ref(0)
        const loadingSeries = ref(0)
        const montageReady = ref(false)
        const cursorTimeout = ref(0)
        const timeoutLen = 250
        // Set up channels
        const montage = RESOURCE.activeMontage
        const channels = []
        // If this is a common reference recording, construct signal array removing possible duplicate channels
        if (montage?.hasCommonReference) {
            channels.push(
                ...new Set(montage.channels
                        .filter((ch) => shouldDisplayChannel(ch, false, SETTINGS))
                        .map((ch, idx) => {
                            return { index: idx, type: ch?.modality, label: ch?.label.split('-')[0] }
                        })
                )
            )
        }
        const chanLabels = channels.filter(ch => ch.type === 'eeg').map(ch => ch.label)
        const selectedSpan = ref(props.seriesSpan)
        const seriesType = ref('dev' as 'dev' | 'avg')
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const error = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const placeholder = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const series = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>
        const topo = ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>
        return {
            chanLabels,
            channels,
            cursorTimeout,
            /** Length of the data sample to use when calculating topograms. */
            dataSampleLen,
            initialLoadDone,
            height,
            loadingTopo,
            loadingSeries,
            montageReady,
            selectedSpan,
            seriesType,
            timeoutLen,
            width,
            // DOM elements
            component,
            error,
            placeholder,
            series,
            topo,
            // Component state
            IS_FIRST_LOAD,
            // Shorthands
            ...useEegContext(store),
        }
    },
    watch: {
        cursorPos () {
            if (!this.loadingTopo) {
                this.loadingTopo = 1
            }
            if (!this.loadingSeries) {
                this.loadingSeries = 1
            }
            if (this.cursorTimeout) {
                window.clearTimeout(this.cursorTimeout)
            }
            this.cursorTimeout = window.setTimeout(() => {
                this.calculateTopomaps()
            }, this.timeoutLen)
        },
        selectedSpan (value: number) {
            this.$emit('series-span', value)
        },
        seriesSpan () {
            this.calculateTopomaps(false)
        },
        seriesType () {
            this.calculateTopomaps(false)
        },
    },
    computed: {
        seriesCanvasHeight () {
            return this.height - 24
        },
        seriesCanvasWidth () {
            return 680 - this.width
        },
        topoCanvasHeight () {
            return this.height
        },
        topoCanvasWidth () {
            return this.width
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
        async calculateTopomaps (topo = true, series = true) {
            if (!this.PYODIDE || !this.montageReady || !this.RESOURCE.samplingRate) {
                return
            }
            const loadStart = Date.now()
            if (topo) {
                this.loadingTopo = loadStart
            }
            if (series) {
                this.loadingSeries = loadStart
            }
            const cursorTimePos = this.cursorPos - this.RESOURCE.viewStart + 0.5*this.dataSampleLen
            const sRate = this.RESOURCE.samplingRate
            const cursorDataPos = Math.round(cursorTimePos*sRate)
            const response = await this.PYODIDE.service?.runCode(
                'topomap_draw_canvas()',
                safeObjectFrom({
                    channel_indices: [...this.selectedChannels],
                    colorbar: this.SETTINGS.services.pyodide.topogramColorbar,
                    cursor_index: cursorDataPos,
                    cursor_time: cursorTimePos,
                    mode: this.seriesType,
                    span: this.selectedSpan,
                }),
                ['topomap']
            ) as any
            if (!response?.success || !response.result) {
                Log.error(`Plotting data in pyodide worker failed.`, this.$options.name as string)
            } else {
                this.initialLoadDone ||= true
            }
            if (this.loadingTopo === loadStart) {
                this.loadingTopo = 0
            }
            if (this.loadingSeries === loadStart) {
                this.loadingSeries = 0
            }
            if (IS_FIRST_LOAD) {
                IS_FIRST_LOAD = false
            }
        },
        async setCanvas () {
            if (!this.PYODIDE || !this.montageReady) {
                return
            }
            const topomap_canvas = this.topo.transferControlToOffscreen()
            topomap_canvas.width = this.topoCanvasWidth
            topomap_canvas.height = this.topoCanvasHeight
            const series_canvas = this.series.transferControlToOffscreen()
            series_canvas.width = this.seriesCanvasWidth
            series_canvas.height = this.seriesCanvasHeight
            try {
                this.PYODIDE.service?.runCode(
                    'topomap_set_canvas()',
                    safeObjectFrom({ series_canvas, topomap_canvas }),
                    ['topomap'],
                    [ series_canvas, topomap_canvas ]
                )
            } catch (error) {
                Log.error(`Setting time series canvas in pyodide worker failed.`, this.$options.name!)
            }
        },
        async setData () {
            if (!this.PYODIDE || !this.montageReady || !this.RESOURCE.samplingRate) {
                return
            }
            const wglPlot = this.$store.getters.getBiosignalPlot()
            const dataPoints = [] as number[][]
            const sRate = this.RESOURCE.samplingRate
            const dataOffset = Math.round(0.5*this.dataSampleLen*sRate)
            for (let i=0; i<wglPlot.traces.length; i++) {
                if (this.channels[i].type !== 'eeg') {
                    continue
                }
                const trace = wglPlot.traces[i]
                const data = trace.getData()
                const sigData = Array.from(
                    data.map(v => v/1_000_000)
                )
                // Prepend and append zeros to the data to allow for time series generation at both ends.
                const extraSamples = new Array(dataOffset).fill(0)
                sigData.unshift(...extraSamples)
                sigData.push(...extraSamples)
                dataPoints.push(sigData)
            }
            const setDataResponse = await this.PYODIDE.service?.runCode(
                'topomap_set_data()',
                safeObjectFrom({
                    data: dataPoints,
                }),
                ['topomap']
            )
            if (!setDataResponse?.success) {
                Log.error(`Setting data in pyodide worker failed.`, this.$options.name as string)
                return
            }
        },
        async setDimensions (width?: number, height?: number) {
            if (!this.PYODIDE || !this.montageReady) {
                return
            }
            width ??= this.width
            height ??= this.height
            const response = await this.PYODIDE.service?.runCode(
                'topomap_set_resolution()',
                safeObjectFrom({
                    series: [this.seriesCanvasWidth, this.seriesCanvasHeight],
                    topomap: [this.topoCanvasWidth, this.topoCanvasHeight],
                }),
                ['topomap']
            )
            if (!response?.success) {
                Log.error(`Setting resolution in pyodide worker failed.`, this.$options.name as string)
            }
        },
        async setupMontage () {
            if (!this.PYODIDE || !this.channels.length) {
                return
            }
            const response = await this.PYODIDE.service?.runCode(
                'topomap_set_channels()',
                safeObjectFrom({ channels: JSON.stringify(this.chanLabels), sfreq: this.RESOURCE.samplingRate }),
                ['topomap']
            )
            if (!response?.success) {
                Log.error(`Setting up montage in pyodide worker failed.`, this.$options.name as string)
            }
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
        // The topogram can only be calculated from a proper common ref montage
        if (this.RESOURCE.activeMontage?.hasCommonReference) {
            await this.PYODIDE?.service.runScript(
                    'topomap',
                    topomapScript,
                    { simulateDocument: true }
                )
            await this.PYODIDE.service?.runCode(
                'topomap_set_montage()',
                safeObjectFrom({ montage: 'standard_1020' }),
                ['topomap']
            )
            await this.setupMontage()
            this.montageReady = true
            await this.setCanvas()
            await this.setDimensions()
            await this.setData()
            this.calculateTopomaps()
        }
    },
})
</script>

<style scoped>
[data-component="topomap-tool"] {
    flex: 7 7 0px;
    position: relative;
    width: 100%;
    overflow: hidden;
}
.topo-header {
    position: absolute;
    left: 0;
    top: 0;
    height: 25px;
    line-height: 25px;
    width: 420px;
    font-variant: small-caps;
    z-index: 1;
}
.series-header {
    position: absolute;
    left: 420px;
    top: 0;
    height: 1.5rem;
    width: 300px;
    font-variant: small-caps;
}
    .series-header > span {
        display: inline-block;
        line-height: 1.5rem;
        position: relative;
        top: 2px;
    }
.topomap {
    position: absolute;
    top: 5px;
    left: -15px;
    width: v-bind(topoCanvasWidth)px;
    height: v-bind(topoCanvasHeight)px;
}
.series {
    position: absolute;
    left: 420px;
    top: 34px;
    width: v-bind(seriesCanvasWidth)px;
    height: v-bind(seriesCanvasHeight)px;
}
.series-header wa-select {
    display: inline-block;
    height: 1.5rem;
    vertical-align: middle;
}
.series-header wa-select::part(start),
.series-header wa-select::part(label),
.series-header wa-select::part(end) {
    height: 1.5rem;
}
.series-header wa-select.type {
    width: 8.75rem;
}
.series-header wa-select.span {
    width: 6.5rem;
}
.series-header wa-select::part(combobox) {
    border: none;
    min-height: 1.5rem;
    padding: 0 0.25em;
}
.series-header wa-select::part(expand-icon) {
    margin-inline-start: 0;
}
.series-header wa-option::part(checked-icon) {
    width: 1.5em;
}
.topo-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 300px;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-top: 25px;
    padding-right: 13%;
    background-color: transparent;
    opacity: 0.75;
}
.series-overlay {
    position: absolute;
    top: 30px;
    left: 420px;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-right: 40px;
    background-color: transparent;
    opacity: 0.75;
}
    .topo-overlay > wa-spinner, .series-overlay > wa-spinner {
        /* Align spinner dead-center of the image. */
        margin: 25px 0 0 0;
        font-size: 2.5vw;
    }
.error, .placeholder {
    position: relative;
    width: 100%;
    height: 100%;
    margin-top: 100px;
    line-height: 75px;
    text-align: center;
}
    .error > wa-icon {
        margin-right: 0.25em;
        font-size: 1.5em;
        color: var(--epicv-warning);
    }
    .placeholder > .first-load {
        position: absolute;
        top: 25px;
        width: 100%;
        font-size: 0.8em;
    }
    .placeholder > wa-spinner {
        margin: 0 auto;
        font-size: 2.5vw;
    }
</style>
