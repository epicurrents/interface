/**
 * Epicurrents Interface standalone setup — EXAMPLE ONLY.
 *
 * This is a worked reference consumer of the framework setup (`setups/index.ts`),
 * kept for illustration. It is no longer the official build entry: the production
 * build now originates from the app/builder repo, whose config-driven setup
 * registers only the active edition's modules. See the builder's `setup/` and its
 * `vite.config.lib.ts`.
 *
 * As an example it imports every bundled module, importer, service and worker and
 * registers them through the framework's `register` callback, honouring
 * `SETUP.activeModules`. A real consumer writes its own small setup against
 * `createEpicurrentsApp` from `setups/index.ts` rather than importing this file.
 *
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { ApplicationInterfaceConfig } from '#types/globals'
// The framework owns the bootstrap, configuration and launch. Importing it also
// runs the shared SETUP / global bootstrap exactly once.
import { createEpicurrentsApp as createFrameworkApp, type SetupContext } from '#setups/index'
import { inlineWorker } from '@epicurrents/core/dist/util'
// Core (modality) modules.
import * as accModule from '@epicurrents/acc-module'
import * as docModule from '@epicurrents/doc-module'
import * as eegModule from '@epicurrents/eeg-module'
// Readers / importers.
import { CsvImporter, CsvWorkerSubstitute } from '@epicurrents/csv-reader'
import { EdfExporter, EdfImporter, EdfWorkerSubstitute } from '@epicurrents/edf-reader'
import { DicomImporter, DicomWorkerSubstitute } from '@epicurrents/dicom-reader'
import { HtmImporter, MarkdownWorkerSubstitute } from '@epicurrents/htm-reader'
import { PdfImporter } from '@epicurrents/pdf-reader'
// Analysis service.
import { PyodideService } from '@epicurrents/pyodide-service'
// Interface (UI) resource modules.
import * as interfaceAccModule from '#app/modules/acc'
import * as interfaceDocModule from '#app/modules/doc'
import * as interfaceEegModule from '#app/modules/eeg'
import * as interfacePdfModule from '#app/modules/pdf'

/*
 * Worker bundles are pre-built UMD files copied into `dist/workers/` by
 * `scripts/workers.mjs` (run during `npm run start` / `npm run build:lib`). We
 * load each one as a raw source string via Vite's `?raw` query and hand it to
 * `inlineWorker`, which wraps the string in a Blob URL and spawns a CLASSIC
 * worker. Two reasons not to use Vite's `?worker&inline` instead:
 *   1. Vite's `?worker` spawns module workers in dev regardless of
 *      `worker.format: 'iife'`. The Pyodide worker calls `importScripts(...)`
 *      to load its WASM runtime and module workers don't support that — they
 *      fail with "Module scripts don't support importScripts()".
 *   2. Even when module workers work syntactically, Vite's dev server fetches
 *      the worker source and each transitive import separately — cold paths can
 *      take tens of seconds. The pre-built UMD bundles are self-contained, so
 *      the Blob-URL approach sidesteps both Vite re-processing and the cascade.
 */
import memWorkerSrc from '#root/dist/workers/memory-manager.worker.js?raw'
const memWorker = () => inlineWorker('MemoryManagerWorker', memWorkerSrc).create()
import montWorkerSrc from '#root/dist/workers/montage.worker.js?raw'
const montWorker = () => inlineWorker('MontageWorker', montWorkerSrc).create()
import trendWorkerSrc from '#root/dist/workers/trend.worker.js?raw'
const trendWorker = () => inlineWorker('TrendWorker', trendWorkerSrc).create()
// Markdown.
import mdWorkerSrc from '#root/dist/workers/markdown.worker.js?raw'
const mdWorker = () => inlineWorker('MarkdownWorker', mdWorkerSrc).create()
// Pyodide — the virtual compiler has significant startup cost, so the worker is
// created once at module load and reused across all overrides that target it.
import pyoWorkerSrc from '#root/dist/workers/pyodide.worker.js?raw'
const pwrk = inlineWorker('PyodideWorker', pyoWorkerSrc).create()
const pyoWorker = () => pwrk
// DICOM (for testing purposes).
import dcmWorkerSrc from '#root/dist/workers/dicom.worker.js?raw'
const dcmWorker = () => inlineWorker('DicomWorker', dcmWorkerSrc).create()
// EDF.
import edfWorkerSrc from '#root/dist/workers/edf.worker.js?raw'
const edfWorker = () => inlineWorker('EdfWorker', edfWorkerSrc).create()
// EDF writer (export) — the exporter runs the heavy encode off the main thread and transfers the bytes back.
import edfWriterWorkerSrc from '#root/dist/workers/edf.writer.worker.js?raw'
const edfWriterWorker = () => inlineWorker('EdfWriterWorker', edfWriterWorkerSrc).create()
// CSV.
import csvWorkerSrc from '#root/dist/workers/csv.worker.js?raw'
const csvWorker = () => inlineWorker('CsvWorker', csvWorkerSrc).create()
// PDF — pdfjs requires a URL string for `GlobalWorkerOptions.workerSrc`.
// `inlineWorker`'s returned `url` is a Blob URL pointing at the same bundle.
import pdfWorkerSrc from '#root/dist/workers/pdfjs.worker.js?raw'

