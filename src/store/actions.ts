/**
 * Epicurrents Interface Vuex store actions.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { ActionContext } from "vuex"
import type { State } from "#store"
import { Log } from "scoped-event-log"
import { MixedMediaDataset } from "@epicurrents/core"
import type {
    ConnectorType,
    DataResource,
    DatasourceConnector,
    Entries,
    FileSystemItem,
} from "@epicurrents/core/types"
import { MutationTypes } from './mutations'
import { applicationViews, useContext } from '#config'
import type { InterfaceComponent } from '#types/config'
import type { WebDAVClient } from 'webdav'

const SCOPE = "StoreActions"

export type ScopedResource = {
    /** Application scope for the resource. */
    scope: string
    resource: DataResource
}
export type ConnectorProperties = UrlWithCredentials & {
    /** Name of the connector displayed in the UI. */
    name: string
    /** Type of the connector. */
    type: ConnectorType
    /** Optional mapping of database column names to property names. */
    nameMap?: Record<string, string>
    /** Access mode for the connector (`r`ead, `w`rite, or `r`ead-`w`rite; default `r`). */
    mode?: 'r' | 'rw' | 'w'
    /** Optional override properties for the return StudyContext. */
    overrideProperties?: Record<string, any>
    /** Optional parameter method for database connectors. */
    paramMethod?: 'get' | 'inject' | 'post'
    /** Optional override for the WebDAV client instance. */
    wdClient?: WebDAVClient
}
export type UrlWithCredentials = {
    /** URL to the resource. */
    url: string
    /** Username for basic authentication. */
    username: string
    /** Password for basic authentication. */
    password: string
}

/**
 * Map of components and their associated styles.
 */
const COMPONENT_STYLES = new Map<string, string[]>()

/**
 * Disable all other resources, except for the resource at `index`.
 * @param index - Index of the resource to skip (null will disable all resources)
 */
const disableAllOtherResources = async (state: State, skip: DataResource | null) => {
    // In these methods we check for isActive before assigning it to false,
    // because every assignment triggers possible property update watchers.
    if (state.APP.activeDataset) {
        for (const item of state.APP.activeDataset.resources) {
            if (item.resource.isActive && (!skip || (item.resource.id !== skip.id))) {
                // Wait for resource deactivation to finish.
                let resolveDeact: () => void
                const deactPromise = new Promise<void>((resolve) => {
                    resolveDeact = resolve
                })
                item.resource.onPropertyChange('isActive', () => {
                    resolveDeact()
                    item.resource.removeAllEventListeners('disableAllOtherResources')
                }, 'disableAllOtherResources')
                item.resource.isActive = false
                const useMemoryManager = useContext({ state }, item.resource.modality).SETTINGS.useMemoryManager &&
                                         state.SETTINGS.app.useMemoryManager
                if (useMemoryManager) {
                    // Don't proceed until the resource has been fully deactivated.
                    await deactPromise
                }
            }
        }
        return
    }
    /*
    for (let i=0; i<injectee.state.DOC.resources.length; i++) {
        const doc = injectee.state.DOC.resources[i]
        if (doc.isActive &&(!skip || (scope !== 'document' || doc.id !== skip.id))) {
            doc.isActive = false
        }
    }
    for (let i=0; i<injectee.state.EEG.resources.length; i++) {
        const eeg = injectee.state.EEG.resources[i]
        if (eeg.isActive && (!skip || (scope !== 'eeg' || eeg.id !== skip.id))) {
            eeg.isActive = false
        }
    }
    for (let i=0; i<injectee.state.EMG.resources.length; i++) {
        const emg = injectee.state.EMG.resources[i]
        if (emg.isActive && (!skip || (scope !== 'emg' || emg.id !== skip.id))) {
            emg.isActive = false
        }
    }
    for (let i=0; i<injectee.state.NCS.resources.length; i++) {
        const ncs = injectee.state.NCS.resources[i]
        if (ncs.isActive && (!skip || (scope !== 'ncs' || ncs.id !== skip.id))) {
            ncs.isActive = false
        }
    }
    for (let i=0; i<injectee.state.MEG.resources.length; i++) {
        const meg = injectee.state.MEG.resources[i]
        if (meg.isActive && (!skip || (scope !== 'meg' || meg.id !== skip.id))) {
            meg.isActive = false
        }
    }
    */
}

