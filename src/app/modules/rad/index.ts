/**
 * Epicurrents Interface Vuex store radiology module.
 * @package    epicurrents/interface
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { type ActionContext } from "vuex"
import type { Modify } from "@epicurrents/core/types"
import { EpiCStore, type InterfaceResourceModule, type State } from "#store"
import { loadAsyncComponent } from "#util"
import { Log } from "scoped-event-log"
import { useContext } from '#config'
import type { ModuleConfiguration } from '#types/globals'
import type { CommonInterfaceSettings } from '#types/config'
import type { RadiologyModuleSettings, RadiologyResource } from './types'

const SCOPE = "vue-interface-doc-module"

export const runtime = {
    __proto__: null,
    moduleName: {
        code: 'rad',
        full: 'Radiology',
        short: 'Radiology',
    },
    async applyConfiguration (_config: ModuleConfiguration) {

    },
    getControlsComponent: () => {
        return loadAsyncComponent(() => null)
    },
    getFooterComponent: () => {
        return loadAsyncComponent(() => null)
    },
    getViewerComponent: () => {
        return loadAsyncComponent(() => null)
    },
    /** This method must be overridden by parent. */
    setPropertyValue (_property, _value) {
        Log.warn(`setPropertyValue method in 'htm' has not been overridden, state will not be altered.`, SCOPE)
    },
    resourceLifecycleHooks: {
        beforeDestroy (_resource: RadiologyResource) {

        },
        created (_resource: RadiologyResource) {

        },
        destroyed (_resource: RadiologyResource) {

        },
    },
} as InterfaceResourceModule

enum RadiologyActionTypes {
    // An example action type.
    DUMMY = 'dummy',
}

export const actions = {
    // An example action.
    [RadiologyActionTypes.DUMMY] (_injectee: ActionContext<State, State>, payload: number | string | null) {
        runtime.setPropertyValue('dummy', payload)
    },
}

export const settings: CommonInterfaceSettings = {
    __proto__: null,
    _userDefinable: {},
    compatibleView: 'radiology',
}

/**
 * Get scoped component properties for the radiology scope.
 * @param store - The vuex store object.
 * @param component - Possible calling component name.
 * @returns Scoped component properties.
 */
export const useRadiologyContext = (store: EpiCStore, component?: string) => {
    const scopeProps = useContext(store, 'radiology', component)
    const typifiedProps = scopeProps as Modify<typeof scopeProps, {
        /**
         * Currently active radiology settings.
         * @remarks
         * These scoped properties are only meant to be used inside components that display
         * data from active resources and expect that active recording cannot be null.
         */
        SETTINGS: typeof scopeProps['SETTINGS'] & RadiologyModuleSettings
    }>
    return {
        /**
         * Currently ective resource.
         * @remarks
         * These scoped properties are only meant to be used inside components that display
         * data from active resources and expect that active recording cannot be null.
         */
        RESOURCE: store.getters.getActiveResource() as RadiologyResource,
        ...typifiedProps,
    }
}
