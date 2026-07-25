/**
 * Source localization orchestrator composable.
 *
 * Handles the full pipeline from lead-field download to Pyodide-side inverse
 * computation and canvas rendering, following the same pattern as TopomapTool
 * (import Python script as `?raw`, call PyodideService.runScript / runCode).
 *
 * Three-phase lifecycle
 * ---------------------
 * 1. **Load** — `ensureScriptLoaded(service)` loads `source_localize.py` into
 *    the Pyodide worker (idempotent; PyodideService caches the loaded state).
 *
 * 2. **Setup** — `fetchAndMatchLeadField(montageName, recordingChannels, opts)`
 *    obtains the pre-computed lead field from the host, intersects its channel
 *    list with the recording's active channels, and sub-selects the relevant
 *    lead-field rows.  The result is cached at module scope so that a second
 *    call for the same montage is instant.
 *    Then `setup(service, lfSetup, options)` pushes the matched lead field and
 *    method parameters into the Pyodide worker.
 *
 * 3. **Analyse** — `setCanvases(service, sourceCanvas, topomapCanvas?)` registers
 *    the output canvases, then `analyze(service, resource, timeRange, lfSetup)`
 *    extracts the epoch signals, ships them to Python, and triggers the inverse
 *    solve + canvas render.
 *
 * Lead-field source
 * -----------------
 * Lead fields are large, deployment-specific artifacts, so this composable does
 * not fetch them.  The host supplies one through
 * `SETUP.modules.eeg.leadFieldProvider` and keeps its own URLs, credentials and
 * caching strategy behind that call; `LeadFieldProvider` in the module's `types`
 * states the contract and `LeadFieldData` the shape it returns.  With no
 * provider configured the tool reports itself unavailable.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { ref } from 'vue'
import sourceLocalizeScript from '#app/modules/eeg/scripts/source_localize.py?raw'
import { runtime } from '#app/modules/eeg'
import type { LeadFieldData } from '#app/modules/eeg/types'
import type { BiosignalResource } from '@epicurrents/core/types'
import type { PythonInterpreterService, RunCodeResult } from '@epicurrents/pyodide-service/types'

// RunCodeResult.error is `string | string[]` because Python errors come back
// as [traceback, error_text]. Flatten to a single string for display.
const fmtErr = (e: string | string[] | undefined): string | undefined =>
    Array.isArray(e) ? e.join('\n') : e

// ── Public types ──────────────────────────────────────────────────────────────

export type SourceLocMethod    = 'sloreta' | 'eloreta' | 'dspm' | 'mne' | 'dipole'
export type SourceLocPlotMode  = '2d' | '3d'
export type SourceLocPolarity  = 'negative' | 'positive'

export type { LeadFieldData, LeadFieldProvider } from '#app/modules/eeg/types'

/**
 * Result of `fetchAndMatchLeadField` — the lead-field sub-selected to the
 * channels present in both the recording and the cached matrix, plus the
 * recording signal indices needed to extract the matching epoch columns.
 */
export type LeadFieldSetup = {
    /** Sub-selected lead-field rows, shape (nMatchedChannels, nSources × nOrient). */
    leadField:      Float64Array
    /** Source positions (unchanged from the full download). */
    srcPos:         Float64Array
    /** EEG channel names in lead-field row order (passed to `src_set_channels`). */
    channelNames:   string[]
    nSources:       number
    nOrient:        number
    /**
     * Indices into `getAllSignals()` response signals array corresponding to
     * each matched channel, in lead-field row order.  Used in `analyze()` to
     * pick the right signal columns.
     */
    signalIndices:  number[]
}

export type SourceLocOptions = {
    /** MNE standard montage name, e.g. `'standard_1020'`. */
    montageName:     string
    method?:         SourceLocMethod
    snr?:            number
    nOrient?:        number
    gridResMm?:      number
    /** Dipole polarity convention (only relevant when method === 'dipole'). */
    dipolePolarity?: SourceLocPolarity
}

export type SourceLocResult = {
    success:           boolean
    error?:            string
    /** Distributed methods: time of peak source activity (seconds). */
    peakTimeS?:        number
    /** Distributed methods: position of the peak source (mm). */
    peakSourcePosMm?:  number[]
    /** Dipole method: fitted position (mm). */
    dipolePosMm?:      number[]
    /** Dipole method: unit orientation vector. */
    dipoleOri?:        number[]
    /** Dipole method: goodness-of-fit percentage. */
    dipoleGofPct?:     number
}

// ── Module-level caches (persist across component remounts) ───────────────────

/** Cache key: `"${montageName}/${nOrient}/${gridResMm}"`. */
const _lfCache = new Map<string, LeadFieldData>()

const SCRIPT_NAME = 'source-localize'

