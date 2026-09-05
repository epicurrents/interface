/**
 * Emit the package's TypeScript declarations, then make their import specifiers portable.
 *
 * `tsc` writes the `#`-prefixed path aliases into the emitted declarations verbatim. Those aliases
 * are this package's own tsconfig, so a consumer resolving them gets "cannot find module" on every
 * type the package exposes — which is indistinguishable, from the consumer's side, from the package
 * shipping no types at all. Each one is therefore rewritten to a relative path into the emitted
 * tree, resolved against what was actually written rather than assumed: a directory alias becomes
 * an explicit `/index` so the result holds under any module-resolution mode.
 *
 * Run as part of `npm run build`. See tsconfig.types.json for why this is plain `tsc`.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { execSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')
const outDir = join(root, 'dist')

/** Every emitted declaration file, depth first. */
function declarations (dir) {
    const found = []
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) {
            found.push(...declarations(path))
        } else if (path.endsWith('.d.ts')) {
            found.push(path)
        }
    }
    return found
}

/**
 * Resolve an alias to a path inside the emitted tree, or null when nothing was emitted for it.
 *
 * A null is not silently dropped: the caller leaves the specifier alone and reports it, because an
 * alias with no emitted target means the declaration references something this build did not write.
 */
function resolveAlias (specifier) {
    const target = join(outDir, specifier.slice(1))
    if (existsAsFile(`${target}.d.ts`)) {
        return target
    }
    if (existsAsFile(join(target, 'index.d.ts'))) {
        return join(target, 'index')
    }
    return null
}

function existsAsFile (path) {
    try {
        return statSync(path).isFile()
    } catch {
        return false
    }
}

/**
 * Copy hand-written `.d.ts` sources into the emitted tree.
 *
 * `tsc` passes them through without emitting, so a declaration importing one — every reference to
 * `#types/globals`, for instance — would point at a file the package does not ship. Ambient files
 * are deliberately left behind: they declare into the global scope, and a consumer that picked up
 * this package's `*.vue` shim would have it apply to its own components.
 */
function copyDeclarationSources (dir) {
    let copied = 0
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) {
            copied += copyDeclarationSources(path)
            continue
        }
        if (!path.endsWith('.d.ts') || path.endsWith('.ambient.d.ts') || path.endsWith('.shim.d.ts')) {
            continue
        }
        const target = join(outDir, relative(srcDir, path))
        mkdirSync(dirname(target), { recursive: true })
        copyFileSync(path, target)
        copied++
    }
    return copied
}

execSync('npx tsc -p tsconfig.types.json', { cwd: root, stdio: 'inherit' })
const copied = copyDeclarationSources(srcDir)

const unresolved = []
let rewritten = 0
for (const file of declarations(outDir)) {
    const source = readFileSync(file, 'utf-8')
    const updated = source.replace(/(from\s+|import\s*\()(["'])(#[^"']+)\2/g, (whole, lead, quote, specifier) => {
        // A sibling workspace package. tsc prefers this alias over the bare specifier the source
        // wrote, because the mapping matches where the file actually sits; a consumer has no such
        // mapping, so it goes back to the package name. `dist/types` normalises to the `types`
        // subpath both packages export, which the deeper path is not.
        const sibling = specifier.match(/^#workspace\/([^/]+)\/([^/]+)\/(.*)$/)
        if (sibling) {
            const [, group, pkg, rest] = sibling
            // The scoped packages publish their types under a `types` subpath and not at the deeper
            // path the alias names; the unscoped utilities export both, so their path stands.
            const name = group === 'epicurrents' ? `@epicurrents/${pkg}` : pkg
            const path = group === 'epicurrents' ? rest.replace(/^dist\/types/, 'types') : rest
            rewritten++
            return `${lead}${quote}${name}/${path}${quote}`
        }
        // `#root/src/…` names a source file by package-relative path rather than through the `#`
        // alias, and resolves into the emitted tree the same way once the `src/` prefix is dropped.
        const target = specifier.startsWith('#root/src/')
            ? resolveAlias(`#${specifier.slice('#root/src/'.length)}`)
            : specifier.startsWith('#root/') ? null : resolveAlias(specifier)
        if (!target) {
            unresolved.push(`${relative(root, file)}: ${specifier}`)
            return whole
        }
        let path = relative(dirname(file), target).split('\\').join('/')
        if (!path.startsWith('.')) {
            path = `./${path}`
        }
        rewritten++
        return `${lead}${quote}${path}${quote}`
    })
    if (updated !== source) {
        writeFileSync(file, updated)
    }
}

if (unresolved.length) {
    console.error(`Declarations reference aliases with no emitted target:\n  ${unresolved.join('\n  ')}`)
    process.exit(1)
}
console.info(
    `Declarations emitted (${copied} hand-written .d.ts copied); rewrote ${rewritten} alias import(s).`
)
