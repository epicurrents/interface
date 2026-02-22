/**
 * Epicurrents Interface default setup script.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

// Make sure global is defined.
window.global ||= window

import { safeObjectFrom } from '@epicurrents/core/dist/util'
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
        modules: {},
        pyodideAssetPath: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/', // CDN path.
        //pyodideAssetPath: `${window.location.origin}/vendor/pyodide/0.25.0/`, // Local dev path.
        scope: 'local' as 'local' | 'workspace',
        signalCacheMaxSize: 1000,
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
// Import rest of the modules after global property setup.
import * as interfaceDocModule from '#app/modules/doc'
import * as interfaceEegModule from '#app/modules/eeg'
import * as interfacePdfModule from '#app/modules/pdf'
/*
 * ANNOTATION: How this file registers modules, workers and importers
 * -----------------------------------------------------------------
 * This entry script prepares a `SETUP` object and then creates a core
 * `Epicurrents` instance in `createEpicurrentsApp()`. The code below
 * imports all available modules and conditionally registers them using
 * checks against `SETUP.activeModules`.
 *
 * Common patterns you'll see and can reuse:
 *
 * 1) Register a module
 *    coreApp.registerModule('<modName>', <moduleObject>)
 *
 * 2) Register a study importer/loader
 *    coreApp.registerStudyImporter('mod/import-id', 'Label', 'file|folder|url', loaderInstance)
 *
 * 3) Override a worker used by the core or a module
 *    coreApp.setWorkerOverride('<worker-key>', () => myWorkerFactory())
 *
 * 4) Use the SETUP.activeModules list to include/exclude modules at
 *    runtime without changing the file itself. When `activeModules` is
 *    empty, a sensible default set is registered.
 *
 * Example: Add a new module 'foo' with a worker and a file importer
 *
 *  - At the top of this file, import your module and any reader:
 *      import * as fooModule from '@epicurrents/foo-module'
 *      import { FooImporter, FooWorkerSubstitute } from '@epicurrents/foo-reader'
 *
 *  - Add an inline worker source (if you ship a worker with the build):
 *      import fooWorkerSrc from '#root/dist/workers/foo.worker.js?raw'
 *      const fooWorker = () => inlineWorker('FooWorker', fooWorkerSrc).create()
 *
 *  - In `createEpicurrentsApp()` add the registration block:
 *      if (!SETUP.activeModules.length || SETUP.activeModules.includes('foo')) {
 *          coreApp.registerModule('foo', fooModule)
 *          coreApp.setWorkerOverride('foo-worker', fooWorker)
 *          const fooImporter = new FooImporter()
 *          fooImporter.setWorkerOverride('foo', () => fooWorker())
 *          coreApp.registerStudyImporter('foo/file', 'Open Foo file', 'file', fooImporter)
 *      }
 *
 * Example: Remove or disable a module
 *
 *  - Remove the corresponding registration block above, or
 *  - Prevent it at runtime by setting `window.__EPICURRENTS__.SETUP.activeModules`
 *    to a list that does not include the module key (e.g. ['eeg','pdf']).
 *
 * Notes on workers and Pyodide
 *  - This file often uses `inlineWorker(...?raw)` to embed worker sources so
 *    Vite's dev server and single-file builds resolve worker code reliably.
 *  - Pyodide requires an `indexURL` pointing to a WASM asset path. The
 *    default `SETUP.pyodideAssetPath` uses JSDelivr. For local testing, host
 *    the pyodide assets on a static server and update `SETUP.pyodideAssetPath`.
 *  - SharedArrayBuffer (SAB) usage is detected and used to decide whether to
 *    create SAB-backed workers (memory manager, montage) or fall back to substitutes.
 */
import { Epicurrents } from '@epicurrents/core'
import { inlineWorker } from '@epicurrents/core/dist/util'
import * as docModule from '@epicurrents/doc-module'
import * as eegModule from '@epicurrents/eeg-module'
import { EdfImporter, EdfWorkerSubstitute } from '@epicurrents/edf-reader'
import { DicomImporter, DicomWorkerSubstitute } from '@epicurrents/dicom-reader'
import { HtmImporter, MarkdownWorkerSubstitute } from '@epicurrents/htm-reader'
import { PdfImporter } from '@epicurrents/pdf-reader'
import { PyodideService } from '@epicurrents/pyodide-service'
import { DefaultInterface } from '#DefaultInterface'

// Initial logging threshold.
Log.setPrintThreshold(SETUP.logThreshold)

// Vite doesn't handle worker modules from packages very well (at least in dev mode), so this is necessary.
// inlineWorker gets the worker source from the compiled app file, removing the need for a file server.
import memWorkerSrc from '#root/dist/workers/memory-manager.worker.js?raw'
const memWorker = () => inlineWorker('MemoryManagerWorker', memWorkerSrc).create()
import montWorkerSrc from '#root/dist/workers/montage.worker.js?raw'
const montWorker = () => inlineWorker('MontageWorker', montWorkerSrc).create()

// Markdown.
import mdWorkerSrc from '#root/dist/workers/markdown.worker.js?raw'
const mdWorker = () => inlineWorker('MarkdownWorker', mdWorkerSrc).create()

