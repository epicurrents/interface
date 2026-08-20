/**
 * Epicurrents Interface user-settings backend client.
 *
 * The interface persists user-definable settings to the device by default (session storage always,
 * local storage when the user has opted into the settings cookie). That copy belongs to one browser
 * on one machine, which is the wrong granularity for a deployment where the same person works from
 * whichever workstation is free.
 *
 * When the host sets `app.userSettingsBackend` to an address, this module mirrors those same
 * settings to the signed-in user's account through it: the address is read once at startup and the
 * stored values are applied on top of the device copy, and every later change is written back with
 * a short debounce so a burst of adjustments costs one request. With the setting empty — its
 * default, and the case for the standalone viewer — nothing here reaches the network and the device
 * copy is the only one.
 *
 * Three properties keep the mirror from doing harm when it misbehaves:
 *
 * - **Failures are quiet.** A settings mirror that cannot be reached must never block the viewer
 *   from opening, so every error is logged and the device copy carries on as before. Both requests
 *   carry a timeout, because a hanging connection would otherwise stall startup in a way a failing
 *   one does not.
 * - **No write before a read.** A write replaces the stored map wholesale, so writing from a local
 *   picture that was never populated from the backend would delete every setting the user has
 *   stored elsewhere. Until a read succeeds, changes stay on the device only.
 * - **Values are checked before they are sent.** The write is all-or-nothing, so a single value the
 *   backend rejects would take every other setting down with it and keep doing so for the rest of
 *   the session. A value that does not fit the contract is dropped here instead, with a warning.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { SETTINGS } from '@epicurrents/core'
import type { SettingsValue } from '@epicurrents/core/types'
import { Log } from 'scoped-event-log'

const SCOPE = 'user-settings'

/** Milliseconds to wait for further changes before writing the accumulated set to the backend. */
const SAVE_DEBOUNCE_MS = 1_000
/** Milliseconds before a request to the backend is abandoned. The read is awaited during startup,
 *  so this bounds how long an unreachable backend can delay the viewer opening. */
const REQUEST_TIMEOUT_MS = 5_000
/**
 * Cookie holding the CSRF token, and the header the backend expects it echoed in. These are
 * Django's defaults and the convention most session-authenticated backends follow; a backend that
 * does not use them simply sees no such cookie and the header is omitted.
 */
const CSRF_COOKIE = 'csrftoken'
const CSRF_HEADER = 'X-CSRFToken'
/**
 * The shape a stored setting may take, mirroring what the backend accepts: a `<module>.<field>`
 * path naming the setting, and a primitive or a short flat list of primitives as its value.
 * Anything else is dropped before it can fail a write that carries every other setting with it.
 */
const SETTING_KEY_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/
const MAX_VALUE_LENGTH = 1024
const MAX_ITEMS_PER_VALUE = 64

/** Settings as last known to the backend, merged with every change queued since. */
let knownSettings = {} as Record<string, SettingsValue>
/** Whether a read has succeeded this session. Writes are held back until it has. */
let backendRead = false
/** Pending debounced write, or `null` when no write is scheduled. */
let saveTimer = null as ReturnType<typeof setTimeout> | null

/** Read a cookie value by name, or an empty string when it is not set. */
const readCookie = (name: string): string => {
    if (typeof document === 'undefined') {
        return ''
    }
    for (const part of document.cookie.split(';')) {
        const [key, ...rest] = part.trim().split('=')
        if (key === name) {
            return decodeURIComponent(rest.join('='))
        }
    }
    return ''
}

/** An abort signal that fires after the request timeout, or undefined where it is unavailable. */
const timeoutSignal = (): AbortSignal | undefined => {
    return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        : undefined
}

/** Whether a single value is one the backend will accept. */
const isStorableValue = (value: unknown): boolean => {
    if (value === null || typeof value === 'boolean' || typeof value === 'number') {
        return true
    }
    if (typeof value === 'string') {
        return value.length <= MAX_VALUE_LENGTH
    }
    if (Array.isArray(value)) {
        return value.length <= MAX_ITEMS_PER_VALUE && value.every(item =>
            item === null
            || typeof item === 'boolean'
            || typeof item === 'number'
            || (typeof item === 'string' && item.length <= MAX_VALUE_LENGTH)
        )
    }
    return false
}

