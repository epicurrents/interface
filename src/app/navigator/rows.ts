/**
 * The geometry of the navigator's rows: where each row starts, and which rows a scroll position brings into view. The
 * navigator mounts only those, and the rows it pins, so a dataset of any number of members costs the member rows that
 * fit on screen. A row is a group header or a dataset member; the resources listed under a member are part of its
 * row and are all mounted with it while they are shown, however many they are.
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
 * The rows to mount: those of `range`, and the pinned rows outside it, in list order.
 * @param range - The rows within reach of the viewport from `rowRange`, as the index of the first and one past the last.
 * @param pinned - Indexes of rows that stay mounted wherever the list is scrolled; one that names no row is left out.
 * @param count - The number of rows in the list.
 */
export const shownIndexes = (range: [number, number], pinned: number[], count: number) => {
    const shown = [] as number[]
    for (let i = range[0]; i < range[1]; i++) {
        shown.push(i)
    }
    for (const index of pinned) {
        if (Number.isInteger(index) && index >= 0 && index < count && (index < range[0] || index >= range[1])) {
            shown.push(index)
        }
    }
    return [...new Set(shown)].sort((a, b) => a - b)
}

/**
 * The height left empty before each mounted row, standing for the rows not mounted above it, and as the last element
 * the height left empty after the last one. With no row mounted the one element is the height of the whole list.
 * @param offsets - The row offsets from `rowOffsets`.
 * @param shown - Indexes of the mounted rows in list order, from `shownIndexes`.
 */
export const rowGaps = (offsets: number[], shown: number[]) => {
    const gaps = [] as number[]
    let end = 0
    for (const index of shown) {
        gaps.push(offsets[index] - end)
        end = offsets[index + 1]
    }
    gaps.push(offsets[offsets.length - 1] - end)
    return gaps
}

/**
 * The scroll position that brings a row into the viewport, or null when some part of the row is in it already. A row
 * above the viewport is brought to its top and one below to its bottom, or to its top when the row is taller than
 * the viewport.
 * @param offsets - The row offsets from `rowOffsets`.
 * @param index - Index of the row to show.
 * @param top - The scroll position of the list in pixels.
 * @param height - The height of the viewport in pixels.
 */
export const scrollTopToShow = (offsets: number[], index: number, top: number, height: number) => {
    if (index < 0 || index >= offsets.length - 1) {
        return null
    }
    const rowTop = offsets[index]
    const rowBottom = offsets[index + 1]
    if (rowBottom <= top) {
        return rowTop
    }
    if (rowTop >= top + height) {
        return Math.max(0, rowBottom - rowTop > height ? rowTop : rowBottom - height)
    }
    return null
}

/**
 * How far the list has to be scrolled to keep its visible rows in place when a row's height changes: the change in
 * height when the whole row lies above the scroll position, nothing otherwise.
 * @param offsets - The row offsets from `rowOffsets`, as they were before the change.
 * @param index - Index of the row whose height changed.
 * @param height - The row's new height in pixels.
 * @param top - The scroll position of the list in pixels.
 */
export const scrollShiftFor = (offsets: number[], index: number, height: number, top: number) => {
    if (index < 0 || index >= offsets.length - 1 || offsets[index + 1] > top) {
        return 0
    }
    return height - (offsets[index + 1] - offsets[index])
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
