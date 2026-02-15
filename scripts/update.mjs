/**
 * Update existing dependencies from repository.
 */

import { packages, updateDependency } from './util.mjs'

console.info("Updating dependencies...")

packages.forEach((pkg) => {
    updateDependency(pkg.name)
})

console.info("Done updating dependencies.")
