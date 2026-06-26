<template>
    <div data-component="source-loc-tool" ref="root">
        <!-- Loading / unavailable / error ───────────────────────────── -->
        <div v-if="state !== 'ready' && state !== 'computing' && state !== 'done'" class="status-screen">
            <wa-spinner v-if="state === 'loading'"></wa-spinner>
            <app-icon v-else name="triangle-exclamation" class="status-icon"></app-icon>
            <p class="status-message">{{ statusMessage }}</p>
            <wa-button v-if="state === 'error'"
                appearance="plain"
                variant="brand"
                @click="load"
            >
                {{ $t('Retry') }}
            </wa-button>
        </div>

        <!-- Ready / computing / done ────────────────────────────────── -->
        <template v-else>
            <div class="main">
                <div class="canvases">
                    <div class="source-wrap">
                        <canvas ref="sourceCanvas" class="source-canvas"></canvas>
                        <div v-if="state === 'computing'" class="canvas-overlay">
                            <wa-spinner></wa-spinner>
                        </div>
                        <div v-if="state === 'ready'" class="canvas-placeholder">
                            <span>{{ $t('Press Analyze to compute source estimate') }}</span>
                        </div>
                    </div>
                </div>
                <div class="controls">
                    <label class="control-label">{{ $t('Method') }}</label>
                    <wa-select
                        class="method-select"
                        size="s"
                        :value="method"
                        @change="onMethodChange"
                    >
                        <wa-option value="sloreta">sLORETA</wa-option>
                        <wa-option value="eloreta">eLORETA</wa-option>
                        <wa-option value="dspm">dSPM</wa-option>
                        <wa-option value="mne">MNE</wa-option>
                        <wa-option value="dipole">{{ $t('Dipole') }}</wa-option>
                    </wa-select>
                    <label class="control-label">SNR</label>
                    <wa-input
                        class="control-input"
                        min="1"
                        size="s"
                        step="0.5"
                        type="number"
                        :value="String(snr)"
                        @change="onSnrChange"
                        @keydown.stop=""
                    ></wa-input>
                    <label class="control-label">{{ $t('Window') }}</label>
                    <wa-input
                        class="control-input"
                        min="0.05"
                        size="s"
                        step="0.05"
                        type="number"
                        :value="String(windowSec)"
                        @change="onWindowChange"
                        @keydown.stop=""
                    >
                        <span slot="suffix">s</span>
                    </wa-input>
                    <template v-if="method === 'dipole'">
                    <label class="control-label">{{ $t('Pole') }}</label>
                    <div class="mode-buttons">
                        <button
                            :class="{ active: dipolePolarity === 'negative' }"
                            @click="dipolePolarity = 'negative'"
                        >
                            {{ $t('Neg') }}
                        </button>
                        <button
                            :class="{ active: dipolePolarity === 'positive' }"
                            @click="dipolePolarity = 'positive'"
                        >
                            {{ $t('Pos') }}
                        </button>
                    </div>
                </template>
                <label class="control-label">{{ $t('View') }}</label>
                    <div class="mode-buttons">
                        <button
                            :class="{ active: plotMode === '2d' }"
                            @click="plotMode = '2d'"
                        >
                            2D
                        </button>
                        <button
                            :class="{ active: plotMode === '3d' }"
                            @click="plotMode = '3d'"
                        >
                            3D
                        </button>
                    </div>
                    <wa-button
                        appearance="plain"
                        class="analyze-btn"
                        :disabled="state === 'computing'"
                        variant="brand"
                        @click="runAnalysis"
                    >
                        {{ $t('Analyze') }}
                    </wa-button>
                    <span v-if="resultSummary" class="result-summary">{{ resultSummary }}</span>
                </div>
            </div>
        </template>
    </div>
</template>

<script lang="ts">
/**
 * Source localization tool — analysis window tab for EEG.
 *
 * Lifecycle
 * ---------
 * 1. Tab opened → component mounts → `load()` runs automatically.
 * 2. `load()`: ensures the Pyodide script is loaded, fetches + matches the
 *    lead field for the active setup's MNE montage, calls the Python setup
 *    chain.  State transitions: loading → ready (or error/unavailable).
 * 3. User clicks Analyze → `runAnalysis()` extracts a ±windowSec/2 epoch at
 *    `cursorPos`, ships it to Pyodide, renders result to the two canvases.
 */