/**
 * Register every bundled module, importer, service and worker, gated by
 * `SETUP.activeModules` (an empty list registers them all).
 */
const registerAllModules = ({ app, useSAB, setup, registerInterfaceModule }: SetupContext) => {
    // Use the memory manager if we have SAB support.
    if (useSAB) {
        app.setWorkerOverride('memory-manager', memWorker)
        app.setWorkerOverride('montage', montWorker)
        app.setWorkerOverride('trend', trendWorker)
    }
    // Pyodide service setup.
    if (setup.usePyodide) {
        app.setWorkerOverride('pyodide', pyoWorker)
        if (useSAB) {
            // If we use Pyodide for computing montages, we must convey signal
            // data cache updates to the service, among others.
            app.setWorkerOverride('montage', pyoWorker)
        }
        const pyoService = new PyodideService()
        app.registerService('pyodide', pyoService)
        pyoService.setupWorker(
            { indexURL: setup.pyodideAssetPath, packages: ['scipy', 'matplotlib', 'mne'] }
        )
        if (useSAB) {
            pyoService.loadDefaultScript('biosignal')
        }
    }

    // EEG module setup.
    if (!setup.activeModules.length || setup.activeModules.includes('eeg')) {
        // Register the EEG and EDF file loader modules.
        app.registerModule('eeg', eegModule)
        // The eeg module ships useMemoryManager=false; opt it into the shared-memory
        // path (must be set after registerModule so 'eeg' resolves as a module field).
        app.configure({ 'eeg.useMemoryManager': useSAB })
        app.setWorkerOverride('eeg-montage', () => {
            if (setup.usePyodide) {
                return pyoWorker()
            }
            return montWorker()
        })
        const edfLoader = new EdfImporter()
        edfLoader.setWorkerOverride('eeg', () => {
            const eegSAB = window.__EPICURRENTS__.RUNTIME!.SETTINGS.getFieldValue('eeg.useMemoryManager')
            if (useSAB && eegSAB) {
                return edfWorker()
            }
            return new EdfWorkerSubstitute()
        })
        // The EDF exporter turns the active recording into an anonymized EDF file plus a metadata sidecar. It runs
        // the encode in the writer worker (transferring the result back for the main thread to download).
        const edfExporter = new EdfExporter()
        edfExporter.setWorkerOverride(edfWriterWorker)
        const eegLoader = new eegModule.EegStudyLoader(
            'EegEdfLoader',
            ['eeg'],
            edfLoader,
            edfExporter
        )
        app.registerStudyImporter('eeg/edf-file', 'Open EDF file', 'file', eegLoader)
        app.registerStudyImporter('eeg/edf-folder', 'Open EDF files from folder', 'folder', eegLoader)
        app.registerStudyImporter('eeg/edf-url', 'Open EDF from URL', 'url', eegLoader)
        app.registerStudyExporter('eeg/edf-export', 'Export as anonymized EDF', 'file', eegLoader)
        // DICOM reader is in development stage.
        const dcmLoader = new DicomImporter()
        dcmLoader.setWorkerOverride('eeg', () => {
            const eegSAB = window.__EPICURRENTS__.RUNTIME!.SETTINGS.getFieldValue('eeg.useMemoryManager')
            if (useSAB && eegSAB) {
                return dcmWorker()
            }
            return new DicomWorkerSubstitute()
        })
        const eegDcmLoader = new eegModule.EegStudyLoader(
            'EegDicomLoader',
            ['eeg'],
            dcmLoader
        )
        app.registerStudyImporter('eeg/dcm-file', 'Open DICOM file', 'file', eegDcmLoader)
        app.registerStudyImporter('eeg/dcm-folder', 'Open DICOM files from folder', 'folder', eegDcmLoader)
        app.registerStudyImporter('eeg/dcm-url', 'Open DICOM from URL', 'url', eegDcmLoader)
        registerInterfaceModule('eeg', interfaceEegModule)
    }

    // ACC module setup.
    if (!setup.activeModules.length || setup.activeModules.includes('acc')) {
        app.registerModule('acc', accModule)
        const csvLoader = new CsvImporter()
        csvLoader.setWorkerOverride('acc', () => {
            const accSAB = window.__EPICURRENTS__.RUNTIME!.SETTINGS.getFieldValue('acc.useMemoryManager')
            if (useSAB && accSAB) {
                return csvWorker()
            }
            return new CsvWorkerSubstitute()
        })
        const accLoader = new accModule.AccStudyLoader('AccCsvLoader', csvLoader)
        app.registerStudyImporter('acc/csv-file', 'Open CSV file', 'file', accLoader)
        app.registerStudyImporter('acc/csv-folder', 'Open CSV files from folder', 'folder', accLoader)
        app.registerStudyImporter('acc/csv-url', 'Open CSV from URL', 'url', accLoader)
        // Also load ACC data from EDF (accelerometry exported / converted to EDF),
        // not just CSV — registered as the acc/edf-* importers.
        const accEdfImporter = new EdfImporter()
        accEdfImporter.setWorkerOverride('acc', () => {
            const accSAB = window.__EPICURRENTS__.RUNTIME!.SETTINGS.getFieldValue('acc.useMemoryManager')
            if (useSAB && accSAB) {
                return edfWorker()
            }
            return new EdfWorkerSubstitute()
        })
        const accEdfLoader = new accModule.AccStudyLoader('AccEdfLoader', accEdfImporter)
        app.registerStudyImporter('acc/edf-file', 'Open EDF file', 'file', accEdfLoader)
        app.registerStudyImporter('acc/edf-folder', 'Open EDF files from folder', 'folder', accEdfLoader)
        app.registerStudyImporter('acc/edf-url', 'Open EDF from URL', 'url', accEdfLoader)
        registerInterfaceModule('acc', interfaceAccModule)
    }

    // Markdown module setup.
    if (!setup.activeModules.length || setup.activeModules.includes('htm')) {
        // Register the document module and htm reader.
        app.registerModule('htm', docModule)
        const htmReader = new HtmImporter('markdown')
        htmReader.setWorkerOverride('markdown',
            () => {
                const docSAB = window.__EPICURRENTS__.RUNTIME!.SETTINGS.getFieldValue('doc.useMemoryManager')
                if (useSAB && docSAB) {
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
        app.registerStudyImporter('doc/htm-file', 'Open markdown file', 'file', htmLoader)
        app.registerStudyImporter('doc/htm-folder', 'Open markdown files from folder', 'folder', htmLoader)
        app.registerStudyImporter('doc/htm-url', 'Open markdown from URL', 'url', htmLoader)
        registerInterfaceModule('htm', interfaceDocModule)
    }

    // PDF module setup.
    if (!setup.activeModules.length || setup.activeModules.includes('pdf')) {
        app.registerModule('pdf', docModule)
        const pdfReader = new PdfImporter(
            inlineWorker('PdfWorker', pdfWorkerSrc).url
        )
        const pdfLoader = new docModule.DocumentLoader(
            'PDFLoader',
            'pdf',
            pdfReader
        )
        app.registerStudyImporter('doc/pdf-file', 'Open PDF file', 'file', pdfLoader)
        app.registerStudyImporter('doc/pdf-folder', 'Open PDF files from folder', 'folder', pdfLoader)
        app.registerStudyImporter('doc/pdf-url', 'Open PDF from URL', 'url', pdfLoader)
        registerInterfaceModule('pdf', interfacePdfModule)
    }
}

// Create an instance of the core Epicurrents application with every bundled module registered.
export const createEpicurrentsApp = (config?: ApplicationInterfaceConfig) =>
    createFrameworkApp(config, registerAllModules)
