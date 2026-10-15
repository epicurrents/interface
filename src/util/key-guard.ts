/**
 * Keyboard ownership: which key events belong to the control they were typed into rather than to the application's
 * hotkeys.
 *
 * The application and its modules listen for hotkeys on `window`. A key typed into a field, or pressed in an open
 * dialog or menu, belongs to that control, and reaching a hotkey listener as well makes it act twice: an arrow key
 * moves the caret and pages the signal. `installKeyGuard` stops such events at the document, after every element on
 * their path has handled them and before any `window` listener sees them, so no control has to stop them itself and
 * no listener has to check where they came from. A listener registered in the capture phase on `window` runs before
 * the guard, and checks `keyEventOwnedByControl` itself.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

/**
 * The attribute marking an element whose key events are its own wherever they come from inside it, for a composite
 * control that holds buttons or tabs the rules below do not cover.
 */
export const OWNS_KEYS_ATTRIBUTE = 'data-owns-keys'

/** Native input types that take no typing, so their key events are left to the hotkeys. */
const NON_TEXT_INPUT_TYPES = new Set([
    'button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit',
])

/** WebAwesome controls that take typing, owning their key events whenever focused. */
const TEXT_CONTROL_TAGS = new Set(['WA-COMBOBOX', 'WA-INPUT', 'WA-TEXTAREA'])

/**
 * WebAwesome controls that own their key events only while open. Focus stays on a select or a menu trigger after it
 * closes, and the hotkeys must keep working then.
 */
const OPEN_CONTROL_TAGS = new Set(['WA-DIALOG', 'WA-DROPDOWN', 'WA-SELECT'])

/** Event types the guard stops. */
const KEY_EVENTS = ['keydown', 'keypress', 'keyup'] as const

/**
 * Does `event` belong to a control on its path rather than to the hotkeys: a field that takes typing, a native select,
 * an open WebAwesome select, menu or dialog, or an element marked with {@link OWNS_KEYS_ATTRIBUTE}. Escape never does,
 * so it still closes what the application closes on Escape wherever it is pressed. The path is read through shadow
 * roots, so a field inside a WebAwesome control is found.
 * @param event - The key event.
 */
export const keyEventOwnedByControl = (event: KeyboardEvent): boolean => {
    if (event.key === 'Escape') {
        return false
    }
    for (const node of event.composedPath()) {
        if (!(node instanceof Element)) {
            continue
        }
        if (node.hasAttribute(OWNS_KEYS_ATTRIBUTE) || (node as HTMLElement).isContentEditable) {
            return true
        }
        if (node.tagName === 'INPUT') {
            const input = node as HTMLInputElement
            if (!input.readOnly && !NON_TEXT_INPUT_TYPES.has(input.type)) {
                return true
            }
        } else if (node.tagName === 'TEXTAREA') {
            if (!(node as HTMLTextAreaElement).readOnly) {
                return true
            }
        } else if (node.tagName === 'SELECT' || TEXT_CONTROL_TAGS.has(node.tagName)) {
            return true
        } else if (OPEN_CONTROL_TAGS.has(node.tagName) && (node as Element & { open?: boolean }).open) {
            return true
        }
    }
    return false
}

/**
 * Stop the key events a control owns from reaching any `window` listener. Returns the function that removes the guard.
 * @param target - The node to guard at; the document unless a test supplies its own.
 */
export const installKeyGuard = (target: Document | HTMLElement = document): (() => void) => {
    const guard = (event: Event) => {
        if (keyEventOwnedByControl(event as KeyboardEvent)) {
            event.stopPropagation()
        }
    }
    for (const type of KEY_EVENTS) {
        target.addEventListener(type, guard)
    }
    return () => {
        for (const type of KEY_EVENTS) {
            target.removeEventListener(type, guard)
        }
    }
}
