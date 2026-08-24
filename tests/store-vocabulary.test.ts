/**
 * Test asserting that every store action dispatched by a string literal names an action the store registers.
 *
 * Vuex answers a dispatch for an unregistered action with a console error and a resolved promise, so a
 * mistyped or stale name is not a failure the caller can see — the control moves, nothing happens, and the
 * call site keeps looking like a working channel. This is a source scan rather than a runtime check because
 * the action names live in enums across the store and the eight module index files, and importing those
 * pulls in the whole component tree.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

// Resolved from the working directory rather than `import.meta.url`: under the jsdom environment the module
// URL is not a file URL, so `fileURLToPath` throws at import time.
const SRC = join(process.cwd(), 'src')

/** Collect every `.ts` and `.vue` file under `dir`. */
const sourceFiles = (dir: string): string[] => {
    const found = [] as string[]
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) {
            found.push(...sourceFiles(path))
        } else if (entry.endsWith('.ts') || entry.endsWith('.vue')) {
            found.push(path)
        }
    }
    return found
}

const FILES = sourceFiles(SRC)

/**
 * Drop block comments and whole-line `//` comments, so a dispatch that has been commented out is not read as
 * a live call site. Trailing `//` on a code line is left alone: stripping it would also cut protocol
 * separators out of string literals.
 */
const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '')
                                                .split('\n')
                                                .filter(line => !line.trim().startsWith('//'))
                                                .join('\n')

/**
 * Every string literal assigned in an enum member, which is where both the core `ActionTypes` and each
 * module's own action enum declare their names.
 */
const declaredActions = () => {
    const names = new Set<string>()
    for (const file of FILES) {
        const source = withoutComments(readFileSync(file, 'utf-8'))
        for (const [, name] of source.matchAll(/^\s{4}[A-Z][A-Z0-9_]*\s*=\s*'([^']+)',$/gm)) {
            names.add(name)
        }
    }
    return names
}

/** Every `dispatch('name')` call whose action is a plain string literal. */
const dispatchedActions = () => {
    const calls = [] as { action: string, file: string }[]
    for (const file of FILES) {
        const source = withoutComments(readFileSync(file, 'utf-8'))
        for (const [, action] of source.matchAll(/\.dispatch\(\s*'([^']+)'/g)) {
            calls.push({ action, file: file.slice(SRC.length + 1) })
        }
    }
    return calls
}

describe('store action vocabulary', () => {
    test('every literal dispatch names a declared action', () => {
        const declared = declaredActions()
        const calls = dispatchedActions()
        // Guard against a scan that silently matches nothing: either regex failing quietly would leave an
        // empty comparison and a green test covering no call site at all.
        expect(declared.size).toBeGreaterThan(0)
        expect(calls.length).toBeGreaterThan(0)
        const unknown = calls.filter(call => !declared.has(call.action))
                             .map(call => `${call.action} (${call.file})`)
        expect(unknown).toEqual([])
    })
})
