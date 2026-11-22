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
    StudyListing,
    StudyLoader,
} from '@epicurrents/core/types'
import { Log } from 'scoped-event-log'
import RadiologyResource, { RADIOLOGY_MODALITY } from './RadiologyResource'
import { isAllowedViewerUrl } from './viewerUrl'

const SCOPE = 'RadiologyLoader'

/** How many studies `useStudy` holds for `getResource` at a time. */
const MAX_PENDING_STUDIES = 8

/**
 * Loads a radiology study from the address of its viewer page without fetching it: the resource keeps the address
 * and the radiology view frames it. Only a URL can be loaded, since a local file has no page to render it; there is
 * no importer, exporter, worker or memory manager, so the methods that would configure one accept and ignore it.
 *
 * The address has to be one the view may frame, an `http:` or `https:` page of an allowed origin (`viewerUrl.ts`);
 * a study with any other address is refused, listed or loaded.
 */
export default class RadiologyLoader implements StudyLoader {
    protected _nextIndex = 0
    /**
     * Studies taken by `useStudy` and not yet made into a resource, keyed by the index `useStudy` returned. At most
     * `MAX_PENDING_STUDIES` are held, the oldest giving way, so a study nobody asks the resource of is not kept.
     */
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

    /**
     * List a study from the address of its viewer page. The resource needs nothing read, so it is ready as listed and
     * its activation loads nothing.
     */
    createListedResource (listing: StudyListing) {
        if (typeof listing.source !== 'string' || !listing.source) {
            Log.error(`Study '${listing.name}' is listed without the address of its viewer page.`, SCOPE)
            return null
        }
        if (!isAllowedViewerUrl(listing.source)) {
            Log.error(`Study '${listing.name}' is listed with a viewer address that may not be framed.`, SCOPE)
            return null
        }
        return new RadiologyResource(listing.name, listing.source)
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
        if (!isAllowedViewerUrl(url)) {
            Log.error(`Study '${study.name}' has a viewer address that may not be framed.`, SCOPE)
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
        if (!isAllowedViewerUrl(viewerUrl)) {
            Log.error(
                `The address is not one a radiology viewer page may have: only an http or https page of the ` +
                `application's own origin, or of an origin the host allowed, is framed.`,
                SCOPE
            )
            return null
        }
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
        // A map keeps its insertion order, so the first key is the oldest study.
        while (this._studies.size > MAX_PENDING_STUDIES) {
            this._studies.delete(this._studies.keys().next().value as number)
        }
        return index
    }
}
