/**
 * Composable for the annotation editing overlay lifecycle shared across all
 * biosignal viewers: opening the editor for an existing event, saving edits,
 * closing the editor, and notifying listeners when events have been updated.
 *
 * All property-change dispatches are tagged `{ source: 'user' }` so that
 * auto-save hooks correctly identify them as user-initiated changes.
 */

import type { Ref } from 'vue'
import type {
    BiosignalAnnotationEvent,
    BiosignalResource,
} from '@epicurrents/core/dist/types'

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
        }
        editingEvents.value.splice(0)
    }

    function saveEventEdits (props: { class: string, label: string }) {
        let anyChanged = false
        for (const event of editingEvents.value) {
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
