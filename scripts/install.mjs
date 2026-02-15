/**
 * Install NPM packages for all dependencies. Installed dependencies should be cleaned of
 * conflicting @epicurrents namespace packages afterwards.
 */

import { installDependency, packages } from './util.mjs'

console.info("Installing dependencies...")

packages.forEach(pkg => {
    installDependency(pkg)
})

console.info("Installing dependencies complete.")
