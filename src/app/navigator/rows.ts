/**
 * The geometry of the navigator's rows: where each row starts, and which rows a scroll position brings into view. The
 * navigator mounts only those, so a dataset of any size costs the rows that fit on screen.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { DataResource } from '@epicurrents/core/types'

/**
 * The offset of each row's top from the top of the list, and as the last element the height of the whole list.
 * @param heights - The height of each row in pixels, in list order.
 */
export const rowOffsets = (heights: number[]) => {
    const offsets = new Array<number>(heights.length + 1)
    offsets[0] = 0
    for (let i = 0; i < heights.length; i++) {
        offsets[i + 1] = offsets[i] + heights[i]
    }
    return offsets
}

/**
 * The rows any part of which lies within `overscan` pixels of the viewport, as the index of the first and one past the
 * last. Rows of no height at the edges are left out.
 * @param offsets - The row offsets from `rowOffsets`.
 * @param top - The scroll position of the list in pixels.
 * @param height - The height of the viewport in pixels.
 * @param overscan - How far past each edge of the viewport rows are kept, so a short scroll shows rows already laid out.
 */
export const rowRange = (offsets: number[], top: number, height: number, overscan: number): [number, number] => {
    const count = offsets.length - 1
    const from = top - overscan
    const to = top + height + overscan
    // The first row whose bottom is below `from`.
    let lo = 0
    let hi = count
    while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (offsets[mid + 1] > from) {
            hi = mid
        } else {
            lo = mid + 1
        }
    }
    const start = lo
    // The first row whose top is at or below `to`.
    hi = count
    while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (offsets[mid] >= to) {
            hi = mid
        } else {
            lo = mid + 1
        }
    }
    return [start, Math.max(start, lo)]
}

/**
 * Whether a member's children are shown. The navigator keeps one per member for as long as the dataset is open, since
 * the member's entry is unmounted whenever it leaves the view.
 */
export type EntryDisclosure = {
    isOpen: boolean
    /** The member's activity when its entry last read it, so only a change of it opens or closes the list. */
    wasActive: boolean
}

/** A row of the navigator: a group header, or a dataset member with the resources listed under it. */
export type NavigatorRow = {
    /** Whether the row is the first in the list. */
    first: boolean
    key: string
} & (
    { header: string, kind: 'header' }
    | { disclosure: EntryDisclosure, kind: 'member', resource: DataResource }
)
