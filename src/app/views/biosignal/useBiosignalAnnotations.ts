/**
 * Composable for user-initiated annotation mutations on a biosignal resource.
 *
 * All methods that call into the resource tag changes with `{ source: 'user' }`
 * so that downstream listeners (e.g. auto-save hooks) can distinguish user
 * edits from system-originated mutations such as EDF annotation loading.
 *
 * Also manages the per-component undo/redo stacks and the corresponding
 * store flags (`has-undoable-action`, `has-redoable-action`).
 */

import { computed, ref } from 'vue'
import { useStore } from 'vuex'
import type {
    AnnotationLabel,
    BiosignalAnnotationEvent,
    BiosignalResource,
} from '@epicurrents/core/dist/types'
import type { UndoOrRedoAction } from '#types/interface'

export function useBiosignalAnnotations (resource: BiosignalResource) {
    const store = useStore()

    const undoableActions = ref([] as UndoOrRedoAction[])
    const redoableActions = ref([] as UndoOrRedoAction[])

    const undoableRemoveEvents = computed(() =>
        undoableActions.value.filter(a => a.action === 'remove-events')
    )
    const undoableRemoveLabels = computed(() =>
        undoableActions.value.filter(a => a.action === 'remove-labels')
    )

    function addRedoAction (action: string, ...args: unknown[]) {
        redoableActions.value.push({ action, args: Array.isArray(args) ? args : [args] })
        if (!store.state.APP.hasRedoableAction) {
            store.commit('set-redoable-action', true)
        }
    }

    function addUndoAction (action: string, isOriginal: boolean, ...args: unknown[]) {
        undoableActions.value.push({ action, args: Array.isArray(args) ? args : [args] })
        if (isOriginal && redoableActions.value.length) {
            redoableActions.value.splice(0)
            store.commit('set-redoable-action', false)
        }
        if (!store.state.APP.hasUndoableAction) {
            store.commit('set-undoable-action', true)
        }
    }

    function addUserEvents (...events: BiosignalAnnotationEvent[]) {
        resource.addEvents({ source: 'user' }, ...events)
    }

    function removeUserEvents (...events: string[] | number[] | BiosignalAnnotationEvent[]) {
        const removed = resource.removeEvents({ source: 'user' }, ...(events as BiosignalAnnotationEvent[]))
        if (removed.length) {
            addUndoAction('remove-events', true, ...removed)
        }
        return removed
    }

    function addUserLabels (...labels: AnnotationLabel[]) {
        resource.addLabels({ source: 'user' }, ...labels)
    }

    function removeUserLabels (...labels: string[] | number[] | AnnotationLabel[]) {
        const removed = resource.removeLabels({ source: 'user' }, ...(labels as AnnotationLabel[]))
        if (removed.length) {
            addUndoAction('remove-labels', true, ...removed)
        }
        return removed
    }

    function undoAction () {
        const lastAction = undoableActions.value.pop()
        if (lastAction) {
            const args = lastAction.args as unknown[]
            switch (lastAction.action) {
                case 'add-events':
                case 'add-annotations': {
                    const addedEvents = args as BiosignalAnnotationEvent[]
                    const deletedEvents = resource.removeEvents({ source: 'user' }, ...addedEvents)
                    addRedoAction(lastAction.action, ...deletedEvents)
                    break
                }
                case 'add-labels': {
                    const addedLabels = args as BiosignalAnnotationEvent[]
                    const deletedLabels = resource.removeEvents({ source: 'user' }, ...addedLabels)
                    addRedoAction(lastAction.action, ...deletedLabels)
                    break
                }
                case 'remove-events': {
                    const delEvents = args as BiosignalAnnotationEvent[]
                    resource.addEvents({ source: 'user' }, ...delEvents)
                    addRedoAction(lastAction.action, ...delEvents)
                    break
                }
                case 'remove-labels': {
                    const delLabels = args as BiosignalAnnotationEvent[]
                    resource.addEvents({ source: 'user' }, ...delLabels)
                    addRedoAction(lastAction.action, ...delLabels)
                    break
                }
            }
            if (!undoableActions.value.length) {
                store.commit('set-undoable-action', false)
            }
        }
    }

    function redoAction () {
        const lastAction = redoableActions.value.pop()
        if (lastAction) {
            const args = lastAction.args as unknown[]
            switch (lastAction.action) {
                case 'add-events':
                case 'add-annotations': {
                    const events = args as BiosignalAnnotationEvent[]
                    resource.addEvents({ source: 'user' }, ...events)
                    addUndoAction(lastAction.action, false, ...events)
                    break
                }
                case 'remove-events': {
                    const delEvents = args as BiosignalAnnotationEvent[]
                    resource.removeEvents({ source: 'user' }, ...delEvents)
                    addUndoAction(lastAction.action, false, ...delEvents)
                    break
                }
            }
            if (!redoableActions.value.length) {
                store.commit('set-redoable-action', false)
            }
        }
    }

    function undoRemoveEvents () {
        for (let i = undoableActions.value.length - 1; i >= 0; i--) {
            const undo = undoableActions.value[i]
            if (undo.action === 'remove-events') {
                const removed = undoableActions.value.splice(i, 1)[0]
                const args = removed.args as BiosignalAnnotationEvent[]
                resource.addEvents({ source: 'user' }, ...args)
                addRedoAction(removed.action, ...args)
                return
            }
        }
    }

    function undoRemoveLabels () {
        for (let i = undoableActions.value.length - 1; i >= 0; i--) {
            const undo = undoableActions.value[i]
            if (undo.action === 'remove-labels') {
                const removed = undoableActions.value.splice(i, 1)[0]
                const args = removed.args as AnnotationLabel[]
                resource.addLabels({ source: 'user' }, ...args)
                addRedoAction(removed.action, ...args)
                return
            }
        }
    }

    return {
        undoableActions,
        redoableActions,
        undoableRemoveEvents,
        undoableRemoveLabels,
        addUndoAction,
        addRedoAction,
        addUserEvents,
        removeUserEvents,
        addUserLabels,
        removeUserLabels,
        undoAction,
        redoAction,
        undoRemoveEvents,
        undoRemoveLabels,
    }
}
