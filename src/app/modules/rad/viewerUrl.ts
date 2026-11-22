/**
 * Which addresses the radiology view may frame.
 *
 * A study's viewer page is framed inside the application's own chrome, so its address is held to the same standard as
 * application code: an `http:` or `https:` page of the application's own origin, or of an origin the host named when it
 * registered the module. Anything else is refused, which keeps a `javascript:` address from running in a frame that
 * inherits the application's origin and keeps a foreign page from being presented as part of the application. The
 * loader checks an address when it lists or loads a study, and the view checks it again before it frames it.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { Log } from 'scoped-event-log'

const SCOPE = 'radiology-viewer-url'

/** The origins a viewer page may have besides the application's own. */
const allowedOrigins = new Set<string>()

/**
 * The origin of `address` when it is an absolute `http:` or `https:` one, null otherwise.
 * @param address - An origin, or any absolute address of it.
 */
const webOrigin = (address: string) => {
    try {
        const url = new URL(address)
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null
    } catch {
        return null
    }
}

/**
 * Replace the origins a viewer page may have besides the application's own, which is always allowed.
 * @param origins - Origins such as `https://viewer.example.org`; an entry that is not an `http:` or `https:` origin is logged and left out.
 */
export const setAllowedViewerOrigins = (origins: Iterable<string> = []) => {
    allowedOrigins.clear()
    for (const entry of origins) {
        const origin = typeof entry === 'string' ? webOrigin(entry) : null
        if (!origin) {
            Log.error(`'${entry}' is not an origin a radiology viewer page can have; it was not allowed.`, SCOPE)
            continue
        }
        allowedOrigins.add(origin)
    }
}

/** The origins a viewer page may have: the application's own, then the ones the host allowed. */
export const getAllowedViewerOrigins = () => {
    return [window.location.origin, ...[...allowedOrigins].filter(origin => origin !== window.location.origin)]
}

/**
 * Resolve the address of a viewer page against the application's document and check that it may be framed.
 * @param address - Address of the viewer page, absolute or relative to the application's document.
 * @returns The resolved address when it is an `http:` or `https:` page of an allowed origin, null otherwise.
 */
export const resolveViewerUrl = (address: unknown): URL | null => {
    if (typeof address !== 'string' || !address.trim()) {
        return null
    }
    let url: URL
    try {
        url = new URL(address, window.location.href)
    } catch {
        return null
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null
    }
    if (url.origin !== window.location.origin && !allowedOrigins.has(url.origin)) {
        return null
    }
    return url
}

/**
 * Whether the address of a viewer page may be framed.
 * @param address - Address of the viewer page, absolute or relative to the application's document.
 */
export const isAllowedViewerUrl = (address: unknown) => {
    return resolveViewerUrl(address) !== null
}
