/**
 * Tests for the finding picker's handling of focus, which the annotation editor reads to tell whether it is still in
 * use.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest'
import FindingPicker from '#app/modules/eeg/components/overlays/FindingPicker.vue'

type LeaveGroupContext = {
    clearbtn: { focus: () => void }
    keptGroup: number | null
    update: (edit: (code: { group?: number }) => void) => void
}

describe('leaving a finding group', () => {
    it('moves the focus to the clear button before the group, and the button holding the focus, are gone', () => {
        const order = [] as string[]
        const code = { group: 3 }
        const context: LeaveGroupContext = {
            clearbtn: { focus: vi.fn(() => order.push('focus')) },
            keptGroup: 3,
            update: vi.fn(edit => {
                order.push('update')
                edit(code)
            }),
        }
        const methods = (FindingPicker as unknown as { methods: { leaveGroup (this: LeaveGroupContext): void } }).methods
        methods.leaveGroup.call(context)
        expect(order).toEqual(['focus', 'update'])
        expect(code.group).toBeUndefined()
        expect(context.keptGroup).toBeNull()
    })
})