/** Write the accumulated settings to the backend, clearing the pending timer first. */
const writeSettings = async (): Promise<void> => {
    saveTimer = null
    const backend = getUserSettingsBackend()
    if (!backend) {
        return
    }
    const headers = { 'Content-Type': 'application/json' } as Record<string, string>
    const csrfToken = readCookie(CSRF_COOKIE)
    if (csrfToken) {
        headers[CSRF_HEADER] = csrfToken
    }
    try {
        const response = await fetch(backend, {
            body: JSON.stringify({ settings: knownSettings }),
            credentials: 'same-origin',
            headers: headers,
            method: 'PUT',
            signal: timeoutSignal(),
        })
        if (!response.ok) {
            Log.warn(`Saving settings to the user settings backend failed with ${response.status}.`, SCOPE)
            return
        }
        Log.debug(`Saved ${Object.keys(knownSettings).length} settings to the user settings backend.`, SCOPE)
    } catch (error) {
        Log.warn(`Could not reach the user settings backend to save settings: ${error}.`, SCOPE)
    }
}

/**
 * Address of the configured user-settings backend, or an empty string when settings are kept on the
 * local device only.
 */
export const getUserSettingsBackend = (): string => {
    return SETTINGS.app.userSettingsBackend || ''
}

/**
 * Fetch the signed-in user's stored settings from the configured backend.
 *
 * A successful read is also what unblocks writing: until one has happened, {@link
 * queueUserSettingsSave} keeps changes on the device, because a write replaces the stored map
 * wholesale and one built from an empty local picture would erase the user's other settings.
 *
 * @returns Map of `<module>.<field>` to stored value, or `null` when no backend is configured or it
 *          could not be read. A `null` return is not an error the caller needs to handle; it means
 *          the device copy of the settings stands unchanged.
 */
export const loadUserSettings = async (): Promise<Record<string, SettingsValue> | null> => {
    const backend = getUserSettingsBackend()
    if (!backend) {
        return null
    }
    try {
        const response = await fetch(backend, { credentials: 'same-origin', signal: timeoutSignal() })
        if (!response.ok) {
            Log.warn(`Reading the user settings backend failed with ${response.status}.`, SCOPE)
            return null
        }
        const body = await response.json() as { settings?: Record<string, SettingsValue> }
        const settings = body?.settings
        if (!settings || typeof settings !== 'object') {
            Log.warn(`The user settings backend returned an unexpected response shape.`, SCOPE)
            return null
        }
        // Seed the local mirror so the first write back is a complete snapshot rather than just the
        // one field that changed.
        knownSettings = { ...settings }
        backendRead = true
        return settings
    } catch (error) {
        Log.warn(`Could not reach the user settings backend to load settings: ${error}.`, SCOPE)
        return null
    }
}

/**
 * Record a changed setting and schedule it to be written to the backend.
 *
 * Calling this is a no-op when no backend is configured, and until a read of the backend has
 * succeeded this session. Successive calls within the debounce window are collapsed into a single
 * write carrying every field, so adjusting a slider does not produce a request per step.
 *
 * @param field - Full settings path of the changed field (e.g. `eeg.defaultMontage`).
 * @param value - The new value. Callers are expected to have already checked that the field is user-definable.
 */
export const queueUserSettingsSave = (field: string, value: SettingsValue): void => {
    if (!getUserSettingsBackend() || !backendRead) {
        return
    }
    if (!SETTING_KEY_RE.test(field) || !isStorableValue(value)) {
        // Dropping one setting is the lesser failure: the write carries every field, so sending a
        // value the backend refuses would lose the whole map, and keep losing it on every
        // subsequent change for the rest of the session.
        Log.warn(`Setting ${field} has a shape the user settings backend does not accept; not saved.`, SCOPE)
        return
    }
    knownSettings[field] = value
    if (saveTimer !== null) {
        clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(writeSettings, SAVE_DEBOUNCE_MS)
}
