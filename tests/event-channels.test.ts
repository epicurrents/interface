/**
 * Naming an event's channels and resolving them back again.
 *
 * The round-trip cases are the point of this file. Naming and resolution are two halves of one
 * convention, and they drifted apart once already — an event created on a derivation was stored
 * under the derivation's own name, which matches no record channel, so it was drawn on none. A
 * test of either half alone would have passed throughout.
 */

import { describe, expect, it } from 'vitest'
import type { BiosignalMontage, BiosignalResource } from '@epicurrents/core/dist/types'
import { eventChannelNames, resolveEventChannelIndices } from '../src/app/views/biosignal/eventChannels'

/** Source signals, by index: 0 Fp1, 1 F7, 2 Fp2, 3 F8. */
const montage = (channels: { name: string, active: number, reference: number[] }[]) =>
    ({ channels }) as unknown as BiosignalMontage

/** The as-recorded montage: one channel per signal, active on itself. */
const RECORD = montage([
    { name: 'Fp1', active: 0, reference: [] },
    { name: 'F7', active: 1, reference: [] },
    { name: 'Fp2', active: 2, reference: [] },
    { name: 'F8', active: 3, reference: [] },
])

/** A bipolar montage: each channel active on one electrode, referenced against another. */
const BIPOLAR = montage([
    { name: 'Fp1-F7', active: 0, reference: [1] },
    { name: 'Fp2-F8', active: 2, reference: [3] },
])

/** A referential montage: every channel against the same reference. */
const REFERENTIAL = montage([
    { name: 'Fp1-Avg', active: 0, reference: [0, 1, 2, 3] },
    { name: 'F7-Avg', active: 1, reference: [0, 1, 2, 3] },
    { name: 'Fp2-Avg', active: 2, reference: [0, 1, 2, 3] },
])

const resource = (activeMontage: BiosignalMontage) =>
    ({ recordMontage: RECORD, activeMontage }) as unknown as BiosignalResource

describe('naming the channels an event is created on', () => {
    it('names the electrode a derivation is active on, not the derivation', () => {
        expect(eventChannelNames(RECORD, BIPOLAR.channels[0])).toEqual(['Fp1'])
        expect(eventChannelNames(RECORD, REFERENTIAL.channels[1])).toEqual(['F7'])
    })
    it('returns nothing for a general event created on no channel', () => {
        expect(eventChannelNames(RECORD, null)).toEqual([])
        expect(eventChannelNames(RECORD, undefined)).toEqual([])
    })
    it('falls back to the channel name where no record channel resolves', () => {
        expect(eventChannelNames(RECORD, { name: 'Unmapped', active: -1 })).toEqual(['Unmapped'])
        expect(eventChannelNames(null, BIPOLAR.channels[0])).toEqual(['Fp1-F7'])
    })
    it('names every record channel a derivation draws on', () => {
        const averaged = { name: 'Frontal', active: [0, 2] as (number | number[])[] }
        expect(eventChannelNames(RECORD, averaged)).toEqual(['Fp1', 'Fp2'])
    })
})

describe('resolving a named event back to the active montage', () => {
    it('finds the derivation it was created on', () => {
        const names = eventChannelNames(RECORD, BIPOLAR.channels[0])
        expect(resolveEventChannelIndices(resource(BIPOLAR), names)).toEqual([0])
    })
    it('finds the same electrode in a montage that derives it differently', () => {
        // Created in the bipolar montage, opened in the referential one.
        const names = eventChannelNames(RECORD, BIPOLAR.channels[0])
        expect(resolveEventChannelIndices(resource(REFERENTIAL), names)).toEqual([0])
    })
    it('would have resolved to nothing under the derivation name that used to be stored', () => {
        // The regression itself, pinned so the two halves cannot drift apart again.
        expect(resolveEventChannelIndices(resource(BIPOLAR), ['Fp1-F7'])).toEqual([])
    })
    it('falls back to a single-reference derivation where nothing is active on the channel', () => {
        const names = eventChannelNames(RECORD, RECORD.channels[1])
        expect(names).toEqual(['F7'])
        // Nothing in BIPOLAR is active on F7, but Fp1-F7 is referenced against it alone.
        expect(resolveEventChannelIndices(resource(BIPOLAR), names, true)).toEqual([0])
        expect(resolveEventChannelIndices(resource(BIPOLAR), names, false)).toEqual([])
    })
    it('does not spread an event across an average-referenced montage', () => {
        // Every channel references every signal there, so the reference fallback must not match.
        const names = eventChannelNames(RECORD, RECORD.channels[3])
        expect(names).toEqual(['F8'])
        expect(resolveEventChannelIndices(resource(REFERENTIAL), names, true)).toEqual([])
    })
    it('returns nothing for a general event', () => {
        expect(resolveEventChannelIndices(resource(BIPOLAR), [])).toEqual([])
        expect(resolveEventChannelIndices(resource(BIPOLAR), undefined)).toEqual([])
    })
})
