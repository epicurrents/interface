/**
 * Tests for the conversion of a viewer's channel layout settings into the core layout config.
 *
 * Spreading a viewer's `SETTINGS` into `setChannelLayout` yields an empty object: `SETTINGS` is a Proxy that answers
 * reads but lists no keys, so every montage would fall back to the core's spacing defaults, which put no gap between
 * channel groups. The settings object here is a Proxy of the same shape for that reason.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { describe, expect, it } from 'vitest'
import { calculateSignalOffsets } from '@epicurrents/core/util'
import type { MontageChannel } from '@epicurrents/core/types'
import {
    CHANNEL_LAYOUT_SETTINGS,
    channelLayoutFromSettings,
    isChannelLayoutSetting,
} from '#app/views/biosignal/channelLayout'
import type { ChannelLayoutSettings } from '#types/config'

/** A settings object that, like the `useContext` Proxy, can be read by property but has no own keys. */
const readOnlyProxy = (values: Record<string, unknown>) => new Proxy({} as Record<string, unknown>, {
    get: (_, name) => values[name as string],
    has: (_, name) => name in values,
}) as unknown as ChannelLayoutSettings

const channel = (label: string) => ({
    active: 0,
    label,
    modality: 'eeg',
    name: label,
    offset: { baseline: 0, bottom: 0, top: 0 },
    visible: true,
}) as unknown as MontageChannel

describe('channelLayoutFromSettings', () => {
    it('reads the layout fields from a settings Proxy a spread would lose', () => {
        const settings = readOnlyProxy({ channelSpacing: 1, groupGap: 0.5, yPadding: 1.2 })
        expect({ ...settings }).toEqual({})
        expect(channelLayoutFromSettings(settings)).toEqual({ channelSpacing: 1, groupSpacing: 1.5, yPadding: 1.2 })
    })

    it('adds the group gap to the channel spacing', () => {
        const settings = readOnlyProxy({ channelSpacing: 2, groupGap: 0, yPadding: 1 })
        expect(channelLayoutFromSettings(settings).groupSpacing).toBe(2)
    })

    it('leaves out a value that is not a finite number, so the core default applies', () => {
        const settings = readOnlyProxy({ channelSpacing: 1, yPadding: Number.NaN })
        expect(channelLayoutFromSettings(settings)).toEqual({ channelSpacing: 1 })
    })

    it('carries no layout, so a montage keeps its own channel groups', () => {
        const settings = readOnlyProxy({ channelSpacing: 1, groupGap: 0.5, yPadding: 1 })
        expect(channelLayoutFromSettings(settings)).not.toHaveProperty('layout')
    })

    it('spaces groups apart by the gap in the computed offsets', () => {
        const channels = ['a', 'b', 'c', 'd'].map(channel)
        const settings = readOnlyProxy({ channelSpacing: 1, groupGap: 0.5, yPadding: 1 })
        calculateSignalOffsets(channels, { ...channelLayoutFromSettings(settings), layout: [2, 2] })
        const baselines = channels.map(chan => (chan.offset as { baseline: number }).baseline)
        const withinGroup = baselines[0] - baselines[1]
        const betweenGroups = baselines[1] - baselines[2]
        expect(betweenGroups/withinGroup).toBeCloseTo(1.5)
    })
})

describe('isChannelLayoutSetting', () => {
    it('matches each layout setting in the viewer scope only', () => {
        for (const key of CHANNEL_LAYOUT_SETTINGS) {
            expect(isChannelLayoutSetting(`eeg.${key}`, 'eeg')).toBe(true)
            expect(isChannelLayoutSetting(`acc.${key}`, 'eeg')).toBe(false)
        }
        expect(isChannelLayoutSetting('eeg.groupSpacing', 'eeg')).toBe(false)
    })
})
