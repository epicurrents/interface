/**
 * Stepping a plot's sensitivity through the values its settings offer.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

/**
 * The sensitivity one step from `current` among the offered values, or null when no value lies that way. The offered
 * values are in the setting's display unit and the resource's sensitivity in the signal's base unit, so `current` is
 * compared, and the result returned, through the setting's scale. A value that is not offered steps to the nearest
 * offered value in the given direction.
 * @param settings - The sensitivity setting of the active unit, with its offered values and the scale to the base unit.
 * @param current - The resource's sensitivity in the signal's base unit.
 * @param step - -1 for the next smaller value, which draws the signal larger, and 1 for the next larger value.
 */
export const steppedSensitivity = (
    settings: { availableValues: number[], scale?: number },
    current: number,
    step: -1 | 1,
): number | null => {
    const scale = settings.scale || 1
    // A relative tolerance, so a value that has been through the scale still matches the offered value it came from.
    const units = current / scale
    const tolerance = Math.abs(units) * 1e-9
    const values = [...settings.availableValues].sort((a, b) => a - b)
    const next = step < 0
                 ? values.filter(value => value < units - tolerance).pop()
                 : values.find(value => value > units + tolerance)
    return next === undefined ? null : next * scale
}
