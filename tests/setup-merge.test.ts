import { describe, expect, it } from 'vitest'
import { mergeConfig } from '../src/setups/merge'

/** The shape the interface ships as its own default, reduced to the parts the merge has to keep. */
const defaults = () => ({
    activeModules: [] as string[],
    appName: 'EpiCurrents',
    modules: {
        eeg: {
            cascadeMontages: {
                'default:10-20': [{ id: 'ekg', label: 'EKG cascade' }],
            },
        },
    },
    useSAB: true,
})

describe('mergeConfig', () => {
    it('keeps module defaults a host did not name', () => {
        // The case the recursion exists for: a provider cannot be expressed in JSON, so a host that
        // needs one supplies `modules` and would otherwise take the whole key with it.
        const leadFieldProvider = () => null
        const merged = mergeConfig(defaults(), { modules: { eeg: { leadFieldProvider } } })
        expect(merged.modules.eeg).toHaveProperty('leadFieldProvider', leadFieldProvider)
        expect(merged.modules.eeg.cascadeMontages['default:10-20']).toHaveLength(1)
    })
    it('lets a host override a default it does name', () => {
        const merged = mergeConfig(defaults(), { appName: 'Platform', useSAB: false })
        expect(merged.appName).toBe('Platform')
        expect(merged.useSAB).toBe(false)
    })
    it('replaces an array rather than concatenating or padding it', () => {
        // Splicing two montage lists together would yield a list neither side asked for, and a
        // shorter host list must not leave the default's trailing entries behind.
        const merged = mergeConfig(defaults(), {
            activeModules: ['eeg'],
            modules: { eeg: { cascadeMontages: { 'default:10-20': [] } } },
        })
        expect(merged.activeModules).toEqual(['eeg'])
        expect(merged.modules.eeg.cascadeMontages['default:10-20']).toEqual([])
    })
    it('applies sources in ascending order of precedence', () => {
        const merged = mergeConfig(defaults(), { appName: 'First' }, { appName: 'Second' })
        expect(merged.appName).toBe('Second')
    })
    it('merges the same key across sources instead of letting the last one win alone', () => {
        const merged = mergeConfig(
            defaults(),
            { modules: { eeg: { trends: { defaultType: 'aeeg' } } } },
            { modules: { eeg: { trends: { showStrip: false } } } },
        )
        expect(merged.modules.eeg).toMatchObject({ trends: { defaultType: 'aeeg', showStrip: false } })
        expect(merged.modules.eeg.cascadeMontages['default:10-20']).toHaveLength(1)
    })
    it('skips absent sources and absent values', () => {
        // A page that declares a key it has no value for must not blank the default underneath.
        const merged = mergeConfig(defaults(), undefined, null, { appName: undefined })
        expect(merged.appName).toBe('EpiCurrents')
    })
    it('carries a null value through, because null is a value', () => {
        const merged = mergeConfig(defaults(), { appName: null })
        expect(merged.appName).toBe(null)
    })
    it('does not alias a source object, so later mutation of either leaves the other alone', () => {
        const source = { modules: { eeg: { trends: { defaultType: 'aeeg' } } } }
        const merged = mergeConfig(defaults(), source)
        source.modules.eeg.trends.defaultType = 'spectrogram'
        expect(merged.modules.eeg).toMatchObject({ trends: { defaultType: 'aeeg' } })
    })
    it('keeps a function, class instance and array by reference', () => {
        // Anything whose identity matters is carried whole; merging into one would produce a value
        // the source never described.
        class Provider { id = 'p' }
        const fn = () => null
        const instance = new Provider()
        const list = ['eeg']
        const merged = mergeConfig(defaults(), { modules: { eeg: { fn, instance } }, activeModules: list })
        expect(merged.modules.eeg).toHaveProperty('fn', fn)
        expect(merged.modules.eeg).toHaveProperty('instance', instance)
        expect(merged.activeModules).toBe(list)
    })
    it('leaves Object.prototype alone when a source names a prototype key', () => {
        // The untrusted-input case: SETUP can be JSON a page parsed from a URL.
        const hostile = JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"polluted": true}}')
        const merged = mergeConfig(defaults(), hostile)
        expect(({} as Record<string, unknown>).polluted).toBeUndefined()
        expect(Object.hasOwn(merged, 'constructor')).toBe(false)
    })
    it('builds prototype-free objects for keys the target does not already hold', () => {
        const merged = mergeConfig(Object.create(null) as { modules?: object }, { modules: { eeg: {} } })
        expect(Object.getPrototypeOf(merged.modules)).toBe(null)
    })
    it('returns the target it was given, mutated in place', () => {
        const target = defaults()
        expect(mergeConfig(target, { appName: 'Platform' })).toBe(target)
        expect(target.appName).toBe('Platform')
    })
})
