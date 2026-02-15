/**
 * Epicurrents Interface Vuex store.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { App, ComponentPublicInstance } from "vue"
import { createStore, CommitOptions, DispatchOptions, GetterTree, Store, ActionContext } from "vuex"
// Actions
import { Actions, actions } from "./actions"
// Mutations
import { Mutations, mutations } from "./mutations"
// Modules - these are named in all capital letters in the store object
import { getters as appGetters, settings as appSettings, type Getters as AppGetters } from "#app/modules/app"
import INTERFACE_SETTINGS, { applicationViews, useContext } from "#config"
import { WebGlPlot } from '#components'
import { APP_MODULE } from "@epicurrents/core/runtime"
import { SETTINGS } from "@epicurrents/core"
import type {
    AppSettings,
    AssetService,
    RuntimeResourceModule,
    SafeObject,
    SettingsValue,
    StateManager,
} from "@epicurrents/core/types"
import { Log } from "scoped-event-log"
import type {
    AugmentedRuntimeState as State,
    InterfaceSettings,
    AugmentedRuntimeAppModule,
} from "#types/config"
import type { BiosignalPlot } from '#types/plot'
import type { ModuleConfiguration } from '#types/globals'
import { loadAsyncComponent } from "../util"
import { nullPromise, safeObjectFrom } from "@epicurrents/core/util"

// Re-export the AugmentedRuntimeState as State for simplicity and in case it has to be altered in the future.
export { type State }

const SCOPE = "Store"

// Getters
export type Getters = AppGetters & {
    getBiosignalPlot: () => () => BiosignalPlot
    getResourceControls: (type?: string) => () => (new () => ComponentPublicInstance<unknown>)
    getResourceFooter: (type?: string) => () => (new () => ComponentPublicInstance<unknown>)
    getResourceViewer: (type?: string) => () => (new () => ComponentPublicInstance<unknown>)
}

/**
 * Epicurrents Interface Vuex store types.
 */
export type EpiCStore = Omit<
    Store<State>,
    'getters' | 'commit' | 'dispatch'
> & {
    commit<K extends keyof Mutations, P extends Parameters<Mutations[K]>[1]>(
        key: K | string,
        payload?: P,
        options?: CommitOptions
    ): ReturnType<Mutations[K]>
    dispatch<K extends keyof Actions, P extends Parameters<Actions[K]>[0]>(
        key: K | string,
        payload?: P,
        options?: DispatchOptions
    ): ReturnType<Actions[K]>
} & {
    getters: {
        [K in keyof Getters]: ReturnType<Getters[K]>
    }
}
export type InterfaceResourceModule = RuntimeResourceModule & {
    applyConfiguration: (config: ModuleConfiguration) => Promise<void>
    getControlsComponent: () => new () => ComponentPublicInstance<unknown>
    getFooterComponent: () => new () => ComponentPublicInstance<unknown>
    getViewerComponent: () => new () => ComponentPublicInstance<unknown>
    resourceLifecycleHooks: {
        beforeDestroy: (resource: unknown) => void
        created: (resource: unknown) => void
        destroyed: (resource: unknown) => void
    }
}
export type ResourceModuleContext = {
    runtime: InterfaceResourceModule
    actions?: {
        [name: string]: ((
            injectee: ActionContext<State, State>,
            payload: any
        ) => unknown)
    }
    mutations?: {
        [name: string]: ((state: State, payload: unknown) => any)
    }
    schemas?: SafeObject & {
        [name: string]: unknown
    }
    settings?: SafeObject & {
        [name: string]: unknown
    }
}
const stateModules = new Map<string, InterfaceResourceModule>()
const stateServices = new Map<string, AssetService>()
/**
 * Initial store state that contains placeholders for all the relevant properties. It is replaced by the main
 * application's tuntime state.
 */
