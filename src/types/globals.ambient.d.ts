/**
 * Ambient global declarations for the viewer. The `window.__EPICURRENTS__` slot itself is declared by
 * `@epicurrents/core` (and the interface's `announce` field is merged in by {@link ./core-global-augment}), so
 * this file only declares the bare `__EPICURRENTS__` alias for non-`window` access and the Chrome /
 * FileSystemAPI surface the viewer relies on.
 *
 * Kept separate from {@link ./globals.d.ts} so host pages that `import type { EpicurrentsGlobal }` from
 * {@link ./epicurrents-global} don't pull in this ambient block; pulling it in would declaration-merge onto a
 * host's own `Window` declarations.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { EpicurrentsGlobal as ViewerEpicurrentsGlobal } from './epicurrents-global'

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
     * Bare (non-`window`) alias of the global. `@epicurrents/core` declares `Window.__EPICURRENTS__`; this
     * covers code that reads `__EPICURRENTS__` without the `window.` prefix.
     */
    const __EPICURRENTS__: ViewerEpicurrentsGlobal
    interface Window {
        chrome: unknown
        global: Window
        PUBLIC_URL: string
        showDirectoryPicker: (options?: OpenDirectoryOptions) => Promise<FileSystemDirectoryHandle>
        showOpenFilePicker: (options?: OpenFileOptions) => Promise<FileSystemFileHandle[]>
        showSaveFilePicker: (options?: SaveFileOptions) => Promise<FileSystemFileHandle>
    }
}
export {}
