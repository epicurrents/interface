/**
 * Epicurrents Interface Vuex store app module.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { safeObjectFrom } from '@epicurrents/core/util'
import type { State } from "#store"
import type { DataResource, SafeObject, SettingsValueConstructor } from "@epicurrents/core/types"
import type { HotkeyProperties } from '#types/config'
export type Getters = {
    getActiveResource (state: State): () => DataResource | null
    /** Is SharedArrayBuffer used for memory management. */
    isSabUsed (state: State): () => boolean
}

/**
 * Interface settings.
 */
export type AppModuleSettings = SafeObject & {
    _userDefinable: { [field: string]: SettingsValueConstructor }
    /** Height of the controls bar. */
    controlsBarHeight: string
    /** Timestamp when the user accepted the disclaimer. */
    disclaimerAccepted: number
    /** Require either the alt or option (on Mac) key to trigger hotkey actions. */
    hotkeyAltOrOpt: boolean
    /** Available hotkeys. */
    hotkeys: { [key: string]: HotkeyProperties }
    /** Name of the icons library. */
    iconLib: string
    /** Should the right-click context menu be disabled in the application (in production mode). */
    isContextMenuDisabled: boolean
    /** Is the viewer component expanded beyond its containing element. */
    isExpanded: boolean
    /** Is the app mounted in the main component of the page. */
    isMainComponent: boolean
    /** Mains AC frequency used for default notch filters. */
    mainsFrequency: 50 | 60 | 0
    /** Do not use workers for data processing. */
    noWorkers: boolean
    /** Screen pixels per inch used for calibrating biosignal dimensions. */
    screenPPI: number
    /** Name of the currently logged in user. */
    userName: string
    /** Array of view names to use in the application. */
    useViews: string[]
}

export const getters = {
    getActiveResource: (state: State) => (): DataResource | null => {
        const activeSet = state.APP.activeDataset
        if (!activeSet || activeSet instanceof Promise) {
            return null
        }
        for (const context of activeSet.resources) {
            if (context.resource.isActive) {
                // Return the active child resource if exists, otherwise the parent resource.
                return context.resource.activeChildResource || context.resource
            }
        }
        return null
    },
    isSabUsed: (state: State) => (): boolean => {
        return state.SETTINGS.app.useMemoryManager && typeof window.SharedArrayBuffer !== 'undefined'
    },
}

export const settings = safeObjectFrom({
    _userDefinable: {
        disclaimerAccepted: Number,
        hotkeyAltOrOpt: Boolean,
        mainsFrequency: Number,
        screenPPI: Number,
        theme: String,
        useMemoryManager: Boolean,
        username: String,
    },
    controlsBarHeight: '2.25rem',
    disclaimerAccepted: 0,
    hotkeyAltOrOpt: false,
    hotkeys: {
        dataset: {
            code: 'KeyD',
            control: false,
            key: 'd',
            shift: false,
        },
    },
    iconLib: 'fa',
    isContextMenuDisabled: true,
    isExpanded: false,
    isMainComponent: true,
    mainsFrequency: 50, // Default to 50Hz, can be set to 60Hz for US/Canada.
    noWorkers: false,
    screenPPI: 96,
    userName: '',
    useViews: [],
}) as AppModuleSettings
