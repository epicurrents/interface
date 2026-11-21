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
import { rowOffsets, rowRange, type EntryDisclosure, type NavigatorRow } from '#app/navigator/rows'

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
})

describe('the navigator rows', () => {
    type Computed = Record<string, () => unknown>
    type Methods = Record<string, (...args: unknown[]) => unknown>
    const options = DatasetNavigator as unknown as { computed: Computed, methods: Methods }

    const member = (id: string, children = 0) => ({
        resource: { childResources: new Array(children).fill({}), id },
    })

    /** A navigator over `count` members of 100px each, whose computed values are evaluated on demand. */
    const navigator = (count: number) => {
        const vm = {
            disclosures: new Map<string, EntryDisclosure>(),
            groups: [{ header: '', key: 'all', resources: [] as unknown[] }],
            heights: new Map<string, number>(),
            layoutCounter: 0,
            rem: 16,
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
        expect(vm.spaceAbove).toBe('0px')
        expect(vm.spaceBelow).toBe(`${(1000 - 8) * 100}px`)
    })

    it('moves the mounted rows with the scroll, the spacers keeping the height of the list', () => {
        const vm = navigator(1000)
        vm.scrollTop = 50_000
        const shown = vm.shownRows as NavigatorRow[]
        expect(shown[0].key).toBe('member-m497')
        expect(shown).toHaveLength(11)
        const above = parseFloat(vm.spaceAbove as string)
        const below = parseFloat(vm.spaceBelow as string)
        expect(above + shown.length * 100 + below).toBe(100_000)
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