export enum ActionTypes {
    _DUMMY = '_dummy',
    ACCEPT_DISCLAIMER = 'accept-disclaimer',
    ADD_COMPONENT_STYLES = 'add-component-styles',
    ADD_CONNECTOR = 'add-connector',
    ADD_RESOURCE = 'add-resource',
    DISPLAY_CALLOUT = 'display-callout',
    DISPLAY_VIEWER = 'display-viewer',
    LOAD_DATASET_FOLDER = 'load-dataset-folder',
    LOAD_DATASET_PROGRESS = 'load-dataset-progress',
    LOAD_STUDY_FILE = 'load-study-file',
    LOAD_STUDY_FOLDER = 'load-study-folder',
    LOAD_STUDY_URL = 'load-study-url',
    OVERLAY_CLICKED = 'overlay-clicked',
    POINTER_LEFT_APP = 'pointer-left-app',
    REDO_ACTION = 'redo-action',
    REMOVE_CONNECTOR = 'remove-connector',
    SET_ACTIVE_RESOURCE = 'set-active-resource',
    SET_ACTIVE_MODALITY = 'set-active-modality',
    SET_SETTINGS_VALUE = 'set-settings-value',
    SET_UI_COMPONENT_VISIBLE = 'set-ui-component-visible',
    SET_VIEW = 'set-view',
    TOGGLE_DIALOG = 'toggle-dialog',
    TOGGLE_EXPAND_VIEWER = 'toggle-expand-viewer',
    TOGGLE_FULLSCREEN = 'toggle-fullscreen',
    TOGGLE_UI_COMPONENT = 'toggle-ui-component',
    UNDO_ACTION = 'undo-action',
    // Datasets
    ADD_DATASET = 'add-dataset',
    CREATE_DATASET = 'create-dataset',
    SET_ACTIVE_DATASET = 'set-active-dataset',
    // ONNX
    PAUSE_ONNX_RUN = 'pause-onnx-run',
    RUN_ONNX_MODEL = 'run-onnx-model',
    SET_ONNX_MODEL = 'set-onnx-model',
}
export type Actions = {
    // TypeScript can't check the types of dynamically loaded module
    // actions, so this first one is just to avoid type check errors.
    [ActionTypes._DUMMY] (payload: any): any
    [ActionTypes.ACCEPT_DISCLAIMER] (): void
    [ActionTypes.ADD_COMPONENT_STYLES] (payload: { component?: string, styles: string | string[] }): void
    [ActionTypes.ADD_CONNECTOR] (payload: ConnectorProperties): void
    [ActionTypes.ADD_RESOURCE] (payload: ScopedResource): void
    [ActionTypes.DISPLAY_CALLOUT] (payload: { message: string, role: 'confirm' | 'error' | 'warning' }): void
    [ActionTypes.DISPLAY_VIEWER] (): void
    [ActionTypes.LOAD_DATASET_FOLDER] (payload: { folder: FileSystemItem, name?: string, context?: string }): void
    [ActionTypes.LOAD_DATASET_PROGRESS] (payload: { context: 'filesystem' | 'repository', loaded: number, total: number }): void
    [ActionTypes.LOAD_STUDY_FILE] (payload: { loader: string, file: FileSystemItem, name?: string }): void
    [ActionTypes.LOAD_STUDY_FOLDER] (payload: { loader: string, folder: FileSystemItem, name?: string, context?: string }): void
    [ActionTypes.LOAD_STUDY_URL] (payload: { loader: string, url: string, name?: string }): void
    [ActionTypes.OVERLAY_CLICKED] (): void
    [ActionTypes.POINTER_LEFT_APP] (): void
    [ActionTypes.REDO_ACTION] (): void
    [ActionTypes.REMOVE_CONNECTOR] (payload: string): void
    [ActionTypes.SET_ACTIVE_RESOURCE] (payload: DataResource | null): void
    [ActionTypes.SET_ACTIVE_MODALITY] (payload: string): void
    [ActionTypes.SET_SETTINGS_VALUE] (payload: { field: string, value: string | number | boolean }): void
    [ActionTypes.SET_UI_COMPONENT_VISIBLE] (payload: { component: InterfaceComponent, value: boolean }): void
    [ActionTypes.SET_VIEW] (payload: string): void
    [ActionTypes.TOGGLE_DIALOG] (payload: { name: string, value?: boolean }): void
    [ActionTypes.TOGGLE_EXPAND_VIEWER] (payload?: boolean): void
    [ActionTypes.TOGGLE_FULLSCREEN] (): void
    [ActionTypes.TOGGLE_UI_COMPONENT] (payload: InterfaceComponent): void
    [ActionTypes.UNDO_ACTION] (): void
    // Datasets
    [ActionTypes.ADD_DATASET] (payload?: MixedMediaDataset): void
    [ActionTypes.CREATE_DATASET] (payload?: { name: string, connector: DatasourceConnector | null }): void
    [ActionTypes.SET_ACTIVE_DATASET] (payload: MixedMediaDataset | null): void
    // ONNX
    [ActionTypes.PAUSE_ONNX_RUN] (): void
    [ActionTypes.RUN_ONNX_MODEL] (): void
    [ActionTypes.SET_ONNX_MODEL] (payload: string): void
}
export const actions = {
    [ActionTypes.ACCEPT_DISCLAIMER] (injectee: ActionContext<State, State>) {
        injectee.commit(MutationTypes.ACCEPT_DISCLAIMER)
    },
    [ActionTypes.ADD_COMPONENT_STYLES] (
        injectee: ActionContext<State, State>,
        payload: { component?: string, styles: string | string[] }
    ) {
        const styles = Array.isArray(payload.styles) ? payload.styles : [payload.styles as string]
        const newStyles = [] as string[]
        const existing = COMPONENT_STYLES.get(payload.component || 'unknown')
        if (!existing) {
                COMPONENT_STYLES.set(payload.component || 'unknown', styles)
                newStyles.push(...styles)
        } else {
            for (const style of styles) {
                if (!existing.includes(style)) {
                    existing.push(style)
                    newStyles.push(style)
                }
            }
        }
        // Add any new styles.
        injectee.commit(MutationTypes.ADD_STYLES, { component: payload.component || 'unknown', styles: styles })
    },
    [ActionTypes.ADD_CONNECTOR] (injectee: ActionContext<State, State>, payload: ConnectorProperties) {
        injectee.commit(MutationTypes.ADD_CONNECTOR, payload)
    },
    [ActionTypes.ADD_RESOURCE] (injectee: ActionContext<State, State>, payload: ScopedResource) {
        injectee.commit(MutationTypes.ADD_RESOURCE, payload)
    },
    [ActionTypes.DISPLAY_CALLOUT] (
        _injectee: ActionContext<State, State>,
        _payload: { message: string, role: 'confirm' | 'error' | 'warning' }
    ) {
        // Broadcast.
    },
    [ActionTypes.DISPLAY_VIEWER] () {
        // Broadcast.
    },
    [ActionTypes.LOAD_DATASET_FOLDER] (
        injectee: ActionContext<State, State>,
        payload: { folder: FileSystemItem, name?: string, context?: string }
    ) {
        injectee.commit(MutationTypes.LOAD_DATASET_FOLDER, payload)
    },
    [ActionTypes.LOAD_DATASET_PROGRESS] (
        _injectee: ActionContext<State, State>,
        _payload: { context: 'filesystem' | 'repository', loaded: number, total: number }
    ) {
        // Broadcast.
    },
    [ActionTypes.LOAD_STUDY_FILE] (
        injectee: ActionContext<State, State>,
        payload: { file: FileSystemItem, loader: string, name?: string }
    ) {
        let promiseResolve, promiseReject
        const promise = new Promise((resolve, reject) => {
            // This promise is resolved when the study file has loaded
            promiseResolve = resolve
            promiseReject = reject
        })
        injectee.commit(MutationTypes.LOAD_STUDY_FILE, {
            study: payload,
            promise: { resolve: promiseResolve, reject: promiseReject },
        })
        return promise
    },
    [ActionTypes.LOAD_STUDY_FOLDER] (
        injectee: ActionContext<State, State>,
        payload: { folder: FileSystemItem, loader: string, name?: string, context?: string }
    ) {
        let promiseResolve, promiseReject
        const promise = new Promise((resolve, reject) => {
            // This promise is resolved when the study folder has loaded
            promiseResolve = resolve
            promiseReject = reject
        })
        injectee.commit(MutationTypes.LOAD_STUDY_FOLDER, {
            study: payload,
            promise: { resolve: promiseResolve, reject: promiseReject },
        })
        return promise
    },
    [ActionTypes.LOAD_STUDY_URL] (
        injectee: ActionContext<State, State>,
        payload: { loader: string, url: string, name?: string }
    ) {
        let promiseResolve, promiseReject
        const promise = new Promise((resolve, reject) => {
            promiseResolve = resolve
            promiseReject = reject
        })
        injectee.commit(MutationTypes.LOAD_STUDY_URL, {
            study: payload,
            promise: { resolve: promiseResolve, reject: promiseReject },
        })
        return promise
    },
    [ActionTypes.OVERLAY_CLICKED] (injectee: ActionContext<State, State>) {
        injectee.commit(MutationTypes.HIDE_OVERLAY)
    },
    [ActionTypes.POINTER_LEFT_APP] (injectee: ActionContext<State, State>) {
        injectee.commit(MutationTypes.HIDE_OVERLAY)
    },
    [ActionTypes.REDO_ACTION] () {
        // Broadcast that a redo action has been performed.
    },
    [ActionTypes.REMOVE_CONNECTOR] (injectee: ActionContext<State, State>, payload: string) {
        injectee.commit(MutationTypes.REMOVE_CONNECTOR, payload)
    },
    [ActionTypes.SET_ACTIVE_MODALITY] (injectee: ActionContext<State, State>, payload: string) {
        injectee.commit(MutationTypes.SET_ACTIVE_MODALITY, payload)
    },
    [ActionTypes.SET_ACTIVE_RESOURCE] (injectee: ActionContext<State, State>, payload: DataResource | null) {
        // Disable other resources before enabling the new one (to avoid race conditions in shared memory buffer ops).
        disableAllOtherResources(injectee.state, payload).then(() => {
            if (payload) {
                // Make sure the required view is available and active.
                const modView = injectee.state.INTERFACE.modules.get(
                                    payload.activeChildResource?.modality || payload.modality
                                )?.settings?.compatibleView
                if (!modView) {
                    Log.error(
                        `Cannot set active resource, modality '${payload.modality}' is not available.`, SCOPE)
                    return
                }
                if (injectee.state.APP.view.name !== modView) {
                    for (const [key, view] of applicationViews) {
                        if (modView === key) {
                            injectee.commit(MutationTypes.SET_VIEW, view)
                            break
                        }
                    }
                    if (injectee.state.APP.view.name !== modView) {
                        Log.error(
                            `Cannot set active resource, required view '${modView}' is not available.`,
                            SCOPE
                        )
                        return
                    }
                }
            }
            injectee.commit(MutationTypes.SET_ACTIVE_RESOURCE, payload)
        })
    },
    [ActionTypes.SET_SETTINGS_VALUE] (
        injectee: ActionContext<State, State>,
        payload: { field: string, value: string | number | boolean }
    ) {
        injectee.commit(MutationTypes.SET_SETTINGS_VALUE, payload)
    },
    [ActionTypes.SET_UI_COMPONENT_VISIBLE] (
        injectee: ActionContext<State, State>,
        payload: { component: InterfaceComponent, value: boolean }
    ) {
        if (!Object.hasOwn(injectee.state.APP.uiComponentVisible, payload.component)) {
            Log.error(`Cannot set UI component '${payload.component}' visibility.`, SCOPE)
            return
        }
        injectee.commit(MutationTypes.SET_UI_COMPONENT_VISIBLE, payload.value)
    },
    [ActionTypes.SET_VIEW] (injectee: ActionContext<State, State>, payload: string) {
        const view = applicationViews.get(payload)
        if (!view) {
            Log.error(`Cannot set application view to invalid value '${payload}'.`, SCOPE)
            return
        }
        if (injectee.state.APP.view.name === view.name) {
            Log.debug(`Application view '${view.name}' is already active.`, SCOPE)
            return
        }
        injectee.commit(MutationTypes.SET_VIEW, view)
        // Check if we need to apply component defaults.
        type SupportedComponents = Entries<typeof view.components>
        for (const [key, uiCmp] of Object.entries(view.components) as SupportedComponents) {
            if (uiCmp && uiCmp.visible !== null) {
                if (injectee.state.APP.uiComponentVisible[key] !== uiCmp.visible) {
                    injectee.commit(MutationTypes.SET_UI_COMPONENT_VISIBLE, { component: key, value: uiCmp.visible })
                }
            }
        }
    },
    [ActionTypes.TOGGLE_DIALOG] (_injectee: ActionContext<State, State>, _payload: { name: string, value?: boolean }) {
        // Broadcast.
    },
    [ActionTypes.TOGGLE_EXPAND_VIEWER] (injectee: ActionContext<State, State>, payload?: boolean) {
        injectee.commit(MutationTypes.TOGGLE_EXPAND_VIEWER, payload)
    },
    [ActionTypes.TOGGLE_FULLSCREEN] (injectee: ActionContext<State, State>) {
        const appCont = document.querySelector(`#epicurrents${injectee.state.APP.containerId}`) as HTMLDivElement | null
        if (document.fullscreenElement !== null) {
            document.exitFullscreen()
            if (document.fullscreenElement === appCont) {
                return // Don't re-request fullscreen
            }
        }
        appCont?.requestFullscreen()
    },
    [ActionTypes.TOGGLE_UI_COMPONENT] (injectee: ActionContext<State, State>, payload: InterfaceComponent) {
        if (!Object.hasOwn(injectee.state.APP.uiComponentVisible, payload)) {
            Log.error(`Cannot toggle UI component '${payload}'.`, SCOPE)
            return
        }
        injectee.commit(
            MutationTypes.SET_UI_COMPONENT_VISIBLE,
            {
                component: payload,
                value: !injectee.state.APP.uiComponentVisible[payload],
            }
        )
    },
    [ActionTypes.UNDO_ACTION] () {
        // Broadcast that an undo action has been performed.
    },
    // Datasets
    [ActionTypes.ADD_DATASET] (injectee: ActionContext<State, State>, payload?: MixedMediaDataset) {
        if (!payload) {
            payload = new MixedMediaDataset(
                `Dataset ${injectee.state.APP.datasets.length + 1}`
            )
        }
        injectee.commit(MutationTypes.ADD_DATASET, payload)
    },
    [ActionTypes.CREATE_DATASET] (
        _injectee: ActionContext<State, State>,
        _payload?: { name: string, connector: DatasourceConnector | null }
    ) {
        // Broadcast.
        null
    },
    [ActionTypes.SET_ACTIVE_DATASET] (
        injectee: ActionContext<State, State>,
        payload: MixedMediaDataset | number | null
    ) {
        if (payload === null) {
            injectee.commit(MutationTypes.SET_ACTIVE_DATASET, payload)
        } else if (typeof payload === 'number') {
            if (injectee.state.APP.datasets[payload]) {
                injectee.commit(MutationTypes.SET_ACTIVE_DATASET, injectee.state.APP.datasets[payload])
            } else {
                Log.error(`Cannot set active dataset, array index ${payload} is out of bounds.`, SCOPE)
            }
        } else {
            injectee.commit(MutationTypes.SET_ACTIVE_DATASET, payload)
        }
    },
    // ONNX
    [ActionTypes.PAUSE_ONNX_RUN] (injectee: ActionContext<State, State>) {
        if (injectee.state.SERVICES.get('ONNX')) {
            injectee.commit(MutationTypes.PAUSE_ONNX_RUN)
        }
    },
    [ActionTypes.RUN_ONNX_MODEL] (injectee: ActionContext<State, State>) {
        if (injectee.state.SERVICES.get('ONNX')) {
            injectee.commit(MutationTypes.RUN_ONNX_MODEL)
        }
    },
    [ActionTypes.SET_ONNX_MODEL] (injectee: ActionContext<State, State>, payload: string) {
        // TODO: Validate model that is requested somehow.
        if (injectee.state.SERVICES.get('ONNX')) {
            injectee.commit(MutationTypes.SET_ONNX_MODEL, payload)
        }
    },
}
