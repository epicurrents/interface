/**
 * Every icon name the interface offers must resolve to a bundled SVG.
 *
 * The icon library is two tables: `ICON_SVGS` maps a Material Symbols name to the raw SVG imported
 * for it, and `FA_TO_MATERIAL` translates the FontAwesome-style names used in components to those
 * Material names. A component asks for the second kind. If a translation names an asset nothing
 * imported, the resolver returns an empty string and the icon is simply absent — no error, no
 * warning, and nothing in a type-check to notice, because both tables are maps of strings.
 *
 * `FA_TO_MATERIAL` is deliberately not exported, so it is read from the source the way
 * `i18n-interpolation.test.ts` reads the locale.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ICON_SVGS } from '#app/icons'

const SOURCE = readFileSync(resolve(process.cwd(), 'src/app/icons.ts'), 'utf-8')

/** The `FA_TO_MATERIAL` entries, as `[offered name, material name]` pairs. */
const translations = (): [string, string][] => {
    // Anchored on the declaration rather than the name, which also appears in the module docstring.
    const start = SOURCE.indexOf('const FA_TO_MATERIAL')
    const table = SOURCE.slice(start)
    const body = table.slice(table.indexOf('{') + 1, table.indexOf('\n}'))
    return [...body.matchAll(/^\s*'([^']+)':\s*'([^']+)',/gm)].map(m => [m[1], m[2]])
}

describe('the icon library', () => {
    it('reads its translation table from a source the test can still find', () => {
        expect(SOURCE).toContain('FA_TO_MATERIAL')
        expect(translations().length).toBeGreaterThan(50)
    })
    it('imports an SVG for every Material name a translation points at', () => {
        const missing = translations()
            .filter(([, material]) => !ICON_SVGS[material])
            .map(([offered, material]) => `${offered} -> ${material}`)
        expect(missing).toEqual([])
    })
    it('carries an outlined variant for every entry, since that is the resolver default', () => {
        const empty = Object.entries(ICON_SVGS)
            .filter(([, entry]) => !entry.outlined)
            .map(([name]) => name)
        expect(empty).toEqual([])
    })
})
