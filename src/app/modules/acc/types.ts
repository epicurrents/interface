/**
 * Interface-side types for the ACC module.
 */

import type { InterfaceSchema } from '#types/interface'
import type {
    CommonBiosignalInterfaceSettings,
    HotkeyProperties,
    RecursivePartial,
} from '#types/config'
import type { ModuleConfiguration } from '#types/globals'
import type {
    BiosignalMontageTemplate,
    ConfigBiosignalSetup,
    SettingsColor,
} from '@epicurrents/core/types'
import type {
    AccCascadeEntry,
    AccModuleSettings as AccCoreSettings,
    AccResource,
} from '@epicurrents/acc-module/types'

export type AccInterfaceSchemas = InterfaceSchema

export type AccInterfaceSettings = CommonBiosignalInterfaceSettings & {
    /** Delay in milliseconds before starting continuous browsing. */
    continuousBrowseDelay: number
    /** Interval in milliseconds between updates when continuously browsing. */
    continuousBrowseInterval: number
    /** Hotkey definitions. */
    hotkeys: {
        annotation: HotkeyProperties
        examine: HotkeyProperties
        inspect: HotkeyProperties
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
    notchDefaultFrequency: 50 | 60 | 0
    services: object
    timeline: {
        labelSpacing: number
    }
    tools: CommonBiosignalInterfaceSettings['tools'] & {
        cursorLine: { color: SettingsColor, width: number, dasharray?: number[], style?: string }
        excludeArea: { color: SettingsColor, width: number, dasharray?: number[], style?: string }
        guideLine: { color: SettingsColor, width: number, dasharray?: number[], style?: string }
        guideLineSymbol: { color: SettingsColor }
        poiMarkerCircle: { color: SettingsColor, radius: number, width: number, dasharray?: number[], style?: string }
        poiMarkerLine: { color: SettingsColor, width: number, dasharray?: number[], style?: string }
        signals: AccToolProperties[]
    }
    viewport: {
        horizontalDivs: number
        mainAxis: 'x' | 'y' | null
        verticalDivs: number
    }
}

/**
 * ACC module config payload merged at runtime via `runtime.applyConfiguration`.
 * Mirrors the EEG/EMG shape so the same JSON-config conventions apply.
 */
export type AccModuleConfiguration = ModuleConfiguration & {
    cascadeMontages?: {
        [setup: string]: AccCascadeEntry[]
    }
    extraMontages?: {
        [setup: string]: (BiosignalMontageTemplate | string)[]
    }
    extraSetups?: (ConfigBiosignalSetup | string)[]
    hotkeys?: Partial<AccInterfaceSettings['hotkeys']>
    navigator?: Partial<AccInterfaceSettings['navigator']>
    tools?: Partial<AccInterfaceSettings['tools']>
    trace?: RecursivePartial<AccInterfaceSettings['trace']>
}

/** Re-export the data-module's settings so the interface module imports a single shape. */
export type AccModuleSettings = AccCoreSettings

export type AccNavigationKey = 'ArrowLeft' | 'ArrowRight' | 'PageDown' | 'PageUp'

export type AccToolProperties = {
    color: SettingsColor
    dasharray?: number[]
    radius?: number
    style?: string
    width?: number
}

export type { AccResource }
