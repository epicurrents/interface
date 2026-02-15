/**
 * Additions to base EMG module types.
 */

import type { InterfaceSchema, } from '#types/interface'
import type { CommonBiosignalInterfaceSettings, HotkeyProperties, RecursivePartial } from '#types/config'
import type { ModuleConfiguration } from '#types/globals'
import type {
    BiosignalMontageTemplate,
    ConfigBiosignalSetup,
    SettingsColor,
} from '@epicurrents/core/types'

export type EmgInterfaceSchemas = InterfaceSchema

export type EmgInterfaceSettings = CommonBiosignalInterfaceSettings & {
    /** Delay in milliseconds before starting continuous browsing. */
    continuousBrowseDelay: number
    /** Interval in milliseconds between updates when continuously browsing. */
    continuousBrowseInterval: number
    /** Array of available hotkey actions. */
    hotkeys: {
        /** Hotkey to open the annotation side drawer. */
        annotation: HotkeyProperties
        /** Hotkey to open the examine tool window. */
        examine: HotkeyProperties
        /** Hotkey to toggle the inspect cursor tool. */
        inspect: HotkeyProperties
        /** Hotkey to toggle default notch filter. */
        notch: HotkeyProperties
    }
    navigator: {
        annotationColor: SettingsColor
        borderColor: SettingsColor
        cachedColor: SettingsColor
        interruptionColor: SettingsColor
        loadedColor: SettingsColor
        loadingColor: SettingsColor
        signalColor: SettingsColor
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
    services: {}
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
        signals: EmgToolProperties[]
    }
    /** Viewport settings for the EMG module. */
    viewport: {
        /** Number of horizontal divisions in the viewport */
        horizontalDivs: number
        /** Main axis of the viewport to adjust the other axis of the grid by. */
        mainAxis: 'x' | 'y' | null
        /** Number of vertical divisions in the viewport */
        verticalDivs: number
    }
}

/**
 * Additional setup for the EMG module.
 */
export type EmgModuleConfiguration = ModuleConfiguration & {
    epochMode?: EmgInterfaceSettings['epochMode']
    extraMontages?: {
        [setup: string]: (BiosignalMontageTemplate | string)[]
    }
    extraSetups?: (ConfigBiosignalSetup | string)[]
    hotkeys?: Partial<EmgInterfaceSettings['hotkeys']>
    navigator?: Partial<EmgInterfaceSettings['navigator']>
    tools?: Partial<EmgInterfaceSettings['tools']>
    trace?: RecursivePartial<EmgInterfaceSettings['trace']>
}

export type EmgNavigationKey = 'ArrowLeft' | 'ArrowRight' | 'PageDown' | 'PageUp'

export type EmgToolProperties = {
    color: SettingsColor
    dasharray?: number[]
    radius?: number
    style?: string
    width?: number
}
