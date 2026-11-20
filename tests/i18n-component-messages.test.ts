/**
 * A component's own messages are found under `components.<Name>.` before the root messages are consulted.
 *
 * Message keys are English sentences, and vue-i18n reads a key as a dotted path, so a sentence with a period in it is
 * a path into nothing: without the message resolver, `components.X.Please wait...` never matches the entry the
 * component's file has for `Please wait...`, and the call silently falls through to the root or to the key itself.
 * A key with placeholders then renders them literally.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { App } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import { init, resolveMessage, T } from '../src/i18n'

/** Key shapes, each with a period, a space, a placeholder or punctuation vue-i18n's path parser treats specially. */
const KEYS = [
    'Plain',
    'Two words',
    'Ends with period.',
    'Please wait...',
    'Count: {count}. Length: {l}',
    'e.g. this',
    'Voltage / Δ ({unit})',
    'Has: colon',
]

describe('resolveMessage', () => {
    const scoped = Object.fromEntries(KEYS.map(key => [key, `own ${key}`]))
    const root = Object.fromEntries(KEYS.map(key => [key, `root ${key}`]))
    const i18n = createI18n({
        fallbackLocale: 'en',
        locale: 'fi',
        messageResolver: resolveMessage,
        messages: {
            en: { components: { X: scoped }, nested: { inner: 'nested inner' }, ...root },
            fi: {},
        },
        missingWarn: false,
        fallbackWarn: false,
    })
    const t = (key: string) => i18n.global.t(key, { count: 1, l: 2, unit: 'uV' })

    it.each(KEYS)('finds the component entry for %j', key => {
        expect(t(`components.X.${key}`)).toBe(`own ${key}`.replace('{count}', '1').replace('{l}', '2')
            .replace('{unit}', 'uV'))
    })

    it.each(KEYS)('finds the root entry for %j', key => {
        expect(t(key)).toBe(`root ${key}`.replace('{count}', '1').replace('{l}', '2').replace('{unit}', 'uV'))
    })

    it('reads a key that is no literal entry as a path into nested messages', () => {
        expect(t('nested.inner')).toBe('nested inner')
    })

    it('reports a key a component does not have as missing rather than reading the root', () => {
        expect(t('components.Y.Plain')).toBe('components.Y.Plain')
    })
})

describe('T', () => {
    init({ use: () => undefined } as unknown as App, 'fi')

    it('interpolates a key from the component file', () => {
        expect(T('Peak at {t} ms', 'SourceLocalizationTool', { t: 12 })).toBe('Peak at 12 ms')
    })

    it('interpolates a key from the component file that ends in a period', () => {
        expect(T('The recording is {duration} s long.', 'SignalExportDialog', { duration: 30 }))
            .toBe('The recording is 30 s long.')
    })

    it('reads nested messages from the component file', () => {
        expect(T('welcome.title', 'WelcomeDialog')).toBe('Welcome to Epicurrents!')
    })

    it('falls back to the root messages for a key the component does not have', () => {
        expect(T('Day {d}', 'SourceLocalizationTool', { d: 2 })).toBe('Day 2')
    })

    it('falls back to the key for a message nobody has', () => {
        expect(T('Setting up montages.', 'EegViewer')).toBe('Setting up montages.')
    })
})
