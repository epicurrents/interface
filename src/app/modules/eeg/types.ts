/**
 * Additions to base EEG module types.
 */

import type { InterfaceSchema, } from '#types/interface'
import type { CommonBiosignalInterfaceSettings, HotkeyProperties, RecursivePartial } from '#types/config'
import type { ModuleConfiguration } from '#types/globals'
import type {
    BiosignalMontageTemplate,
    CommonBiosignalSettings,
    ConfigBiosignalSetup,
    SettingsColor,
} from '@epicurrents/core/types'
import type { EegModuleSettings } from '@epicurrents/eeg-module/types'

export type EegInterfaceSchemas = InterfaceSchema

/**
 * A lead-field matrix and the source grid it was computed for, as delivered by the host's
 * {@link LeadFieldProvider}.
 *
 * `leadField` and `srcPos` are little-endian float64 in C order; they may be views into the same
 * `ArrayBuffer` (the interface never writes to either).
 */
export type LeadFieldData = {
    /** Full lead-field matrix, shape (nChannels, nSources × nOrient), row-major float64. */
    leadField:    Float64Array
    /** Source positions, shape (nSources, 3), in metres, float64. */
    srcPos:       Float64Array
    nChannels:    number
    nSources:     number
    nOrient:      number
    /** Channel names in the order the lead-field rows are stored. */
    channelNames: string[]
}

/**
 * Host-supplied source for pre-computed lead fields, used by the source-localisation tool.
 *
 * The interface never knows where lead fields come from — a host injects this through
 * `SETUP.modules.eeg.leadFieldProvider` and owns every URL, credential and fallback decision
 * behind it. Without a provider the tool reports source localisation as unavailable.
 *
 * Resolve to `null` when no lead field exists for the requested parameters (a normal, expected
 * outcome the tool surfaces as "not available on this server"). Reject with an `Error` when the
 * lookup itself failed — a network error, a malformed payload — so the tool can offer a retry.
 *
 * @param montageName - MNE standard montage name, e.g. `'standard_1020'`.
 * @param nOrient - Dipole orientations per source: 1 (fixed) or 3 (free).
 * @param gridResMm - Source grid spacing in millimetres.
 */
export type LeadFieldProvider = (
    montageName: string,
    nOrient:     number,
    gridResMm:   number,
) => Promise<LeadFieldData | null>

