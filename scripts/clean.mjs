/**
 * When compiling the entire application, especially in development, it is benefitial to use
 * the same package versions for all the modules. Removing the separate packages will force
 * Node to use the packages present in this module.
 *
 * Packages must be cleaned every time new NPM packages are installed or removed in any of
 * the submodules.
 */

import { cleanDependency, packages } from './util.mjs'

console.info("Cleaning dependency modules...")

packages.forEach(pkg => {
    cleanDependency(pkg)
})

console.info("Cleaning dependency modules complete.")