const state: State = {
    __proto__: null,
    APP: APP_MODULE as AugmentedRuntimeAppModule,
    INTERFACE: INTERFACE_SETTINGS,
    MODULES: stateModules,
    SERVICES: stateServices,
    SETTINGS: SETTINGS,
    WORKERS: new Map(),
    // Properties required by RuntimeState.
    id: '',
    isActive: false,
    modality: '',
    name: '',
    addConnector (_name, _url, _username, _password, _mode?, _wdClient?) {},
    addDataset (_dataset, _setAsActive?) {},
    addEventListener (_pattern, _handler, _caller?) {},
    addResource (_scope, _resource, _setAsActive?) {},
    configure (_config, _schema, _resource) {},
    deactivateResource (_resource) {},
    destroy () { return new Promise(() => {}) },
    dispatchEvent (_event, _phase, _detail) { return false },
    dispatchPayloadEvent (_event, _payload, _phase) { return false },
    dispatchPropertyChangeEvent(_property, _newValue, _oldValue, _phase?, _event?) { return false },
    getEventHooks (_event, _subscriber) { return { after () {}, before () {}, unsubscribe () {} } },
    getService (_name) { return undefined },
    getWorkerOverride (_name) { return null },
    init (_initValues) {},
    loadDatasetFolder (_folder, _loader, _studyLoaders, _config) { return new Promise(() => {}) },
    onPropertyChange (_property, _handler, _subscriber, _phase?) {},
    removeAllEventListeners (_subscriber?) {},
    removeEventListener (_pattern, _handler) {},
    removeConnector (_name) {},
    removeResource (_resource, _dataset) {},
    serialize () { return {} },
    setActiveDataset (_dataset) {},
    setActiveResource (_resource) {},
    setModule (_name, _module) {},
    setModulePropertyValue (_module, _property, _value) {},
    setService (_name, _service) {},
    setSettingsValue (_field, _value) { return false },
    setWorkerOverride (_name, _getWorker) {},
    subscribe(_event, _callback, _subscriber, _phase?) {},
    unsubscribe (_event, _callback, _subscriber, _phase?) {},
    unsubscribeAll (_subscriber?) {},
}

//type ModuleAction = (injectee: ActionContext<State, State>, payload: any) => unknown
//type ModuleMutation = (state: State, payload: any) => unknown

export interface InterfaceStoreManager {
    instance: EpiCStore | null
    addModule (name: string, module: ResourceModuleContext): void
    addService: (name: string, service: AssetService) => void
    /**
     * Initialize a Vuex store in the given Vue app instance.
     * @param appInstance Vue instance, will call vueInstance.use(store) if supplied
     * @param initValues optional values as an object of { field: value } pairs (e.g. { SETTINGS: { 'eeg.trace.margin.top': 10 } })
     * @returns Vuex store instance
     */
    init: (appInstance?: App, initValues?: { [module: string]: any }) => EpiCStore
    /**
     * Load and apply possible locally saved settings.
     */
    loadLocalSettings (): void
}

export default class AppStore implements InterfaceStoreManager {
    private isInitialized = false
    private modules = new Map<string, InterfaceResourceModule>()
    private runtime = null as State | null
    private services = new Map<string, AssetService>()
    private store: Store<State>

    constructor (runtimeState?: StateManager) {
        if (!runtimeState) {
            // This should only be used in testing.
            Log.warn(`Store was initialized without a runtime state. Only basic functionality is available.`, SCOPE)
        } else {
            this.runtime = runtimeState as State
            // Replace the empty interface property with our interface settings.
            this.runtime.INTERFACE = state.INTERFACE
            // Add interface properties.
            Object.assign(this.runtime.APP, {
                activeScope: '',
                activeModality: '',
                componentStyles: [],
                containerId: '',
                hasRedoableAction: false,
                hasUndoableAction: false,
                isFullscreen: false,
                plots: new Map<string, BiosignalPlot | null>(),
                settingsOpen: false,
                shadowRoot: null,
                showOverlay: false,
                uiComponentVisible: {
                    controls: true,
                    footer: true,
                    navigator: true,
                },
                view: applicationViews.get('default'),
            })
        }
        const getters: GetterTree<State, State> & Getters = {
            getBiosignalPlot: () => {
                if (!this.runtime!.APP.plots.get('biosignal')) {
                    this.runtime!.APP.plots.set('biosignal', new WebGlPlot())
                }
                return (() => this.runtime!.APP.plots.get('biosignal') as BiosignalPlot)
            },
            getResourceControls: () => {
                const resModality = appGetters.getActiveResource(this.store.state)()?.modality
                if (!resModality) {
                    return () => loadAsyncComponent(() => nullPromise)
                }
                const resourceMod = this.modules.get(resModality)
                if (!resourceMod) {
                    return () => loadAsyncComponent(() => nullPromise)
                }
                return resourceMod.getControlsComponent
            },
            getResourceFooter: () => {
                const resModality = appGetters.getActiveResource(this.store.state)()?.modality
                if (!resModality) {
                    return () => loadAsyncComponent(() => nullPromise)
                }
                const resourceMod = this.modules.get(resModality)
                if (!resourceMod) {
                    return () => loadAsyncComponent(() => nullPromise)
                }
                return resourceMod.getFooterComponent
            },
            getResourceViewer: () => {
                const resModality = appGetters.getActiveResource(this.store.state)()?.modality
                if (!resModality) {
                    return () => loadAsyncComponent(() => nullPromise)
                }
                const resourceMod = this.modules.get(resModality)
                if (!resourceMod) {
                    return () => loadAsyncComponent(() => nullPromise)
                }
                return resourceMod.getViewerComponent
            },
            ...appGetters,
        }
        this.store = createStore({
            state: this.runtime || state,
            actions,
            getters,
            mutations,
            devtools: false,
        })
    }

