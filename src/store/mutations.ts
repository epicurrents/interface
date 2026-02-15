/**
 * Epicurrents Interface Vuex store mutations.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { MutationTree } from "vuex"
import { type State } from "#store"
import {
    type DataResource,
    type FileSystemItem,
} from "@epicurrents/core/types"
import Log from "scoped-event-log"
import type { ConnectorProperties, ScopedResource } from "./actions"
import { MixedMediaDataset } from "@epicurrents/core"
import INTERFACE from "#config"
import type { ApplicationView, InterfaceSettings } from "#types/config"
import { DatabaseQueryOptions, WebDAVConnectorOptions } from "#workspace/epicurrents/core/dist/types/connector"

const SCOPE = "StoreMutations"

export enum MutationTypes {
    ACCEPT_DISCLAIMER = 'accept-disclaimer',
    ADD_CONNECTOR = 'add-connector',
    ADD_RESOURCE = 'add-resource',
    ADD_STYLES = 'add-styles',
    HIDE_OVERLAY = 'hide-overlay',
    LOAD_DATASET_FOLDER = 'load-dataset-folder',
    LOAD_STUDY_FILE = 'load-study-file',
    LOAD_STUDY_FOLDER = 'load-study-folder',
    LOAD_STUDY_URL = 'load-study-url',
    REMOVE_CONNECTOR = 'remove-connector',
    SET_ACTIVE_RESOURCE = 'set-active-resource',
    SET_ACTIVE_SCOPE = 'set-active-scope',
    SET_ACTIVE_MODALITY = 'set-active-modality',
    SET_APP_ID = 'set-app-id',
    SET_FULLSCREEN = 'set-fullscreen',
    SET_REDOABLE_ACTION = 'set-redoable-action',
    SET_SETTINGS_VALUE = 'set-settings-value',
    SET_UI_COMPONENT_VISIBLE = 'set-ui-component-visible',
    SET_UNDOABLE_ACTION = 'set-undoable-action',
    SET_VIEW = 'set-view',
    SHOW_OVERLAY = 'show-overlay',
    TOGGLE_EXPAND_VIEWER = 'toggle-expand-viewer',
    TOGGLE_SETTINGS = 'toggle-settings',
    // Datasets
    ADD_DATASET = 'add-dataset',
    SET_ACTIVE_DATASET = 'set-active-dataset',
    // ONNX mutations
    PAUSE_ONNX_RUN = 'pause-onnx-run',
    RUN_ONNX_MODEL = 'run-onnx-model',
    SET_ONNX_MODEL = 'set-onnx-model',
}
export type Mutations<S = State> = {
    [MutationTypes.ACCEPT_DISCLAIMER] (state: S): void
    [MutationTypes.ADD_CONNECTOR] (state: S, payload: ConnectorProperties): void
    [MutationTypes.ADD_RESOURCE] (state: S, payload: ScopedResource): void
    [MutationTypes.ADD_STYLES] (state: S, payload: { component: string, styles: string[] }): void
    [MutationTypes.HIDE_OVERLAY] (state: S): void
    [MutationTypes.LOAD_DATASET_FOLDER] (state: S, payload: { folder: { folder: FileSystemItem, name?: string, context?: string }, promise: any }): void
    [MutationTypes.LOAD_STUDY_FILE] (state: S, payload: { study: { file: FileSystemItem, loader: string, name?: string }, promise: any }): void
    [MutationTypes.LOAD_STUDY_FOLDER] (state: S, payload: { study: { folder: FileSystemItem, loader: string, name?: string, context?: string }, promise: any }): void
    [MutationTypes.LOAD_STUDY_URL] (state: S, payload: { study: { loader: string, url: string, name?: string }, promise: Promise<void> }): void
    [MutationTypes.REMOVE_CONNECTOR] (state: S, payload: string): void
    [MutationTypes.SET_ACTIVE_RESOURCE] (state: S, payload: DataResource | null): void
    [MutationTypes.SET_APP_ID] (state: S, payload: string): void
    [MutationTypes.SET_FULLSCREEN] (state: S, payload: boolean): void
    [MutationTypes.SET_REDOABLE_ACTION] (state: S, payload: boolean): void
    [MutationTypes.SET_SETTINGS_VALUE] (state: S, payload: { field: string, value: string | number | boolean }): void
    [MutationTypes.SET_UI_COMPONENT_VISIBLE] (state: S, payload: { component: string, value: boolean }): void
    [MutationTypes.SET_UNDOABLE_ACTION] (state: S, payload: boolean): void
    [MutationTypes.SET_VIEW] (state: S, payload: ApplicationView): void
    [MutationTypes.SHOW_OVERLAY] (state: S): void
    [MutationTypes.TOGGLE_EXPAND_VIEWER] (state: S, payload?: boolean): void
    [MutationTypes.TOGGLE_SETTINGS] (state: S, payload?: boolean): void
    // Datatest
    [MutationTypes.ADD_DATASET] (state: S, payload: MixedMediaDataset): void
    [MutationTypes.SET_ACTIVE_DATASET] (state: S, payload: MixedMediaDataset | null): void
    // ONNX
    //[MutationTypes.PAUSE_ONNX_RUN] (state: S): void
    //[MutationTypes.RUN_ONNX_MODEL] (state: S): void
    //[MutationTypes.SET_ONNX_MODEL] (state: S, payload: string): void
}
export const mutations: MutationTree<State> & Mutations = {
    [MutationTypes.ACCEPT_DISCLAIMER] (state: State) {
        const acceptTime = Date.now()
        state.INTERFACE.app.disclaimerAccepted = acceptTime
        mutations[MutationTypes.SET_SETTINGS_VALUE](state, { field: 'app.disclaimerAccepted', value: acceptTime })
    },
    [MutationTypes.ADD_CONNECTOR] (state: State, payload: ConnectorProperties) {
        state.addConnector(
            payload.name,
            payload.type,
            payload.url,
            payload.username,
            payload.password,
            payload.type === 'database' ? {
                nameMap: payload.nameMap,
                overrideProperties: payload.overrideProperties,
                paramMethod: payload.paramMethod,
            } as DatabaseQueryOptions : {
                mode: payload.mode,
                client: payload.wdClient,
            } as WebDAVConnectorOptions
        )
    },
    [MutationTypes.ADD_RESOURCE] (state: State, payload: ScopedResource) {
        state.addResource(payload.scope, payload.resource)
    },
    [MutationTypes.ADD_STYLES] (_state: State, _payload: { component: string, styles: string[] }) {
        // I like to keep DOM manipulation in the Vue components, so, this
        // method is only to trigger an update in the root application.
        null
    },
    [MutationTypes.HIDE_OVERLAY] (state: State) {
        state.APP.showOverlay = false
    },
    [MutationTypes.LOAD_DATASET_FOLDER] (_state: State, _payload: unknown) {
        null // For broadcasting.
    },
    [MutationTypes.LOAD_STUDY_FILE] (_state: State, _payload: unknown) {
        null // For broadcasting.
    },
    [MutationTypes.LOAD_STUDY_FOLDER] (_state: State, _payload: unknown) {
        null // For broadcasting.
    },
    [MutationTypes.LOAD_STUDY_URL] (_state: State, _payload: unknown) {
        null // For broadcasting.
    },
    [MutationTypes.REMOVE_CONNECTOR] (state: State, payload: string) {
        state.removeConnector(payload)
    },
    [MutationTypes.SET_ACTIVE_RESOURCE] (state: State, payload: DataResource) {
        state.setActiveResource(payload)
        if (!payload) {
            state.APP.activeModality = ''
        } else {
            state.APP.activeModality = payload.isActive
                                     ? payload.activeChildResource?.modality || payload.modality : ''
        }
    },
    [MutationTypes.SET_ACTIVE_MODALITY] (state: State, payload: string) {
        state.APP.activeModality = payload
    },
    [MutationTypes.SET_APP_ID] (state: State, payload: string) {
        state.APP.id = payload
    },
    [MutationTypes.SET_FULLSCREEN] (state: State, payload: boolean) {
        state.APP.isFullscreen = payload
    },
    [MutationTypes.SET_REDOABLE_ACTION] (state: State, payload: boolean) {
        state.APP.hasRedoableAction = payload
    },
    [MutationTypes.SET_SETTINGS_VALUE] (state: State, payload: { field: string, value: any }) {
        const storeIfValueChanged = (changed: boolean) => {
            if (!changed) {
                return
            }
            // Check if this setting can be stored.
            // Make sure the field contains more than the module name and extract path components.
            if (payload.field.includes('.')) {
                const match = payload.field.match(/^(.+?)\.(.+)$/)
                if (!match) {
                    return
                }
                const [full, mod, field] = match
                const userDef = mod === 'app' ? {
                    ...state.SETTINGS.app._userDefinable,
                    ...state.INTERFACE.app._userDefinable,
                } : {
                    ...state.SETTINGS.modules[mod]._userDefinable,
                    ...(state.INTERFACE.modules.get(mod)?.settings?._userDefinable || {}),
                }
                // Check if value can be set.
                if (userDef) {
                    const valConst = userDef[field as keyof typeof userDef]
                    if (valConst === payload.value.constructor) {
                        const session = JSON.parse(window.sessionStorage.getItem('epicurrents') || '{}')
                        if (!session.settings) {
                            session.settings = {}
                        }
                        session.settings[payload.field] = payload.value
                        window.sessionStorage.setItem('epicurrents', JSON.stringify(session))
                        // Update the setting in locals storage as well if enabled.
                        const local = window.localStorage.getItem('epicurrents')
                        if (local) {
                            const localStorage = JSON.parse(local)
                            if (!localStorage.settings) {
                                localStorage.settings = {}
                            }
                            localStorage.settings[payload.field] = payload.value
                            window.localStorage.setItem('epicurrents', JSON.stringify(localStorage))
                        }
                        Log.debug(`Saved value ${payload.value} to settings field ${full} locally.`, SCOPE)
                    }
                }
            }
        }
        // First try to alter interface settings.
        if (INTERFACE.setFieldValue(payload.field, payload.value)) {
            storeIfValueChanged(true)
            return
        }
        const result = state.setSettingsValue(payload.field, payload.value)
        storeIfValueChanged(result)
    },
    [MutationTypes.SET_UI_COMPONENT_VISIBLE] (state: State, payload: { component: string, value: boolean }) {
        state.APP.uiComponentVisible[payload.component as keyof typeof state.APP.uiComponentVisible] = payload.value
    },
    [MutationTypes.SET_UNDOABLE_ACTION] (state: State, payload: boolean) {
        state.APP.hasUndoableAction = payload
    },
    [MutationTypes.SET_VIEW] (state: State, payload: ApplicationView) {
        state.APP.view = payload
    },
    [MutationTypes.SHOW_OVERLAY] (state: State) {
        state.APP.showOverlay = true
    },
    [MutationTypes.TOGGLE_EXPAND_VIEWER] (state: State, payload?: boolean) {
        if (payload !== undefined) {
            state.INTERFACE.app.isExpanded = payload
        } else {
            state.INTERFACE.app.isExpanded = !state.INTERFACE.app.isExpanded
        }
        // Since this property resides in the interface scope, also trigger property update watchers.
        (state.INTERFACE as InterfaceSettings).onPropertyUpdate('app.isExpanded', state.INTERFACE.app.isExpanded)
    },
    [MutationTypes.TOGGLE_SETTINGS] (state: State, payload?: boolean) {
        if (payload !== undefined) {
            state.APP.settingsOpen = payload
        } else {
            state.APP.settingsOpen = !state.APP.settingsOpen
        }
    },
    // Datasets
    [MutationTypes.ADD_DATASET] (state: State, payload: MixedMediaDataset) {
        state.APP.datasets.push(payload)
        Log.debug(`${payload.name} added.`, SCOPE)
    },
    [MutationTypes.SET_ACTIVE_DATASET] (state: State, payload: MixedMediaDataset | null) {
        state.setActiveDataset(payload)
    },
    // ONNX
    //[MutationTypes.PAUSE_ONNX_RUN] (state: State) {
    //    const ONNX = state.SERVICES.get('ONNX') as OnnxService
    //    ONNX?.pauseRun()
    //},
    //[MutationTypes.RUN_ONNX_MODEL] (state: State) {
    //    const ONNX = state.SERVICES.get('ONNX') as OnnxService
    //    ONNX?.run()
    //},
    //[MutationTypes.SET_ONNX_MODEL] (state: State, payload: string) {
    //    const ONNX = state.SERVICES.get('ONNX') as OnnxService
    //    ONNX?.loadModel(payload)
    //},
}