import { defineComponent, ref } from 'vue'
import { T } from '#i18n'
import { useStore } from 'vuex'
import { useEegContext } from '#app/modules/eeg'
import { shouldDisplayChannel } from '@epicurrents/core/util'
import { Log } from 'scoped-event-log'
import {
    useSourceLocalization,
    type SourceLocMethod,
    type SourceLocPlotMode,
    type SourceLocPolarity,
    type LeadFieldSetup,
} from './useSourceLocalization'

const SCOPE = 'SourceLocalizationTool'

/**
 * Map the EEG setup name (e.g. '10-20', '10-10') to the MNE standard montage
 * name used by the backend lead-field computation.  Falls back to 'standard_1020'
 * for unrecognised names.
 */
const SETUP_TO_MNE: Record<string, string> = {
    '10-20':  'standard_1020',
    '10-10':  'standard_1005',
    '10-5':   'standard_1005',
}

type SourceLocState =
    | 'loading'      // fetching lead field + setting up Pyodide
    | 'ready'        // setup complete, awaiting first Analyze click
    | 'computing'    // analysis running
    | 'done'         // analysis rendered; canvases show results
    | 'error'        // recoverable failure (retry available)
    | 'unavailable'  // lead field not on server (staff must compute it first)

export default defineComponent({
    name: 'SourceLocalizationTool',
    props: {
        cursorPos: {
            type: Number,
            required: true,
        },
        height: {
            type: Number,
            default: 0,
        },
        width: {
            type: Number,
            default: 0,
        },
    },
    setup () {
        const store = useStore()
        const sourceCanvasRef = ref<HTMLCanvasElement | null>(null)
        const root            = ref<HTMLElement | null>(null)
        const sourceLoc       = useSourceLocalization()
        const lfSetup         = ref<LeadFieldSetup | null>(null)

        return {
            root,
            sourceCanvas: sourceCanvasRef,
            sourceLoc,
            lfSetup,
            ...useEegContext(store, SCOPE),
        }
    },
    data () {
        return {
            canvasesTransferred: false,
            dipolePolarity: 'negative' as SourceLocPolarity,
            method:        'dipole' as SourceLocMethod,
            plotMode:      '2d' as SourceLocPlotMode,
            resultSummary: null as string | null,
            snr:           3.0,
            state:         'loading' as SourceLocState,
            statusMessage: '',
            windowSec:     2.0,
        }
    },
    methods: {
        $t (key: string, params = {}) {
            return T(key, this.$options.name, params)
        },
        /**
         * Resolve the MNE montage name to use for the current recording setup.
         * Reads from the source-localisation settings if present, otherwise
         * maps from the setup name, falling back to 'standard_1020'.
         */
        getMneMontage (): string {
            const setupName = (this.RESOURCE as unknown as { setup?: { name?: string } })?.setup?.name ?? ''
            return SETUP_TO_MNE[setupName] ?? 'standard_1020'
        },
        /**
         * Collect EEG channel labels from the active montage, in signal-index
         * order.  Used by the orchestrator to intersect with the lead-field
         * channel list.
         *
         * Source localisation requires a common-reference montage.  With a
         * bipolar montage the signal T7−T8 would be matched to the T7 lead-field
         * row, treating a LEFT-minus-RIGHT signal as a unipolar T7 recording —
         * the result would be spatially wrong.  We warn but don't block so the
         * user can still experiment.
         */
        getEegChannelLabels (): string[] {
            if (this.RESOURCE.activeMontage && !this.RESOURCE.activeMontage.hasCommonReference) {
                Log.warn(
                    'Source localisation works best with a common-reference montage (avg/linked mastoids). '
                    + 'Bipolar derivations will produce spatially incorrect results.',
                    SCOPE,
                )
            }
            return (this.RESOURCE.activeMontage?.channels ?? [])
                .filter(ch => shouldDisplayChannel(ch, false, this.SETTINGS) && ch.modality === 'eeg')
                .map(ch => ch.label.split('-')[0])
        },
        /**
         * Full load sequence: script → lead field fetch + channel match →
         * Pyodide setup.  Called automatically on mount and on Retry.
         */
        async load () {
            this.state = 'loading'
            this.resultSummary = null
            const service = this.PYODIDE?.service
            if (!service) {
                this.statusMessage = this.$t('Pyodide service unavailable.')
                this.state = 'error'
                return
            }

            // 1. Load the Python script.
            this.statusMessage = this.$t('Loading source localisation script…')
            const scriptOk = await this.sourceLoc.ensureScriptLoaded(service)
            if (!scriptOk) {
                this.statusMessage = this.sourceLoc.lastError.value
                    ?? this.$t('Failed to load script.')
                this.state = 'error'
                return
            }

            // 2. Fetch lead field + match channels.
            this.statusMessage = this.$t('Fetching lead field model…')
            const montageName = this.getMneMontage()
            const channelLabels = this.getEegChannelLabels()
            const setup = await this.sourceLoc.fetchAndMatchLeadField(
                montageName,
                channelLabels,
            )
            if (!setup) {
                const err = this.sourceLoc.lastError.value ?? ''
                if (err.includes('No cached lead field') || err.includes('No lead field')) {
                    this.statusMessage = this.$t(
                        'Lead field model for {montage} is not available on this server. '
                        + 'Contact an administrator to compute it.',
                        { montage: montageName },
                    )
                    this.state = 'unavailable'
                } else {
                    this.statusMessage = err || this.$t('Failed to fetch lead field.')
                    this.state = 'error'
                }
                return
            }
            this.lfSetup = setup

            // 3. Push the lead field + parameters into the Pyodide worker.
            this.statusMessage = this.$t('Setting up inverse solver…')
            const sfreq = (this.RESOURCE as unknown as { samplingRate?: number }).samplingRate ?? 256
            const setupOk = await this.sourceLoc.setup(
                service,
                sfreq,
                setup,
                { montageName, method: this.method, snr: this.snr,
                  dipolePolarity: this.dipolePolarity },
            )
            if (!setupOk) {
                this.statusMessage = this.sourceLoc.lastError.value
                    ?? this.$t('Failed to initialise inverse solver.')
                this.state = 'error'
                return
            }

            Log.debug(`Source localisation ready (${setup.channelNames.length} channels, ${setup.nSources} sources).`, SCOPE)
            this.state = 'ready'
            // Transfer canvas control to the Pyodide worker now that the DOM
            // is in its final state.  transferControlToOffscreen() can only be
            // called once per element, so this must not be repeated on retry.
            await this.$nextTick()
            const sc = this.sourceCanvas
            if (sc && !this.canvasesTransferred) {
                const ok = await this.sourceLoc.setCanvases(service, sc)
                if (ok) {
                    this.canvasesTransferred = true
                }
            }
        },
        async runAnalysis () {
            if (!this.lfSetup || this.state === 'computing') {
                return
            }
            const service = this.PYODIDE?.service
            if (!service) {
                return
            }
            this.state = 'computing'
            this.resultSummary = null
            // Re-push method + SNR in case the user changed them since load.
            const sfreq = (this.RESOURCE as unknown as { samplingRate?: number }).samplingRate ?? 256
            await this.sourceLoc.setup(
                service,
                sfreq,
                this.lfSetup,
                { montageName: this.getMneMontage(), method: this.method, snr: this.snr,
                  dipolePolarity: this.dipolePolarity },
            )
            // Build time window centred on the cursor.
            const half = this.windowSec / 2
            const start = Math.max(0, this.cursorPos - half)
            const end   = Math.min(
                (this.RESOURCE as unknown as { totalDuration?: number }).totalDuration ?? 0,
                this.cursorPos + half,
            )
            const result = await this.sourceLoc.analyze(
                service,
                this.RESOURCE,
                [start, end],
                this.lfSetup,
                -half,
                this.plotMode,
            )
            if (!result?.success) {
                Log.error(result?.error ?? 'Analysis failed', SCOPE)
                this.state = 'ready'
                return
            }
            // Build a one-line summary from the result.
            if (result.dipoleGofPct !== undefined && result.dipolePosMm) {
                const [x, y, z] = result.dipolePosMm.map(v => v.toFixed(0))
                this.resultSummary = this.$t(
                    'Dipole ({x}, {y}, {z}) mm — GOF {gof}%',
                    { x, y, z, gof: result.dipoleGofPct.toFixed(1) },
                )
            } else if (result.peakTimeS !== undefined) {
                this.resultSummary = this.$t(
                    'Peak at {t} ms',
                    { t: (result.peakTimeS * 1000).toFixed(0) },
                )
            }
            this.state = 'done'
        },
        onMethodChange (event: Event) {
            this.method = (event.target as HTMLSelectElement).value as SourceLocMethod
        },
        onSnrChange (event: Event) {
            const v = Number((event.target as HTMLInputElement).value)
            if (Number.isFinite(v) && v > 0) {
                this.snr = v
            }
        },
        onWindowChange (event: Event) {
            const v = Number((event.target as HTMLInputElement).value)
            if (Number.isFinite(v) && v >= 0.05) {
                this.windowSec = v
            }
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId },
        )
    },
    mounted () {
        this.load()
    },
})
</script>

