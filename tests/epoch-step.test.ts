/**
 * Tests for the value the trend settings store for an epoch step, from what a user typed.
 */

import { describe, expect, test } from 'vitest'
import { normaliseEpochStep } from '#app/modules/eeg/trends/epochStep'

describe('normaliseEpochStep', () => {
    test('an empty field, a zero and anything unusable mean no overlap', () => {
        for (const input of ['', '   ', '0', '-1', 'abc', 0, -0.5, NaN]) {
            expect(normaliseEpochStep(input, 3)).toBe(0)
        }
    })

    test('a step shorter than the epoch is kept, whichever decimal mark it was typed with', () => {
        expect(normaliseEpochStep('0.5', 3)).toBe(0.5)
        expect(normaliseEpochStep('0,5', 3)).toBe(0.5)
        expect(normaliseEpochStep(2, 3)).toBe(2)
    })

    test('a step at or above the epoch is stored as no overlap, not as a number', () => {
        // Stored as a number it would become an overlap the moment the epoch length was raised past it.
        expect(normaliseEpochStep('3', 3)).toBe(0)
        expect(normaliseEpochStep('5', 3)).toBe(0)
    })

    test('without a known epoch length only the lower limit applies', () => {
        expect(normaliseEpochStep('5', 0)).toBe(5)
    })
})
