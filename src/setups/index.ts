/**
 * Epicurrents Interface framework setup.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

/*
 * ============================================================================
 * Framework setup — the lean, registration-driven entry point
 * ============================================================================
 *
 * This entry boots the application shell and core runtime and **imports no
 * modules, readers, importers, services, interface components or workers**.
 * Pulling any of those in here would bake them into the framework build
 * artifact and bloat every consumer's bundle — exactly what this entry exists
 * to avoid.
 *
 * Instead, the consumer passes a `register` callback that runs after the core
 * app is configured but before it launches. Inside it the consumer registers
 * only the modules their build needs (and imports only those packages), so each
 * consumer bundle contains exactly its chosen set and nothing else. The
 * interface (UI) modules under `#app/modules/*` are likewise NOT imported here —
 * the consumer imports the ones it needs and hands them to
 * `registerInterfaceModule()`, keeping them out of the framework artifact.
 *
 * An empty / absent `register` callback boots a bare shell with no modules —
 * the minimal-embed / bootstrap-smoke case.
 *
 * --------------------------------------------------------------------------
 * Consumer setup example (in the consumer's own file, NOT here)
 * --------------------------------------------------------------------------
 *
 *   import { createEpicurrentsApp, type SetupContext } from '@epicurrents/viewer'
 *   import * as eegModule from '@epicurrents/eeg-module'
 *   import { EdfImporter, EdfWorkerSubstitute } from '@epicurrents/edf-reader'
 *   import * as interfaceEegModule from '@epicurrents/viewer/modules/eeg'
 *   import { inlineWorker } from '@epicurrents/core/dist/util'
 *   import edfWorkerSrc from '@epicurrents/edf-reader/dist/workers/edf.worker.js?raw'
 *
 *   const edfWorker = () => inlineWorker('EdfWorker', edfWorkerSrc).create()
 *
 *   createEpicurrentsApp(config, async ({ app, useSAB, registerInterfaceModule }) => {
 *       app.registerModule('eeg', eegModule)
 *       const edf = new EdfImporter()
 *       edf.setWorkerOverride('eeg', () => useSAB ? edfWorker() : new EdfWorkerSubstitute())
 *       const loader = new eegModule.EegStudyLoader('EegEdfLoader', ['eeg'], edf)
 *       app.registerStudyImporter('eeg/edf-file', 'Open EDF file', 'file', loader)
 *       registerInterfaceModule('eeg', interfaceEegModule)
 *   })
 *
 * --------------------------------------------------------------------------
 * Module catalogue (DOCUMENTATION ONLY — do not import these in this file)
 * --------------------------------------------------------------------------
 *
 * A documented catalogue of the modules a consumer can register, so a clinician
 * or researcher (paired with an AI assistant) can discover the exact strings and
 * packages without reading source. A consumer may build a `MODULE_REGISTRY` like
 * this in their OWN setup file — but it must NOT live here, or importing the
 * framework would pull every module in.
 *
 *   | spec    | enables                              | reads            | package
 *   |---------|--------------------------------------|------------------|------------------------------
 *   | 'eeg'   | EEG viewer, montages, filters, aEEG  | EDF/EDF+, DICOM  | @epicurrents/eeg-module,
 *   |         |                                      |                  |   edf-reader, dicom-reader
 *   | 'acc'   | Accelerometry viewer                 | CSV              | @epicurrents/acc-module, csv-reader
 *   | 'htm'   | Markdown / HTML document viewer      | Markdown, HTML   | @epicurrents/doc-module, htm-reader
 *   | 'pdf'   | PDF document viewer                  | PDF              | @epicurrents/doc-module, pdf-reader
 *   | pyodide | Python-in-browser analysis service   | —                | @epicurrents/pyodide-service
 *
 * The all-in `setups/standalone.ts` is the reference consumer: it registers
 * every entry above and is the standalone demo / library build.
 */

// Make sure global is defined.
window.global ||= window

