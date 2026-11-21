/**
 * Tests for stepping a plot's sensitivity from the keyboard. The offered values are in the setting's display unit and
 * the resource's sensitivity in the signal's base unit, so a step reads and writes through the setting's scale.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { describe, expect, it } from 'vitest'
import { steppedSensitivity } from '#util'

const uVperCm = { availableValues: [10, 20, 50, 100, 200], scale: 1e-6 }

describe('stepping the sensitivity', () => {
    it('steps to the neighbouring offered value in the base unit', () => {
        expect(steppedSensitivity(uVperCm, 100e-6, -1)).toBeCloseTo(50e-6, 12)
        expect(steppedSensitivity(uVperCm, 100e-6, 1)).toBeCloseTo(200e-6, 12)
    })

    it('matches a value that has been through the scale to the offered value it came from', () => {
        // 70 * 1e-6 is not exactly 7e-5 in floating point.
        const offered = { availableValues: [50, 70, 100], scale: 1e-6 }
        expect(steppedSensitivity(offered, 70 * 1e-6, 1)).toBeCloseTo(100e-6, 12)
        expect(steppedSensitivity(offered, 70 * 1e-6, -1)).toBeCloseTo(50e-6, 12)
    })

    it('steps from a value that is not offered to the nearest offered one that way', () => {
        expect(steppedSensitivity(uVperCm, 75e-6, -1)).toBeCloseTo(50e-6, 12)
        expect(steppedSensitivity(uVperCm, 75e-6, 1)).toBeCloseTo(100e-6, 12)
    })

    it('stays put at either end of the offered values', () => {
        expect(steppedSensitivity(uVperCm, 10e-6, -1)).toBeNull()
        expect(steppedSensitivity(uVperCm, 200e-6, 1)).toBeNull()
    })

    it('takes a scale of one when the setting has none', () => {
        expect(steppedSensitivity({ availableValues: [1, 2, 5] }, 2, 1)).toBe(5)
    })
})
