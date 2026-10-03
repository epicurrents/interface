/**
 * Tests for the two settings/input conversion helpers in the interface config module.
 *
 * Both are reachable only through the four biosignal module configs, which expose them without
 * calling them, so these cases are the only thing exercising them. They pin three defects that were
 * each dormant for a different reason: the user-definable guard refused exactly the fields it was
 * meant to admit, it compared a qualified settings path against keys written without the module
 * prefix so it never matched either way, and the shared `valueMap` declaration had its pair order
 * reversed relative to the data every module config supplies.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { describe, expect, it } from 'vitest'
import { getInputForSetting, getSettingForInput } from '#config'
import type { InterfaceSettingsField } from '#types/config'
import type { SafeObject, SettingsColor } from '@epicurrents/core/types'

const BLUE: SettingsColor = [0, 0, 1, 0.75]
const RED: SettingsColor = [1, 0, 0, 0.75]

// A checkbox over a numeric setting, which is what `valueMap` exists for: the stored polarity is
// 1 or -1 and the input can only be checked or unchecked.
const FIELDS: InterfaceSettingsField[] = [
    {
        component: 'settings-checkbox',
        setting: 'eeg.displayPolarity',
        text: 'Invert EEG trace polarity.',
        type: 'setting',
        valueMap: [[1, false], [-1, true]],
    },
    {
        component: 'settings-checkbox',
        setting: 'eeg.antialiasing',
        text: 'Apply antialiasing to EEG traces.',
        type: 'setting',
    },
    {
        component: 'settings-dropdown',
        setting: 'eeg.trace.color',
        text: 'Trace colour.',
        type: 'setting',
        valueMap: [[BLUE, 'blue'], [RED, 'red']],
    },
    {
        component: 'settings-checkbox',
        setting: 'eeg.locked',
        text: 'A field the module does not let the user set.',
        type: 'setting',
    },
]

// Keyed by the path within the module, which is how every module config writes it.
const SETTINGS = {
    _userDefinable: {
        'antialiasing': Boolean,
        'displayPolarity': Number,
        'trace.color': String,
    },
} as unknown as SafeObject

describe('getSettingForInput', () => {
    it('converts a mapped input value to the setting value it stands for', () => {
        expect(getSettingForInput('eeg.displayPolarity', true, FIELDS, SETTINGS)).toBe(-1)
        expect(getSettingForInput('eeg.displayPolarity', false, FIELDS, SETTINGS)).toBe(1)
    })
    it('passes an unmapped value through', () => {
        expect(getSettingForInput('eeg.antialiasing', true, FIELDS, SETTINGS)).toBe(true)
    })
    it('refuses a field the module does not list as user-definable', () => {
        expect(getSettingForInput('eeg.locked', true, FIELDS, SETTINGS)).toBeUndefined()
    })
    it('converts a named option back to the colour it stands for', () => {
        expect(getSettingForInput('eeg.trace.color', 'red', FIELDS, SETTINGS)).toBe(RED)
    })
    it('refuses a field no settings menu declares', () => {
        expect(getSettingForInput('eeg.absent', true, FIELDS, SETTINGS)).toBeUndefined()
    })
})

describe('getInputForSetting', () => {
    it('converts a stored setting value to the input value that presents it', () => {
        expect(getInputForSetting('eeg.displayPolarity', -1, FIELDS, SETTINGS)).toBe(true)
        expect(getInputForSetting('eeg.displayPolarity', 1, FIELDS, SETTINGS)).toBe(false)
    })
    it('passes an unmapped value through', () => {
        expect(getInputForSetting('eeg.antialiasing', false, FIELDS, SETTINGS)).toBe(false)
    })
    it('converts a stored colour to the named option that presents it', () => {
        expect(getInputForSetting('eeg.trace.color', BLUE, FIELDS, SETTINGS)).toBe('blue')
    })
    it('refuses a field the module does not list as user-definable', () => {
        expect(getInputForSetting('eeg.locked', true, FIELDS, SETTINGS)).toBeUndefined()
    })
})

describe('the user-definable guard', () => {
    // The guard compared the name it was given against the `_userDefinable` keys directly. A
    // settings menu names a field by its qualified path, so the two spaces never met and the
    // guard answered the same way for every field, whichever direction it was written in.
    it('matches a qualified path against keys written without the module prefix', () => {
        expect(getInputForSetting('eeg.displayPolarity', 1, FIELDS, SETTINGS)).toBe(false)
        expect(getSettingForInput('eeg.antialiasing', true, FIELDS, SETTINGS)).toBe(true)
    })
    it('refuses every field when the module declares no user-definable map', () => {
        // `_userDefinable` is optional on the settings type, so a module may omit it entirely. It
        // then declares nothing the user may set, which is a refusal rather than a crash.
        const bare = {} as unknown as SafeObject
        expect(getSettingForInput('eeg.antialiasing', true, FIELDS, bare)).toBeUndefined()
        expect(getInputForSetting('eeg.displayPolarity', 1, FIELDS, bare)).toBeUndefined()
    })
    it('still resolves a field named without a prefix', () => {
        const fields: InterfaceSettingsField[] = [
            { component: 'settings-checkbox', setting: 'antialiasing', text: 'x', type: 'setting' },
        ]
        expect(getSettingForInput('antialiasing', true, fields, SETTINGS)).toBe(true)
    })
})
