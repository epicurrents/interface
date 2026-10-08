/**
 * The value an epoch step setting stores, from what a user typed.
 *
 * Kept apart from the field component so the rule can be tested without mounting one.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

/** Steps offered as one-click choices, in seconds; only those shorter than the epoch are shown. */
export const EPOCH_STEP_PRESETS = [2, 1, 0.5]

/**
 * Normalise a typed epoch step against the epoch length it applies to.
 *
 * The stored value is either a step shorter than the epoch, which makes epochs overlap, or `0` for no overlap. Empty,
 * zero, negative and non-numeric input store `0`, since clearing the field is how people turn the overlap off. So
 * does a step at or above the epoch length: such a step is no overlap already, and storing it as a number would turn
 * into an overlap nobody asked for the moment the epoch length is raised past it.
 * @param input - The field's text, or a number.
 * @param epochLength - The epoch length the step applies to in seconds; `0` when it is not known, which skips the upper limit.
 * @returns The step to store, in seconds.
 */
export function normaliseEpochStep (input: string | number, epochLength: number): number {
    const value = typeof input === 'number' ? input : (input.trim() ? Number(input.trim().replace(',', '.')) : 0)
    if (!Number.isFinite(value) || value <= 0) {
        return 0
    }
    if (epochLength > 0 && value >= epochLength) {
        return 0
    }
    return value
}
