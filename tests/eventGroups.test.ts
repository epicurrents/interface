/**
 * Groups of annotation events: which group a code puts an event in, and which events are marked together with what
 * the reader points at.
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
    eventGroup,
    eventGroupFocus,
    eventGroupKey,
    focusedEventIds,
    registerCodeGrouper,
    resetCodeGroupers,
} from '#app/views/biosignal/eventGroups'
import { findingGroupOf } from '#app/modules/eeg/findingProperties'

const event = (id: string, hed?: string, isActive = false) => ({
    codes: hed === undefined ? {} : { hed },
    id,
    isActive,
})

const EVENTS = [
    event('a', '(Spike, ID/104)'),
    event('b', '(Spike, ID/104)'),
    event('c', '(Sharp-wave, ID/105)'),
    event('d', 'Spike'),
    event('e'),
]

afterEach(() => {
    resetCodeGroupers()
})

describe('event groups', () => {
    it('are read by the registered standards only', () => {
        expect(eventGroup(EVENTS[0])).toBeNull()
        registerCodeGrouper('hed', findingGroupOf)
        expect(eventGroup(EVENTS[0])).toEqual({ number: 104, standard: 'hed' })
        expect(eventGroupKey(EVENTS[0])).toBe('hed/104')
        expect(eventGroupKey(EVENTS[3])).toBeNull()
        expect(eventGroupKey({ codes: [] as unknown as Record<string, string> })).toBeNull()
    })

    it('mark the hovered group', () => {
        registerCodeGrouper('hed', findingGroupOf)
        eventGroupFocus.hovered = 'hed/104'
        expect(focusedEventIds(EVENTS)).toEqual(new Set(['a', 'b']))
    })

    it('mark the selected event with the rest of its group, or alone', () => {
        registerCodeGrouper('hed', findingGroupOf)
        const events = [...EVENTS.slice(0, 2), event('c', '(Sharp-wave, ID/105)', true), ...EVENTS.slice(3)]
        eventGroupFocus.active = 'c'
        expect(focusedEventIds(events)).toEqual(new Set(['c']))
        const selected = [event('a', '(Spike, ID/104)', true), ...EVENTS.slice(1)]
        eventGroupFocus.active = 'a'
        expect(focusedEventIds(selected)).toEqual(new Set(['a', 'b']))
    })

    it('follow the selection only while the event is still active', () => {
        registerCodeGrouper('hed', findingGroupOf)
        eventGroupFocus.active = 'a'
        expect(focusedEventIds(EVENTS)).toEqual(new Set())
    })
})