import { MB_BYTES, MICRO, safeObjectFrom } from '@epicurrents/core/dist/util'
import type { ApplicationInterfaceConfig } from '#types/globals'
import { Log } from 'scoped-event-log'
// Make sure we have valid initial configuration.
const SETUP: Required<ApplicationInterfaceConfig> = Object.assign(
    safeObjectFrom({
        activeModules: [],
        activeViews: [],
        allowInsecureAuth: true,
        appId: 'app',
        appName: 'EpiCurrents',
        assetPath: window.location.href,
        containerId: '',
        embedded: false,
        isProduction: false,
        locale: 'en',
        logThreshold: 'WARN',
        modules: {
            eeg: {
                cascadeMontages: {
                    'default:10-20': [
                        {
                            id: 'ekg',
                            label: 'EKG cascade',
                            candidates: ['EKG', 'ECG'],
                            rowCount: 10,
                            pageLength: 30,
                            sensitivity: 1000*MICRO,
                            highpass: 0.5,
                            lowpass: 40,
                        },
                    ],
                },
            },
        },
        pyodideAssetPath: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/', // CDN path.
        //pyodideAssetPath: `${window.location.origin}/vendor/pyodide/0.25.0/`, // Local dev path.
        scope: 'local' as 'local' | 'workspace',
        signalCacheMaxSize: 500,
        usePyodide: false,
        user: null,
        useSAB: true,
    } as Required<ApplicationInterfaceConfig>),
    __EPICURRENTS__?.SETUP,
    window.__EPICURRENTS__?.SETUP
)
// Create the global Epicurrents object if not available.
if (typeof window.__EPICURRENTS__ === 'undefined') {
    window.__EPICURRENTS__ = {
        EVENT_BUS: null,
        RUNTIME: null,
        SETUP: SETUP,
    }
} else {
    if (typeof window.__EPICURRENTS__.EVENT_BUS === 'undefined') {
        window.__EPICURRENTS__.EVENT_BUS = null
    }
    if (typeof window.__EPICURRENTS__.RUNTIME === 'undefined') {
        window.__EPICURRENTS__.RUNTIME = null
    }
    if (typeof window.__EPICURRENTS__.SETUP === 'undefined') {
        window.__EPICURRENTS__.SETUP = SETUP
    } else {
        // Merge existing setup with defaults.
        window.__EPICURRENTS__.SETUP = Object.assign(
            SETUP,
            safeObjectFrom(window.__EPICURRENTS__.SETUP)
        )
    }
}

// Core runtime and the interface shell are the only framework dependencies —
// no modules, readers, services or workers are imported here (see header).
import { Epicurrents } from '@epicurrents/core'
import type { EpicurrentsApp } from '@epicurrents/core/types'
import type { ResourceModuleContext } from '#store'
import { DefaultInterface } from '#DefaultInterface'

// Initial logging threshold.
Log.setPrintThreshold(SETUP.logThreshold)

/**
 * What a `register` callback receives. The callback registers the modules,
 * study importers, workers, services and interface components a build needs,
 * importing only the packages it uses so the framework stays free of them.
 */
export type SetupContext = {
    /** The core application instance — already configured, not yet launched. */
    app: EpicurrentsApp
    /** True when shared-memory (SharedArrayBuffer) features are enabled. */
    useSAB: boolean
    /** The resolved SETUP configuration (read `activeModules`, `usePyodide`, …). */
    setup: Required<ApplicationInterfaceConfig>
    /**
     * Register a per-modality interface (UI) module so its viewer / controls /
     * footer components are available once that modality activates. The module
     * is imported by the consumer and never bundled into the framework.
     */
    registerInterfaceModule (name: string, module: ResourceModuleContext): void
}

/**
 * Consumer-supplied registration callback. Runs after the core app is configured
 * and before it launches. Register everything modality-specific here.
 */
export type RegisterModules = (context: SetupContext) => void | Promise<void>

/**
 * The startup configuration object accepted by {@link createEpicurrentsApp}.
 * Re-exported from the framework entry so an external consumer can type its own
 * setup file's `config` parameter without reaching into an internal path.
 */
export type { ApplicationInterfaceConfig }

