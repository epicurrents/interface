/**
 * This script initialiazes the chosen set of dependencies for development, cloning the latest
 * versions directly from repository.
 * Original method from https://stackoverflow.com/a/20643568.
 */

import {
    buildDependency,
    cleanDependency,
    initDependency,
    installDependency,
    packages,
} from './util.mjs'

console.info("Setting up dependencies...")
// Perform each step for all packages.
// Possible errors usually occur in the build step so we will have all the previous steps for all the other packages
// performed if that happens.
packages.forEach((pkg) => {
    initDependency(pkg)
})
packages.forEach((pkg) => {
    installDependency(pkg)
})
packages.forEach((pkg) => {
    cleanDependency(pkg)
})
packages.forEach((pkg) => {
    buildDependency(pkg)
})

console.info("Done setting up dependencies.")
