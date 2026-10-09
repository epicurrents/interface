/**
 * Tests for the channel labels source localisation matches against a lead field.
 */

import { describe, expect, test } from 'vitest'
import { alignedChannelLabels } from '#app/modules/eeg/components/tools/sourceChannels'

type Channel = { label: string, modality: string }

describe('alignedChannelLabels', () => {
    test('an excluded channel keeps its index, so every later label stays on its own signal', () => {
        const channels: Channel[] = [
            { label: 'ECG', modality: 'ekg' },
            { label: 'Fp1-Avg', modality: 'eeg' },
            { label: 'Fp2-Avg', modality: 'eeg' },
            { label: 'T7-Avg', modality: 'eeg' },
            { label: 'T8-Avg', modality: 'eeg' },
        ]
        const labels = alignedChannelLabels(channels, ch => ch.modality === 'eeg')
        expect(labels).toEqual(['', 'Fp1', 'Fp2', 'T7', 'T8'])
        // Signal i belongs to channel i: the left temporal label sits where the left temporal signal is.
        expect(labels.indexOf('T7')).toBe(channels.findIndex(ch => ch.label === 'T7-Avg'))
    })

    test('an unfiltered montage gives every label at its own index', () => {
        const channels: Channel[] = [{ label: 'C3', modality: 'eeg' }, { label: 'C4', modality: 'eeg' }]
        expect(alignedChannelLabels(channels, () => true)).toEqual(['C3', 'C4'])
    })
})
