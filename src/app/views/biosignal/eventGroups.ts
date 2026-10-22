/**
 * Groups of annotation events: the events of one finding seen in several places or many times, which carry the same
 * group in a code. Which code holds the group is a standard's business, so a module registers a reader for the
 * standards it knows, as it registers a namer in `eventNames`; the viewer core knows none of them.
 *
 * What the reader points at is shared state, so every view of the events can mark a group's members together: the
 * group of the event hovered in a list or on the plot, and the event selected on the plot. Whatever sets or clears an
 * event's `isActive` updates `eventGroupFocus.active` with it.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { reactive } from 'vue'
import type { NamedEvent } from '#app/views/biosignal/eventNames'

/** The group a code's value puts its event in, or `null` for none. */
export type CodeGrouper = (value: number | string) => number | null

/** An event as far as grouping needs it. */
export type GroupedEvent = Pick<NamedEvent, 'codes'> & { id: string, isActive?: boolean }

/** Readers by standard, in registration order. */
const _groupers = new Map<string, CodeGrouper>()

/**
 * What the reader points at. `hovered` is the key of the group under the pointer, in a list or on the plot; `active`
 * is the id of the event selected on the plot, kept in step with its `isActive` so a view that does not watch every
 * event can react to a selection.
 */
export const eventGroupFocus = reactive({
    active: null as string | null,
    hovered: null as string | null,
})

/**
 * The group `event` is in, by the first registered standard whose code puts it in one, or `null`.
 * @param event - The event.
 */
export function eventGroup (event: Pick<NamedEvent, 'codes'>) {
    // An event created from a class template may carry its codes as an empty array.
    if (!event.codes || Array.isArray(event.codes)) {
        return null
    }
    for (const [standard, grouper] of _groupers) {
        const value = event.codes[standard]
        const number = value === undefined ? null : grouper(value)
        if (number !== null) {
            return { number, standard }
        }
    }
    return null
}

/**
 * A key naming `event`'s group uniquely across standards, or `null` when it is in none.
 * @param event - The event.
 */
export function eventGroupKey (event: Pick<NamedEvent, 'codes'>) {
    const group = eventGroup(event)
    return group ? `${group.standard}/${group.number}` : null
}

/**
 * The events marked as one with what the reader points at: the members of the hovered group, and the selected event
 * with the members of its group. An ungrouped selected event is marked alone.
 * @param events - Every event of the recording.
 */
export function focusedEventIds (events: GroupedEvent[]) {
    const ids = new Set<string>()
    // The selection is the event's own `isActive`; the focus names it so that a view computing this follows it.
    const active = eventGroupFocus.active
        ? events.find(event => event.id === eventGroupFocus.active && event.isActive)
        : undefined
    const keys = new Set(
        [eventGroupFocus.hovered, active ? eventGroupKey(active) : null].filter(key => key)
    )
    if (active) {
        ids.add(active.id)
    }
    if (keys.size) {
        for (const event of events) {
            const key = eventGroupKey(event)
            if (key && keys.has(key)) {
                ids.add(event.id)
            }
        }
    }
    return ids
}

/**
 * Read the groups of `standard`'s codes with `grouper`. A standard registered again keeps its place in the order.
 * @param standard - The standard, by the identifier its codes are stored under (`hed`).
 * @param grouper - Returns the group a code's value puts its event in.
 */
export function registerCodeGrouper (standard: string, grouper: CodeGrouper) {
    _groupers.set(standard, grouper)
}

/**
 * Forget every registered reader and what the reader points at. For tests.
 */
export function resetCodeGroupers () {
    _groupers.clear()
    eventGroupFocus.active = null
    eventGroupFocus.hovered = null
}
