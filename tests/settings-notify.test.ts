import { describe, expect, it, vi } from 'vitest'
import INTERFACE from '../src/config'

describe('interface settings change notification', () => {
    it('notifies a handler registered on a parent branch when a leaf changes', () => {
        INTERFACE.modules.set('eeg', {
            settings: {
                _userDefinable: {},
                trace: { color: { eeg: [0, 0, 0, 1] }, colorSides: false },
            },
        } as never)
        const handler = vi.fn()
        INTERFACE.addPropertyChangeHandler('eeg.trace', handler, 'test')
        const changed = INTERFACE.setFieldValue('eeg.trace.color.eeg', [10, 20, 30, 1])
        expect(changed).toBe(true)
        expect(handler).toHaveBeenCalledTimes(1)
    })
    it('accepts an rgba string for a colour leaf', () => {
        const handler = vi.fn()
        INTERFACE.addPropertyChangeHandler('eeg.trace', handler, 'test2')
        const changed = INTERFACE.setFieldValue('eeg.trace.color.eeg', 'rgba(200,0,0,1)')
        expect(changed).toBe(true)
        expect(handler).toHaveBeenCalledTimes(1)
    })
})

describe('one handler watching several unrelated fields', () => {
    it('is notified for every field it was registered for', () => {
        INTERFACE.modules.set('eeg', {
            settings: {
                _userDefinable: {},
                displayPolarity: -1,
                trace: { color: { eeg: [0, 0, 0, 1] } },
            },
        } as never)
        // A component that redraws on any of several settings registers the same method for each,
        // which is what every converted plot and grid overlay does.
        const redraw = vi.fn()
        INTERFACE.addPropertyChangeHandler('eeg.displayPolarity', redraw, 'shared')
        INTERFACE.addPropertyChangeHandler('eeg.trace', redraw, 'shared')

        INTERFACE.setFieldValue('eeg.displayPolarity', 1)
        expect(redraw).toHaveBeenCalledTimes(1)

        INTERFACE.setFieldValue('eeg.trace.color.eeg', [9, 9, 9, 1])
        expect(redraw).toHaveBeenCalledTimes(2)
    })
})
