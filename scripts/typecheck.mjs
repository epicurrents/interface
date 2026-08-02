/**
 * Type-check the interface, honouring the INCLUDE_MODULES allowlist so a targeted distro type-checks only the
 * modules it ships. Empty INCLUDE_MODULES type-checks everything (the full build). A non-empty list excludes
 * every `src/app/modules/<name>/` UI dir not in the list, plus the all-in `full.example.ts` reference
 * (and `standalone.ts`, which imports it) — otherwise vue-tsc would pull the omitted modules' packages in via
 * the src include glob and fail when a targeted clone hasn't installed them. Mirrors the bundle-side
 * exclusion in the vite configs so the type-check matches what actually ships.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { readdirSync, writeFileSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const include = (process.env.INCLUDE_MODULES || '')
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0)

function run (args) {
    execSync(`npx vue-tsc ${args}`, { cwd: root, stdio: 'inherit' })
}

if (!include.length) {
    // Full type-check.
    run('-p tsconfig.json')
} else {
    const modalityDirs = readdirSync(join(root, 'src', 'app', 'modules'), { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
    const excluded = modalityDirs.filter(name => !include.includes(name))
    const exclude = [
        'node_modules',
        ...excluded.map(name => `src/app/modules/${name}/**/*`),
        // The all-in reference setup (and the standalone entry that imports it) statically pull in several
        // modality UI dirs and their packages.
        'src/setups/full.example.ts',
        'src/setups/standalone.ts',
    ]
    const tmpConfig = join(root, 'tsconfig.build.tmp.json')
    writeFileSync(tmpConfig, JSON.stringify({ extends: './tsconfig.json', exclude }, null, 4) + '\n')
    console.warn(`Type-checking modules [${include.join(', ')}] — excluding [${excluded.join(', ') || 'none'}].`)
    try {
        run('-p tsconfig.build.tmp.json')
    } finally {
        rmSync(tmpConfig, { force: true })
    }
}
