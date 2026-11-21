/**
 * A radiology study rendered by a viewer page the host serves.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericResource } from '@epicurrents/core'

/** The modality every radiology resource carries. */
export const RADIOLOGY_MODALITY = 'rad'
/**
 * Type of the message a framed viewer page posts to its parent window to ask for the way back: `{ type: <this> }`.
 * The radiology view honours it from its own frame and its own origin only.
 */
export const RADIOLOGY_RETURN_MESSAGE = 'epicurrents:radiology:return'

/**
 * A study the application does not read itself: it holds the address of a page that renders the study, which the
 * radiology view frames. What the page is (a DICOM viewer under the host's own mount, typically) is the host's choice,
 * so the resource is ready as soon as it exists and knows nothing about the study's format.
 *
 * A study attached to a recording it was made alongside is listed as one of that recording's `childResources`, and
 * the way back from the study passes through the recording.
 */
export default class RadiologyResource extends GenericResource {
    protected _viewerUrl: string

    /**
     * Create a radiology resource.
     * @param name - Display name of the resource.
     * @param viewerUrl - Address of the page that renders the study, framed by the radiology view.
     */
    constructor (name: string, viewerUrl: string) {
        super(name, RADIOLOGY_MODALITY)
        this._viewerUrl = viewerUrl
        this._state = 'ready'
    }

    /** Address of the page that renders the study. */
    get viewerUrl () {
        return this._viewerUrl
    }

    destroy () {
        this._viewerUrl = ''
        super.destroy()
    }

    getMainProperties () {
        const props = super.getMainProperties()
        if (this.state === 'ready') {
            props.set('Radiology', null)
        }
        return props
    }
}
