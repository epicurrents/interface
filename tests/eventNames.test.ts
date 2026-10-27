/**
 * The name an annotation event is shown by: a typed label, else the name of its primary code, else its class label.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { EegEvent } from '@epicurrents/eeg-module'
import type { AnnotationEventTemplate } from '@epicurrents/core/types'
import {
    codedEventDescription,
    codedEventName,
    eventDisplayName,
    primaryEventCode,
    registerCodeNamer,
    resetCodeNamers,
} from '#app/views/biosignal/eventNames'
import { hedFindingName } from '#app/modules/eeg/findings'
import { hedTagLabels } from '#app/modules/eeg/findingProperties'

const CLASSES = {
    default: { label: 'Event', name: 'event' },
    technical: { label: 'Technical', name: 'technical' },
}

afterEach(() => {
    resetCodeNamers()
})

describe('event display name', () => {
    it('prefers a typed label, then the primary code, then the class', () => {
        registerCodeNamer('hed', hedFindingName)
        const coded = { class: 'technical', codes: { hed: 'Eye-blink-artifact' }, label: '' }
        expect(eventDisplayName(coded, CLASSES)).toBe('Eye blink artifact')
        expect(eventDisplayName({ ...coded, label: 'Blinks' }, CLASSES)).toBe('Blinks')
        expect(eventDisplayName({ ...coded, label: '  ' }, CLASSES)).toBe('Eye blink artifact')
        expect(eventDisplayName({ ...coded, codes: {} }, CLASSES)).toBe('Technical')
        expect(eventDisplayName({ class: 'event', label: '' }, CLASSES)).toBe('Event')
        expect(eventDisplayName({ class: 'unknown', label: '' }, CLASSES)).toBe('')
    })

    it('translates the class label only', () => {
        registerCodeNamer('hed', hedFindingName)
        const translate = (label: string) => `[${label}]`
        expect(eventDisplayName({ class: 'technical', label: '' }, CLASSES, translate)).toBe('[Technical]')
        expect(eventDisplayName({ class: 'technical', label: 'Typed' }, CLASSES, translate)).toBe('Typed')
        expect(eventDisplayName({ class: 'technical', codes: { hed: 'Spike' }, label: '' }, CLASSES, translate))
            .toBe('Spike')
    })

    it('names a code only of a registered standard', () => {
        const event = { class: 'event', codes: { hed: 'Spike' }, label: '' }
        expect(codedEventName(event)).toBe('')
        expect(eventDisplayName(event, CLASSES)).toBe('Event')
    })
})

describe('primary code', () => {
    it('is the code of the first registered standard the event carries', () => {
        registerCodeNamer('first', String)
        registerCodeNamer('second', String)
        expect(primaryEventCode({ codes: { second: 'b', first: 'a' } })).toEqual({ standard: 'first', value: 'a' })
        expect(primaryEventCode({ codes: { second: 'b', first: '' } })).toEqual({ standard: 'second', value: 'b' })
        expect(primaryEventCode({ codes: { other: 'c' } })).toBeNull()
        expect(primaryEventCode({ codes: [] as unknown as Record<string, string> })).toBeNull()
        expect(primaryEventCode({})).toBeNull()
    })
})

describe('HED finding name', () => {
    it('names a string by its first tag, keeping a value', () => {
        expect(hedFindingName('Spike-and-slow-wave')).toBe('Spike and slow wave')
        expect(hedFindingName('Line-noise-artifact/50 Hz')).toBe('Line noise artifact 50 Hz')
        expect(hedFindingName('(Spike-and-slow-wave, Sensor-list/F7;T7)')).toBe('Spike and slow wave')
        expect(hedFindingName('()')).toBeNull()
    })
})

describe('a new event', () => {
    it('keeps an empty label when the template has no value', () => {
        const event = EegEvent.fromTemplate({
            class: 'event',
            duration: 1,
            label: '',
            priority: 1,
            start: 2,
            value: null,
        } as AnnotationEventTemplate)
        expect(event.label).toBe('')
        expect(event.start).toBe(2)
        expect(event.duration).toBe(1)
    })
})

describe('coded event description', () => {
    it('lists what the primary code says through its describer', () => {
        registerCodeNamer('hed', hedFindingName, hedTagLabels)
        const coded = { codes: { hed: '(Eye-blink-artifact, ID/100, Left)' } }
        expect(codedEventDescription(coded)).toEqual(['Eye blink artifact', 'Left'])
        expect(codedEventDescription({ codes: {} })).toEqual([])
    })

    it('lists nothing for a standard registered without a describer', () => {
        registerCodeNamer('hed', hedFindingName, hedTagLabels)
        registerCodeNamer('hed', hedFindingName)
        expect(codedEventDescription({ codes: { hed: 'Eye-blink-artifact' } })).toEqual([])
    })
})