<style scoped>
[data-component="source-loc-tool"] {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    width: 100%;
}

/* ── Status screens (loading / error / unavailable) ─────────────────────── */
.status-screen {
    align-items: center;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 1rem;
    justify-content: center;
    padding: 2rem;
    text-align: center;
}
    .status-icon {
        font-size: 2rem;
        opacity: 0.6;
    }
    .status-message {
        font-size: 0.85rem;
        margin: 0;
        max-width: 28rem;
        opacity: 0.8;
    }

/* ── Canvas + controls row ───────────────────────────────────────────────── */
.main {
    display: flex;
    flex: 1 1 auto;
    flex-direction: row;
    min-height: 0;
    overflow: hidden;
}

/* ── Canvas area ─────────────────────────────────────────────────────────── */
.canvases {
    display: flex;
    flex: 1 1 0;
    min-width: 0;
    padding: 0.5rem;
}
    .source-wrap {
        flex: 1 1 auto;
        min-width: 0;
        position: relative;
    }
    .source-canvas {
        display: block;
        height: 100%;
        width: 100%;
    }
    .canvas-overlay {
        align-items: center;
        display: flex;
        inset: 0;
        justify-content: center;
        position: absolute;
    }
    .canvas-placeholder {
        align-items: center;
        display: flex;
        font-size: 0.8rem;
        inset: 0;
        justify-content: center;
        opacity: 0.45;
        position: absolute;
    }