export type EegInterfaceSettings = CommonBiosignalInterfaceSettings & {
    /** Per-trend display settings — keyed by trend id (`aeeg`, `ratio`, `pdbsi`,
     *  future trend types). Display-only knobs live here, not in
     *  `CommonBiosignalSettings.trends`, so the trend worker / processor never
     *  has to know about render flags. */
    trends: {
        /**
         * Trend type selected when a recording is opened, as a key of the trend registry. Only the
         * selected trend is ever computed, so this decides what a deployment pays for as well as
         * what it shows first.
         */
        defaultType: string
        /**
         * Open the trend strip with the recording rather than waiting to be asked. Opening the
         * strip is also what triggers the selected trend's computation.
         */
        showStrip: boolean
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
        /** Overlay for the span beyond the trusted-navigation frontier on restricted recordings. */
        offLimitsColor: SettingsColor
        /**
         * Express navigator tick labels and the cursor read-out as time elapsed from the start of
         * the recording (`true`) instead of the recording's wall-clock time of day (`false`).
         * Relative time is the default: it is meaningful for every recording, whereas the time of
         * day depends on the source file carrying a trustworthy start timestamp — which
         * de-identified recordings deliberately do not.
         */
        relativeTime: boolean
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
    timeline: {
        labelSpacing: number
    }
    topogram: {
        /** Display a colour scale with the voltage limit next to the topogram. */
        colorbar: boolean
        /**
         * Diverging colour ramp for the scalp field. EEG potentials have a meaningful zero and a sign, so `neutral`
         * belongs at the midpoint and must stay neutral: a third hue there reads as a third category. The poles are
         * chosen to stay separable under protanopia and deuteranopia, so the sign of the field is never carried by a
         * red/green distinction.
         */
        colors: {
            negative: SettingsColor
            neutral: SettingsColor
            positive: SettingsColor
        }
        /** Number of field contour levels either side of zero. 0 draws no contours. */
        contours: number
        /**
         * Colour saturation of the mid range, 0 (linear) to 100 (most saturated).
         *
         * The default is 0, on the strength of reading spikes on real recordings. At 0 the colour is proportional to
         * the voltage, so a focal discharge stands out against a scalp that is near-neutral because it genuinely is
         * near zero there. Raising it lifts the mid range towards the poles, which inflates how far the discharge
         * appears to spread — a distortion of the one property the reader is judging.
         *
         * Raise it to bring out low-amplitude structure instead: a diffuse asymmetry, a background gradient, the weak
         * counterpart of a dipole. This shapes the ramp only; it does not alter the underlying values.
         */
        intensity: number
        /**
         * Voltage in µV mapped to full saturation. 0 scales every frame to its own maximum (i.e. automatically).
         *
         * Per-frame scaling is what MNE does and what this tool did before, but it hides amplitude changes entirely:
         * a flat stretch and a burst render identically. Set a fixed scale to compare across a time window.
         */
        scale: number
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
    /**
     * Derivations the aEEG trend resolves against a recording's setup, and the fallback for
     * {@link ratio} and {@link spectrogram} when those declare none. The module defaults name
     * 10-20 electrodes, so a deployment whose electrode array does not carry them (a sub-hairline
     * array, an intracranial grid) must redeclare them here or all three trends silently build
     * nothing. Merged over the module defaults; `derivations` replaces the default list wholesale.
     */
    aeeg?: Partial<NonNullable<EegModuleSettings['aeeg']>>
    cascadeMontages?: EegInterfaceSettings['cascadeMontages']
    epochMode?: EegInterfaceSettings['epochMode']
    extraMontages?: {
        [setup: string]: (BiosignalMontageTemplate | string)[]
    }
    extraSetups?: (ConfigBiosignalSetup | string)[]
    hotkeys?: Partial<EegInterfaceSettings['hotkeys']>
    /**
     * Source of pre-computed lead fields for the source-localisation tool. Omit it and the tool
     * reports source localisation as unavailable. See {@link LeadFieldProvider}.
     */
    leadFieldProvider?: LeadFieldProvider
    /**
     * Homologous electrode pairs the pdBSI trend averages over. Same electrode-naming caveat as
     * {@link aeeg}: pairs that do not resolve against the recording's setup are skipped, and the
     * trend is not built at all when none of them resolve.
     */
    pdbsi?: Partial<NonNullable<EegModuleSettings['pdbsi']>>
    /**
     * Derivations for the frequency-ratio trend, when it should not share the aEEG ones. The two
     * trends read the same signal differently — aEEG wants the widest bipolar span it can get,
     * while a band-ratio index computed against a common average reference is usually taken from a
     * single electrode — so an array where that distinction matters declares both.
     */
    ratio?: Partial<NonNullable<EegModuleSettings['ratio']>>
    skipDefaultSetups?: boolean
    /** Derivations for the spectrogram trend, when it should not share the aEEG ones. */
    spectrogram?: Partial<NonNullable<EegModuleSettings['spectrogram']>>
    navigator?: Partial<EegInterfaceSettings['navigator']>
    tools?: Partial<EegInterfaceSettings['tools']>
    trace?: RecursivePartial<EegInterfaceSettings['trace']>
    /** Per-trend math knobs (epoch length, frequency bands, referencing). Merged per trend type
     *  over the module defaults, so naming one knob leaves the rest of that trend's defaults. */
    /**
     * Trend configuration. Carries both halves: the maths knobs (`amplitude`, `spectrogram`,
     * `ratio`, `pdbsi` epoch lengths, bands, referencing) belong to the module settings, while
     * `defaultType` and `showStrip` are interface state. `applyConfiguration` routes each to its
     * own object — they share a key here because a deployment configuring trends should not have
     * to know which layer owns which knob.
     */
    trends?: RecursivePartial<NonNullable<CommonBiosignalSettings['trends']>>
        & RecursivePartial<Pick<EegInterfaceSettings['trends'], 'defaultType' | 'showStrip'>>
}

export type EegNavigationKey = 'ArrowLeft' | 'ArrowRight' | 'PageDown' | 'PageUp'

export type EegToolProperties = {
    color: SettingsColor
    dasharray?: number[]
    radius?: number
    style?: string
    width?: number
}
