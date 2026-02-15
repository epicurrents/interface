/**
 * This script initialiazes the chosen set of dependencies for development, cloning the latest
 * versions directly from repository.
 * Original method from https://stackoverflow.com/a/20643568.
 */

import { initDependency, packages } from './util.mjs'

console.info("Cloning and initializing missing dependencies...")

packages.forEach((pkg) => {
    initDependency(pkg)
})

console.info("Done initializing dependencies.")
