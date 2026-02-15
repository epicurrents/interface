/**
 * Epicurrents Interface Vuex store EMG document module.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { type ActionContext } from "vuex"
import { EpiCStore, type InterfaceResourceModule, type State } from "#store"
import type { DocumentResource, Modify } from "@epicurrents/core/types"
import { loadAsyncComponent } from "#util"
import { Log } from "scoped-event-log"
import { useContext } from '#config'
import { ModuleConfiguration } from '#types/globals'
import type { EmgModuleSettings, EmgResource } from '@epicurrents/emg-module/dist/types'
import type { EmgInterfaceSettings } from './types'

import { settings } from "./config"

const SCOPE = "vue-interface-doc-module"

export const runtime = {
    __proto__: null,
    moduleName: {
        code: 'emg',
        full: 'Electromyography',
        short: 'EMG',
    },
    cursorToolActive: null as string | null,
    openSidebar: null as string | null,
    async applyConfiguration (_config: ModuleConfiguration) {

    },
    getControlsComponent: () => {
        return loadAsyncComponent(() => import('./components/EmgControls.vue'))
    },
    getFooterComponent: () => {
        return loadAsyncComponent(() => import('#app/footers/DefaultFooter.vue'))
    },
    getViewerComponent: () => {
        return loadAsyncComponent(() => import('./components/EmgViewer.vue'))
    },
    /** This method must be overridden in the EMG module. */
    setPropertyValue (_property, _value) {
        Log.warn(`setPropertyValue method in 'emg' has not been overridden, state will not be altered.`, SCOPE)
    },
    resourceLifecycleHooks: {
        beforeDestroy (_resource: DocumentResource) {

        },
        created (_resource: DocumentResource) {

        },
        destroyed (_resource: DocumentResource) {

        },
    },
} as InterfaceResourceModule & {
    /** Name of the cursor tool that is active in the interface, null if no tool is active. */
    cursorToolActive: string | null
    /** Name of the sidebar that is currently open, null if no sidebar is open. */
    openSidebar: string | null
}

enum EmgActionTypes {
    SET_CURSOR_TOOL = 'emg.set-cursor-tool',
    SET_HIGHPASS_FILTER = 'emg.set-highpass-filter',
    SET_LOWPASS_FILTER = 'emg.set-lowpass-filter',
    SET_NOTCH_FILTER = 'emg.set-notch-filter',
    SET_OPEN_SIDEBAR = 'emg.set-open-sidebar',
    SET_SENSITIVITY = 'emg.set-sensitivity',
    SET_TIMEBASE = 'emg.set-timebase',
    TOGGLE_ANNOTATION_SIDEBAR = 'emg.toggle-annotation-sidebar',
}

export const actions = {
    [EmgActionTypes.SET_CURSOR_TOOL] (_injectee: ActionContext<State, State>, payload: string | null) {
        runtime.cursorToolActive = payload
    },
    [EmgActionTypes.SET_HIGHPASS_FILTER] (_injectee: ActionContext<State, State>, payload: number | null) {
        runtime.setPropertyValue('highpass-filter', payload)
    },
    [EmgActionTypes.SET_LOWPASS_FILTER] (_injectee: ActionContext<State, State>, payload: number | null) {
        runtime.setPropertyValue('lowpass-filter', payload)
    },
    [EmgActionTypes.SET_NOTCH_FILTER] (_injectee: ActionContext<State, State>, payload: number | null) {
        runtime.setPropertyValue('notch-filter', payload)
    },
    [EmgActionTypes.SET_OPEN_SIDEBAR] (_injectee: ActionContext<State, State>, payload: string) {
        runtime.openSidebar = payload
    },
    [EmgActionTypes.SET_SENSITIVITY] (_injectee: ActionContext<State, State>, payload: number) {
        runtime.setPropertyValue('sensitivity', payload)
    },
    [EmgActionTypes.SET_TIMEBASE] (_injectee: ActionContext<State, State>, payload: [string, number]) {
        runtime.setPropertyValue('timebase-unit', payload[0])
        runtime.setPropertyValue('timebase', payload[1])
    },
    [EmgActionTypes.TOGGLE_ANNOTATION_SIDEBAR] (_injectee: ActionContext<State, State>, _payload: boolean | undefined ) {
        // This is merely a broadcast.
    },
}

/**
 * Get scoped component properties for the EMG scope.
 * @param store - The vuex store object.
 * @param component - Possible calling component name.
 * @returns Scoped component properties.
 */
export const useEmgContext = (store: EpiCStore, component?: string) => {
    const scopeProps = useContext(store, 'emg', component)
    const typifiedProps = scopeProps as Modify<typeof scopeProps, {
        /**
         * Currently active EMG settings.
         * @remarks
         * These scoped properties are only meant to be used inside components that display
         * data from active resources and expect that active recording cannot be null.
         */
        SETTINGS: typeof scopeProps['SETTINGS'] & EmgModuleSettings & EmgInterfaceSettings
    }>
    return {
        /**
         * Currently active EMG resource.
         * @remarks
         * These scoped properties are only meant to be used inside components that display
         * data from active resources and expect that active recording cannot be null.
         */
        RESOURCE: store.getters.getActiveResource() as EmgResource,
        ...typifiedProps,
    }
}
export { settings }
