/**
 * Copy each @epicurrents package's self-contained (umd) worker bundles into the
 * interface build's dist/workers directory.
 *
 * Packages are auto-discovered: any @epicurrents/* package whose umd/ directory
 * holds *.worker.js files is copied. Core is copied last so its canonical
 * memory-manager / montage / trend bundles win over the copies webpack inlines
 * into other packages' umd output.
 */

import fs from 'fs'
import path from 'path'
import { rootDir } from './util.mjs'

const scope = path.join(rootDir, 'node_modules', '@epicurrents')
const dest = path.join(rootDir, 'dist', 'workers')

console.info('Copying workers...')
fs.mkdirSync(dest, { recursive: true })

const packages = fs.existsSync(scope)
    ? fs.readdirSync(scope).filter(name => fs.existsSync(path.join(scope, name, 'umd')))
    : []
// Core last — its worker bundles overwrite the copies inlined into other packages.
packages.sort((a, b) => (a === 'core' ? 1 : b === 'core' ? -1 : 0))

for (const pkg of packages) {
    const umd = path.join(scope, pkg, 'umd')
    for (const file of fs.readdirSync(umd)) {
        if (file.endsWith('.worker.js')) {
            console.info(`Copying worker ${pkg}/${file}.`)
            fs.copyFileSync(path.join(umd, file), path.join(dest, file))
        }
    }
}
console.info('Done copying workers.')
