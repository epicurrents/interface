/**
 * Frequencies the reader has measured in the view, kept so an annotation made over the measured span can be given the
 * frequency without typing it again.
 *
 * A measurement is recorded per selection as its markers are placed. It belongs to the span it was made on and is
 * offered only for an annotation that covers that span, so a number measured elsewhere never ends up on an annotation
 * by accident. The list is short and lives in the page only.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

/** A frequency measured from markers placed on a span. */
export type FrequencyMeasurement = {
    /** Highest frequency between two adjacent markers, in Hz. */
    max: number
    /** Frequency of the mean marker interval, in Hz. */
    mean: number
    /** Lowest frequency between two adjacent markers, in Hz. */
    min: number
    /** Start and end of the measured span, in seconds from the recording start. */
    range: [number, number]
}

/** How many measurements are kept. */
const KEPT = 20

/**
 * Slack in comparing a measured span with an annotation's, in seconds. An annotation's end is its start plus its
 * duration, which in floating point need not equal the end of the selection it was made from.
 */
const TOLERANCE = 1e-6

let _measurements = [] as FrequencyMeasurement[]

/**
 * Forget every measurement. For tests.
 */
export function clearFrequencyMeasurements () {
    _measurements = []
}

/**
 * The latest measurement made on a span within `start` to `end`, or `null`.
 * @param start - Start of the annotation, in seconds.
 * @param end - End of the annotation, in seconds.
 */
export function frequencyMeasurementWithin (start: number, end: number) {
    return _measurements.find(m => m.range[0] >= start - TOLERANCE && m.range[1] <= end + TOLERANCE) ?? null
}

/**
 * Record a measurement, replacing any earlier one on the same span.
 * @param measurement - The measurement.
 */
export function recordFrequencyMeasurement (measurement: FrequencyMeasurement) {
    const others = _measurements.filter(
        m => m.range[0] !== measurement.range[0] || m.range[1] !== measurement.range[1]
    )
    const kept: FrequencyMeasurement = { ...measurement, range: [measurement.range[0], measurement.range[1]] }
    _measurements = [kept, ...others].slice(0, KEPT)
}