    get instance () {
        return this.store
    }

    addModule (
        name: string,
        module: ResourceModuleContext
    ) {
        Log.debug((`Adding a new module ${name}.`), SCOPE)
        // Override runtime property value setter.
        module.runtime.setPropertyValue = (property: string, value: unknown) => {
            this.runtime?.setModulePropertyValue(modKey, property, value)
        }
        const modKey = name.toLowerCase()
        this.modules.set(modKey, module.runtime)
        if (module.actions) {
            Object.assign(actions, module.actions)
        }
        if (module.mutations) {
            Object.assign(mutations, module.mutations)
        }
        const modConfig = safeObjectFrom({
            schemas: module.schemas,
            settings: module.settings,
        })
        if (module.settings) {
            (state.INTERFACE as InterfaceSettings).modules.set(name, modConfig)
        }
        this.store.hotUpdate({ actions: actions, mutations: mutations })
    }

    addService (name: string, service: AssetService) {
        Log.debug((`Adding a new service ${name}.`), SCOPE)
        const serviceKey = name.toLowerCase()
        this.services.set(serviceKey, service)
    }

    init = (appInstance?: App) => {
        if (this.isInitialized) {
            Log.warn(`Tried to initialize an already initialized store.`, SCOPE)
            return this.store
        }
        // FIRST set logging threshold, so all possible messages are seen
        Log.setPrintThreshold(this.store.state.SETTINGS.app.logThreshold)
        // Use in provided Vue app instance
        if (appInstance) {
            appInstance.use(this.store)
        }
        this.isInitialized = true
        return this.store
    }

    loadLocalSettings () {
        // Check if the local storage contains settings.
        // Prioritize session storage over local storage, so we can mmaintain different settings in multiple open tabs.
        const storage = window.sessionStorage.getItem('epicurrents') || window.localStorage.getItem('epicurrents')
        if (storage) {
            const localStorage = JSON.parse(storage)
            if (localStorage.settings) {
                // Go through fields.
                field_loop:
                for (const [field, value] of Object.entries(localStorage.settings)) {
                    const match = field.match(/^(.+?)\.(.+)$/)
                    if (!match) {
                        continue
                    }
                    const [_fullField, mod, modField] = match
                    // App is a special case.
                    const userDefinable = mod === 'app'
                                        ? Object.assign({},
                                            { ... appSettings._userDefinable },
                                            { ... SETTINGS.app._userDefinable },
                                        )
                                        : Object.assign({},
                                            {
                                                ... this.store.state.INTERFACE.modules
                                                        .get(mod)
                                                        ?.settings
                                                        ?._userDefinable
                                                    || {},
                                            },
                                            {
                                                ... SETTINGS.modules[
                                                        mod as keyof AppSettings
                                                    ]._userDefinable
                                            }
                                        )
                    if (!Object.keys(userDefinable).length) {
                        continue
                    }
                    // Check that the setting can be modified.
                    for (const [uField, uConstr] of Object.entries(userDefinable)) {
                        if (uField === modField && (value as any)?.constructor === uConstr) {
                            useContext(this.store, mod).setFieldValue(field, value as SettingsValue)
                            Log.debug(`Applied local value ${value} to settings field ${field}`, SCOPE)
                            continue field_loop
                        }
                    }
                    Log.warn(
                        `Setting ${field} cannot be set by the user or the value type is incorrect.`,
                    SCOPE)
                }
            }
        }
    }
    get APP () {
        return this.store.state.APP
    }
    get INTERFACE () {
        return this.store.state.INTERFACE
    }
    get ONNX () {
        return this.store.state.SERVICES.get('onnx')
    }
    get PYODIDE () {
        return this.store.state.SERVICES.get('pyodide')
    }
    get SETTINGS () {
        return this.runtime?.SETTINGS || SETTINGS
    }
}
