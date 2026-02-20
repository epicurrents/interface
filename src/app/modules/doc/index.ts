/**
 * Epicurrents Interface Vuex store HTM document module.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { type ActionContext } from "vuex"
import { EpiCStore, type InterfaceResourceModule, type State } from "#store"
import { safeObjectFrom } from '@epicurrents/core/util'
import type { DocumentResource, Modify } from "@epicurrents/core/types"
import type { DocumentModuleSettings, PaginatedDocumentResource } from "@epicurrents/doc-module/types"
import { loadAsyncComponent } from "#util"
import { Log } from "scoped-event-log"
import { useContext } from '#config'
import { ModuleConfiguration } from '#types/globals'
import { CommonInterfaceSettings } from '#root/src/types/config'

const SCOPE = "vue-interface-doc-module"

export const runtime = {
    moduleName: {
        code: 'htm',
        full: 'Pages',
        short: 'Pages',
    },
    async applyConfiguration (_config: ModuleConfiguration) {

    },
    getControlsComponent: () => {
        return loadAsyncComponent(() => import('./components/HtmControls.vue'))
    },
    getFooterComponent: () => {
        return loadAsyncComponent(() => import('#app/footers/DefaultFooter.vue'))
    },
    getViewerComponent: () => {
        return loadAsyncComponent(() => import('./components/HtmViewer.vue'))
    },
    /** This method must be overridden by parent. */
    setPropertyValue (_property, _value) {
        Log.warn(`setPropertyValue method in 'htm' has not been overridden, state will not be altered.`, SCOPE)
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
    DECREASE_SCALE = 'htm.decrease-scale',
    INCREASE_SCALE = 'htm.increase-scale',
    NEXT_PAGE = 'htm.next-page',
    PREVIOUS_PAGE = 'htm.previous-page',
    SET_PAGE_NUMBER = 'htm.set-page-number',
    SET_SCALE = 'htm.set-scale',
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
        const active = (resource.activeChildResource || resource) as PaginatedDocumentResource
        if (active.modality !== 'htm') {
            return
        }
        if (active && active.scale > 0.5) {
            injectee.commit('htm.set-scale', { resource: active, value: Math.max(0.5, active.scale - 0.1) })
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
        const active = (resource.activeChildResource || resource) as PaginatedDocumentResource
        if (active.modality !== 'htm') {
            return
        }
        if (active && active.scale < 2) {
            injectee.commit('htm.set-scale', { resource: active, value: Math.min(2, active.scale + 0.1) })
        }
    },
        [DocumentActionTypes.NEXT_PAGE] (injectee: ActionContext<State, State>) {
            const activeSet = injectee.state.APP.activeDataset
            if (!activeSet) {
                return
            }
            if (!activeSet.resources) {
                return
            }
            const resource = activeSet.resources.filter(ctx => ctx.resource.isActive)[0].resource
            const active = (resource.activeChildResource || resource) as PaginatedDocumentResource
            if (active.modality !== 'htm') {
                return
            }
            if (active && active.numPages > active.currentPage) {
                injectee.commit('htm.set-page-number', { resource: active, value: active.currentPage + 1 })
            }
        },
        [DocumentActionTypes.PREVIOUS_PAGE] (injectee: ActionContext<State, State>) {
            const activeSet = injectee.state.APP.activeDataset
            if (!activeSet) {
                return
            }
            if (!activeSet.resources) {
                return
            }
            const resource = activeSet.resources.filter(ctx => ctx.resource.isActive)[0].resource
            const active = (resource.activeChildResource || resource) as PaginatedDocumentResource
            if (active.modality !== 'htm') {
                return
            }
            if (active && active.currentPage > 1) {
                injectee.commit('htm.set-page-number', { resource: active, value: active.currentPage - 1 })
            }
        },
        [DocumentActionTypes.SET_PAGE_NUMBER] (injectee: ActionContext<State, State>, payload: number) {
            const activeSet = injectee.state.APP.activeDataset
            if (!activeSet) {
                return
            }
            if (!activeSet.resources) {
                return
            }
            const resource = activeSet.resources.filter(ctx => ctx.resource.isActive)[0].resource
            const active = (resource.activeChildResource || resource) as PaginatedDocumentResource
            if (active.modality !== 'htm') {
                return
            }
            if (active && payload > 0 && active.numPages >= payload) {
                injectee.commit('htm.set-page-number', { resource: active, value: payload })
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
        const active = (resource.activeChildResource || resource) as PaginatedDocumentResource
        if (active.modality !== 'htm') {
            return
        }
        if (isNaN(payload) || typeof payload !== 'number' || payload < 0.5 || payload > 2) {
            Log.warn(`Invalid scale value: ${payload}. Must be a number between 0.5 and 2.`, SCOPE)
            return
        }
        if (active && active.scale !== payload) {
            injectee.commit('htm.set-scale', { resource: active, value: payload })
        }
    },
}

export const mutations = {
    [DocumentActionTypes.SET_PAGE_NUMBER] () {
        // Simply broadcast that this action was validated.
    },
    [DocumentActionTypes.SET_SCALE] () {
        // Simply broadcast that this action was validated.
    },
}

export const settings: CommonInterfaceSettings = safeObjectFrom({
    _userDefinable: {},
    compatibleView: 'media',
})

/**
 * Get scoped component properties for the document scope.
 * @param store - The vuex store object.
 * @param component - Possible calling component name.
 * @returns Scoped component properties.
 */
export const useDocumentContext = (store: EpiCStore, component?: string) => {
    const scopeProps = useContext(store, 'document', component)
    const typifiedProps = scopeProps as Modify<typeof scopeProps, {
        /**
         * Currently active document settings.
         * @remarks
         * These scoped properties are only meant to be used inside components that display
         * data from active resources and expect that active recording cannot be null.
         */
        SETTINGS: typeof scopeProps['SETTINGS'] & DocumentModuleSettings
    }>
    return {
        /**
         * Currently ective Document.
         * @remarks
         * These scoped properties are only meant to be used inside components that display
         * data from active resources and expect that active recording cannot be null.
         */
        RESOURCE: store.getters.getActiveResource() as PaginatedDocumentResource,
        ...typifiedProps,
    }
}
