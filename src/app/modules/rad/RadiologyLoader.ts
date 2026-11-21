/**
 * Study loader for radiology studies rendered by a viewer page the host serves.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { studyContextTemplate } from '@epicurrents/core'
import type {
    ConfigStudyLoader,
    FileFormatExporter,
    FileFormatImporter,
    FileSystemItem,
    StudyContext,
    StudyContextCollection,
    StudyLoader,
} from '@epicurrents/core/types'
import { Log } from 'scoped-event-log'
import RadiologyResource, { RADIOLOGY_MODALITY } from './RadiologyResource'

const SCOPE = 'RadiologyLoader'

/**
 * Loads a radiology study from the address of its viewer page without fetching it: the resource keeps the address
 * and the radiology view frames it. Only a URL can be loaded, since a local file has no page to render it; there is
 * no importer, exporter, worker or memory manager, so the methods that would configure one accept and ignore it.
 */
export default class RadiologyLoader implements StudyLoader {
    protected _nextIndex = 0
    /** Studies taken by `useStudy` and not yet made into a resource, keyed by the index `useStudy` returned. */
    protected _studies = new Map<number, StudyContext>()

    get resourceModality () {
        return RADIOLOGY_MODALITY
    }
    get studyExporter () {
        return null
    }
    get studyImporter () {
        return null
    }
    get supportedModalities () {
        return [RADIOLOGY_MODALITY]
    }

    async getResource (idx: number | string = -1) {
        const index = typeof idx === 'number'
                      ? (idx < 0 ? this._nextIndex - 1 : idx)
                      : [...this._studies].find(([, s]) => s.name === idx)?.[0] ?? -1
        const study = this._studies.get(index)
        if (!study) {
            return null
        }
        this._studies.delete(index)
        const url = study.files[0]?.url
        if (!url) {
            Log.error(`Study '${study.name}' has no viewer address to load.`, SCOPE)
            return null
        }
        return new RadiologyResource(study.name, url)
    }

    isSupportedModality (modality: string) {
        return modality === RADIOLOGY_MODALITY
    }

    async loadFromDirectory (_dir: FileSystemItem, _options?: ConfigStudyLoader) {
        Log.error(`A radiology study is opened from the address of its viewer, not from a directory.`, SCOPE)
        return null
    }

    async loadFromFile (_file: File, _options?: ConfigStudyLoader) {
        Log.error(`A radiology study is opened from the address of its viewer, not from a file.`, SCOPE)
        return null
    }

    async loadFromFsItem (_fileTree: FileSystemItem, _options?: ConfigStudyLoader) {
        return [] as StudyContextCollection[]
    }

    async loadFromUrl (viewerUrl: string, options?: ConfigStudyLoader) {
        const study = studyContextTemplate({ modality: RADIOLOGY_MODALITY, name: options?.name || 'Radiology study' })
        study.format = RADIOLOGY_MODALITY
        study.files.push({
            file: null,
            format: RADIOLOGY_MODALITY,
            mime: null,
            modality: RADIOLOGY_MODALITY,
            name: study.name,
            partial: false,
            range: [],
            role: 'data',
            url: viewerUrl,
        })
        return study
    }

    registerMemoryManager () {
        // Nothing to manage: the framed page holds the study.
    }

    registerStudyExporter (_mod: FileFormatExporter) {
        Log.warn(`A radiology study cannot be exported; the exporter was not registered.`, SCOPE)
    }

    registerStudyImporter (_mod: FileFormatImporter) {
        Log.warn(`A radiology study is read by its viewer page; the importer was not registered.`, SCOPE)
    }

    async useStudy (study: StudyContext) {
        const index = this._nextIndex++
        this._studies.set(index, study)
        return index
    }
}
