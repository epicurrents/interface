/**
 * Ambient global declarations for the viewer (`window.__EPICURRENTS__` plus the
 * Chrome / FileSystemAPI surface). Split out from {@link ./globals.d.ts} so
 * host pages that `import type { EpicurrentsGlobal } from './epicurrents-global'`
 * — which transitively reaches globals.d.ts via `ApplicationInterfaceConfig`
 * — don't pull in this ambient block. Pulling it in causes declaration
 * merging on the host's own `Window.__EPICURRENTS__` declaration and clashes
 * the host's looser `SETUP: Record<string, unknown>` against the viewer's
 * strict `SETUP: ApplicationInterfaceConfig`.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { EpicurrentsGlobal } from './epicurrents-global'

/* eslint-disable */

type OpenDirectoryOptions = {
    id?: string
    mode?: 'read' | 'readwrite'
    startIn?: FileSystemHandle | string
}

type OpenFileOptions = {
    excludeAcceptAllOption?: boolean
    id?: string
    multiple?: boolean
    startIn?: FileSystemHandle | string
    types?: { accept: { [type: string]: string[] }, description: string }[]
}

type SaveFileOptions = {
    excludeAcceptAllOption?: boolean
    id?: string
    startIn?: FileSystemHandle | string
    suggestedName?: string
    types?: { accept: { [type: string]: string[] }, description: string }[]
}

declare global {
    /**
     * Epicurrents global properties.
     * - EVENT_BUS: Master event bus for broadcasting application events.
     * - RUNTIME: Runtime state manager of the initiated application.
     * - SETUP: Initial setup properties.
     */
    declare const __EPICURRENTS__: EpicurrentsGlobal
    interface Window {
        __EPICURRENTS__: EpicurrentsGlobal
        chrome: unknown
        global: Window
        PUBLIC_URL: string
        showDirectoryPicker: (options?: OpenDirectoryOptions) => Promise<FileSystemDirectoryHandle>
        showOpenFilePicker: (options?: OpenFileOptions) => Promise<FileSystemFileHandle[]>
        showSaveFilePicker: (options?: SaveFileOptions) => Promise<FileSystemFileHandle>
    }
}
export {}
