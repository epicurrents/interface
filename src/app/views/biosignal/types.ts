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

/**
 * What a biosignal view needs from the pointer-event overlay it drives.
 *
 * Named as a contract in a plain module rather than taken as the component's instance type, so a
 * consumer of this composable does not have to resolve a single-file component to type it. The
 * overlay satisfies it structurally.
 */
export interface PointerOverlayHandle {
    /** Current width of the overlay element in pixels, or 0 before it is laid out. */
    getOffsetWidth (): number
}
