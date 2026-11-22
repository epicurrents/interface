/**
 * Tests for mounting only the navigator rows within reach of the viewport.
 *
 * The rows' offsets come from their heights, measured once a row has been laid out and estimated before. A scroll
 * position selects the rows any part of which lies within the overscan of the viewport, and two spacers stand for the
 * rows above and below them, so the list keeps its full height. A member keeps one disclosure state for as long as the
 * dataset is open, whichever of its rows are mounted.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { describe, expect, it } from 'vitest'
import DatasetNavigator from '#app/navigator/DatasetNavigator.vue'
import {
    rowGaps,
    rowOffsets,
    rowRange,
    scrollShiftFor,
    scrollTopToShow,
    shownIndexes,
    type EntryDisclosure,
    type NavigatorRow,
} from '#app/navigator/rows'

describe('row geometry', () => {
    it('offsets each row by the heights above it, ending with the height of the list', () => {
        expect(rowOffsets([10, 20, 30])).toEqual([0, 10, 30, 60])
        expect(rowOffsets([])).toEqual([0])
    })

    it('takes the rows any part of which lies within the overscan of the viewport', () => {
        // Ten rows of 10px: the viewport shows 30..60, and the overscan widens it to 20..70.
        const offsets = rowOffsets(new Array(10).fill(10))
        expect(rowRange(offsets, 30, 30, 10)).toEqual([2, 7])
    })

    it('takes the rows from the top when the list is not scrolled', () => {
        const offsets = rowOffsets(new Array(10).fill(10))
        expect(rowRange(offsets, 0, 25, 0)).toEqual([0, 3])
    })

    it('takes every row of a list shorter than the viewport', () => {
        const offsets = rowOffsets([10, 10, 10])
        expect(rowRange(offsets, 0, 500, 100)).toEqual([0, 3])
    })

    it('takes no rows of an empty list', () => {
        expect(rowRange([0], 0, 500, 100)).toEqual([0, 0])
    })

    it('takes the last rows when scrolled to the end', () => {
        const offsets = rowOffsets(new Array(10).fill(10))
        expect(rowRange(offsets, 70, 30, 0)).toEqual([7, 10])
    })

    it('adds the pinned rows outside the range, in list order and once each', () => {
        expect(shownIndexes([3, 6], [], 10)).toEqual([3, 4, 5])
        expect(shownIndexes([3, 6], [8, 1], 10)).toEqual([1, 3, 4, 5, 8])
        expect(shownIndexes([3, 6], [4, 8, 8], 10)).toEqual([3, 4, 5, 8])
        expect(shownIndexes([3, 6], [-1, 10, 2.5], 10)).toEqual([3, 4, 5])
        expect(shownIndexes([0, 0], [2], 3)).toEqual([2])
    })

    it('leaves the height of the rows not mounted before each mounted row and after the last', () => {
        const offsets = rowOffsets(new Array(10).fill(10))
        expect(rowGaps(offsets, [3, 4, 5])).toEqual([30, 0, 0, 40])
        expect(rowGaps(offsets, [1, 3, 4, 8])).toEqual([10, 10, 0, 30, 10])
        expect(rowGaps(offsets, [])).toEqual([100])
    })

    it('scrolls to a row no part of which is in the viewport, by the shorter way', () => {
        // Ten rows of 10px under a viewport of 30px at 30..60.
        const offsets = rowOffsets(new Array(10).fill(10))
        expect(scrollTopToShow(offsets, 1, 30, 30)).toBe(10)
        expect(scrollTopToShow(offsets, 8, 30, 30)).toBe(60)
        expect(scrollTopToShow(offsets, 3, 30, 30)).toBeNull()
        // A row the viewport edge cuts through counts as in view.
        expect(scrollTopToShow(offsets, 5, 35, 30)).toBeNull()
        expect(scrollTopToShow(offsets, 2, 30, 30)).toBe(20)
        expect(scrollTopToShow(offsets, 6, 30, 30)).toBe(40)
        expect(scrollTopToShow(offsets, 10, 30, 30)).toBeNull()
        expect(scrollTopToShow(offsets, -1, 30, 30)).toBeNull()
        // A row taller than the viewport is shown from its top.
        expect(scrollTopToShow(rowOffsets([10, 10, 100]), 2, 0, 15)).toBe(20)
    })

    it('shifts the scroll by the change in a row that lies wholly above it', () => {
        const offsets = rowOffsets(new Array(10).fill(10))
        expect(scrollShiftFor(offsets, 1, 25, 30)).toBe(15)
        expect(scrollShiftFor(offsets, 2, 4, 30)).toBe(-6)
        expect(scrollShiftFor(offsets, 3, 25, 35)).toBe(0)
        expect(scrollShiftFor(offsets, 7, 25, 30)).toBe(0)
        expect(scrollShiftFor(offsets, -1, 25, 30)).toBe(0)
    })
})

describe('the navigator rows', () => {
    type Computed = Record<string, () => unknown>
    type Methods = Record<string, (...args: unknown[]) => unknown>
    type Layout = { height?: number, index?: number, key: string, kind: 'gap' | 'row' }[]
    const options = DatasetNavigator as unknown as { computed: Computed, methods: Methods }

    const member = (id: string, children = 0) => ({
        resource: { childResources: new Array(children).fill({}), id },
    })

    /** A navigator over `count` members of 100px each, whose computed values are evaluated on demand. */
    const navigator = (count: number) => {
        const vm = {
            disclosures: new Map<string, EntryDisclosure>(),
            focusedKey: '',
            groups: [{ header: '', key: 'all', resources: [] as unknown[] }],
            heights: new Map<string, number>(),
            layoutCounter: 0,
            rem: 16,
            revealPending: false,
            scrollTop: 0,
            viewportHeight: 500,
        } as Record<string, unknown>
        for (let i = 0; i < count; i++) {
            (vm.groups as { resources: unknown[] }[])[0].resources.push(member(`m${i}`))
            ;(vm.heights as Map<string, number>).set(`member-m${i}`, 100)
        }
        for (const [name, method] of Object.entries(options.methods)) {
            vm[name] = method.bind(vm)
        }
        for (const [name, getter] of Object.entries(options.computed)) {
            if (name === 'groups') {
                continue
            }
            Object.defineProperty(vm, name, { get: getter.bind(vm) })
        }
        return vm
    }

    it('mounts only the rows near the viewport of a thousand-member dataset', () => {
        const vm = navigator(1000)
        const shown = vm.shownRows as NavigatorRow[]
        // 500px of viewport and 300px of overscan below it.
        expect(shown).toHaveLength(8)
        expect(shown[0].key).toBe('member-m0')
        const layout = vm.layout as Layout
        // No spacer above the first row, and one below the last for the rest of the list.
        expect(layout.map(item => item.kind)).toEqual([...new Array(8).fill('row'), 'gap'])
        expect(layout[8].height).toBe((1000 - 8) * 100)
    })

    it('moves the mounted rows with the scroll, the spacers keeping the height of the list', () => {
        const vm = navigator(1000)
        vm.scrollTop = 50_000
        const shown = vm.shownRows as NavigatorRow[]
        expect(shown[0].key).toBe('member-m497')
        expect(shown).toHaveLength(11)
        const layout = vm.layout as Layout
        expect(layout.map(item => item.kind)).toEqual(['gap', ...new Array(11).fill('row'), 'gap'])
        expect(layout[0].height! + shown.length * 100 + layout[12].height!).toBe(100_000)
        // A row says where it is in the whole list, not among the mounted ones.
        expect(layout[1].index).toBe(497)
    })

    it('keeps the focused row and the active row mounted wherever the list is scrolled', () => {
        const vm = navigator(1000)
        const groups = vm.groups as { resources: { resource: { isActive?: boolean } }[] }[]
        groups[0].resources[900].resource.isActive = true
        vm.focusedKey = 'member-m3'
        vm.scrollTop = 50_000
        const shown = vm.shownRows as NavigatorRow[]
        expect(shown[0].key).toBe('member-m3')
        expect(shown[1].key).toBe('member-m497')
        expect(shown[shown.length - 1].key).toBe('member-m900')
        expect(shown).toHaveLength(13)
        // The spacers between the pinned rows and the others keep every row where it belongs.
        const layout = vm.layout as Layout
        expect(layout.map(item => item.kind)).toEqual(
            ['gap', 'row', 'gap', ...new Array(11).fill('row'), 'gap', 'row', 'gap']
        )
        expect(layout.filter(item => item.kind === 'gap').map(item => item.height)).toEqual(
            [300, (497 - 4) * 100, (900 - 508) * 100, 99 * 100]
        )
        // A pinned row within reach of the viewport is mounted once.
        vm.focusedKey = 'member-m500'
        expect(vm.shownRows as NavigatorRow[]).toHaveLength(12)
        // A focus on a row the list no longer has pins nothing.
        vm.focusedKey = 'member-gone'
        expect(vm.shownRows as NavigatorRow[]).toHaveLength(12)
    })

    it('forgets the heights and disclosure states of rows that are gone', () => {
        const vm = navigator(3)
        const disclosures = vm.disclosures as Map<string, EntryDisclosure>
        const heights = vm.heights as Map<string, number>
        void vm.rows
        expect([...disclosures.keys()]).toEqual(['m0', 'm1', 'm2'])
        const groups = vm.groups as { resources: unknown[] }[]
        groups[0].resources.splice(1, 1)
        vm.focusedKey = 'member-m1'
        ;(vm.pruneRows as () => void)()
        expect([...disclosures.keys()]).toEqual(['m0', 'm2'])
        expect([...heights.keys()]).toEqual(['member-m0', 'member-m2'])
        expect(vm.focusedKey).toBe('')
    })

    it('starts another dataset from nothing kept and from the top', () => {
        const vm = navigator(3)
        void vm.rows
        vm.scrollTop = 120
        vm.focusedKey = 'member-m1'
        const content = { scrollTop: 120 }
        vm.scroller = { content }
        ;(vm.resetRows as () => void)()
        expect((vm.disclosures as Map<string, unknown>).size).toBe(0)
        expect((vm.heights as Map<string, unknown>).size).toBe(0)
        expect([vm.scrollTop, content.scrollTop, vm.focusedKey, vm.layoutCounter]).toEqual([0, 0, '', 1])
    })

    it('scrolls by the change when a row above the scroll position is measured', () => {
        const vm = navigator(1000)
        const content = { scrollTop: 50_000 }
        vm.scroller = { content }
        vm.scrollTop = 50_000
        const resized = vm.rowsResized as (entries: unknown[]) => void
        const row = (key: string) => ({ dataset: { row: key }, isConnected: true, offsetHeight: 0 })
        // A row wholly above the scroll position grows by 40px, and one in view by 10px.
        resized([
            { borderBoxSize: [{ blockSize: 140 }], target: row('member-m498') },
            { borderBoxSize: [{ blockSize: 110 }], target: row('member-m502') },
        ])
        expect(content.scrollTop).toBe(50_040)
        expect(vm.scrollTop).toBe(50_040)
        // A row the scroll position cuts through stays where it is.
        content.scrollTop = 50_090
        resized([{ borderBoxSize: [{ blockSize: 60 }], target: row('member-m500') }])
        expect(content.scrollTop).toBe(50_090)
    })

    it('scrolls the active row into view once the navigator has a height', () => {
        const vm = navigator(1000)
        const groups = vm.groups as { resources: { resource: { isActive?: boolean } }[] }[]
        groups[0].resources[900].resource.isActive = true
        const content = { clientHeight: 0, scrollTop: 0 }
        vm.scroller = { content }
        const reveal = vm.revealActiveRow as () => void
        reveal()
        // Hidden, with no viewport to scroll.
        expect([content.scrollTop, vm.revealPending]).toEqual([0, true])
        content.clientHeight = 500
        reveal()
        expect([content.scrollTop, vm.scrollTop, vm.revealPending]).toEqual([90_100 - 500, 90_100 - 500, false])
        // In view already: the list stays where it is.
        content.scrollTop = 89_950
        reveal()
        expect(content.scrollTop).toBe(89_950)
    })

    it('estimates a row that has not been laid out by what it holds', () => {
        const vm = navigator(0)
        const groups = vm.groups as { header: string, key: string, resources: unknown[] }[]
        groups[0] = { header: 'EEG', key: 'eeg', resources: [member('a'), member('b', 2)] }
        const rows = vm.rows as NavigatorRow[]
        const estimate = vm.estimateHeight as (row: NavigatorRow) => number
        expect(rows.map(row => estimate(row))).toEqual([1.5 * 16, 2.7 * 16, 4.45 * 16])
        ;(rows[2] as { disclosure: EntryDisclosure }).disclosure.isOpen = true
        expect(estimate(rows[2])).toBe((4.45 + 2 * 2.7) * 16)
    })

    it('takes no height from a row measured while the navigator is hidden', () => {
        const vm = navigator(1000)
        const element = { dataset: { row: 'member-m0' }, isConnected: true, offsetHeight: 0 }
        const resized = vm.rowsResized as (entries: unknown[]) => void
        resized([{ borderBoxSize: [{ blockSize: 0 }], target: element }])
        expect((vm.heights as Map<string, number>).get('member-m0')).toBe(100)
        expect(vm.layoutCounter).toBe(0)
        resized([{ borderBoxSize: [{ blockSize: 43 }], target: element }])
        expect((vm.heights as Map<string, number>).get('member-m0')).toBe(43)
        expect(vm.layoutCounter).toBe(1)
    })

    it('keeps one disclosure state per member however often the rows are computed', () => {
        const vm = navigator(3)
        const first = (vm.rows as { disclosure: EntryDisclosure }[])[1].disclosure
        first.isOpen = true
        const again = (vm.rows as { disclosure: EntryDisclosure }[])[1].disclosure
        expect(again).toBe(first)
        expect(again.isOpen).toBe(true)
    })
})