// ── Composable ────────────────────────────────────────────────────────────────

export function useSourceLocalization () {
    const scriptLoaded  = ref(false)
    const computing     = ref(false)
    const lastError     = ref<string | null>(null)
    /** Set when the last lead-field lookup came back empty rather than broken. */
    const leadFieldUnavailable = ref(false)

    // ── Phase 1: script loading ───────────────────────────────────────────────

    /**
     * Load `source_localize.py` into the Pyodide worker.  Idempotent — calling
     * it multiple times is safe; the service returns immediately on subsequent
     * calls once the script is in the `'loaded'` state.
     *
     * The `biosignal` script must be loaded first (it initialises the SAB
     * buffers that Pyodide uses for channel data).  PyodideService handles the
     * dependency chain via `scriptDeps`.
     */
    async function ensureScriptLoaded (service: PythonInterpreterService): Promise<boolean> {
        const result = await service.runScript(
            SCRIPT_NAME,
            sourceLocalizeScript,
            {},
            ['biosignal'],
        )
        if (!result?.success) {
            lastError.value = (result as { error?: string })?.error
                ?? 'Failed to load source localisation script.'
            return false
        }
        scriptLoaded.value = true
        return true
    }

    // ── Phase 2a: lead-field download & channel matching ─────────────────────

    /**
     * Fetch the lead-field matrix for `montageName` from the backend, intersect
     * its channels with the recording's `recordingChannels`, and sub-select the
     * relevant lead-field rows.
     *
     * The full download is cached at module scope so subsequent calls for the
     * same `(montageName, nOrient, gridResMm)` triple are instant.  Returns
     * `null` and sets `lastError` on any failure.
     *
     * @param montageName      - MNE standard montage, e.g. `'standard_1020'`.
     * @param recordingChannels - EEG channel labels from the active montage, in
     *                            signal-index order.
     * @param opts             - Optional `nOrient` (default 1) and `gridResMm`
     *                           (default 7.5) to select a specific cached matrix.
     */
    async function fetchAndMatchLeadField (
        montageName:       string,
        recordingChannels: string[],
        opts: Pick<SourceLocOptions, 'nOrient' | 'gridResMm'> = {},
    ): Promise<LeadFieldSetup | null> {
        const nOrient  = opts.nOrient  ?? 1
        const gridResMm = opts.gridResMm ?? 7.5
        lastError.value = null
        leadFieldUnavailable.value = false

        // Fetch (or retrieve from module cache).
        const lfData = await _fetchLeadField(montageName, nOrient, gridResMm)
        if (!lfData) {
            return null
        }

        // Intersect: walk lead-field channel order, find matching recording indices.
        // MNE's standard_1020 montage uses new IFCN nomenclature (T7/T8/P7/P8),
        // but many clinical EEG systems still use the old names (T3/T4/T5/T6).
        // Try both so temporal channels are not silently excluded.
        const OLD_TO_NEW: Record<string, string> = {
            T3: 'T7', T4: 'T8', T5: 'P7', T6: 'P8',
            T7: 'T3', T8: 'T4', P7: 'T5', P8: 'T6',
        }
        const recUpper = recordingChannels.map(n => n.toUpperCase())
        const lfUpper  = lfData.channelNames.map(n => n.toUpperCase())

        const lfRowsToKeep:   number[] = []
        const signalIndices:  number[] = []
        const matchedNames:   string[] = []

        for (let lfIdx = 0; lfIdx < lfData.channelNames.length; lfIdx++) {
            const lfName = lfUpper[lfIdx]
            // Try the lead-field name directly, then the old/new equivalent.
            let recIdx = recUpper.indexOf(lfName)
            if (recIdx === -1) {
                const alt = OLD_TO_NEW[lfName]
                if (alt) {
                    recIdx = recUpper.indexOf(alt)
                }
            }
            if (recIdx !== -1) {
                lfRowsToKeep.push(lfIdx)
                signalIndices.push(recIdx)
                matchedNames.push(lfData.channelNames[lfIdx])
            }
        }

        if (!lfRowsToKeep.length) {
            lastError.value =
                `No overlap between recording channels and lead-field channels for montage '${montageName}'.`
            return null
        }

        // Sub-select lead-field rows so Pyodide only sees matched channels.
        const nSrcOri = lfData.nSources * lfData.nOrient
        const subLf   = new Float64Array(lfRowsToKeep.length * nSrcOri)
        for (let i = 0; i < lfRowsToKeep.length; i++) {
            const srcRow = lfRowsToKeep[i]
            subLf.set(
                lfData.leadField.subarray(srcRow * nSrcOri, (srcRow + 1) * nSrcOri),
                i * nSrcOri,
            )
        }

        return {
            leadField:     subLf,
            srcPos:        lfData.srcPos,
            channelNames:  matchedNames,
            nSources:      lfData.nSources,
            nOrient:       lfData.nOrient,
            signalIndices,
        }
    }

    // ── Phase 2b: Pyodide setup ───────────────────────────────────────────────

    /**
     * Push the matched lead field and analysis parameters into the Pyodide
     * worker by calling the Python `src_set_*` setup chain.  Must be called
     * after `ensureScriptLoaded` and after the recording's sampling rate is
     * known.
     *
     * The lead-field buffer is **structured-cloned** (not transferred) so the
     * cached `LeadFieldSetup` remains usable for future analysis runs without
     * re-downloading.
     */
    async function setup (
        service:  PythonInterpreterService,
        sfreq:    number,
        lfSetup:  LeadFieldSetup,
        options:  SourceLocOptions,
    ): Promise<boolean> {
        const { montageName, method = 'sloreta', snr = 3.0 } = options
        lastError.value = null

        const dipolePolarity = options.dipolePolarity ?? 'negative'
        const steps: [string, Record<string, unknown>][] = [
            ['src_set_montage()',          { montage_name: montageName }],
            ['src_set_channels()',         { channels: JSON.stringify(lfSetup.channelNames), sfreq }],
            ['src_set_lead_field()',       {
                lead_field: lfSetup.leadField,
                src_pos:    lfSetup.srcPos,
                n_channels: lfSetup.channelNames.length,
                n_sources:  lfSetup.nSources,
                n_orient:   lfSetup.nOrient,
            }],
            ['src_set_method()',           { method }],
            ['src_set_snr()',              { snr }],
            ['src_set_dipole_polarity()',  { polarity: dipolePolarity }],
        ]

        for (const [code, params] of steps) {
            const r = await service.runCode(code, params, [SCRIPT_NAME])
            const py = (r?.result ?? r) as { success: boolean, error?: string } | undefined
            if (!r?.success || !py?.success) {
                lastError.value = fmtErr(py?.error) ?? fmtErr(r?.error) ?? `${code} failed.`
                return false
            }
        }
        return true
    }

    /**
     * Register the output canvas elements in the Pyodide worker.
     *
     * `HTMLCanvasElement` cannot be cloned for `postMessage`, so each canvas is
     * converted to an `OffscreenCanvas` via `transferControlToOffscreen()` and
     * added to the transfer list.  **This must be called exactly once** — the
     * browser moves (not copies) the canvas control to the worker, and a second
     * call on the same element will throw.  The component must guard accordingly.
     */
    async function setCanvases (
        service:        PythonInterpreterService,
        sourceCanvas:   HTMLCanvasElement,
        topomapCanvas?: HTMLCanvasElement,
    ): Promise<boolean> {
        lastError.value = null

        const sourceOff = sourceCanvas.transferControlToOffscreen()
        const r1 = await service.runCode('src_set_source_canvas()', {
            canvas: sourceOff,
            width:  sourceCanvas.offsetWidth || sourceCanvas.width,
            height: sourceCanvas.offsetHeight || sourceCanvas.height,
        }, [SCRIPT_NAME], [sourceOff]) as { success: boolean, error?: string } | undefined
        if (!r1?.success) {
            lastError.value = r1?.error ?? 'src_set_source_canvas() failed.'
            return false
        }

        if (topomapCanvas) {
            const topoOff = topomapCanvas.transferControlToOffscreen()
            const r2 = await service.runCode('src_set_topomap_canvas()', {
                canvas: topoOff,
            }, [SCRIPT_NAME], [topoOff]) as { success: boolean, error?: string } | undefined
            if (!r2?.success) {
                lastError.value = r2?.error ?? 'src_set_topomap_canvas() failed.'
                return false
            }
        }
        return true
    }

    // ── Phase 3: analysis ─────────────────────────────────────────────────────

    /**
     * Extract a signal epoch for the matched channels, push it into Pyodide,
     * compute the source estimate, and render to the registered canvases.
     *
     * The epoch `Float32Array` is **transferred** to the worker (zero-copy)
     * since it is freshly allocated on every call.
     *
     * @param service    - Active PyodideService.
     * @param resource   - Current EEG recording resource.
     * @param timeRange  - `[start, end]` in seconds defining the analysis window.
     * @param lfSetup    - Matched lead-field setup (provides `signalIndices`).
     * @param tmin       - Epoch start time in seconds (default 0).
     */
    async function analyze (
        service:   PythonInterpreterService,
        resource:  BiosignalResource,
        timeRange: [number, number],
        lfSetup:   LeadFieldSetup,
        tmin = 0,
        plotMode: SourceLocPlotMode = '2d',
    ): Promise<SourceLocResult | null> {
        computing.value = true
        lastError.value = null
        try {
            const response = await resource.getAllSignals(timeRange)
            if (!response?.signals?.length) {
                lastError.value = 'No signal data available for the selected time window.'
                return null
            }

            const { signalIndices } = lfSetup
            const nCh    = signalIndices.length
            const nTimes = response.signals[signalIndices[0]]?.data.length ?? 0
            if (!nTimes) {
                lastError.value = 'Signal data is empty for the selected time window.'
                return null
            }

            // Pack matched channels into a flat (1, nCh, nTimes) Float32Array.
            const epochs = new Float32Array(nCh * nTimes)
            for (let ci = 0; ci < nCh; ci++) {
                const sig = response.signals[signalIndices[ci]]?.data
                if (sig) {
                    epochs.set(sig, ci * nTimes)
                }
            }

            const pyResult = (r: RunCodeResult | undefined) =>
                ((r?.result ?? r) as { success: boolean, error?: string } | undefined)

            // src_set_epochs — transfer the buffer (freshly allocated, not cached).
            const r1 = await service.runCode('src_set_epochs()', {
                epochs,
                n_epochs:   1,
                n_channels: nCh,
                n_times:    nTimes,
                tmin,
            }, [SCRIPT_NAME], [epochs.buffer])
            if (!r1?.success || !pyResult(r1)?.success) {
                lastError.value = fmtErr(pyResult(r1)?.error) ?? fmtErr(r1?.error) ?? 'src_set_epochs() failed.'
                return null
            }

            const r2 = await service.runCode('src_compute_evoked()', {}, [SCRIPT_NAME])
            if (!r2?.success || !pyResult(r2)?.success) {
                lastError.value = fmtErr(pyResult(r2)?.error) ?? fmtErr(r2?.error) ?? 'src_compute_evoked() failed.'
                return null
            }

            const r3 = await service.runCode('src_compute_source()', {}, [SCRIPT_NAME])
            if (!r3?.success || !pyResult(r3)?.success) {
                lastError.value = fmtErr(pyResult(r3)?.error) ?? fmtErr(r3?.error) ?? 'src_compute_source() failed.'
                return null
            }

            await service.runCode('src_set_plot_mode()', { mode: plotMode }, [SCRIPT_NAME])
            const r4 = await service.runCode('src_plot()', {}, [SCRIPT_NAME])
            if (!r4?.success || !pyResult(r4)?.success) {
                lastError.value = fmtErr(pyResult(r4)?.error) ?? fmtErr(r4?.error) ?? 'src_plot() failed.'
                return null
            }

            return pyResult(r3) as unknown as SourceLocResult
        } finally {
            computing.value = false
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Ask the host's lead-field provider for the matrix matching the given
     * parameters, memoising the result at module scope.
     *
     * Sets `lastError` and `leadFieldUnavailable` on failure and returns null;
     * the two flags let the caller tell "this deployment has no lead field for
     * that montage" (nothing to retry) from "the lookup broke" (retry may help).
     */
    async function _fetchLeadField (
        montageName: string,
        nOrient:     number,
        gridResMm:   number,
    ): Promise<LeadFieldData | null> {
        const cacheKey = `${montageName}/${nOrient}/${gridResMm}`
        if (_lfCache.has(cacheKey)) {
            return _lfCache.get(cacheKey)!
        }

        const provider = runtime.leadFieldProvider
        if (!provider) {
            lastError.value = 'No lead field provider is configured for this application.'
            leadFieldUnavailable.value = true
            return null
        }

        let data: LeadFieldData | null
        try {
            data = await provider(montageName, nOrient, gridResMm)
        } catch (e) {
            lastError.value = `Lead field lookup failed: ${(e as Error).message}`
            return null
        }
        if (!data) {
            lastError.value = `No lead field is available for montage '${montageName}' `
                            + `(n_orient=${nOrient}, ${gridResMm} mm).`
            leadFieldUnavailable.value = true
            return null
        }

        _lfCache.set(cacheKey, data)
        return data
    }

    // ── Public surface ────────────────────────────────────────────────────────

    return {
        /** True once the Python script has been loaded into the Pyodide worker. */
        scriptLoaded,
        /** True while `analyze()` is running. */
        computing,
        /** Last error message, or null. Cleared at the start of each operation. */
        lastError,
        /**
         * True when `fetchAndMatchLeadField` failed because this deployment has no lead field for
         * the requested montage (or no provider at all), as opposed to the lookup breaking.
         * Retrying will not help; an administrator has to make the lead field available.
         */
        leadFieldUnavailable,
        ensureScriptLoaded,
        fetchAndMatchLeadField,
        setup,
        setCanvases,
        analyze,
    }
}
