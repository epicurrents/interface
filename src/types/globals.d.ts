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
 * Epicurrents properties available in the global scope.
 */
type EpicurrentsGlobal = {
    /**
     * Master event bus for broadcasting application events.
     */
    EVENT_BUS: import('#events/types').ScopedEventBus | null
    /**
     * Runtime state manager of the initiated application (null before initiation).
     * @remarks
     * This property is required by the core application.
     */
    RUNTIME: import('@epicurrents/core/dist/types/application').StateManager | null
    /**
     * Initial application setup. This constant can be defined in the file or script that
     * loads the main epicurrents interface script to control what features are available
     * at application startup.
     *
     * Features can also be defined using URL search parameters in the following fashion:
     * - `log`: either `DEBUG`, `INFO`, `WARN`, or `ERROR`.
     * - `mods`: A comma-separated list of study modules to load.
     * - `services`: A comma-separated list of services to load.
     * - `sab`: Including this in the search string will use SharedArrayBuffer integration, if available.
     */
    SETUP: ApplicationInterfaceConfig
}
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
    /** User properties if user authentication is in use. */
    user?: {
        /**
         * URL of the user authentication backend service.
         * If not set, users may select whichever name they want.
         */
        authenticationBackend?: string
        /** Available user names for login selection. If not set, an input field is shown. */
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
type OpenDirectoryOptions = {
    /**
     * By specifying an ID, the browser can remember different directories for different IDs. If the same ID is used
     * for another picker, the picker opens in the same directory.
     */
    id?: string
    /**
     * A string that defaults to "read" for read-only access or "readwrite" for read and write access to the directory.
     */
    mode?: 'read' | 'readwrite'
    /**
     * A FileSystemHandle or a well known directory ("desktop", "documents", "downloads", "music", "pictures", or
     * "videos") to open the dialog in.
     */
    startIn?: FileSystemHandle | string
}
type OpenFileOptions = {
    /**
     * A boolean value that defaults to false. By default the picker should include an option to not apply any file
     * type filters (instigated with the type option below). Setting this option to true means that option is not
     * available.
     */
    excludeAcceptAllOption?: boolean
    /**
     * By specifying an ID, the browser can remember different directories for different IDs. If the same ID is used
     * for another picker, the picker opens in the same directory.
     */
    id?: string
    /**
     * A boolean value that defaults to false. When set to true multiple files may be selected.
     */
    multiple?: boolean
    /**
     * A FileSystemHandle or a well known directory ("desktop", "documents", "downloads", "music", "pictures", or
     * "videos") to open the dialog in.
     */
    startIn?: FileSystemHandle | string
    /**
     * An Array of allowed file types to pick. Each item is an object with the following options:
     * - `accept`: An Object with the keys set to the MIME type and the values an Array of file extensions.\
     *             For example `{ "image/*": [".png", ".gif", ".jpeg", ".jpg"] }`.
     * - `description`: An optional description of the category of files types allowed. Defaults to an empty string.
     */
    types?: { accept: { [type: string]: string[] }, description: string }[]
}
type SaveFileOptions = {
    /**
     * A boolean value that defaults to false. By default the picker should include an option to not apply any file
     * type filters (instigated with the type option below). Setting this option to true means that option is not
     * available.
     */
    excludeAcceptAllOption?: boolean
    /**
     * By specifying an ID, the browser can remember different directories for different IDs. If the same ID is used
     * for another picker, the picker opens in the same directory.
     */
    id?: string
    /**
     * A FileSystemHandle or a well known directory ("desktop", "documents", "downloads", "music", "pictures", or
     * "videos") to open the dialog in.
     */
    startIn?: FileSystemHandle | string
    /**
     * The suggested file name.
     */
    suggestedName?: string
    /**
     * An Array of allowed file types to pick. Each item is an object with the following options:
     * - `accept`: An Object with the keys set to the MIME type and the values an Array of file extensions.\
     *             For example `{ "image/*": [".png", ".gif", ".jpeg", ".jpg"] }`.
     * - `description`: An optional description of the category of files types allowed. Defaults to an empty string.
     */
    types?: { accept: { [type: string]: string[] }, description: string }[]
}
/**
 * Modules that are supported in the interface.
 */
export type SupportedModule = 'api' | 'doc' | 'edf' | 'eeg' |  'emg' | 'htm' | 'ncs' | 'pdf' | 'tab' | 'wav'
declare global {
    /**
     * Epicurrents global properties.
     * - EVENT_BUS: Master event bus for broadcasting application events.
     * - RUNTIME: Runtime state manager of the initiated application.
     * - SETUP: Initial setup properties.
     */
    declare const __EPICURRENTS__: EpicurrentsGlobal
    interface Window {
        /**
         * Epicurrents global properties.
         * - EVENT_BUS: Master event bus for broadcasting application events.
         * - RUNTIME: Runtime state manager of the initiated application.
         * - SETUP: Initial setup properties.
         */
        __EPICURRENTS__: EpicurrentsGlobal
        /**
         * This is a the Chrome app API available in Chromium-based browsers but undefined in others.
         * We can use its presence to determine if the browser is Chromium-based or not.
         */
        chrome: unknown
        /**
         * The global variable used by some dependency libraries must point to the window object.
         */
        global: Window
        /**
         * URL base used to load OHIF assets.
         */
        PUBLIC_URL: string
        /**
         * Experimental FileSystemAPI directory picker. May not be available in the user's browser.
         * @param options - Options for the picker; optional.
         * @returns Promise of a FileSystemDirectoryHandle.
         */
        showDirectoryPicker: (options?: OpenDirectoryOptions) => Promise<FileSystemDirectoryHandle>
        /**
         * Experimental FileSystemAPI file picker. May not be available in the user's browser.
         * @param options - Options for the picker; optional.
         * @returns Promise of a FileSystemDirectoryHandle.
         */
        showOpenFilePicker: (options?: OpenFileOptions) => Promise<FileSystemFileHandle[]>
        /**
         * Experimental FileSystemAPI file saver. May not be available in the user's browser.
         * @param options - Options for the picker; optional.
         * @returns Promise of a FileSystemDirectoryHandle.
         */
        showSaveFilePicker: (options?: SaveFileOptions) => Promise<FileSystemFileHandle>
    }
}
export {}
