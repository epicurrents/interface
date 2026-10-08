/**
 * Tests for the trend types a deployment offers through `trends.enabled`: which types are offered and which one a
 * recording opens with, how the configuration is read, and that the module refuses a type it does not offer and an
 * empty strip.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('#config', async (importOriginal) => ({
    ...await importOriginal<typeof import('#config')>(),
    // The maths half of the trend configuration goes to the core module settings, which need a running app.
    applyModuleSettings: vi.fn(),
}))

import { actions, runtime } from '#app/modules/eeg'
import { initialTrend, isTrendOffered, offeredTrends, settings } from '#app/modules/eeg/config'
import { TREND_REGISTRY } from '#app/modules/eeg/trends'
import type { EegModuleConfiguration } from '#app/modules/eeg/types'

const ALL = Object.keys(TREND_REGISTRY)

/** Apply an EEG module configuration; the runtime's signature is the generic one every module shares. */
function configure (config: EegModuleConfiguration) {
    return runtime.applyConfiguration(config)
}

/** Run a module action the way the store would, without a store: none of these read the injectee. */
function dispatch (type: string, payload?: unknown) {
    const action = (actions as Record<string, (injectee: unknown, payload: unknown) => unknown>)[type]
    action({}, payload)
}

afterEach(() => {
    settings.trends.enabled = null
    settings.trends.defaultType = 'aeeg'
    runtime.selectedTrend = 'aeeg'
    runtime.trendVisible = false
})

describe('offered trends', () => {
    it('offers every registered type when nothing is configured', () => {
        expect(offeredTrends()).toEqual(ALL)
        expect(initialTrend()).toBe('aeeg')
    })

    it('offers only the listed types, in registry order', () => {
        settings.trends.enabled = ['spectrogram', 'aeeg']
        expect(offeredTrends()).toEqual(ALL.filter(key => key === 'aeeg' || key === 'spectrogram'))
        expect(isTrendOffered('ratio')).toBe(false)
    })

    it('opens with the first offered type when the default is not offered', () => {
        settings.trends.enabled = ['spectrogram']
        expect(initialTrend()).toBe('spectrogram')
        settings.trends.enabled = []
        expect(initialTrend()).toBeNull()
    })
})

describe('the trends configuration', () => {
    it('selects an offered type even when only the list is given', async () => {
        await configure({ trends: { enabled: ['spectrogram'] } })
        expect(settings.trends.enabled).toEqual(['spectrogram'])
        expect(runtime.selectedTrend).toBe('spectrogram')
    })

    it('drops unknown types rather than offering them', async () => {
        await configure({ trends: { enabled: ['spectrogram', 'spectogram'] } })
        expect(settings.trends.enabled).toEqual(['spectrogram'])
    })

    it('ignores a list that is not a list', async () => {
        await configure({ trends: { enabled: 'spectrogram' as unknown as string[] } })
        expect(settings.trends.enabled).toBeNull()
    })
})

describe('the module actions', () => {
    it('refuses to select a type that is not offered', () => {
        settings.trends.enabled = ['spectrogram']
        runtime.selectedTrend = 'spectrogram'
        dispatch('eeg.set-selected-trend', 'aeeg')
        expect(runtime.selectedTrend).toBe('spectrogram')
        dispatch('eeg.set-selected-trend', 'spectrogram')
        expect(runtime.selectedTrend).toBe('spectrogram')
    })

    it('does not open the strip with nothing offered', () => {
        settings.trends.enabled = []
        dispatch('eeg.set-trend-visible', true)
        expect(runtime.trendVisible).toBe(false)
        dispatch('eeg.toggle-trend-visible')
        expect(runtime.trendVisible).toBe(false)
    })

    it('opens and closes the strip when something is offered', () => {
        settings.trends.enabled = ['spectrogram']
        dispatch('eeg.toggle-trend-visible')
        expect(runtime.trendVisible).toBe(true)
        dispatch('eeg.set-trend-visible', false)
        expect(runtime.trendVisible).toBe(false)
    })
})
