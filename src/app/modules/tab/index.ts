/**
 * Epicurrents Interface Vuex store Tab data module.
 * @package    epicurrents/interface
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { type ActionContext } from "vuex"
import { EpiCStore, type InterfaceResourceModule, type State } from "#store"
import { safeObjectFrom } from '@epicurrents/core/util'
import type { DocumentResource, Modify } from "@epicurrents/core/types"
import type { TabDataModuleSettings, TabularDataResource } from "@epicurrents/tab-module/types"
import { loadAsyncComponent } from "#util"
import { Log } from "scoped-event-log"
import { useContext } from '#config'
import { ModuleConfiguration } from '#types/globals'
import { CommonInterfaceSettings } from '#root/src/types/config'

const SCOPE = "vue-interface-tab-module"

export const runtime = {
    moduleName: {
        code: 'tab',
        full: 'Tabular data',
        short: 'TabData',
    },
    async applyConfiguration (_config: ModuleConfiguration) {

    },
    getControlsComponent: () => {
        return loadAsyncComponent(() => import('./components/TabControls.vue'))
    },
    getFooterComponent: () => {
        return loadAsyncComponent(() => import('#app/footers/DefaultFooter.vue'))
    },
    getViewerComponent: () => {
        return loadAsyncComponent(() => import('./components/TabViewer.vue'))
    },
    /** This method must be overridden by parent. */
    setPropertyValue (_property, _value) {
        Log.warn(`setPropertyValue method in 'tab' has not been overridden, state will not be altered.`, SCOPE)
    },
    resourceLifecycleHooks: {
        beforeDestroy (_resource: DocumentResource) {

        },
        created (_resource: DocumentResource) {

        },
        destroyed (_resource: DocumentResource) {

        },
    },
} as InterfaceResourceModule

enum DocumentActionTypes {
    DECREASE_SCALE = 'tab.decrease-scale',
    INCREASE_SCALE = 'tab.increase-scale',
    SET_SCALE = 'tab.set-scale',
}

export const actions = {
    // General document
    [DocumentActionTypes.DECREASE_SCALE] (injectee: ActionContext<State, State>) {
        const activeSet = injectee.state.APP.activeDataset
        if (!activeSet) {
            return
        }
        if (!activeSet.resources) {
            return
        }
        const resource = activeSet.resources.filter(ctx => ctx.resource.isActive)[0].resource
        const active = (resource.activeChildResource || resource) as DocumentResource
        if (active.modality !== 'tab') {
            return
        }
        if (active && active.scale > 0.5) {
            injectee.commit('tab.set-scale', { resource: active, value: Math.max(0.5, active.scale - 0.1) })
        }
    },
    [DocumentActionTypes.INCREASE_SCALE] (injectee: ActionContext<State, State>) {
        const activeSet = injectee.state.APP.activeDataset
        if (!activeSet) {
            return
        }
        if (!activeSet.resources) {
            return
        }
        const resource = activeSet.resources.filter(ctx => ctx.resource.isActive)[0].resource
        const active = (resource.activeChildResource || resource) as DocumentResource
        if (active.modality !== 'tab') {
            return
        }
        if (active && active.scale < 2) {
            injectee.commit('tab.set-scale', { resource: active, value: Math.min(2, active.scale + 0.1) })
        }
    },
    [DocumentActionTypes.SET_SCALE] (injectee: ActionContext<State, State>, payload: number) {
        const activeSet = injectee.state.APP.activeDataset
        if (!activeSet) {
            return
        }
        if (!activeSet.resources) {
            return
        }
        const resource = activeSet.resources.filter(ctx => ctx.resource.isActive)[0].resource
        const active = (resource.activeChildResource || resource) as DocumentResource
        if (active.modality !== 'tab') {
            return
        }
        if (isNaN(payload) || typeof payload !== 'number' || payload < 0.5 || payload > 2) {
            Log.warn(`Invalid scale value: ${payload}. Must be a number between 0.5 and 2.`, SCOPE)
            return
        }
        if (active && active.scale !== payload) {
            injectee.commit('tab.set-scale', { resource: active, value: payload })
        }
    },
}

export const mutations = {
    [DocumentActionTypes.SET_SCALE] () {
        // Simply broadcast that this action was validated.
    },
}

export const settings: CommonInterfaceSettings = safeObjectFrom({
    _userDefinable: {},
    annotations: {
        saveToDataset: false,
    },
    compatibleView: 'media',
})

/**
 * Get scoped component properties for the tabular data scope.
 * @param store - The vuex store object.
 * @param component - Possible calling component name.
 * @returns Scoped component properties.
 */
export const useTabDataContext = (store: EpiCStore, component?: string) => {
    const scopeProps = useContext(store, 'tab', component)
    const typifiedProps = scopeProps as Modify<typeof scopeProps, {
        /**
         * Currently active document settings.
         * @remarks
         * These scoped properties are only meant to be used inside components that display
         * data from active resources and expect that active recording cannot be null.
         */
        SETTINGS: typeof scopeProps['SETTINGS'] & TabDataModuleSettings
    }>
    return {
        /**
         * Currently active tabular data resource.
         * @remarks
         * These scoped properties are only meant to be used inside components that display
         * data from active resources and expect that active recording cannot be null.
         */
        RESOURCE: store.getters.getActiveResource() as TabularDataResource,
        ...typifiedProps,
    }
}
