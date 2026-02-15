/**
 * Additions to base EEG module types.
 */

import type { InterfaceSchema, } from '#types/interface'
import type { CommonBiosignalInterfaceSettings, HotkeyProperties, RecursivePartial } from '#types/config'
import type { ModuleConfiguration } from '#types/globals'
import type {
    BiosignalMontageTemplate,
    ConfigBiosignalSetup,
    SettingsColor,
} from '@epicurrents/core/types'

export type EegInterfaceSchemas = InterfaceSchema

export type EegInterfaceSettings = CommonBiosignalInterfaceSettings & {
    /** Delay in milliseconds before starting continuous browsing. */
    continuousBrowseDelay: number
    /** Interval in milliseconds between updates when continuously browsing. */
    continuousBrowseInterval: number
    /** Montage to use by default when opening a new recording (one of `rec`, `avg`, `lon`, `trv`). */
    defaultMontage: string
    /** Additional montages to use as { [setup name]: EegMontage } */
    extraMontages: {
        [setup: string]: BiosignalMontageTemplate[]
    }
    /** Additional EEG setups to use. */
    extraSetups: ConfigBiosignalSetup[]
    groupSpacing: number
    /** Array of available hotkey actions. */
    hotkeys: {
        /** Hotkey to open the annotation side drawer. */
        annotation: HotkeyProperties
        /** Hotkey to open the examine tool window. */
        examine: HotkeyProperties
        /** Hotkey to open the FFT tool window. */
        fft: HotkeyProperties
        /** Hotkey to toggle the inspect cursor tool. */
        inspect: HotkeyProperties
        /** Hotkey toi activate the first default montage. */
        montage1: HotkeyProperties
        /** Hotkey to activate the second default montage. */
        montage2: HotkeyProperties
        /** Hotkey to activate the third default montage. */
        montage3: HotkeyProperties
        /** Hotkey to activate the fourth default montage. */
        montage4: HotkeyProperties
        /** Hotkey to toggle default notch filter. */
        notch: HotkeyProperties
        /** Hotkey to open the report window. */
        report: HotkeyProperties
        /** Hotkey to open the topogram tool window (if MNE is loaded). */
        topogram: HotkeyProperties
    }
    navigator: {
        annotationColor: SettingsColor
        borderColor: SettingsColor
        cachedColor: SettingsColor
        interruptionColor: SettingsColor
        loadedColor: SettingsColor
        loadingColor: SettingsColor
        theme: string
        tickColor: SettingsColor
        viewBoxColor: SettingsColor
    }
    /**
     * Default frequency of the notch filter (extends the setting from common biosignal settings).
     * - If set to value other than 0, the notch control will be a toggle to enable/disable the notch filter and the
     *   notch hotkey will toggle this frequency.
     * - If set to 0, the notch control will be a dropdown to select the notch frequency and the notch hotkey will be
     *   disabled.
     */
    notchDefaultFrequency: 50 | 60 | 0
    services: {
        pyodide: {
            /** Display the colorbar along the large topogram. */
            topogramColorbar: boolean
        }
    }
    timeline: {
        labelSpacing: number
    }
    tools: CommonBiosignalInterfaceSettings['tools'] & {
        cursorLine: {
            color: SettingsColor
            width: number
            dasharray?: number[]
            style?: string
        }
        excludeArea: {
            color: SettingsColor
            width: number
            dasharray?: number[]
            style?: string
        }
        guideLine: {
            color: SettingsColor
            width: number
            dasharray?: number[]
            style?: string
        }
        guideLineSymbol: {
            color: SettingsColor
        }
        poiMarkerCircle: {
            color: SettingsColor
            radius: number
            width: number
            dasharray?: number[]
            style?: string
        }
        poiMarkerLine: {
            color: SettingsColor
            width: number
            dasharray?: number[]
            style?: string
        }
        /** Color values for each simultaneously displayed signal in the analysis tool. */
        signals: EegToolProperties[]
    }
    trace: {
        color: {
            eeg: SettingsColor
                sin: SettingsColor
                dex: SettingsColor
                mid: SettingsColor
            ekg: SettingsColor
            emg: SettingsColor
            eog: SettingsColor
            res: SettingsColor
            act: SettingsColor
            meta: SettingsColor
            default: SettingsColor
        }
        colorSides: boolean
        highlight: {
            color: SettingsColor
        }
        selections: {
            color: SettingsColor
        }
        theme: string
        width: {
            eeg: number
            ekg: number
            eog: number
        }
    }
    yPadding: number
}

/**
 * Additional setup for the EEG module.
 */
export type EegModuleConfiguration = ModuleConfiguration & {
    epochMode?: EegInterfaceSettings['epochMode']
    extraMontages?: {
        [setup: string]: (BiosignalMontageTemplate | string)[]
    }
    extraSetups?: (ConfigBiosignalSetup | string)[]
    hotkeys?: Partial<EegInterfaceSettings['hotkeys']>
    navigator?: Partial<EegInterfaceSettings['navigator']>
    tools?: Partial<EegInterfaceSettings['tools']>
    trace?: RecursivePartial<EegInterfaceSettings['trace']>
}

export type EegNavigationKey = 'ArrowLeft' | 'ArrowRight' | 'PageDown' | 'PageUp'

export type EegToolProperties = {
    color: SettingsColor
    dasharray?: number[]
    radius?: number
    style?: string
    width?: number
}
