/**
 * Epicurrents Interface global property types.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { App } from 'vue'
import { ApplicationConfig } from '@epicurrents/core/types'

/* eslint-disable */
/**
 * `EpicurrentsGlobal` (the `window.__EPICURRENTS__` shape) is defined in a
 * standalone non-ambient module so host pages can `import type` it without
 * pulling in the ambient `declare global` block below — mixing the two
 * triggers TypeScript declaration merging and clashes the host's
 * `Window.__EPICURRENTS__` against the viewer's.
 */
export type { EpicurrentsGlobal } from './epicurrents-global'
import type { EpicurrentsGlobal } from './epicurrents-global'
export type ApplicationInterfaceConfig = ApplicationConfig & {
    /**
     * List of modules to load on application start.
     */
    activeModules?: string[]
    /**
     * Views to activate on application start.
     */
    activeViews?: string[]
    /**
     * Allow authenticating connections over insecure HTTP.
     */
    allowInsecureAuth?: boolean
    /**
     * Id of the application instance to launch. Multiple instance support is not yet implemented so setting this
     * option has no practical effect.
     */
    appId?: string
    /**
     * Name to display as the application title.
     */
    appName?: string
    /**
     * Id of the container that will house the application. Defaults to "epicurrents" if left blank.
     */
    containerId?: string
    /**
     * Should the application be mounted inside a shadow DOM.
     */
    embedded?: boolean
    /**
     * Is the application running in production mode.
     */
    isProduction?: boolean
    /**
     * Locale to start the application in (two letter locale code, e.g. 'en').
     */
    locale?: string
    /**
     * List of modules to load on application start.
     */
    modules?: {
        /**
         * Module setup properties or URL pointing to the module setup JSON file.
         */
        [mod in SupportedModule]?: ModuleConfiguration | string
    }
    /**
     * Path from which to load pyodide assets (pyodide parameter`indexUrl`).
     */
    pyodideAssetPath?: string
    /**
     * Maximum size of the biosignal signal cache in mebibytes (MiB).
     */
    signalCacheMaxSize?: number
    /**
     * Should the pyodide service be used.
     */
    usePyodide?: boolean
    /**
     * User authentication configuration. Following options are allowed:
     * - `string`: This name is used as the user name for this application instance.
     * - `object`: An object containing the following optional fields.
     *      - `authenticationBackend`: Optional URL of the user authentication backend service.
     *      - `nameOptions`: Optional preset user names for login selection.
     *  - `null`: No user authentication is used, and no user information is stored.
     */
    user?: {
        /**
         * URL of the user authentication backend service for use without preset name options.
         * The API must accept POST requests with JSON body containing `username` and `password` fields, and return a
         * JSON response with a `success` boolean field indicating the authentication result.
         * If not set, the name the user enters is accepted as-is without further authentication.
         */
        authenticationBackend?: string
        /**
         * Available user names for login selection.
         * The option that the user selects will be accepted as-is without further authentication.
         * If not set, a text input field is shown.
         */
        nameOptions?: { label?: string, name: string }[]
    } | null
}
/**
 * Setup properties for interface modules.
 */
export type ModuleConfiguration = {
    /** Override the module name properties. */
    moduleName?: {
        full?: string
        short?: string
    },
}
/**
 * Modules that are supported in the interface.
 */
export type SupportedModule = 'api' | 'doc' | 'edf' | 'eeg' |  'emg' | 'htm' | 'ncs' | 'pdf' | 'tab' | 'wav'
// The ambient `declare global` block (the `Window.__EPICURRENTS__` declaration
// and the FileSystemAPI surface) lives in `./globals.ambient.d.ts`, so files
// that `import type` from here don't pull the ambient declarations along.
export {}
