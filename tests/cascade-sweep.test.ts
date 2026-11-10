/**
 * Tests for the EMG cascade sweep geometry: what each trace set draws for a playback position, and how a range of
 * stack time is cut into row spans.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { describe, expect, it } from 'vitest'
import { rowSpans, stackStart, sweepRange } from '../src/app/modules/emg/sweep'

/** A stack of four 0.5 s rows starting at 10 s, played to 0.7 s into it. */
const sweep = (over: Partial<Parameters<typeof sweepRange>[1]> = {}) => ({
    erase: 0,
    offset: 0.7,
    stackLength: 2,
    viewStart: 10,
    ...over,
})

describe('sweepRange', () => {
    it('draws the played part of the stack in view', () => {
        expect(sweepRange(10, sweep())).toEqual([0, 0.7])
    })

    it('draws nothing of the stack in view before playback reaches it', () => {
        expect(sweepRange(10, sweep({ offset: 0 }))).toBeNull()
    })

    it('hides the previous stack when clearing', () => {
        expect(sweepRange(8, sweep())).toBeNull()
    })

    it('draws the previous stack beyond the blank when drawing over it', () => {
        expect(sweepRange(8, sweep({ erase: 0.05 }))).toEqual([0.75, 2])
    })

    it('draws nothing of the previous stack once the blank reaches the stack end', () => {
        expect(sweepRange(8, sweep({ erase: 0.05, offset: 1.96 }))).toBeNull()
    })

    it('hides a set holding any other stack, or none', () => {
        // After a page turn the set filled for the view before last still holds its stack until it is refilled.
        expect(sweepRange(6, sweep({ erase: 0.05 }))).toBeNull()
        expect(sweepRange(NaN, sweep({ erase: 0.05 }))).toBeNull()
    })

    it('treats a set still holding the stack just turned from as the previous one', () => {
        // The frames between a page turn and the new read: the set filled for the view at 8 is now the previous stack.
        const range = sweepRange(8, sweep({ erase: 0.05, offset: 0.01 }))!
        expect(range[0]).toBeCloseTo(0.06, 10)
        expect(range[1]).toBe(2)
    })
})

describe('rowSpans', () => {
    it('fills the rows before the write position and cuts the row it is in', () => {
        // 100 points per second, so a 0.5 s row has 50.
        expect(rowSpans([0, 0.7], 4, 0.5, 100)).toEqual([[0, 50], [0, 20], [0, 0], [0, 0]])
    })

    it('starts a range mid-row and runs it to the stack end', () => {
        expect(rowSpans([0.75, 2], 4, 0.5, 100)).toEqual([[0, 0], [25, 50], [0, 50], [0, 50]])
    })

    it('gives every row an empty span for no range', () => {
        expect(rowSpans(null, 3, 0.5, 100)).toEqual([[0, 0], [0, 0], [0, 0]])
    })

    it('leaves a gap between the two sets exactly as wide as the blank', () => {
        const played = rowSpans([0, 0.7], 4, 0.5, 100)
        const previous = rowSpans([0.75, 2], 4, 0.5, 100)
        // Row 1 holds the write position: new signal to point 20, old signal from point 25.
        expect(played[1][1]).toBe(20)
        expect(previous[1][0]).toBe(25)
    })
})

describe('stackStart', () => {
    it('keeps a time on the grid in its own stack', () => {
        // `0.9 % 0.3` is just short of 0.3, which put 0.9 a whole stack back at 0.6.
        expect(stackStart(0.9, 0.3)).toBeCloseTo(0.9, 9)
        expect(stackStart(19.8, 0.3)).toBeCloseTo(19.8, 9)
    })

    it('floors a time inside a stack to its start', () => {
        expect(stackStart(1.05, 0.3)).toBeCloseTo(0.9, 9)
        expect(stackStart(2.999, 1)).toBe(2)
    })

    it('leaves the time as it is for a step that is not positive', () => {
        expect(stackStart(1.7, 0)).toBe(1.7)
        expect(stackStart(1.7, NaN)).toBe(1.7)
    })
})
