/**
 * Composable for the annotation editing overlay lifecycle shared across all
 * biosignal viewers: opening the editor for an existing event, saving edits,
 * closing the editor, and notifying listeners when events have been updated.
 *
 * All property-change dispatches are tagged `{ source: 'user' }` so that
 * auto-save hooks correctly identify them as user-initiated changes.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { Ref } from 'vue'
import { eventGroupFocus } from '#app/views/biosignal/eventGroups'
import type {
    BiosignalAnnotationEvent,
    BiosignalResource,
} from '@epicurrents/core/types'

/**
 * The codes of an event as a record. An event created from a class template may carry an empty array, which holds none.
 */
function codesOf (event: BiosignalAnnotationEvent): Record<string, number | string> {
    return Array.isArray(event.codes) ? {} : event.codes
}

/**
 * Whether `a` and `b` hold the same codes.
 */
function sameCodes (a: Record<string, number | string>, b: Record<string, number | string>) {
    const entries = Object.entries(a)
    return entries.length === Object.keys(b).length && entries.every(([standard, value]) => b[standard] === value)
}

export function useBiosignalAnnotationEditor (
    resource: BiosignalResource,
    editingEvents: Ref<BiosignalAnnotationEvent[]>,
    editingEventsMode: Ref<string>,
) {

    function editEvent (annotation: BiosignalAnnotationEvent) {
        editingEvents.value.push(annotation)
        editingEventsMode.value = 'edit'
    }

    function exitEventEditor () {
        for (const anno of editingEvents.value) {
            anno.isActive = false
            if (eventGroupFocus.active === anno.id) {
                eventGroupFocus.active = null
            }
        }
        editingEvents.value.splice(0)
    }

    function saveEventEdits (props: { class: string, codes?: Record<string, number | string>, label: string }) {
        let anyChanged = false
        // The editor shows the first event's codes, so only the standards changed from those are applied, and each
        // event keeps the codes of every other standard it carries.
        const edited = props.codes ?? {}
        const shown = editingEvents.value.length ? codesOf(editingEvents.value[0]) : {}
        const changed = props.codes
            ? [...new Set([...Object.keys(shown), ...Object.keys(edited)])].filter(std => shown[std] !== edited[std])
            : []
        for (const event of editingEvents.value) {
            if (changed.length) {
                const codes = { ...codesOf(event) }
                for (const standard of changed) {
                    if (edited[standard] === undefined) {
                        delete codes[standard]
                    } else {
                        codes[standard] = edited[standard]
                    }
                }
                if (!sameCodes(codesOf(event), codes)) {
                    event.codes = codes
                    anyChanged = true
                }
            }
            if (event.class !== props.class) {
                event.class = props.class as typeof event['class']
                anyChanged = true
            }
            if (event.label !== props.label) {
                event.label = props.label
                anyChanged = true
            }
        }
        if (anyChanged) {
            resource.dispatchPropertyChangeEvent('events', undefined, undefined, 'after', { source: 'user' })
        }
        exitEventEditor()
    }

    function handleEventsUpdated () {
        resource.dispatchPropertyChangeEvent('events', undefined, undefined, 'after', { source: 'user' })
    }

    return { editEvent, exitEventEditor, saveEventEdits, handleEventsUpdated }
}
