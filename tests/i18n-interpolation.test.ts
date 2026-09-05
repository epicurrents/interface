/**
 * Every interpolating translation call must have an entry in the English locale.
 *
 * vue-i18n returns the key verbatim when no message matches it, without running the
 * message compiler over it — so a `$t('Peak at {t} ms', { t })` whose key is absent from
 * the locale renders the literal `{t}` to the user. The failure is silent everywhere
 * except the screen: the call site looks correct, the build succeeds, and nothing warns
 * (the i18n instance sets `silentFallbackWarn` and `silentTranslationWarn`).
 *
 * The locale therefore registers placeholder-bearing keys as identity mappings, English
 * to identical English, purely so the compiler runs. This test asserts that convention
 * holds for every call site rather than for the ones someone remembered.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Resolved from the working directory rather than `import.meta.url`, which this runner
// does not give as a file: URL. Asserted below so a moved test scans nothing loudly.
const SRC = resolve(process.cwd(), 'src')

/** Source files that can carry a translation call. */
const sourceFiles = (dir: string): string[] => {
    const found: string[] = []
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) {
            found.push(...sourceFiles(path))
        } else if (path.endsWith('.vue') || path.endsWith('.ts')) {
            found.push(path)
        }
    }
    return found
}

/** Keys the English locale defines, as they appear quoted at the start of an entry. */
const localeKeys = (): Set<string> => {
    const locale = readFileSync(join(SRC, 'i18n/locales/en.ts'), 'utf-8')
    const keys = new Set<string>()
    for (const match of locale.matchAll(/^\s*'([^']+)':/gm)) {
        keys.add(match[1])
    }
    for (const match of locale.matchAll(/^\s*"([^"]+)":/gm)) {
        keys.add(match[1])
    }
    return keys
}

/**
 * Translation calls that pass a named-parameter object, with their key.
 *
 * Matches both `$t(...)` and the `T(...)` helper, and joins a key split across
 * concatenated string literals — a long message is usually written that way, and the
 * key vue-i18n looks up is the concatenation.
 */
const interpolatingCalls = (source: string): { key: string, line: number }[] => {
    const call = /(?:\$t|\bT)\(\s*((?:'[^']*'|"[^"]*")(?:\s*\+\s*(?:'[^']*'|"[^"]*"))*)\s*,\s*\{/g
    const calls: { key: string, line: number }[] = []
    for (const match of source.matchAll(call)) {
        const key = [...match[1].matchAll(/'([^']*)'|"([^"]*)"/g)]
            .map(part => part[1] ?? part[2])
            .join('')
        if (key.includes('{')) {
            calls.push({ key, line: source.slice(0, match.index).split('\n').length })
        }
    }
    return calls
}

describe('i18n interpolation', () => {
    it('finds the source tree', () => {
        expect(existsSync(join(SRC, 'i18n/locales/en.ts')), `no source tree at ${SRC}`).toBe(true)
    })

    it('every interpolating call has an English locale entry', () => {
        const keys = localeKeys()
        const missing: string[] = []
        for (const path of sourceFiles(SRC)) {
            for (const { key, line } of interpolatingCalls(readFileSync(path, 'utf-8'))) {
                if (!keys.has(key)) {
                    missing.push(`${relative(SRC, path)}:${line} — ${key}`)
                }
            }
        }
        expect(missing, `these render their placeholders literally:\n  ${missing.join('\n  ')}`).toEqual([])
    })
})
