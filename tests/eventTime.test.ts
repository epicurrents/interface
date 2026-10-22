/**
 * The time an annotation is listed at: elapsed from the start, or by the recording's clock.
 */

import { describe, expect, it } from 'vitest'
import { eventTimeLabel, eventTimeTitle, eventTimeWidth, type TimedRecording } from '#app/views/biosignal/eventTime'

/** A recording starting at `start` (local time), lasting `duration` seconds, with the core's clock arithmetic. */
const recording = (start: Date | null, duration: number): TimedRecording => ({
    startTime: start,
    totalDuration: duration,
    getAbsoluteTimeAt: (time: number) => {
        const at = new Date((start?.getTime() ?? 0) + time*1000)
        const day = start
            ? Math.round(
                (new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()
                 - new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime())/86400000
            ) + 1
            : 1
        return { date: at, day, hour: at.getHours(), minute: at.getMinutes(), second: at.getSeconds() }
    },
}) as TimedRecording

describe('event time', () => {
    const start = new Date(2026, 9, 18, 14, 37, 20)

    it('lists a short recording by elapsed time as minutes and seconds', () => {
        expect(eventTimeLabel(recording(start, 1200), 30, true)).toEqual({ main: '00:30' })
    })

    it('lists the clock time with its hour, however short the recording', () => {
        // The minutes and seconds of the clock alone read as neither the clock nor the elapsed time.
        expect(eventTimeLabel(recording(start, 1200), 30, false)).toEqual({ main: '14:37', secs: '50' })
    })

    it('lists elapsed hours, and elapsed days for a recording of more than a day', () => {
        expect(eventTimeLabel(recording(start, 7200), 3725, true)).toEqual({ main: '01:02', secs: '05' })
        expect(eventTimeLabel(recording(start, 2*86400), 90000, true))
            .toEqual({ days: '1', main: '01:00', secs: '00' })
    })

    it('lists the calendar day of a clock time when the recording crosses midnight', () => {
        const evening = new Date(2026, 9, 18, 23, 0, 0)
        expect(eventTimeLabel(recording(evening, 7200), 4000, false)).toEqual({ days: '2', main: '00:06', secs: '40' })
        expect(eventTimeLabel(recording(evening, 7200), 60, false)).toEqual({ days: '1', main: '23:01', secs: '00' })
    })

    it('falls back to elapsed time when the recording has no clock', () => {
        expect(eventTimeLabel(recording(null, 1200), 30, false)).toEqual({ main: '00:30' })
        expect(eventTimeTitle(recording(null, 1200), 30, true)).toBe('')
    })

    it('titles a label with the other time base', () => {
        expect(eventTimeTitle(recording(start, 1200), 30, true)).toBe('14:37:50')
        expect(eventTimeTitle(recording(start, 1200), 30, false)).toBe('00:30')
    })

    it('sizes the column for the longest label', () => {
        expect(eventTimeWidth(recording(start, 1200), true)).toBe('3.5rem')
        expect(eventTimeWidth(recording(start, 1200), false)).toBe('4.5rem')
        expect(eventTimeWidth(recording(start, 2*86400), true)).toBe('5.25rem')
    })
})
