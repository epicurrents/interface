<template>
    <div data-component="topomap-tool" ref="component">
        <div v-if="!available && !preparing" class="error">
            <app-icon class="inline" name="triangle-exclamation"></app-icon>
            {{ unavailableReason }}
        </div>
        <template v-else>
            <div class="panel topo">
                <div class="header">{{ $t('Voltage field map') }}</div>
                <canvas ref="topo" class="map"></canvas>
                <div v-if="showColorbar" class="colorbar">
                    <div class="scale" :style="`background: ${colorbarGradient};`"></div>
                    <div class="limits">
                        <span>{{ limitLabel }}</span>
                        <span>0</span>
                        <span>-{{ limitLabel }}</span>
                    </div>
                </div>
            </div>
            <div class="panel surface">
                <div class="header">{{ $t('Scalp surface') }}</div>
                <canvas ref="surface" class="map" :class="{ 'epicv-hidden': !hasFieldMap }"></canvas>
                <div v-if="!hasFieldMap" class="note">
                    {{ $t('No surface field map is available for this montage.') }}
                </div>
                <div v-else class="note">{{ $t('Drag to rotate.') }}</div>
            </div>
        </template>
        <div :class="['placeholder', { 'epicv-hidden': !preparing }]">
            {{ $t('Preparing the topogram, please wait...') }}<br>
            <wa-spinner></wa-spinner>
        </div>
    </div>
</template>

<script lang="ts">
/**
 * Tool for the scalp voltage field topogram.
 *
 * Both views are computed in the browser from the signal values under the cursor, so there is no precomputed time
 * series and no worker round-trip: a frame is a matrix-vector product and a colour ramp. That is what lets the cursor
 * drive the map directly instead of the map lagging the cursor behind a debounce.
 *
 * The two views deliberately differ in handedness and that is not a bug. The 3D view is a realistic view of a head, so
 * the subject's right is on the viewer's left when facing them; the 2D view is from above with the nose up, so the
 * subject's right is on the image right. They share a sphere origin, a colour ramp and a contour level formula, so a
 * feature that moves in one moves correspondingly in the other.
 */
import { defineComponent, markRaw, PropType, ref, Ref } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import { useEegContext } from "#app/modules/eeg"
import { shouldDisplayChannel } from "@epicurrents/core/util"
import {
    EegSurfaceFieldMap,
    EegTopogram,
    rampFromSettingsColors,
    resolveMontageElectrodes,
} from "@epicurrents/eeg-module"
import type { DivergingRamp, FieldMapChannelMatch } from "@epicurrents/eeg-module/types"
import { Log } from "scoped-event-log"
import { ScalpFieldRenderer, TopogramCanvas } from "#components"

/** Side of the square interpolation grid. Above this the operator build time is felt and nothing looks better. */
const GRID_RESOLUTION = 256
/**
 * Height of the fixed chrome stacked around each canvas, in pixels: the header above and the note below.
 *
 * Must match the `.panel > .header` and `.panel > .note` heights in this component's styles. A canvas sized without
 * counting both makes the panel taller than the space the tool was given, and the note is what falls off the end.
 */
const PANEL_CHROME = 44
/** A spline needs enough knots to be worth drawing at all. */
const MIN_ELECTRODES = 4
/** Signal values are normalised to volts on decode, so this converts only for display and for the scale setting. */
const MICROVOLTS_PER_VOLT = 1_000_000