/* ── Controls sidebar ────────────────────────────────────────────────────── */
.controls {
    border-left: 1px solid var(--wa-color-surface-border);
    box-sizing: border-box;
    display: flex;
    flex: 0 0 min(33%, 200px);
    flex-direction: column;
    gap: 0.35rem;
    overflow-y: auto;
    padding: 0.6rem 0.6rem 0.6rem 0.75rem;
    width: min(33%, 200px);
}
    .control-label {
        font-size: 0.72rem;
        margin-top: 0.25rem;
        opacity: 0.7;
    }
    .method-select,
    .control-input {
        width: 100%;
    }
    .mode-buttons {
        display: flex;
        gap: 0.2rem;
    }
        .mode-buttons button {
            background: none;
            border: 1px solid var(--wa-color-surface-border);
            border-radius: 0.25rem;
            color: var(--wa-color-text-quiet);
            cursor: pointer;
            flex: 1 1 0;
            font-size: 0.7rem;
            padding: 0.1rem 0;
        }
        .mode-buttons button.active {
            background: var(--wa-color-brand-fill-loud);
            border-color: transparent;
            color: #fff;
        }
    .analyze-btn {
        margin-top: auto;
        width: 100%;
    }
    .result-summary {
        font-size: 0.72rem;
        opacity: 0.75;
        word-break: break-word;
    }
</style>