/**
 * Create an Epicurrents application instance.
 *
 * The framework performs the shared bootstrap, applies pre-launch configuration
 * and launches the interface shell. Everything modality-specific — modules,
 * study importers, workers, services and interface components — is registered by
 * the optional `register` callback, which imports only the packages it needs.
 * Omitting `register` boots a bare shell with no modules.
 *
 * @param config   Optional configuration merged over the resolved SETUP.
 * @param register Optional callback that registers modules before launch.
 */
export const createEpicurrentsApp = async (
    config?: ApplicationInterfaceConfig,
    register?: RegisterModules,
) => {
    // Update setup.
    Object.assign(SETUP, config)
    // Resolve the runtime configuration a host's HTML entry used to set, so every consumer — the
    // standalone build and embedding hosts such as the platform — honours it identically.
    const urlParams = new URLSearchParams(window.location?.search || '')
    // Production unless running under the Vite dev server. `import.meta.hot` is defined only by the
    // dev server and undefined in any build, making it the reliable build-vs-dev signal — unlike
    // `import.meta.env.MODE`, which the dist builds as 'development' (NODE_ENV) and so never reads
    // 'production'. An explicit isProduction in the incoming config still wins.
    const isProduction = typeof config?.isProduction === 'boolean' ? config.isProduction : !import.meta.hot
    SETUP.isProduction = isProduction
    // The `log` flag overrides the print threshold; otherwise default by mode unless the host chose
    // one (the platform sets its own per its dev-server signal, which must not be clobbered here).
    const logFlag = urlParams.get('log')
    if (logFlag) {
        SETUP.logThreshold = logFlag.toLocaleUpperCase() as typeof SETUP.logThreshold
    } else if (config?.logThreshold === undefined) {
        SETUP.logThreshold = isProduction ? 'WARN' : 'INFO'
    }
    Log.setPrintThreshold(SETUP.logThreshold)
    // The `services`/`advanced` flags opt into the Pyodide compute service.
    if (urlParams.get('services')?.split(',').includes('pyodide') || urlParams.has('advanced')) {
        SETUP.usePyodide = true
    }
    // The `memory` flag sets the signal-cache size in megabytes; a value of 0 disables the
    // shared-memory (SharedArrayBuffer) route entirely so the plain JS-heap buffer design is used
    // instead — a safety hatch for environments where SAB misbehaves.
    const memoryFlag = urlParams.get('memory')
    const memoryMb = memoryFlag !== null ? Number.parseFloat(memoryFlag) : NaN
    const sabDisabledByFlag = memoryMb === 0
    if (Number.isFinite(memoryMb) && memoryMb > 0) {
        SETUP.signalCacheMaxSize = memoryMb
    }
    /** Application core. */
    const coreApp = new Epicurrents()
    // Check for SharedArrayBuffer support and the initial config value for the memory manager.
    const USE_SAB = typeof SharedArrayBuffer !== 'undefined' && SETUP.useSAB && !sabDisabledByFlag
    Log.debug(USE_SAB ? 'Using shared memory features.' : 'Shared memory features are disabled.', 'entry')
    // Apply pre-launch configuration.
    coreApp.configure({
        'app.logThreshold': SETUP.logThreshold,
        'app.maxLoadCacheSize': SETUP.signalCacheMaxSize*MB_BYTES,
        'app.useMemoryManager': USE_SAB,
    })
    // The interface module map is populated by the consumer's registrar through
    // registerInterfaceModule(); reset it so repeated calls start clean.
    DefaultInterface.MODULES = {}
    // Let the consumer register the modules, importers, workers, services and
    // interface components their build needs — before the app launches.
    if (register) {
        await register({
            app: coreApp,
            useSAB: USE_SAB,
            setup: SETUP,
            registerInterfaceModule: (name, module) => {
                DefaultInterface.MODULES[name] = module
            },
        })
    }
    // Register the interface and launch the app.
    coreApp.registerInterface(DefaultInterface)
    coreApp.launch(SETUP).then(() => {
        // Possible post-launch setup.
    })
    return coreApp
}