export default defineComponent({
    name: 'TopomapTool',
    props: {
        cursorPos: {
            type: Number,
            required: true,
        },
        height: {
            type: Number,
            required: true,
        },
        /**
         * Names of the selected channels, marked on both views.
         *
         * Names rather than indices into some other component's channel list: this tool builds its own list, dropping
         * channels with no known electrode position, so an index from elsewhere would point at the wrong electrode.
         */
        selectedChannels: {
            type: Array as PropType<string[]>,
            required: true,
        },
        viewRange: {
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
        // Displayed channels in plot trace order, so a trace index is an index into this array.
        const channels = [] as { label: string, name: string, type: string | undefined }[]
        const montage = RESOURCE.activeMontage
        if (montage?.hasCommonReference) {
            channels.push(
                ...montage.channels
                          .filter((ch) => shouldDisplayChannel(ch, false, SETTINGS))
                          .map((ch) => ({
                              label: ch?.label.split('-')[0],
                              name: ch?.name,
                              type: ch?.modality,
                          }))
            )
        }
        /** Trace index of each EEG channel. */
        const eegTraceIndices = channels.reduce((indices, channel, index) => {
            if (channel.type === 'eeg') {
                indices.push(index)
            }
            return indices
        }, [] as number[])
        const eegLabels = eegTraceIndices.map(index => channels[index].label)
        /** Channel name of each EEG channel, for resolving a selection against this montage. */
        const eegNames = eegTraceIndices.map(index => channels[index].name)
        return {
            eegLabels,
            eegNames,
            eegTraceIndices,
            /** Per-vertex colour buffer for the surface, reused every frame. */
            colorBuffer: null as Float32Array | null,
            fieldMatch: null as FieldMapChannelMatch | null,
            /** Indices of the selected channels among the field map's own channels. */
            fieldSelection: [] as number[],
            hasFieldMap: ref(false),
            preparing: ref(true),
            renderer: null as ScalpFieldRenderer | null,
            /** Index in `eegLabels` of each electrode whose position resolved, in topogram order. */
            positionIndices: [] as number[],
            redrawPending: 0,
            /**
             * Bumped whenever a topogram setting changes.
             *
             * The settings proxy is not a Vue reactive source, so anything derived from it has to be told when to
             * recompute. Without this the map would still redraw through the property-change handler, but the colour
             * scale beside it would keep rendering the previous ramp.
             */
            settingsVersion: ref(0),
            topogramCanvas: null as TopogramCanvas | null,
            topogram: null as EegTopogram | null,
            voltageLimit: ref(0),
            // DOM elements
            component: ref<HTMLDivElement>() as Ref<HTMLDivElement>,
            surface: ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>,
            topo: ref<HTMLCanvasElement>() as Ref<HTMLCanvasElement>,
            // Shorthands
            ...useEegContext(store, 'TopomapTool'),
        }
    },
    watch: {
        cursorPos () {
            this.scheduleRedraw()
        },
        height () {
            this.resize()
        },
        selectedChannels () {
            this.applySelection()
            this.scheduleRedraw()
        },
        width () {
            this.resize()
        },
    },
    computed: {
        available (): boolean {
            return !this.preparing && this.topogram !== null
        },
        canvasSize (): number {
            // Two square panels side by side, each with room for the header above and the note below.
            return Math.max(0, Math.min(this.height - PANEL_CHROME, Math.floor(this.width/2) - 16))
        },
        /**
         * Laid-out size of each canvas.
         *
         * Bound through CSS rather than assigned in `resize`, so a canvas occupies its final space from the very first
         * render. A canvas with no CSS size falls back to the HTML default of 300x150, and everything positioned
         * against the panel — the colour scale above all, being a percentage of its height — is laid out against that
         * wrong height until the first resize corrects it.
         */
        canvasCssSize (): string {
            return `${this.canvasSize}px`
        },
        colorbarGradient (): string {
            const ramp = this.ramp
            const stops: string[] = []
            for (let i = 0; i <= 10; i++) {
                const t = 1 - 2*i/10
                const a = Math.pow(Math.abs(t), ramp.gamma)
                const pole = t < 0 ? ramp.negative : ramp.positive
                const rgb = [0, 1, 2].map(k => Math.round((ramp.neutral[k] + a*(pole[k] - ramp.neutral[k]))*255))
                stops.push(`rgb(${rgb[0]},${rgb[1]},${rgb[2]}) ${i*10}%`)
            }
            return `linear-gradient(to bottom, ${stops.join(', ')})`
        },
        showColorbar (): boolean {
            void this.settingsVersion
            return this.SETTINGS.topogram.colorbar
        },
        /** Voltage at full saturation, in microvolts, as shown on the colour scale. */
        limitLabel (): string {
            const microvolts = this.voltageLimit*MICROVOLTS_PER_VOLT
            return microvolts >= 100 ? microvolts.toFixed(0)
                 : microvolts >= 10 ? microvolts.toFixed(1)
                 : microvolts.toFixed(2)
        },
        ramp (): DivergingRamp {
            void this.settingsVersion
            const colors = this.SETTINGS.topogram.colors
            // The setting reads as intensity, so 100 is the most saturated; the ramp takes the inverse
            // as an exponent, where 1 is a linear ramp.
            const gamma = 1 - 0.75*Math.min(100, Math.max(0, this.SETTINGS.topogram.intensity))/100
            return rampFromSettingsColors(colors.negative, colors.neutral, colors.positive, gamma)
        },
        unavailableReason (): string {
            if (!this.RESOURCE.activeMontage?.hasCommonReference) {
                return this.$t('The topogram requires a common reference montage.')
            }
            return this.$t('The montage has too few channels with known electrode positions.')
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
        /** Resolve the selected channel names into marker indices for both views. */
        applySelection () {
            const selected = new Set(
                this.selectedChannels.map(name => this.eegNames.indexOf(name)).filter(index => index >= 0)
            )
            this.topogramCanvas?.setSelectedElectrodes(
                this.positionIndices.reduce((indices, source, electrode) => {
                    if (selected.has(source)) {
                        indices.push(electrode)
                    }
                    return indices
                }, [] as number[])
            )
            this.fieldSelection = (this.fieldMatch?.indices ?? []).reduce((indices, source, channel) => {
                if (selected.has(source)) {
                    indices.push(channel)
                }
                return indices
            }, [] as number[])
            this.renderer?.setSelectedElectrodes(this.fieldSelection)
        },
        /** Draw both views from the signal values under the cursor. */
        draw () {
            const values = this.readValues()
            if (!values || !this.topogram) {
                return
            }
            const topogramValues = Float32Array.from(this.positionIndices, index => values[index])
            // One limit for both views, so a feature that saturates in the 2D map saturates in the 3D
            // one as well. Deriving it per view would let the same voltage read as two intensities.
            const fixed = this.SETTINGS.topogram.scale/MICROVOLTS_PER_VOLT
            const limit = fixed > 0 ? fixed : EegTopogram.limitOf(this.topogram.interpolate(topogramValues))
            this.voltageLimit = limit
            const contours = Math.round(this.SETTINGS.topogram.contours)
            this.topogramCanvas?.draw(topogramValues, limit, contours, this.ramp)
            this.drawSurface(values, limit, contours)
        },
        /** Draw the 3D scalp surface. */
        drawSurface (values: Float32Array, limit: number, contours: number) {
            const match = this.fieldMatch
            if (!match || !this.renderer || !this.colorBuffer) {
                return
            }
            const fieldValues = Float32Array.from(match.indices, index => values[index])
            this.renderer.setColors(match.map.colors(fieldValues, this.colorBuffer, limit, this.ramp))
            this.renderer.setIsolines(contours > 0 ? match.map.isolines(fieldValues, contours, limit) : null)
            this.renderer.render()
        },
        /**
         * Build the interpolation operator and the surface field map for the active montage.
         *
         * Building the operator takes long enough to be felt, so it is deferred past a paint to let the placeholder
         * appear first. `EegTopogram.forPositions` caches, so the cost is paid once per montage rather than on every
         * remount, and this panel is destroyed and recreated on every tab switch.
         */
        prepare () {
            const { indices, positions } = resolveMontageElectrodes(this.eegLabels)
            if (positions.length < MIN_ELECTRODES) {
                Log.warn(
                    `Only ${positions.length} of ${this.eegLabels.length} channels have known electrode positions, ` +
                    `which is too few for a topogram.`,
                    this.$options.name as string
                )
                this.preparing = false
                return
            }
            this.positionIndices = indices
            // A field map is baked around a fitted sphere origin, and the two views only agree when the
            // topogram is built around the same one.
            const match = EegSurfaceFieldMap.forLabels(this.eegLabels)
            this.fieldMatch = match ? markRaw(match) : null
            this.hasFieldMap = match !== null
            this.topogram = markRaw(EegTopogram.forPositions(positions, GRID_RESOLUTION, match?.map.origin))
            if (match) {
                this.colorBuffer = markRaw(new Float32Array(match.map.vertices.length))
            }
            this.preparing = false
            this.$nextTick(() => {
                // Sizing first: it is the step the drawing depends on, and the one least able to fail.
                this.resize()
                this.setUpViews()
                this.applySelection()
                this.scheduleRedraw()
            })
        },
        /**
         * Read one value per EEG channel at the cursor.
         *
         * The values come from the plot's own traces rather than from the resource, so the map shows the signal as it
         * is drawn: the active montage, the active filters, the active reference.
         *
         * They are already in volts, whatever unit the source file stored: the reader normalises voltages to the
         * modality's base unit on decode, which is what `getSignalScale` exists to undo for display.
         */
        readValues () {
            const plot = this.$store.getters.getBiosignalPlot()
            if (!plot?.traces?.length || this.viewRange <= 0) {
                return null
            }
            const position = (this.cursorPos - this.RESOURCE.viewStart)/this.viewRange
            const values = new Float32Array(this.eegTraceIndices.length)
            for (let i = 0; i < this.eegTraceIndices.length; i++) {
                const trace = plot.traces[this.eegTraceIndices[i]]
                const data = trace?.getData()
                if (!data?.length) {
                    return null
                }
                // Indexing by fraction of the view rather than by sample count keeps this correct when
                // the plot is downsampling, which it does at long page lengths.
                const index = Math.round(position*(data.length - 1))
                values[i] = data[Math.min(Math.max(index, 0), data.length - 1)]
            }
            return values
        },
        /** Redraw after a topogram setting changed, refreshing anything derived from the settings proxy. */
        refreshSettings () {
            this.settingsVersion++
            this.scheduleRedraw()
        },
        /**
         * Match each canvas's backing store to the space CSS has laid it out in, and redraw.
         *
         * Only the backing store: the laid-out size comes from `canvasCssSize`, so that a canvas never spends a frame
         * at the HTML default size while waiting to be measured.
         */
        resize () {
            const size = this.canvasSize
            if (size <= 0) {
                return
            }
            const ratio = window.devicePixelRatio || 1
            for (const canvas of [this.topo, this.surface]) {
                if (!canvas) {
                    continue
                }
                canvas.width = Math.round(size*ratio)
                canvas.height = Math.round(size*ratio)
            }
            this.scheduleRedraw()
        },
        /**
         * Coalesce redraw requests into the next animation frame.
         *
         * A cursor drag fires far more often than the display refreshes, and a frame costs a few milliseconds of
         * interpolation, so drawing per event would spend most of it on frames nobody sees.
         */
        scheduleRedraw () {
            if (this.redrawPending) {
                return
            }
            this.redrawPending = window.requestAnimationFrame(() => {
                this.redrawPending = 0
                this.draw()
            })
        },
        /** Attach both views to their canvases, once the template has rendered them. */
        setUpViews () {
            if (this.topogram && this.topo) {
                this.topogramCanvas = markRaw(new TopogramCanvas(this.topo, this.topogram))
            }
            if (!this.fieldMatch || !this.surface) {
                return
            }
            const renderer = new ScalpFieldRenderer(this.surface, this.fieldMatch.map)
            if (!renderer.available) {
                // Without WebGL the 2D map still works, so drop the surface rather than the tool.
                this.fieldMatch = null
                this.hasFieldMap = false
                return
            }
            this.renderer = markRaw(renderer)
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
        if (!this.RESOURCE.activeMontage?.hasCommonReference) {
            this.preparing = false
            return
        }
        this.addPropertyChangeHandler(`${this.SCOPE}.topogram`, this.refreshSettings)
        // Let the placeholder paint before the operator build takes over the main thread.
        window.setTimeout(() => this.prepare(), 0)
    },
    beforeUnmount () {
        if (this.redrawPending) {
            window.cancelAnimationFrame(this.redrawPending)
        }
        this.removePropertyChangeHandlers()
        this.renderer?.destroy()
        this.renderer = null
    },
})
</script>

<style scoped>
[data-component="topomap-tool"] {
    display: flex;
    flex: 3 3 0px;
    align-items: flex-start;
    justify-content: space-between;
    padding-right: 1rem;
    position: relative;
    width: 100%;
    /*
     * A flex item's automatic minimum size is its content, so without this the tool refuses to shrink below whatever
     * its panels happen to measure and takes the space from the sibling below it instead — which is what collapsed
     * the cursor tool once the overflow rule was removed. With it, the flex basis decides the height, so neither the
     * sibling nor an overflow rule is doing load-bearing work.
     */
    min-height: 0;
}
.panel {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
}
    .panel > .header {
        height: 1.5rem;
        line-height: 1.5rem;
        font-variant: small-caps;
        text-align: center;
    }
    .panel > .map {
        display: block;
        width: v-bind(canvasCssSize);
        height: v-bind(canvasCssSize);
    }
    .panel > .note {
        height: 1.25rem;
        line-height: 1.25rem;
        font-size: 0.8em;
        opacity: 0.6;
    }
.panel.surface > .map {
    cursor: grab;
    touch-action: none;
}
.colorbar {
    position: absolute;
    top: 20%;
    right: -2.5rem;
    display: flex;
    height: 60%;
    gap: 0.25em;
}
    .colorbar > .scale {
        width: 0.6rem;
        border: 1px solid var(--epicv-border, rgba(128, 128, 128, 0.5));
    }
    .colorbar > .limits {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        font-size: 0.7em;
        line-height: 1;
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
    .placeholder > wa-spinner {
        margin: 0 auto;
        font-size: 2.5vw;
    }
</style>
