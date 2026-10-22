/**
 * The time an annotation is listed at: from the start of the recording, or by the recording's clock.
 *
 * A clock time always carries its hour, since minutes and seconds of a clock are no position in the recording, and an
 * elapsed time carries an hour only when the recording runs for one. A day is shown when the recording spans more
 * than one: by elapsed days from the start, or by the calendar day of the recording, counted from one.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { BiosignalResource } from '@epicurrents/core/types'

/** A listed time in parts, so the day and the seconds can be styled apart. */
export type EventTimeLabel = {
    days?: string
    main: string
    secs?: string
}

/** What a time label needs of a recording. */
export type TimedRecording = Pick<BiosignalResource, 'getAbsoluteTimeAt' | 'startTime' | 'totalDuration'>

const DAY = 86400
const HOUR = 3600

const pad = (value: number) => value.toString().padStart(2, '0')

/**
 * Whether a recording's times are listed by its clock: when the reader has not asked for elapsed time and the
 * recording knows when it started.
 * @param recording - The recording.
 * @param relative - The reader's choice of elapsed time.
 */
export function listsClockTime (recording: TimedRecording, relative: boolean) {
    return !relative && !!recording.startTime
}

/**
 * The label of an annotation starting at `time`.
 * @param recording - The recording the annotation is in.
 * @param time - Start of the annotation, in seconds from the recording start.
 * @param relative - List the time elapsed from the start rather than the recording's clock time.
 */
export function eventTimeLabel (recording: TimedRecording, time: number, relative: boolean): EventTimeLabel {
    if (listsClockTime(recording, relative)) {
        const clock = recording.getAbsoluteTimeAt(time)
        const lastDay = recording.getAbsoluteTimeAt(recording.totalDuration).day
        const spansDays = recording.getAbsoluteTimeAt(0).day !== lastDay
        return {
            days: spansDays ? clock.day.toString() : undefined,
            main: `${pad(clock.hour)}:${pad(clock.minute)}`,
            secs: pad(clock.second),
        }
    }
    const whole = Math.floor(time)
    const parts = {
        days: Math.floor(whole/DAY),
        hours: Math.floor((whole%DAY)/HOUR),
        minutes: Math.floor((whole%HOUR)/60),
        seconds: whole%60,
    }
    if (recording.totalDuration >= DAY) {
        return {
            days: parts.days.toString(),
            main: `${pad(parts.hours)}:${pad(parts.minutes)}`,
            secs: pad(parts.seconds),
        }
    }
    if (recording.totalDuration >= HOUR) {
        return { main: `${pad(parts.hours)}:${pad(parts.minutes)}`, secs: pad(parts.seconds) }
    }
    return { main: `${pad(parts.minutes)}:${pad(parts.seconds)}` }
}

/**
 * The same time in the other time base, as one string, for a tooltip; empty when the recording has no clock.
 * @param recording - The recording the annotation is in.
 * @param time - Start of the annotation, in seconds from the recording start.
 * @param relative - The time base the label is listed in.
 */
export function eventTimeTitle (recording: TimedRecording, time: number, relative: boolean) {
    if (!recording.startTime) {
        return ''
    }
    const other = eventTimeLabel(recording, time, !relative)
    return `${other.days !== undefined ? `${other.days}d ` : ''}${other.main}${other.secs ? `:${other.secs}` : ''}`
}

/**
 * The width the time column needs for every label of a recording.
 * @param recording - The recording.
 * @param relative - The time base the labels are listed in.
 */
export function eventTimeWidth (recording: TimedRecording, relative: boolean) {
    const label = eventTimeLabel(recording, recording.totalDuration, relative)
    if (label.days !== undefined) {
        return '5.25rem'
    }
    return label.secs !== undefined ? '4.5rem' : '3.5rem'
}
