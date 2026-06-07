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
    /** Per-trend display settings — keyed by trend id (`aeeg`, `ratio`, `pdbsi`,
     *  future trend types). Display-only knobs live here, not in
     *  `CommonBiosignalSettings.trends`, so the trend worker / processor never
     *  has to know about render flags. */
    trends: {
        aeeg: {
            /**
             * Per-derivation band colours, keyed by the derivation id from
             * `settings.aeeg.derivations[i].id` (e.g. `'left'`, `'right'`).
             * Standard hemispheric ids (`left`, `right`, `central`) automatically
             * inherit from `trace.color.sin/dex/mid`; add an entry here to override
             * or to colour custom derivation ids.
             */
            derivationColors: { [derivationId: string]: SettingsColor }
            /** How multiple aEEG derivations are laid out: stacked slots or overlaid in one band. */
            displayMode: 'separate' | 'superimposed'
        }
        ratio: {
            /** Layout when two hemisphere traces are shown. */
            displayMode: 'separate' | 'superimposed'
            /** Highlight epochs that exceed the threshold with a distinct fill. */
            markCrossing: boolean
            /** Invert the R-hemisphere axis in separate mode. */
            mirrorMode: boolean
            /** Fill the area between the threshold line and the trace for above-threshold epochs. */
            showFill: boolean
            /** Draw the published abnormality threshold reference line. */
            showThreshold: boolean
            /** Threshold on the [−1, +1] scale (default 0.26 = TAR, van Stigt 2023). */
            threshold: number
        }
        pdbsi: {
            /** Highlight epochs that exceed the threshold with a distinct fill. */
            markCrossing: boolean
            /** Fill the area between the threshold line and the trace for above-threshold epochs. */
            showFill: boolean
            /** Draw the published abnormality threshold reference line. */
            showThreshold: boolean
            /** Threshold on the [0, 1] scale (default 0.52 = delta band, ELECTRA-STROKE). */
            threshold: number
        }
    }
    /** Delay in milliseconds before starting continuous browsing. */
    continuousBrowseDelay: number
    /** Interval in milliseconds between updates when continuously browsing. */
    continuousBrowseInterval: number
    /** Montage to use by default when opening a new recording (one of `rec`, `avg`, `lon`, `trv`). */
    defaultMontage: string
    /**
     * Cascade montage definitions, keyed by setup name (mirroring `extraMontages`). Each entry
     * produces one polygraphic-style montage where N vertically stacked rows show successive
     * `pageLength`-second slices of the same source channel (EKG, breathing, EMG, EOG, ...). The
     * cascade is built against the keyed setup; an entry whose candidates do not resolve in that
     * setup is silently skipped. See `EegCascadeMontage`.
     */
    cascadeMontages: {
        [setup: string]: {
            /** Stable identifier used as the montage name suffix (e.g. `'ekg'` → `'cascade:ekg'`). */
            id: string
            /** Display label shown in the montage selector. */
            label: string
            /**
             * Candidate source channels in priority order. The first candidate that matches a
             * channel in the keyed setup (by label or name) wins. Each candidate is a plain string
             * (no electrode-pair derivation — the cascade view always reads the raw source).
             */
            candidates: string[]
            /** Number of stacked time-shifted rows. Typical polygraphic scanning range is 10–15. */
            rowCount: number
            /**
             * Seconds per row. Becomes the montage's `pageLength` override — forces constant
             * sec/page geometry while the cascade montage is active so calibrated (cm/sec)
             * timebase is coerced.
             */
            pageLength: number
            /**
             * Initial sensitivity for the cascade montage. Units match the recording's sensitivity
             * unit (typically µV/cm; the user-facing slider operates on the same value). Cascade
             * montages flip `applyToMontage` on, so this value is the montage's own state and does
             * not affect the recording's sensitivity. Omit to inherit the recording's value.
             */
            sensitivity?: number
            /** Initial highpass filter (Hz). 0 or omitted = off. Typical EKG band starts at 0.5. */
            highpass?: number
            /** Initial lowpass filter (Hz). 0 or omitted = off. Typical EKG band ends around 40. */
            lowpass?: number
            /** Initial notch filter (Hz). 0 or omitted = off. Typical values 50 (EU) or 60 (US). */
            notch?: number
        }[]
    }
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
    cascadeMontages?: EegInterfaceSettings['cascadeMontages']
    epochMode?: EegInterfaceSettings['epochMode']
    extraMontages?: {
        [setup: string]: (BiosignalMontageTemplate | string)[]
    }
    extraSetups?: (ConfigBiosignalSetup | string)[]
    hotkeys?: Partial<EegInterfaceSettings['hotkeys']>
    skipDefaultSetups?: boolean
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
