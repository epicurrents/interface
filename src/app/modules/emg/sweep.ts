/**
 * Geometry of the EMG cascade sweep: which part of a stack of rows a trace set draws for a playback position.
 *
 * Times here are linear stack time, seconds from the first sample of the stack's top row, so row `i` covers
 * `[i*rowLength, (i + 1)*rowLength)`.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

/** Where the sweep stands: the stack in view and the playback position's offset into it. */
export type CascadeSweep = {
    /** Blank drawn ahead of the new signal over the previous stack, in seconds; zero draws no previous stack. */
    erase: number
    /** Playback position minus the view start, in seconds. */
    offset: number
    /** Length of the whole stack in seconds. */
    stackLength: number
    /** Recording time of the stack in view. */
    viewStart: number
}

/**
 * Start of the stack, or page, holding `time` on the grid of whole steps from zero. Floored on the quotient rather than
 * taken with `%`, which on floating-point steps answers a value just short of the step for a time on the grid itself:
 * `0.9 % 0.3` is `0.29999999999999993`, and subtracting it puts the time one whole stack back.
 * @param time - Recording time in seconds.
 * @param step - Length of one stack or page in seconds; a step that is not positive leaves the time as it is.
 */
export const stackStart = (time: number, step: number) => {
    if (!(step > 0)) {
        return time
    }
    return Math.floor(time/step + 1e-9)*step
}

/**
 * The linear stack time a trace set draws during a sweep, as `[from, to)`, or null when it draws nothing. The set
 * holding the stack in view draws what has been played of it; with an erase width, the set holding the stack before it
 * draws what lies beyond the blank.
 * @param setStart - Recording time of the stack the set's data was read from, NaN for a set holding none.
 * @param sweep - Where the sweep stands.
 */
export const sweepRange = (setStart: number, sweep: CascadeSweep): [number, number] | null => {
    if (setStart === sweep.viewStart) {
        return sweep.offset > 0 ? [0, sweep.offset] : null
    }
    if (sweep.erase > 0 && setStart === sweep.viewStart - sweep.stackLength) {
        const from = sweep.offset + sweep.erase
        return from < sweep.stackLength ? [from, sweep.stackLength] : null
    }
    return null
}

/**
 * Cut linear stack time `[from, to)` into each row's draw span, as datapoint indices `[first, end)`. A row the range
 * does not reach gets `[0, 0]`.
 * @param range - Linear stack time to draw, or null for nothing.
 * @param rowCount - Number of rows.
 * @param rowLength - Length of one row in seconds.
 * @param pointsPerSec - Datapoints per second in a row's trace.
 */
export const rowSpans = (
    range: [number, number] | null,
    rowCount: number,
    rowLength: number,
    pointsPerSec: number,
): [number, number][] => {
    const spans = [] as [number, number][]
    for (let i=0; i<rowCount; i++) {
        if (!range) {
            spans.push([0, 0])
            continue
        }
        const rowStart = i*rowLength
        const first = Math.max(range[0], rowStart) - rowStart
        const end = Math.min(range[1], rowStart + rowLength) - rowStart
        spans.push(end > first ? [Math.round(first*pointsPerSec), Math.round(end*pointsPerSec)] : [0, 0])
    }
    return spans
}
