/**
 * Channel labels for source localisation, aligned with the montage's signal order.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

/**
 * The electrode label of every montage channel, at that channel's index, with `''` for a channel that
 * takes no part.
 *
 * The index a label is found at is the index its signal is read from, because a montage returns one
 * signal per channel in channel order. Dropping the excluded channels instead shifts every index past the
 * first of them, and in a recording ordered in homologous pairs (Fp1, Fp2, F7, F8, …) a shift of one hands
 * each electrode its contralateral partner's signal: a left-sided discharge is located on the right.
 *
 * A derivation label such as `T7-Avg` is reduced to its electrode, `T7`.
 * @param channels - The active montage's channels, in signal order.
 * @param include - Whether a channel takes part in the localisation.
 */
export const alignedChannelLabels = <C extends { label: string }>(
    channels: readonly C[],
    include: (channel: C) => boolean,
): string[] => {
    return channels.map(ch => (include(ch) ? ch.label.split('-')[0] : ''))
}
