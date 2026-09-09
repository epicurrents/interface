/**
 * Epicurrents Interface standalone entry script.
 *
 * The script can be used to automatically create an Epicurrents application instance on page load.
 * It attempts to fetch a local configuration file at `epicurrents-config.json` and uses it to launch the application.
 * If the file is not found, it falls back to using global settings defined in `window.__EPICURRENTS__.SETUP`.
 *
 * The setup it launches is `setups/full.example`, unless the checkout holds a `*.local.ts` setup
 * beside it — the same arrangement the builder's profiles use, where a gitignored local edition may
 * name packages a public one may not. Everything under `src/setups/` is gitignored apart from this
 * file, the framework entry and the examples, so a developer wiring up a reader that has no public
 * release writes their setup there instead of into the example, which every external developer
 * builds and which can therefore only import published packages.
 *
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { ApplicationInterfaceConfig } from '#types/globals'
import * as exampleSetup from '#setups/full.example'
import { Log } from 'scoped-event-log'

/** Setup module shape: whatever `createEpicurrentsApp` a setup file exports. */
type SetupModule = { createEpicurrentsApp: (config?: ApplicationInterfaceConfig) => unknown }

// A glob rather than an import, because the file is usually absent: a static import of a missing
// module is a build error, while a glob that matches nothing is an empty object.
const localSetups = import.meta.glob<SetupModule>('./*.local.ts', { eager: true })
const localNames = Object.keys(localSetups)
if (localNames.length > 1) {
    Log.warn(
        `Found ${localNames.length} local setups (${localNames.join(', ')}); using ${localNames[0]}.`,
        'standalone'
    )
}
const { createEpicurrentsApp } = localNames.length
                                 ? localSetups[localNames[0]]
                                 : exampleSetup as unknown as SetupModule
if (localNames.length) {
    Log.info(`Using the local setup ${localNames[0]}.`, 'standalone')
}

// Try to fetch local settings JSON and launch the app instance.
const configUrl = new URL(`epicurrents-config.json`, window.__EPICURRENTS__.SETUP.assetPath)
fetch(configUrl)
    .then(response => response.json())
    .then(data => {
        Log.debug('Creating app with local settings.', 'standalone')
        // Create the app with the fetched settings.
        createEpicurrentsApp(data)
    })
    .catch(() => {
        Log.debug(
            window.__EPICURRENTS__.SETUP.isProduction
            ? 'Local configuration not found, creating app with global settings.'
            : `Local configuration cannot be found at ${configUrl}, creating app with global settings.`,
            'standalone'
        )
        createEpicurrentsApp(window.__EPICURRENTS__.SETUP)
    })
