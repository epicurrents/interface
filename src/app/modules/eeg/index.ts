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
import { applyModuleSettings, useContext } from "#config"
import { createPropertySetter, type ModulePropertyRegistry } from "#config/properties"
import type { EegInterfaceSettings, EegModuleConfiguration, LeadFieldProvider } from "./types"

const SCOPE = 'interface-eeg-module'

enum EegActionTypes {
    SET_ACTIVE_MONTAGE = 'eeg.set-active-montage',
    SET_CURSOR_TOOL = 'eeg.set-cursor-tool',
    SET_HIGHPASS_FILTER = 'eeg.set-highpass-filter',
    SET_LOWPASS_FILTER = 'eeg.set-lowpass-filter',
    SET_NOTCH_FILTER = 'eeg.set-notch-filter',
    SET_OPEN_SIDEBAR = 'eeg.set-open-sidebar',
    SET_REPORT_OPEN = 'eeg.set-report-open',
    SET_SELECTED_TREND = 'eeg.set-selected-trend',
    SET_SENSITIVITY = 'eeg.set-sensitivity',
    SET_TIMEBASE = 'eeg.set-timebase',
    SET_TREND_VISIBLE = 'eeg.set-trend-visible',
    TOGGLE_ANNOTATION_SIDEBAR = 'eeg.toggle-annotation-sidebar',
    TOGGLE_TREND_VISIBLE = 'eeg.toggle-trend-visible',
}

/** Default trend type used when a new recording is opened. The set of available trend types is
 *  hard-coded for now (aEEG is the only implementation); each new type adds an entry here and an
 *  item to the Display → Trends submenu. */
const DEFAULT_TREND = 'aeeg'

/**
 * Interface-owned properties of the EEG module. Resource properties (sensitivity, timebase, the
 * filters, the active montage) are not listed here — those belong to the core module and are
 * reached through the same setter by forwarding.
 */
export const properties: ModulePropertyRegistry = {
    'cursor-tool': { field: 'cursorToolActive', type: 'String?' },
    'open-sidebar': { field: 'openSidebar', type: 'String?' },
    'report-open': { field: 'isReportOpen', type: 'Boolean' },
    'selected-trend': { field: 'selectedTrend', type: 'String' },
    'trend-visible': { field: 'trendVisible', type: 'Boolean' },
}

