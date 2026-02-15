/**
 * Biosignal interface and component types.
 */

import type { Modify, MontageChannel, SourceChannel } from '@epicurrents/core/dist/types'
import type { PlotTraceSelection } from '#types/plot'

/** A plot trace selection with channel optionally null for global selections. */
export type PlotSelection = Modify<PlotTraceSelection, {
    canceled: boolean
    channel: MontageChannel | SourceChannel | null
}>
