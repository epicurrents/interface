/**
 * Epicurrents Interface Vuex store PDF document module.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { ActionContext } from "vuex"
import type { InterfaceResourceModule, State } from "#store"
import type { DocumentResource } from "@epicurrents/core/types"
import type { PaginatedDocumentResource } from "@epicurrents/doc-module/types"
import { loadAsyncComponent } from "#util"
import Log from "scoped-event-log"
import { useDocumentContext } from '../doc'
import type { ModuleConfiguration } from '#types/globals'
import type { CommonInterfaceSettings } from '#types/config'

const SCOPE = "vue-interface-doc-module"

export const runtime = {
    __proto__: null,
    moduleName: {
        code: 'pdf',
        full: 'Documents',
        short: 'Docs',
    },
    async applyConfiguration (_config: ModuleConfiguration) {

    },
    getControlsComponent: () => {
        return loadAsyncComponent(() => import('./components/PdfControls.vue'))
    },
    getFooterComponent: () => {
        return loadAsyncComponent(() => import('#app/footers/DefaultFooter.vue'))
    },
    getViewerComponent: () => {
        return loadAsyncComponent(() => import('./components/PdfViewer.vue'))
    },
    /** This method must be overridden by parent. */
    setPropertyValue (_property, _value) {
        Log.warn(`setPropertyValue method in 'pdf' has not been overridden, state will not be altered.`, SCOPE)
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
    DECREASE_SCALE = 'pdf.decrease-scale',
    INCREASE_SCALE = 'pdf.increase-scale',
    NEXT_PAGE = 'pdf.next-page',
    PREVIOUS_PAGE = 'pdf.previous-page',
    SET_PAGE_NUMBER = 'pdf.set-page-number',
    SET_SCALE = 'pdf.set-scale',
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
        const resource = activeSet.resources.filter(ctx => ctx.resource.isActive)[0].resource as PaginatedDocumentResource
        if (resource.modality !== 'pdf' && resource.modality !== 'htm') {
            return
        }
        if (resource && resource.scale > 0.5) {
            injectee.commit('pdf.set-scale', { resource: resource, value: Math.max(0.5, resource.scale - 0.1) })
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
        const resource = activeSet.resources.filter(ctx => ctx.resource.isActive)[0].resource as PaginatedDocumentResource
        if (resource.modality !== 'pdf' && resource.modality !== 'htm') {
            return
        }
        if (resource && resource.scale < 2) {
            injectee.commit('pdf.set-scale', { resource: resource, value: Math.min(2, resource.scale + 0.1) })
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
        const resource = activeSet.resources.filter(ctx => ctx.resource.isActive)[0].resource as PaginatedDocumentResource
        if (resource.modality !== 'pdf') {
            return
        }
        if (resource && resource.numPages > resource.currentPage) {
            injectee.commit('pdf.set-page-number', { resource: resource, value: resource.currentPage + 1 })
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
        const resource = activeSet.resources.filter(ctx => ctx.resource.isActive)[0].resource as PaginatedDocumentResource
        if (resource.modality !== 'pdf') {
            return
        }
        if (resource && resource.currentPage > 1) {
            injectee.commit('pdf.set-page-number', { resource: resource, value: resource.currentPage - 1 })
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
        const resource = activeSet.resources.filter(ctx => ctx.resource.isActive)[0].resource as PaginatedDocumentResource
        if (resource.modality !== 'pdf') {
            return
        }
        if (resource && payload > 0 && resource.numPages >= payload) {
            injectee.commit('pdf.set-page-number', { resource: resource, value: payload })
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
        const resource = activeSet.resources.filter(ctx => ctx.resource.isActive)[0].resource as PaginatedDocumentResource
        if (resource.modality !== 'pdf' && resource.modality !== 'htm') {
            return
        }
        if (isNaN(payload) || typeof payload !== 'number' || payload < 0.5 || payload > 2) {
            Log.warn(`Invalid scale value: ${payload}. Must be a number between 0.5 and 2.`, SCOPE)
            return
        }
        if (resource && resource.scale !== payload) {
            injectee.commit('pdf.set-scale', { resource: resource, value: payload })
        }
    },
}

export const mutations = {
    // Datasets
    [DocumentActionTypes.SET_PAGE_NUMBER] () {
        // Simply broadcast that this action was validated.
    },
    [DocumentActionTypes.SET_SCALE] () {
        // Simply broadcast that this action was validated.
    },
}

export const settings: CommonInterfaceSettings = {
    __proto__: null,
    _userDefinable: {},
    compatibleView: 'media',
}

// Export the document scope hook.
export { useDocumentContext }