// Pyodide
import pyoWorkerSrc from '#root/dist/workers/pyodide.worker.js?raw'
// We may need to use this worker for two purposes, but only want to create it once due to the
// overhead associated with the Pyodide virtual compiler.
const pwrk = inlineWorker('PyodideWorker', pyoWorkerSrc).create()
const pyoWorker = () => pwrk

// DICOM (for testing purposes).
import dcmWorkerSrc from '#root/dist/workers/dicom.worker.js?raw'
const dcmWorker = () => inlineWorker('DicomWorker', dcmWorkerSrc).create()

// EDF
import edfWorkerSrc from '#root/dist/workers/edf.worker.js?raw'
const edfWorker = () => inlineWorker('EdfWorker', edfWorkerSrc).create()

// PDF
import pdfWorkerSrc from '#root/dist/workers/pdfjs.worker.js?raw'

// This method creates an instance of the core Epicurrents application and registers the desired modules.
export const createEpicurrentsApp = async (config?: ApplicationInterfaceConfig) => {
    // Update setup.
    Object.assign(SETUP, config)
    /** Application core. */
    const coreApp = new Epicurrents()
    // Check for SharedArrayBuffer support and the initial config value for memory manager.
    const USE_SAB = typeof SharedArrayBuffer !== 'undefined'
                    && SETUP.useSAB
    Log.debug(USE_SAB ? 'Using shared memory features.' : 'Shared memory features are disabled.', 'entry')
    // Apply pre-launch configuration.
    coreApp.configure({
        'app.logThreshold': SETUP.logThreshold,
        'app.maxLoadCacheSize': SETUP.signalCacheMaxSize*1024*1024,
        'app.useMemoryManager': USE_SAB,
    })
    // Use memory manager if we have SAB support.
    if (USE_SAB) {
        coreApp.setWorkerOverride('memory-manager', memWorker)
        coreApp.setWorkerOverride('montage', montWorker)
    }
    // Pyodide service setup.
    if (SETUP.usePyodide) {
        /* Pyodide setup */
        coreApp.setWorkerOverride('pyodide', pyoWorker)
        if (USE_SAB) {
            // If we use Pyodide for computing montages, we must remember to convey signal data cache
            // updates to the service, among others.
            coreApp.setWorkerOverride('montage', pyoWorker)
        }
        /**
         * JSDelivr may start throttling requests if the page is reloaded too often (e.g. when developing).
         * If needed, replace indexURL with local resource path `${window.location.origin}/pyodide/0.25.0./`.
         *
         * Loading WASM scripts from the local file system is not allowed, so this approach does not work if
         * the application is run locally from a single file distribution.
         */
        const pyoService = new PyodideService()
        coreApp.registerService('pyodide', pyoService)
        pyoService.setupWorker(
            { indexURL: SETUP.pyodideAssetPath, packages: ['scipy', 'matplotlib', 'mne'] }
        )
        if (USE_SAB) {
            pyoService.loadDefaultScript('biosignal')
        }
    }

    // EEG module setup.
    if (!SETUP.activeModules.length || SETUP.activeModules.includes('eeg')) {
        // Register the EEG and EDF file loader modules.
        coreApp.registerModule('eeg', eegModule)
        coreApp.setWorkerOverride('eeg-montage', () => {
            if (SETUP.usePyodide) {
                return pyoWorker()
            }
            return montWorker()
        })
        const edfLoader = new EdfImporter()
        edfLoader.setWorkerOverride('eeg', () => {
            const eegSAB = window.__EPICURRENTS__.RUNTIME.SETTINGS.getFieldValue('eeg.useMemoryManager')
            if (USE_SAB && eegSAB) {
                return edfWorker()
            }
            return new EdfWorkerSubstitute()
        })
        const eegLoader = new eegModule.EegStudyLoader(
            'EegEdfLoader',
            ['eeg'],
            edfLoader
        )
        coreApp.registerStudyImporter('eeg/edf-file', 'Open EDF file', 'file', eegLoader)
        coreApp.registerStudyImporter('eeg/edf-folder', 'Open EDF files from folder',  'folder', eegLoader)
        coreApp.registerStudyImporter('eeg/edf-url', 'Open EDF from URL',  'url', eegLoader)
        //coreApp.registerStudyLoader('eeg-study', 'Open EEG study from folder', 'study', eegLoader)
        // DICOM reader is in development stage.
        const dcmLoader = new DicomImporter()
        dcmLoader.setWorkerOverride('eeg', () => {
            const eegSAB = window.__EPICURRENTS__.RUNTIME.SETTINGS.getFieldValue('eeg.useMemoryManager')
            if (USE_SAB && eegSAB) {
                return dcmWorker()
            }
            return new DicomWorkerSubstitute()
        })
        const eegDcmLoader = new eegModule.EegStudyLoader(
            'EegDicomLoader',
            ['eeg'],
            dcmLoader
        )
        coreApp.registerStudyImporter('eeg/dcm-file', 'Open DICOM file', 'file', eegDcmLoader)
        coreApp.registerStudyImporter('eeg/dcm-folder', 'Open DICOM files from folder', 'folder', eegDcmLoader)
        coreApp.registerStudyImporter('eeg/dcm-url', 'Open DICOM from URL', 'url', eegDcmLoader)
    }

    // Markdown module setup.
    if (!SETUP.activeModules.length || SETUP.activeModules.includes('htm')) {
        // Register the document module and htm reader.
        coreApp.registerModule('htm', docModule)
        const htmReader = new HtmImporter('markdown')
        htmReader.setWorkerOverride('markdown',
            () => {
                const docSAB = window.__EPICURRENTS__.RUNTIME.SETTINGS.getFieldValue('doc.useMemoryManager')
                if (USE_SAB && docSAB) {
                    return mdWorker()
                }
                return new MarkdownWorkerSubstitute()
            }
        )
        const htmLoader = new docModule.DocumentLoader(
            'HTMLoader',
            'htm',
            htmReader
        )
        coreApp.registerStudyImporter('doc/htm-file', 'Open markdown file', 'file', htmLoader)
        coreApp.registerStudyImporter('doc/htm-folder', 'Open markdown files from folder',  'folder', htmLoader)
        coreApp.registerStudyImporter('doc/htm-url', 'Open markdown from URL',  'url', htmLoader)
    }

    // PDF module setup.
    if (!SETUP.activeModules.length || SETUP.activeModules.includes('pdf')) {
        coreApp.registerModule('pdf', docModule)
        const pdfReader = new PdfImporter(
            inlineWorker('PdfWorker', pdfWorkerSrc).url
        )
        const pdfLoader = new docModule.DocumentLoader(
            'PDFLoader',
            'pdf',
            pdfReader
        )
        coreApp.registerStudyImporter('doc/pdf-file', 'Open PDF file', 'file', pdfLoader)
        coreApp.registerStudyImporter('doc/pdf-folder', 'Open PDF files from folder',  'folder', pdfLoader)
        coreApp.registerStudyImporter('doc/pdf-url', 'Open PDF from URL',  'url', pdfLoader)
    }

    /* An example EMG module setup. Reading signal data from WAV files requires knowledge of the value that the
     * has been normalized to, so an universal setup is not possible.
    if (!SETUP.activeModules.length || SETUP.activeModules.includes('emg')) {
        // Register the EMG module and WAV reader.
        coreApp.registerModule('emg', emgModule)
        const wavReader = new WavImporter()
        wavReader.setWorkerOverride('emg', () => {
            const emgSAB = window.__EPICURRENTS__.RUNTIME.SETTINGS.getFieldValue('emg.useMemoryManager')
            if (USE_SAB && emgSAB) {
                return wavWorker()
            }
            return new WavWorkerSubstitute()
        })
        const wavLoader = new emgModule.EmgStudyLoader(
            'EmgWavLoader',
            wavReader
        )
        coreApp.registerStudyImporter('emg/wav-file', 'Open WAV file', 'file', wavLoader)
        coreApp.registerStudyImporter('emg/wav-folder', 'Open WAV files from folder',  'folder', wavLoader)
        coreApp.registerStudyImporter('emg/wav-url', 'Open WAV from URL',  'url', wavLoader)
    }
    ----- EMG data reader setup */

    /* An example NCS module setup. This module requires a dedicated API or file reader for the source data used.
    if (!SETUP.activeModules.length || SETUP.activeModules.includes('ncs')) {
        coreApp.registerModule('ncs', ncsModule)
    }
    ----- NCS module setup */

    /* An example tabular data module setup. Tabular data requires a dedicated API reader to fetch the data.
    if (!SETUP.activeModules.length || SETUP.activeModules.includes('tab')) {
        coreApp.registerModule('tab', tabModule)
        const apiReader = new RestApiImporter(
            'tab',
            ['tab'],
            {
                nameMap: {
                    studykey: 'datasetId',
                    studyid: 'name',
                },
                overrideProperties: {
                    api: {
                        url: `http://localhost:8000/study/{datasetId}/`,
                    },
                    modality: 'tab',
                },
                paramMethod: 'inject',
            }
        )
        apiReader.setWorkerOverride('tab-api',
            () => {
                const tabSAB = window.__EPICURRENTS__.RUNTIME.SETTINGS.getFieldValue('tab.useMemoryManager')
                if (USE_SAB && tabSAB) {
                    return apiWorker()
                }
                return new RestApiWorkerSubstitute()
            }
        )
        const apiLoader = new tabModule.TabDataLoader(
            'ApiLoader',
            apiReader
        )
        coreApp.registerStudyImporter('tab/api-url', 'Open API from URL',  'url', apiLoader)
    }
    ----- Tab data reader setup */

    // Add interface resource modules.
    DefaultInterface.MODULES = {
        htm: interfaceDocModule,
        eeg: interfaceEegModule,
        pdf: interfacePdfModule,
    }
    // Register the interface and launch the app.
    coreApp.registerInterface(DefaultInterface)
    coreApp.launch(SETUP).then(() => {
        // Possible post-launch setup.
    })
    return coreApp
}
