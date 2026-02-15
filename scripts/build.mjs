/**
 * Build existing dependencies from source.
 */

import { buildDependency, packages } from './util.mjs'

console.info("Building dependencies...")

packages.forEach(pkg => {
    buildDependency(pkg)
})

console.info("Done building dependencies.")
