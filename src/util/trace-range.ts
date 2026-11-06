/**
 * The band and values a range-mode trace is drawn with, read from its channel.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { BiosignalChannel } from '@epicurrents/core/types'
import type { BiosignalTraceRange } from '#types/plot'

/**
 * The range a trace for `channel` is drawn with: the channel's band, from its layout offsets, spanned by its display
 * range. Null for a channel drawn by sensitivity, which is any channel without a display range.
 * @param channel - The channel the trace draws.
 */
export const traceRange = (
    channel: Pick<BiosignalChannel, 'displayRange' | 'offset'>
): BiosignalTraceRange | null => {
    const range = channel.displayRange
    if (!range || range[1] === range[0] || !channel.offset) {
        return null
    }
    return {
        bottom: channel.offset.bottom,
        top: channel.offset.top,
        values: [range[0], range[1]],
    }
}