export const actions = {
    [EegActionTypes.SET_ACTIVE_MONTAGE] (_injectee: ActionContext<State, State>, payload: number | string | null) {
        runtime.setPropertyValue('active-montage', payload)
    },
    [EegActionTypes.SET_CURSOR_TOOL] (_injectee: ActionContext<State, State>, payload: string | null) {
        runtime.setPropertyValue('cursor-tool', payload)
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
        runtime.setPropertyValue('open-sidebar', payload)
    },
    [EegActionTypes.SET_REPORT_OPEN] (_injectee: ActionContext<State, State>, payload: boolean) {
        runtime.setPropertyValue('report-open', payload)
    },
    [EegActionTypes.SET_SELECTED_TREND] (_injectee: ActionContext<State, State>, payload: string) {
        runtime.setPropertyValue('selected-trend', payload)
    },
    [EegActionTypes.SET_SENSITIVITY] (_injectee: ActionContext<State, State>, payload: number) {
        runtime.setPropertyValue('sensitivity', payload)
    },
    [EegActionTypes.SET_TIMEBASE] (_injectee: ActionContext<State, State>, payload: [string, number]) {
        runtime.setPropertyValue('timebase-unit', payload[0])
        runtime.setPropertyValue('timebase', payload[1])
    },
    [EegActionTypes.SET_TREND_VISIBLE] (_injectee: ActionContext<State, State>, payload: boolean) {
        runtime.setPropertyValue('trend-visible', payload)
    },
    [EegActionTypes.TOGGLE_ANNOTATION_SIDEBAR] (_injectee: ActionContext<State, State>, _payload: boolean | undefined ) {
        // This is merely a broadcast.
    },
    [EegActionTypes.TOGGLE_TREND_VISIBLE] (_injectee: ActionContext<State, State>, _payload: boolean | undefined ) {
        runtime.setPropertyValue('trend-visible', !runtime.trendVisible)
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
    leadFieldProvider: null as LeadFieldProvider | null,
    openSidebar: null as string | null,
    selectedTrend: (settings.trends.defaultType || DEFAULT_TREND) as string,
    trendVisible: false,
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
        if (config.epochMode?.display) {
            settings.epochMode.display = config.epochMode.display
        }
        if (config.epochMode?.contextEpochs !== undefined) {
            settings.epochMode.contextEpochs = config.epochMode.contextEpochs
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
        // Cascade montage definitions (resolved + added per recording in EegViewer.montagesChanged
        // once the recording's default setups and montages are in place). Keyed by setup name —
        // mirrors the extraMontages shape so the same mental model applies.
        if (config.cascadeMontages) {
            for (const [setup, entries] of Object.entries(config.cascadeMontages)) {
                for (const entry of entries) {
                    Log.debug(
                        `Registering cascade montage '${entry.label}' (id=${entry.id}) for setup '${setup}'.`,
                        SCOPE,
                    )
                    if (!settings.cascadeMontages[setup]) {
                        settings.cascadeMontages[setup] = [entry]
                    } else {
                        settings.cascadeMontages[setup].push(entry)
                    }
                }
            }
        }
        // Skip default setups flag. Read by EegRecording when it applies its setups, so it has to
        // land on the module settings.
        if (config.skipDefaultSetups !== undefined) {
            applyModuleSettings('eeg', { skipDefaultSetups: config.skipDefaultSetups })
        }
        // Trend configuration. Every one of these is resolved against the recording's setup by
        // EegRecording, so they belong to the module settings as well. The aEEG derivations double
        // as the fallback for the ratio and spectrogram trends.
        if (config.aeeg) {
            applyModuleSettings('eeg', { aeeg: config.aeeg })
        }
        if (config.pdbsi) {
            applyModuleSettings('eeg', { pdbsi: config.pdbsi })
        }
        if (config.ratio) {
            applyModuleSettings('eeg', { ratio: config.ratio })
        }
        if (config.spectrogram) {
            applyModuleSettings('eeg', { spectrogram: config.spectrogram })
        }
        // `trends` carries two layers' settings under one key. `defaultType` and `showStrip` are
        // interface state — the strip and the selection belong to the chrome, and the module knows
        // nothing of either — so they are filed on this module's own settings. Everything else is a
        // maths knob the trend processor reads, and goes to the module settings. Splitting here
        // rather than in the config surface means a deployment configures trends in one place.
        if (config.trends) {
            const { defaultType, showStrip, ...moduleTrends } = config.trends
            if (defaultType) {
                settings.trends.defaultType = defaultType
                // Also aligned on the live runtime, not only stored as the setting. `runtime` was
                // built at module-import time, before any configuration existed, so it still holds
                // the built-in default; and the `created` resource hook that would otherwise sync
                // the two is never invoked by anything (see resourceLifecycleHooks below).
                runtime.setPropertyValue('selected-trend', defaultType)
            }
            if (showStrip !== undefined) {
                settings.trends.showStrip = showStrip
            }
            applyModuleSettings('eeg', { trends: moduleTrends })
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
        // Lead-field source for the source-localisation tool. The interface owns no URLs for it;
        // the host injects a provider and keeps its own fetching strategy to itself.
        if (config.leadFieldProvider) {
            runtime.leadFieldProvider = config.leadFieldProvider
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
        // NOTE: nothing invokes these hooks. `resourceLifecycleHooks` is declared on the module
        // contract in #store and implemented by seven modules, but no caller exists — the resource
        // setup each one describes is done by the viewer components instead. Treat the bodies below
        // as inert until a caller lands; anything that has to happen per resource belongs in the
        // module's viewer component, which is where extra setups and montages are actually added.
        created (resource: EegResource) {
            runtime.setPropertyValue('trend-visible', false)
            runtime.setPropertyValue('selected-trend', settings.trends.defaultType || DEFAULT_TREND)
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
    /**
     * Apply an interface-owned property, reporting whether this module claimed the name. The store
     * chains the core module behind this, so a name declared nowhere reaches neither owner and is
     * reported there rather than silently doing nothing.
     */
    setPropertyValue: createPropertySetter('eeg', () => runtime as unknown as Record<string, unknown>, properties),
} as InterfaceResourceModule & {
    /** Name of the cursor tool that is active in the interface, null if no tool is active. */
    cursorToolActive: string | null
    /** Is the report currently open. */
    isReportOpen: boolean
    /** Host-injected source of pre-computed lead fields, null when the host supplied none (in
     *  which case the source-localisation tool reports itself unavailable). */
    leadFieldProvider: LeadFieldProvider | null
    /** Name of the sidebar that is currently open, null if no sidebar is open. */
    openSidebar: string | null
    /** Identifier of the currently selected trend type (e.g. `'aeeg'`). Single-selection — the
     *  Display → Trends submenu enforces one-and-only-one. Reset to `DEFAULT_TREND` on new
     *  recording. Currently only `'aeeg'` is implemented. */
    selectedTrend: string
    /** Whether the trend strip is currently shown. Toggled via `eeg.set-trend-visible` or
     *  `eeg.toggle-trend-visible`. EegViewer also expands its split-panel bottom slot when this
     *  flips on. */
    trendVisible: boolean
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
export type { EegModuleConfiguration, LeadFieldData, LeadFieldProvider } from "./types"
