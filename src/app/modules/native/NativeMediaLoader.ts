/**
 * Study loader for media files the browser renders on its own.
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
import NativeMediaResource, { type NativeMediaModality } from './NativeMediaResource'

const SCOPE = 'NativeMediaLoader'

/**
 * Loads one modality of native media without reading the file: a study from a URL keeps the URL, a study from a
 * local file mints an object URL for it, and the resource hands either to the browser's media element. There is no
 * importer, exporter, worker or memory manager, so the methods that would configure one accept and ignore it.
 */
export default class NativeMediaLoader implements StudyLoader {
    protected _modality: NativeMediaModality
    protected _nextIndex = 0
    /** Studies taken by `useStudy` and not yet made into a resource, keyed by the index `useStudy` returned. */
    protected _studies = new Map<number, StudyContext>()

    /**
     * Create a loader for one native media modality.
     * @param modality - The modality every resource this loader creates carries.
     */
    constructor (modality: NativeMediaModality) {
        this._modality = modality
    }

    get resourceModality () {
        return this._modality
    }
    get studyExporter () {
        return null
    }
    get studyImporter () {
        return null
    }
    get supportedModalities () {
        return [this._modality]
    }

    /**
     * List a media file from its address, or from a local file, for which an object URL is minted that the resource
     * revokes. The browser reads the file, so the resource is ready as listed and its activation loads nothing.
     */
    createListedResource (listing: StudyListing) {
        if (listing.source instanceof File) {
            return new NativeMediaResource(
                listing.name,
                this._modality,
                URL.createObjectURL(listing.source),
                listing.source.type,
                true,
            )
        }
        if (typeof listing.source !== 'string' || !listing.source) {
            Log.error(`Study '${listing.name}' is listed without a file address.`, SCOPE)
            return null
        }
        return new NativeMediaResource(listing.name, this._modality, listing.source)
    }

    async getResource (idx: number | string = -1) {
        const index = typeof idx === 'number'
                      ? (idx < 0 ? this._nextIndex - 1 : idx)
                      : [...this._studies].find(([, s]) => s.name === idx)?.[0] ?? -1
        const study = this._studies.get(index)
        if (!study) {
            return null
        }
        // A study becomes one resource; the resource holds everything the study carried.
        this._studies.delete(index)
        const file = study.files[0]
        if (!file?.url) {
            Log.error(`Study '${study.name}' has no file address to load.`, SCOPE)
            return null
        }
        return new NativeMediaResource(
            study.name,
            this._modality,
            file.url,
            file.mime ?? '',
            study.meta.ownsUrl === true,
        )
    }

    isSupportedModality (modality: string) {
        return modality === this._modality
    }

    async loadFromDirectory (_dir: FileSystemItem, _options?: ConfigStudyLoader) {
        Log.error(`Loading ${this._modality} from a directory is not supported; open the file itself.`, SCOPE)
        return null
    }

    async loadFromFile (file: File, options?: ConfigStudyLoader) {
        // A caller that minted the URL itself keeps the right to revoke it.
        const url = options?.url || URL.createObjectURL(file)
        return this._study(options?.name || file.name, url, file.type, !options?.url)
    }

    async loadFromFsItem (_fileTree: FileSystemItem, _options?: ConfigStudyLoader) {
        return [] as StudyContextCollection[]
    }

    async loadFromUrl (fileUrl: string, options?: ConfigStudyLoader) {
        const name = options?.name || decodeURIComponent(fileUrl.split('?')[0].split('/').pop() || '')
        return this._study(name, fileUrl, '', false)
    }

    registerMemoryManager () {
        // Nothing to manage: the browser holds the decoded media.
    }

    registerStudyExporter (_mod: FileFormatExporter) {
        Log.warn(`Native media cannot be exported; the exporter was not registered.`, SCOPE)
    }

    registerStudyImporter (_mod: FileFormatImporter) {
        Log.warn(`Native media is read by the browser; the importer was not registered.`, SCOPE)
    }

    async useStudy (study: StudyContext) {
        const index = this._nextIndex++
        this._studies.set(index, study)
        return index
    }

    /**
     * Build the study context for one media file.
     * @param name - Display name of the study.
     * @param url - Address of the file.
     * @param mime - MIME type of the file, or an empty string when it is not known.
     * @param ownsUrl - True when `url` is an object URL this loader minted and the resource must revoke.
     */
    protected _study (name: string, url: string, mime: string, ownsUrl: boolean): StudyContext {
        const study = studyContextTemplate({ modality: this._modality, name })
        study.format = this._modality
        study.meta = { ownsUrl }
        study.files.push({
            file: null,
            format: this._modality,
            mime: mime || null,
            modality: this._modality,
            name,
            partial: false,
            range: [],
            role: 'data',
            url,
        })
        return study
    }
}
