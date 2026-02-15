/**
 * Epicurrents Interface Vuex store NCS document module.
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
import type { NcsModuleSettings, NcsResource } from "@epicurrents/ncs-module/dist/types"

import { settings } from "./config"
import type { NcsInterfaceSettings } from "./types"

const SCOPE = "vue-interface-ncs-module"

export const runtime = {
    __proto__: null,
    moduleName: {
        code: 'ncs',
        full: 'Nerve Conduction Study',
        short: 'NCS',
    },
    cursorToolActive: null as string | null,
    openSidebar: null as string | null,
    async applyConfiguration (_config: ModuleConfiguration) {

    },
    getControlsComponent: () => {
        return loadAsyncComponent(() => import('./components/NcsControls.vue'))
    },
    getFooterComponent: () => {
        return loadAsyncComponent(() => import('#app/footers/DefaultFooter.vue'))
    },
    getViewerComponent: () => {
        return loadAsyncComponent(() => import('./components/NcsViewer.vue'))
    },
    /** This method must be overridden in the NCS module. */
    setPropertyValue (_property, _value) {
        Log.warn(`setPropertyValue method in 'ncs' has not been overridden, state will not be altered.`, SCOPE)
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

enum NcsActionTypes {
    SET_CURSOR_TOOL = 'ncs.set-cursor-tool',
    SET_HIGHPASS_FILTER = 'ncs.set-highpass-filter',
    SET_LOWPASS_FILTER = 'ncs.set-lowpass-filter',
    SET_NOTCH_FILTER = 'ncs.set-notch-filter',
    SET_OPEN_SIDEBAR = 'ncs.set-open-sidebar',
    SET_SENSITIVITY = 'ncs.set-sensitivity',
    SET_TIMEBASE = 'ncs.set-timebase',
    TOGGLE_ANNOTATION_SIDEBAR = 'ncs.toggle-annotation-sidebar',
}

export const actions = {
    [NcsActionTypes.SET_CURSOR_TOOL] (_injectee: ActionContext<State, State>, payload: string | null) {
        runtime.cursorToolActive = payload
    },
    [NcsActionTypes.SET_HIGHPASS_FILTER] (_injectee: ActionContext<State, State>, payload: number | null) {
        runtime.setPropertyValue('highpass-filter', payload)
    },
    [NcsActionTypes.SET_LOWPASS_FILTER] (_injectee: ActionContext<State, State>, payload: number | null) {
        runtime.setPropertyValue('lowpass-filter', payload)
    },
    [NcsActionTypes.SET_NOTCH_FILTER] (_injectee: ActionContext<State, State>, payload: number | null) {
        runtime.setPropertyValue('notch-filter', payload)
    },
    [NcsActionTypes.SET_OPEN_SIDEBAR] (_injectee: ActionContext<State, State>, payload: string) {
        runtime.openSidebar = payload
    },
    [NcsActionTypes.SET_SENSITIVITY] (_injectee: ActionContext<State, State>, payload: number) {
        runtime.setPropertyValue('sensitivity', payload)
    },
    [NcsActionTypes.SET_TIMEBASE] (_injectee: ActionContext<State, State>, payload: [string, number]) {
        runtime.setPropertyValue('timebase-unit', payload[0])
        runtime.setPropertyValue('timebase', payload[1])
    },
    [NcsActionTypes.TOGGLE_ANNOTATION_SIDEBAR] (_injectee: ActionContext<State, State>, _payload: boolean | undefined ) {
        // This is merely a broadcast.
    },
}

/**
 * Get scoped component properties for the NCS scope.
 * @param store - The vuex store object.
 * @param component - Possible calling component name.
 * @returns Scoped component properties.
 */
export const useNcsContext = (store: EpiCStore, component?: string) => {
    const scopeProps = useContext(store, 'ncs', component)
    const typifiedProps = scopeProps as Modify<typeof scopeProps, {
        /**
         * Currently active NCS settings.
         * @remarks
         * These scoped properties are only meant to be used inside components that display
         * data from active resources and expect that active recording cannot be null.
         */
        SETTINGS: typeof scopeProps['SETTINGS'] & NcsModuleSettings & NcsInterfaceSettings
    }>
    return {
        /**
         * Currently active NCS resource.
         * @remarks
         * These scoped properties are only meant to be used inside components that display
         * data from active resources and expect that active recording cannot be null.
         */
        RESOURCE: store.getters.getActiveResource() as NcsResource,
        ...typifiedProps,
    }
}
export { settings }
