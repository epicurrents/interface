/**
 * A media file the browser renders on its own: video, audio or a raster image.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericResource } from '@epicurrents/core'

/** The modalities a native media resource can carry, each rendered by its own HTML element. */
export const NATIVE_MEDIA_MODALITIES = ['audio', 'image', 'video'] as const
export type NativeMediaModality = typeof NATIVE_MEDIA_MODALITIES[number]

/**
 * A resource whose bytes the browser fetches and decodes itself, through the `src` of an `<audio>`, `<img>` or
 * `<video>` element. Nothing is read or parsed in the viewer, so the resource is ready as soon as it exists and holds
 * only the address of its file.
 */
export default class NativeMediaResource extends GenericResource {
    protected _mimeType: string
    protected _ownsUrl: boolean
    protected _url: string

    /**
     * Create a native media resource.
     * @param name - Display name of the resource.
     * @param modality - One of `audio`, `image` or `video`.
     * @param url - Address the media element loads the file from.
     * @param mimeType - MIME type of the file, or an empty string when it is not known.
     * @param ownsUrl - True when `url` is an object URL minted for this resource, which it revokes when destroyed.
     */
    constructor (name: string, modality: NativeMediaModality, url: string, mimeType = '', ownsUrl = false) {
        super(name, modality)
        this._mimeType = mimeType
        this._ownsUrl = ownsUrl
        this._url = url
        this._state = 'ready'
    }

    /** MIME type of the file, or an empty string when it is not known. */
    get mimeType () {
        return this._mimeType
    }

    /** Address the media element loads the file from. */
    get url () {
        return this._url
    }

    destroy () {
        if (this._ownsUrl) {
            URL.revokeObjectURL(this._url)
        }
        this._url = ''
        super.destroy()
    }

    getMainProperties () {
        const props = super.getMainProperties()
        if (this.state === 'ready') {
            const label = this._modality === 'audio' ? 'Audio'
                        : this._modality === 'image' ? 'Image'
                        : 'Video'
            props.set(label, null)
        }
        return props
    }
}
