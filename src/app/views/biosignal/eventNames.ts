/**
 * The name an annotation event is shown by, worked out when it is shown rather than stored: the label a reader typed,
 * else the name of the event's primary code, else the label of its class.
 *
 * An event coded in a standard needs no typed label, and keeping it blank keeps free text out of what is saved. A
 * module names the codes of the standards it knows by registering a namer here; the viewer core knows none of them.
 * The primary code is that of the first registered standard the event carries a code in. It is a display convention
 * and ranks nothing: what the codes mean does not depend on it.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

/** Readable name of a code's value, or `null` when the value cannot be named. */
export type CodeNamer = (value: number | string) => string | null

/** An annotation event, as far as naming needs it. */
export type NamedEvent = {
    class: string
    codes?: Record<string, number | string>
    label: string
}

/** The annotation classes of a module's settings, as far as naming needs them. */
export type NamedEventClasses = Record<string, { label: string, name: string }>

/** Namers by standard, in registration order. */
const _namers = new Map<string, CodeNamer>()

/**
 * The name of `event`'s primary code, or the empty string when it carries none a namer can name.
 * @param event - The event.
 */
export function codedEventName (event: Pick<NamedEvent, 'codes'>) {
    const primary = primaryEventCode(event)
    return primary ? (_namers.get(primary.standard)?.(primary.value) ?? '') : ''
}

/**
 * The name `event` is shown by: its label, unless blank, else the name of its primary code, else the label of its
 * class. The empty string when it has none of them, for the caller to fill in.
 * @param event - The event.
 * @param classes - The annotation classes of the module showing the event.
 * @param translate - Translates a class label, which is an interface string; a typed label and a code's name are not.
 */
export function eventDisplayName (
    event: NamedEvent,
    classes: NamedEventClasses = {},
    translate: (label: string) => string = label => label,
) {
    // A label of nothing but whitespace would show as a blank, so it is read as no label.
    if (event.label.trim()) {
        return event.label
    }
    const coded = codedEventName(event)
    if (coded) {
        return coded
    }
    for (const [key, eventClass] of Object.entries(classes)) {
        if (key === event.class || eventClass.name === event.class) {
            return translate(eventClass.label)
        }
    }
    return ''
}

/**
 * The code an event is named by: the code of the first registered standard the event carries a non-empty code in, or
 * `null` when it carries none.
 * @param event - The event.
 */
export function primaryEventCode (event: Pick<NamedEvent, 'codes'>) {
    // An event created from a class template may carry its codes as an empty array.
    if (!event.codes || Array.isArray(event.codes)) {
        return null
    }
    for (const standard of _namers.keys()) {
        const value = event.codes[standard]
        if (value !== undefined && value !== '') {
            return { standard, value }
        }
    }
    return null
}

/**
 * Name the codes of `standard` with `namer`. A standard registered again keeps its place in the order.
 * @param standard - The standard, by the identifier its codes are stored under (`hed`).
 * @param namer - Returns the readable name of a code's value.
 */
export function registerCodeNamer (standard: string, namer: CodeNamer) {
    _namers.set(standard, namer)
}

/**
 * Forget every registered namer. For tests.
 */
export function resetCodeNamers () {
    _namers.clear()
}
