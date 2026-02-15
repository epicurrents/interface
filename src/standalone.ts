/**
 * Epicurrents Interface standalone entry script.
 *
 * The script can be used to automatically create an Epicurrents application instance on page load.
 * It attempts to fetch a local configuration file at `epicurrents-config.json` and uses it to launch the application.
 * If the file is not found, it falls back to using global settings defined in `window.__EPICURRENTS__.SETUP`.
 *
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { createEpicurrentsApp } from '#setups/default'
import { Log } from 'scoped-event-log'

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
