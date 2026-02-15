/**
 * Epicurrents Interface Vuex store EEG module.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { loadAsyncComponent } from "#util"
import { type ActionContext } from "vuex"
import {
    type EpiCStore,
    type InterfaceResourceModule,
    type State,
} from "#store"
import { Log } from "scoped-event-log"
import type { BiosignalMontageTemplate, ConfigBiosignalSetup, Modify } from "@epicurrents/core/types"
import type { EegResource, EegModuleSettings } from "@epicurrents/eeg-module/types"
import { schemas, settings } from "./config"
import { useContext } from "#config"
import type { EegInterfaceSettings, EegModuleConfiguration } from "./types"

const SCOPE = 'interface-eeg-module'

enum EegActionTypes {
    SET_ACTIVE_MONTAGE = 'eeg.set-active-montage',
    SET_CURSOR_TOOL = 'eeg.set-cursor-tool',
    SET_HIGHPASS_FILTER = 'eeg.set-highpass-filter',
    SET_LOWPASS_FILTER = 'eeg.set-lowpass-filter',
    SET_NOTCH_FILTER = 'eeg.set-notch-filter',
    SET_OPEN_SIDEBAR = 'eeg.set-open-sidebar',
    SET_REPORT_OPEN = 'eeg.set-report-open',
    SET_SENSITIVITY = 'eeg.set-sensitivity',
    SET_TIMEBASE = 'eeg.set-timebase',
    TOGGLE_ANNOTATION_SIDEBAR = 'eeg.toggle-annotation-sidebar',
}

export const actions = {
    [EegActionTypes.SET_ACTIVE_MONTAGE] (_injectee: ActionContext<State, State>, payload: number | string | null) {
        runtime.setPropertyValue('active-montage', payload)
    },
    [EegActionTypes.SET_CURSOR_TOOL] (_injectee: ActionContext<State, State>, payload: string | null) {
        runtime.cursorToolActive = payload
    },
    [EegActionTypes.SET_HIGHPASS_FILTER] (_injectee: ActionContext<State, State>, payload: number | null) {
        runtime.setPropertyValue('highpass-filter', payload)
    },
    [EegActionTypes.SET_LOWPASS_FILTER] (_injectee: ActionContext<State, State>, payload: number | null) {
        runtime.setPropertyValue('lowpass-filter', payload)
    },
    [EegActionTypes.SET_NOTCH_FILTER] (_injectee: ActionContext<State, State>, payload: number | null) {
        runtime.setPropertyValue('notch-filter', payload)
    },
    [EegActionTypes.SET_OPEN_SIDEBAR] (_injectee: ActionContext<State, State>, payload: string) {
        runtime.openSidebar = payload
    },
    [EegActionTypes.SET_REPORT_OPEN] (_injectee: ActionContext<State, State>, payload: boolean) {
        runtime.isReportOpen = payload
    },
    [EegActionTypes.SET_SENSITIVITY] (_injectee: ActionContext<State, State>, payload: number) {
        runtime.setPropertyValue('sensitivity', payload)
    },
    [EegActionTypes.SET_TIMEBASE] (_injectee: ActionContext<State, State>, payload: [string, number]) {
        runtime.setPropertyValue('timebase-unit', payload[0])
        runtime.setPropertyValue('timebase', payload[1])
    },
    [EegActionTypes.TOGGLE_ANNOTATION_SIDEBAR] (_injectee: ActionContext<State, State>, _payload: boolean | undefined ) {
        // This is merely a broadcast.
    },
}

export const mutations = {}

export const runtime = {
    __proto__: null,
    moduleName: {
        code: 'eeg',
        full: 'Electroencephalography',
        short: 'EEG',
    },
    cursorToolActive: null as string | null,
    isReportOpen: false,
    openSidebar: null as string | null,
    async applyConfiguration (config: EegModuleConfiguration) {
        // Epoch mode.
        if (config.epochMode?.enabled) {
            settings.epochMode.enabled = config.epochMode.enabled
        }
        if (config.epochMode?.epochLength) {
            settings.epochMode.epochLength = config.epochMode.epochLength
        }
        if (config.epochMode?.onlyFullEpochs) {
            settings.epochMode.onlyFullEpochs = config.epochMode.onlyFullEpochs
        }
        // Module name.
        if (config.moduleName?.full) {
            runtime.moduleName.full = config.moduleName.full
        }
        if (config.moduleName?.short) {
            runtime.moduleName.short = config.moduleName.short
        }
        // Additional montages.
        if (config.extraMontages) {
            for (const [setup, montages] of Object.entries(config.extraMontages)) {
                for (let montage of montages) {
                    if (typeof montage === 'string') {
                        Log.debug(`Fetching extra EEG montage from '${montage}'.`, SCOPE)
                        const response = await fetch(new URL(montage, __EPICURRENTS__.SETUP.assetPath))
                        montage = await response.json() as BiosignalMontageTemplate
                    }
                    Log.debug(`Adding extra EEG montage '${montage.name}' to setup '${setup}'.`, SCOPE)
                    if (!settings.extraMontages[setup]) {
                        settings.extraMontages[setup] = [montage]
                    } else {
                        settings.extraMontages[setup].push(montage)
                    }
                }
            }
        }
        // Additional setups.
        if (config.extraSetups) {
            for (let setup of config.extraSetups) {
                if (typeof setup === 'string') {
                    const response = await fetch(new URL(setup, __EPICURRENTS__.SETUP.assetPath))
                    setup = await response.json() as ConfigBiosignalSetup
                }
                Log.debug(`Adding extra EEG setup '${setup.name}'.`, SCOPE)
                settings.extraSetups.push(setup)
            }
        }
        // Hotkeys.
        if (config.hotkeys?.annotation) {
            settings.hotkeys.annotation = config.hotkeys.annotation
        }
        if (config.hotkeys?.examine) {
            settings.hotkeys.examine = config.hotkeys.examine
        }
        if (config.hotkeys?.fft) {
            settings.hotkeys.fft = config.hotkeys.fft
        }
        if (config.hotkeys?.topogram) {
            settings.hotkeys.topogram = config.hotkeys.topogram
        }
    },
    getControlsComponent: () => {
        const loader = (() => import('./components/EegControls.vue'))
        return loadAsyncComponent(loader)
    },
    getFooterComponent: () => {
        const loader = (() => import('./components/EegFooter.vue'))
        return loadAsyncComponent(loader)
    },
    getViewerComponent: () => {
        const loader = (() => import('./components/EegViewer.vue'))
        return loadAsyncComponent(loader)
    },
    resourceLifecycleHooks: {
        beforeDestroy (_resource: EegResource) {

        },
        created (resource: EegResource) {
            // Add extra setups to the resource.
            for (const setup of settings.extraSetups) {
                resource.addSetup(setup)
            }
            // Add extra montages to the resource.
            for (const [setup, montages] of Object.entries(settings.extraMontages)) {
                for (const montage of montages) {
                    resource.addMontage(`${setup}:${montage.name}`, montage.label, setup, montage)
                }
            }
        },
        destroyed (_resource: EegResource) {

        },
    },
    /** This method must be overridden in the EEG module. */
    setPropertyValue (_property, _value) {
        Log.warn(`setPropertyValue method in 'eeg' has not been overridden, state will not be altered.`, SCOPE)
    },
} as InterfaceResourceModule & {
    /** Name of the cursor tool that is active in the interface, null if no tool is active. */
    cursorToolActive: string | null
    /** Is the report currently open. */
    isReportOpen: boolean
    /** Name of the sidebar that is currently open, null if no sidebar is open. */
    openSidebar: string | null
}

/**
 * Get scoped component properties for the EEG scope.
 * @param store - The vuex store object.
 * @param component - Possible calling component name.
 * @returns Scoped component properties.
 */
export const useEegContext = (store: EpiCStore, component?: string) => {
    const scopeProps = useContext(store, 'eeg', component)
    const typifiedProps = scopeProps as Modify<typeof scopeProps, {
        /**
         * Currently active EEG settings.
         * @remarks
         * These scoped properties are only meant to be used inside components that display
         * data from active resources and expect that active recording cannot be null.
         */
        SETTINGS: typeof scopeProps['SETTINGS'] & EegModuleSettings & EegInterfaceSettings
    }>
    return {
        /**
         * Currently ective EEG resource.
         * @remarks
         * These scoped properties are only meant to be used inside components that display
         * data from active resources and expect that active recording cannot be null.
         */
        RESOURCE: store.getters.getActiveResource() as EegResource,
        ...typifiedProps,
    }
}

export { schemas, settings }
