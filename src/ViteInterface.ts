/**
 * Epicurrents Interface.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

// Vue.
import { createApp, App, ComponentPublicInstance } from "vue"
import { I18n } from "vue-i18n"
import { init as initI18n, availableLocales } from "#i18n"
import AppStore, { InterfaceStoreManager, ResourceModuleContext } from "#store"

// WebAwesome
import { waDirective } from '#util'
import '@awesome.me/webawesome/dist/styles/webawesome.css'
import '@awesome.me/webawesome/dist/components/breadcrumb/breadcrumb.js'
import '@awesome.me/webawesome/dist/components/breadcrumb-item/breadcrumb-item.js'
import '@awesome.me/webawesome/dist/components/button/button.js'
import '@awesome.me/webawesome/dist/components/callout/callout.js'
import '@awesome.me/webawesome/dist/components/color-picker/color-picker.js'
import '@awesome.me/webawesome/dist/components/details/details.js'
import '@awesome.me/webawesome/dist/components/dialog/dialog.js'
import '@awesome.me/webawesome/dist/components/divider/divider.js'
import '@awesome.me/webawesome/dist/components/drawer/drawer.js'
import '@awesome.me/webawesome/dist/components/dropdown/dropdown.js'
import '@awesome.me/webawesome/dist/components/dropdown-item/dropdown-item.js'
import '@awesome.me/webawesome/dist/components/icon/icon.js'
import '@awesome.me/webawesome/dist/components/input/input.js'
import '@awesome.me/webawesome/dist/components/option/option.js'
import '@awesome.me/webawesome/dist/components/popup/popup.js'
import '@awesome.me/webawesome/dist/components/progress-bar/progress-bar.js'
import '@awesome.me/webawesome/dist/components/scroller/scroller.js'
import '@awesome.me/webawesome/dist/components/select/select.js'
import '@awesome.me/webawesome/dist/components/spinner/spinner.js'
import '@awesome.me/webawesome/dist/components/split-panel/split-panel.js'
import '@awesome.me/webawesome/dist/components/switch/switch.js'
import '@awesome.me/webawesome/dist/components/tab/tab.js'
import '@awesome.me/webawesome/dist/components/tab-group/tab-group.js'
import '@awesome.me/webawesome/dist/components/tab-panel/tab-panel.js'
import '@awesome.me/webawesome/dist/components/textarea/textarea.js'
import '@awesome.me/webawesome/dist/components/tree/tree.js'
import '@awesome.me/webawesome/dist/components/tooltip/tooltip.js'
import { allDefined, setBasePath, setKitCode } from '@awesome.me/webawesome/dist/webawesome.js'
setBasePath('@awesome.me/webawesome/dist')
setKitCode('45463b747e')
// Use app-icon component for icons.
import AppIcon from "#app/AppIcon.vue"

// Application.
import { Log } from "scoped-event-log"
import SETTINGS, { useActiveContext } from './config'
import VueApp from "./app/App.vue"
// Modules.
import {
    doc as docModule,
    eeg as eegModule,
    emg as emgModule,
    ncs as ncsModule,
    pdf as pdfModule,
    tab as tabModule,
} from './app/modules'
export {
    eegModule,
}
const interfaceModules = {
    htm: docModule,
    eeg: eegModule,
    emg: emgModule,
    ncs: ncsModule,
    pdf: pdfModule,
    tab: tabModule,
}

import type {
    BiosignalResource,
    DataResource,
    EpicurrentsApp,
    InterfaceModule,
    InterfaceModuleConstructor,
    StateManager,
} from "@epicurrents/core/types"
import { AssetService } from "@epicurrents/core/types"
import { MutationPayload } from "vuex"
import type { PythonInterpreterService, RunCodeResult } from '@epicurrents/pyodide-service/types'
import type { ApplicationInterfaceConfig, ModuleConfiguration } from './types/globals'
import EpicurrentsPlugin from './epicurrents/EpicurrentsPlugin'

const SCOPE = 'interface'

export const ViteInterface: InterfaceModuleConstructor = class EpicurrentsInterface implements InterfaceModule {
    app = null as null | App
    epic = null as null | EpicurrentsApp
    instance = null as null | ComponentPublicInstance
    isReady = false
    i18n = null as null | I18n<any, any, any, boolean>
    readyWaiters = [] as ((success: boolean) => void)[]
    store = null as null | InterfaceStoreManager

    constructor (
        epicApp: EpicurrentsApp,
        manager?: StateManager,
        modules: string[] = [],
        config?: ApplicationInterfaceConfig,
    ) {
        // Use global config if a custom one is not provided.
        config ??= window.__EPICURRENTS__.SETUP
        // Make sure that the container element exists.
        // Prepend a hyphen to the container id, otherwise just use 'epicurrents'.
        // Using the literal 'epicurrents' in the selector is to avoid invalid selector errors.
        const containerId = config.containerId?.length ? `-${config.containerId}` : ''
        const appCnt = document.querySelector(`#epicurrents${containerId}`) as HTMLDivElement | null
        if (!appCnt) {
            Log.error(`Container with the id ${containerId} was not found, viewer cannot be launched!`, SCOPE)
            return
        }
        // Update page title.
        if (config.appName) {
            document.title = config.appName
        }
        if (import.meta.env.MODE === 'production' && SETTINGS.app.isContextMenuDisabled) {
            // Disable right click context menu in production mode.
            appCnt.oncontextmenu = (e) => {
                e.preventDefault()
                return false
            }
        }
        const root = document.createElement('div')
        // For an embedded application, create a shadow root and append the root to it.
        // This is to avoid style conflicts with the host page.
        if (config.embedded) {
            const shadow = appCnt.attachShadow({ mode: 'open' })
            shadow.appendChild(root)
            // Create a style tag for shadow root styles
            shadow.appendChild(
                document.createElement('style')
            )
        } else {
            // Remove all other styles from the page to avoid conflicts.
            for (const style of [
                ...document.head.getElementsByTagName('link'),
                ...document.head.getElementsByTagName('style')
            ]) {
                // This works differently in dev and production mode.
                if (
                    // Keep the standalone epicurrents document styles.
                    style.dataset['epicurrentsStyles'] === undefined
                    // Remove links to stylesheets that are not created by the app.
                    && (
                        style.tagName !== 'LINK'
                        || (
                            (style as HTMLLinkElement).rel === 'stylesheet'
                            && !(style as HTMLLinkElement).href?.split('/').slice(-1)[0]?.includes('epicurrents')
                        )
                    )
                    // In dev mode, the style tag is created by Vite and has a unique id.
                    && style.dataset['viteDevId'] === undefined
                    // In production we must check if the styles contain references to the app.
                    && !style.innerHTML.includes('epicv-')
                ) {
                    style.remove()
                }
            }
            // For a non-embedded application, append the root to the container directly.
            appCnt.appendChild(root)
            // Application should take up the whole page.
            const body = document.querySelector('body') as HTMLBodyElement
            body.style.margin = '0'
            body.style.padding = '0'
            body.style.width = '100vw'
            body.style.height = '100vh'
            body.style.overflow = 'hidden'
        }
        // Make sure app container and root take up all the available space
        appCnt.style.width = "100%"
        appCnt.style.height = "100%"
        root.style.width = "100%"
        root.style.height = "100%"
        this.epic = epicApp
        this.app = createApp(VueApp)
        // Register app-icon component.
        this.app.component('app-icon', AppIcon)
        // Provide easy access to the Epicurrents app and runtime.
        this.app.use(new EpicurrentsPlugin(epicApp), this)
        // Initialize i18n
        let locale = config.locale || 'en'
        if (!availableLocales.includes(locale)) {
            Log.warn(`Given locale ${locale} is not available, falling back to English.`, 'EpicurrentsInterface')
            locale = 'en'
        }
        this.i18n = initI18n(this.app, locale)
        // Initialize Vuex store
        this.store = new AppStore(manager)
        this.store.init(this.app)
        // WebAwesome directive.
        this.app.directive('property', waDirective)
        // App runtime configuration.
        const state = this.store.instance!.state
        state.APP.id = config.appId || 'app'
        state.APP.containerId = containerId
        // Save active views to application settings.
        state.APP.availableViews = config.activeViews?.length ? [...config.activeViews] : []
        // Save a reference to the shadow root in the store.
        if (config.embedded) {
            state.APP.shadowRoot = appCnt.shadowRoot
        }
        // Relay store dispatches from the event bus.
        this.epic.eventBus.addEventListener('store-dispatch', (e: Event) => {
            const { key, payload } = (e as CustomEvent).detail
            this.store?.instance?.dispatch(key, payload)
        })
        // Handle new biosignal resources.
        epicApp.eventBus.subscribe('add-resource', event => {
            const resource = event.detail.payload as DataResource
            const pyodide = window.__EPICURRENTS__.RUNTIME.SERVICES.get('pyodide') as PythonInterpreterService | null
            const memoryManager = window.__EPICURRENTS__.RUNTIME.SETTINGS.app.useMemoryManager
            if (pyodide && memoryManager && Object.hasOwn(resource, '_signalCacheStatus')) {
                // Inform the service of data cache updates, so that the input data arrays within the Pyodide
                // interpreter will be updated as well.
                (resource as BiosignalResource).onPropertyChange('signalCacheStatus', () => {
                    // Update the input signals in the Pyodide interpreter if currently active resource supports
                    // memory manager.
                    if (
                        this.store?.instance &&
                        useActiveContext(this.store.instance).SETTINGS.useMemoryManager
                    ) {
                        pyodide.updateInputSignals()
                    }
                }, 'ViteInterface')
                // Add the core and biosignal scripts as dependencies for biosignal resources.
                resource.addDependencies('pyodide-core', 'pyodide-biosignal')
                pyodide.initialSetup.then(async (setupResult) => {
                    if (setupResult) {
                        resource.setDependenciesReady('pyodide-core')
                        const scriptResult = await pyodide.loadDefaultScript('biosignal') as RunCodeResult
                        if (scriptResult.success) {
                            resource.setDependenciesReady('pyodide-biosignal')
                        } else {
                            resource.errorReason = 'Pyodide script error'
                            resource.state = 'error'
                        }
                    } else {
                        resource.errorReason = 'Failed to load Pyodide'
                        resource.state = 'error'
                    }
                })
            }
        }, 'ViteInterface')
        this.store.instance?.subscribe((mutation: MutationPayload) => {
            if (mutation.type === 'load-dataset-folder') {
                Log.error(`Load dataset feature has not been implemented yet.`, SCOPE)
            } else if (mutation.type === 'load-study-folder') {
                const study = mutation.payload.study
                const promise = mutation.payload.promise
                epicApp.loadStudy(study.loader, study.folder, study.name).then(() => {
                    promise.resolve()
                })
            } else if (mutation.type === 'load-study-url') {
                const study = mutation.payload.study
                const promise = mutation.payload.promise
                epicApp.loadStudy(study.loader, study.url, { name: study.name }).then(recording => {
                    if (recording) {
                        promise.resolve(recording)
                    } else {
                        promise.reject()
                    }
                })
            }
        })
        // Monitor full screen changes to keep store state up-to-date
        document.addEventListener('fullscreenchange', this.fullscreenChange, false)
        document.addEventListener('mozfullscreenchange', this.fullscreenChange, false)
        document.addEventListener('MSFullscreenChange', this.fullscreenChange, false)
        document.addEventListener('webkitfullscreenchange', this.fullscreenChange, false)
        // Mount app as the final step, after possible interface modules have been loaded.
        this.awaitReady().then(async () => {
            // Finally, wait for the WA elements to be defined before displaying the UI (to avoid flicker).
            await allDefined()
            this.instance = this.app!.mount(root)
        })
        // Add active modules to store.
        if (modules.length) {
            this.loadModules(modules, config).then((success) => {
                this.isReady = success
            })
        } else {
            this.isReady = true
            for (const waiter of this.readyWaiters) {
                waiter(true)
            }
        }
    }

    /**
     * Returns a promise that resolves once all interface modules have been loaded.
     * @returns Promise<boolean> Resolves to true if all modules loaded successfully, false otherwise.
     */
    async awaitReady (): Promise<boolean> {
        if (this.isReady) {
            return true
        }
        Log.debug(`Waiting for interface modules to load.`, SCOPE)
        let onReady = (_success: boolean) => {}
        const readyPromise = new Promise((resolve: (success: boolean) => void)=> {
            onReady = resolve
        })
        this.readyWaiters.push(onReady)
        return readyPromise
    }

    /**
     * Display the main viewer UI.
     * @returns void
     */
    displayUI () {
        this.store?.instance?.commit('display-viewer')
    }
    /**
     * Update Vuex store fullscreen property when document fullscreen state changes.
     * @returns void
     */
    fullscreenChange = () => {
        if (!this.store) {
            return
        }
        const appCont = document.querySelector(`#epicurrents${this.store?.instance?.state.APP.containerId}`) as HTMLDivElement
        if (document.fullscreenElement === appCont) {
            this.store.instance?.commit('set-fullscreen', true)
        } else {
            this.store.instance?.commit('set-fullscreen', false)
        }
    }

    /**
     * Load interface `modules` as specified in the `config`uration.
     * @param modules Array of module names to load.
     * @param config Optional application interface configuration.
     * @returns Promise<boolean> Resolves to true if all modules loaded successfully, false otherwise.
     */
    async loadModules (modules: string[], config: ApplicationInterfaceConfig) {
        const results = await Promise.all(modules.map(async (name) => {
            try {
                const mod = interfaceModules[name as keyof typeof interfaceModules]
                let modConfig = config.modules?.[name as keyof typeof config.modules]
                if (typeof modConfig === 'string') {
                    const response = await fetch(new URL(modConfig, config.assetPath))
                    modConfig = await response.json() as ModuleConfiguration
                }
                mod.runtime.applyConfiguration(modConfig || {})
                this.store?.addModule(name, mod)
                Log.debug(`Loaded interface module ${name}.`, SCOPE)
                return true
            } catch (e) {
                console.log(e)
                Log.error(`Failed to load interface module ${name}.`, SCOPE, e as Error)
                return false
            }
        }))
        if (results.includes(false)) {
            Log.error(`At least one interface module did not load correctly.`, SCOPE)
            for (const waiter of this.readyWaiters) {
                waiter(false)
            }
            return false
        }
        this.store?.loadLocalSettings()
        Log.debug(`All interface modules loaded.`, SCOPE)
        this.isReady = true
        for (const waiter of this.readyWaiters) {
            waiter(true)
        }
        return true
    }

    /**
     * Register a resource module in the interface store.
     * @param name Name of the resource module.
     * @param mod Resource module context.
     */
    registerModule (name: string, mod: ResourceModuleContext) {
        this.store?.addModule(name, mod)
    }

    /**
     * Register an asset service in the interface store.
     * @param name Name of the service.
     * @param service Asset service instance.
     */
    registerService (name: string, service: AssetService) {
        this.store?.addService(name, service)
    }
}
