/**
 * Expanded EEG module configuration for the interface part.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { safeObjectFrom } from '@epicurrents/core/util'
import { SettingsValue, type SettingsColor } from '@epicurrents/core/types'
import { type EegInterfaceSettings } from './types'
import type { InterfaceModuleSchema } from '#types/config'
import { getInputForSetting, getSettingForInput } from '#config'

/**
 * Helper type for the input/setting converters.
 */
export type MenuValueMap = {
    fields: {
        setting?: string
        valueMap?: [SettingsValue, (string | number | boolean)][]
    }[]
}

export const schemas: InterfaceModuleSchema = safeObjectFrom({
    module: 'eeg',
    controls: [
    ],
    instructions: {
        content: '',
        description: 'EEG module instructions.',
        label: {
            full: 'Electroencephalography',
            short: 'EEG',
        },
    },
    settings: {
        description: 'Electroencephalography settings.',
        fields: [
            {
                text: 'Memory management',
                type: 'subtitle',
                info: 'Control how EEG resource memory is being managed.',
            },
            {
                component: 'settings-checkbox',
                setting: 'eeg.useMemoryManager',
                text: 'Use the application memory manager with EEG resources.',
                type: 'setting',
                memoryManager: true,
                reloadTooltip: 'Only applies to files opened after the setting is changed.',
                requiresReload: true,
                width: '5rem',
            },
            {
                component: 'settings-checkbox',
                setting: 'eeg.unloadOnClose',
                text: 'Unload cached signal data when EEG resources are closed.',
                type: 'setting',
                width: '5rem',
            },
            {
                text: 'Display options',
                type: 'subtitle',
                info: 'Alter the default appearance of EEG traces.',
            },
            {
                component: 'settings-checkbox',
                setting: 'eeg.displayPolarity',
                text: 'Invert EEG trace polarity.',
                type: 'setting',
                valueMap: [[1, false], [-1, true]],
                width: '5rem',
            },
            {
                component: 'settings-checkbox',
                setting: 'eeg.antialiasing',
                text: 'Apply antialiasing to EEG traces.',
                type: 'setting',
                width: '5rem',
            },
            {
                text: 'Montage options',
                type: 'subtitle',
                info: 'Montage options apply to the four universal montages; As recorded, Average reference, Longutudina bipolar, and Transverse bipolar. Possible setup-specific additional montages are not affected by these settings.',
            },
            {
                component: 'settings-dropdown',
                options: [
                    { label: 'As recorded', value: 'rec' },
                    { label: 'Average reference', value: 'avg' },
                    { label: 'Longitudinal bipolar', value: 'lon' },
                    { label: 'Transverse bipolar', value: 'trv' },
                ],
                setting: 'eeg.defaultMontage',
                text: 'Default montage to use when opening a new recording.',
                type: 'setting',
                width: '50%',
            },
            {
                text: 'Color options',
                type: 'subtitle',
                info: 'Select one of the color presets or adjust the color of different trace types.',
            },
            {
                component: 'settings-preset',
                presets: [
                    { setting: 'eeg.trace.colorSides', value: false },
                    { setting: 'eeg.trace.color.eeg', value: 'rgba(0,0,0,1)' },
                    { setting: 'eeg.trace.color.ekg', value: 'rgba(0,0,0,1)' },
                    { setting: 'eeg.trace.color.emg', value: 'rgba(0,0,0,1)' },
                    { setting: 'eeg.trace.color.eog', value: 'rgba(0,0,0,1)' },
                    { setting: 'eeg.trace.color.res', value: 'rgba(0,0,0,1)' },
                ],
                text: 'All traces black.',
                type: 'preset',
            },
            {
                component: 'settings-preset',
                presets: [
                    { setting: 'eeg.trace.colorSides', value: false },
                    { setting: 'eeg.trace.color.eeg', value: 'rgba(0,0,0,1)' },
                    { setting: 'eeg.trace.color.ekg', value: 'rgba(200,0,0,1)' },
                    { setting: 'eeg.trace.color.emg', value: 'rgba(80,0,0,1)' },
                    { setting: 'eeg.trace.color.eog', value: 'rgba(0,0,200,1)' },
                    { setting: 'eeg.trace.color.res', value: 'rgba(0,200,0,1)' },
                ],
                text: 'EEG traces black, polygraphic traces colored.',
                type: 'preset',
            },
            {
                component: 'settings-preset',
                presets: [
                    { setting: 'eeg.trace.colorSides', value: true },
                    { setting: 'eeg.trace.color.dex', value: 'rgba(0,0,120,1)' },
                    { setting: 'eeg.trace.color.mid', value: 'rgba(0,120,0,1)' },
                    { setting: 'eeg.trace.color.sin', value: 'rgba(120,0,0,1)' },
                ],
                text: 'Left side red, right side blue, midline green.',
                type: 'preset',
            },
            {
                component: 'settings-preset',
                presets: [
                    { setting: 'eeg.trace.colorSides', value: true },
                    { setting: 'eeg.trace.color.dex', value: 'rgba(120,0,0,1)' },
                    { setting: 'eeg.trace.color.mid', value: 'rgba(0,120,0,1)' },
                    { setting: 'eeg.trace.color.sin', value: 'rgba(0,0,120,1)' },
                ],
                text: 'Left side blue, right side red, midline green.',
                type: 'preset',
            },
            {
                component: 'settings-colorpicker',
                setting: 'eeg.trace.color.eeg',
                text: 'Default color of the EEG traces.',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-colorpicker',
                setting: 'eeg.trace.color.ekg',
                text: 'Default color of the EKG traces.',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-colorpicker',
                setting: 'eeg.trace.color.eog',
                text: 'Default color of the EOG traces.',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-checkbox',
                height: '2.5rem',
                setting: 'eeg.trace.colorSides',
                text: 'Use different colors based on channel laterality.',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-colorpicker',
                setting: 'eeg.trace.color.sin',
                text: 'Color of the left side EEG traces.',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-colorpicker',
                setting: 'eeg.trace.color.dex',
                text: 'Color of the right side EEG traces.',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-colorpicker',
                setting: 'eeg.trace.color.mid',
                text: 'Color of the midline EEG traces.',
                type: 'setting',
                width: '5rem',
            },
            {
                text: 'Grid options',
                type: 'subtitle',
                info: 'Change the properties of the background grid.',
            },
            {
                component: 'settings-checkbox',
                height: '2.5rem',
                setting: 'eeg.grid.major.show',
                text: 'Display major grid lines.',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-number',
                setting: 'eeg.grid.major.width',
                min: 1,
                max: 5,
                text: 'Width of the major grid in pixels.',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-colorpicker',
                setting: 'eeg.grid.major.color',
                text: 'Color of the major grid lines.',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-checkbox',
                height: '2.5rem',
                setting: 'eeg.grid.minor.show',
                text: 'Display minor grid lines.',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-number',
                setting: 'eeg.grid.minor.width',
                min: 1,
                max: 5,
                text: 'Width of the minor grid in pixels.',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-colorpicker',
                setting: 'eeg.grid.minor.color',
                text: 'Color of the minor grid lines.',
                type: 'setting',
                width: '5rem',
            },
            {
                text: 'Channel isoelectric lines',
                type: 'subtitle',
                info: 'Change the properties of the isoelectric line for signal channels.',
            },
            {
                component: 'settings-checkbox',
                height: '2.5rem',
                setting: 'eeg.isoelLine.show',
                text: 'Display channel isoelectric lines.',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-number',
                setting: 'eeg.isoelLine.width',
                min: 1,
                max: 5,
                text: 'Width of the isoelectric lines in pixels.',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-colorpicker',
                setting: 'eeg.isoelLine.color',
                text: 'Color of the isoelectric lines.',
                type: 'setting',
                width: '5rem',
            },
            {
                text: 'Epoch mode options',
                type: 'subtitle',
                info: 'Options to control epoch-based data browsing.',
            },
            // Not adding these to the _userDefinable object will prevent them from being saved in the cookie.
            {
                component: 'settings-checkbox',
                height: '2.5rem',
                setting: 'eeg.epochMode.enabled',
                text: 'Use epoch-based data browsing (requires setting an epoch length).',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-checkbox',
                height: '2.5rem',
                setting: 'eeg.epochMode.onlyFullEpochs',
                text: 'Only display full epochs (hide possible partial last epoch).',
                type: 'setting',
                width: '5rem',
            },
            {
                component: 'settings-number',
                setting: 'eeg.epochMode.epochLength',
                text: 'Length of a single epoch in seconds (set to zero to disable).',
                min: 0,
                max: 60,
                zeroMeansOff: true,
                type: 'setting',
                width: '5rem',
            },
            {
                text: 'Pyodide options',
                type: 'subtitle',
                info: 'Options for features depending on the Pyodide service.',
                service: 'pyodide',
            },
            {
                component: 'settings-checkbox',
                height: '2.5rem',
                setting: 'eeg.services.pyodide.topogramColorbar',
                text: 'Display a colorbar with voltage scale next to the topogram.',
                type: 'setting',
                width: '5rem',
                service: 'pyodide',
            },
        ],
        label: {
            full: 'Electroencephalography',
            short: 'EEG',
        },
    },
    // Reference these for easier access.
    getInputForSetting: (
        field: string, value: SettingsValue
    ) => getInputForSetting(
        field, value, schemas.settings.fields, settings
    ),
    getSettingForInput: (
        field: string, input: string | number | boolean
    ) => getSettingForInput(
        field, input, schemas.settings.fields, settings
    ),
})

export const settings: EegInterfaceSettings = safeObjectFrom({
    _userDefinable: {
        'antialiasing': Boolean,
        'annotations.saveToDataset': Boolean,
        'channelSpacing': Number,
        'defaultMontage': String,
        'displayPolarity': Number,
        'groupSpacing': Number,
        'filters.highpass.default': Number,
        'filters.lowpass.default': Number,
        'filters.notch.default': Number,
        'isoelLine.color': String,
        'isoelLine.show': Boolean,
        'isoelLine.width': Number,
        'grid.major.color': String,
        'grid.major.show': Boolean,
        'grid.major.width': Number,
        'grid.minor.color': String,
        'grid.minor.show': Boolean,
        'grid.minor.width': Number,
        'trace.color.eeg': String,
        'trace.color.dex': String,
        'trace.color.mid': String,
        'trace.color.sin': String,
        'trace.color.ekg': String,
        'trace.color.eog': String,
        'trace.colorSides': Boolean,
        'epochMode.enabled': Boolean,
        'epochMode.epochLength': Number,
        'epochMode.onlyFullEpochs': Boolean,
        'useMemoryManager': Boolean,
        'unloadOnClose': Boolean,
    },
    annotations: {
        classes: {
            default: {
                codes: {},
                color: [0, 0, 1, 0.75] as SettingsColor,
                label: 'Event',
                name: 'event',
                quickCode: 0,
            },
            activation: {
                codes: {},
                color: [0, 0.75, 0, 0.75] as SettingsColor,
                label: 'Activation',
                name: 'activation',
                quickCode: 1,
            },
            comment: {
                codes: {},
                color: [0, 0.5, 0.5, 0.75] as SettingsColor,
                label: 'Comment',
                name: 'comment',
                quickCode: 2,
            },
            technical: {
                codes: {},
                color: [0.4, 0.4, 0.4, 0.75] as SettingsColor,
                label: 'Technical',
                name: 'technical',
                quickCode: 3,
            },
        },
        color: [0, 0, 1, 0.75] as SettingsColor,
        containWithinRecording: true,
        saveToDataset: false,
        typeColors: {
            'act_ec': [0.25, 0.5, 0.25, 0.75] as SettingsColor,
            'act_eo': [0.25, 0.5, 0.25, 0.75] as SettingsColor,
            'act_hv': [0.6, 0, 0.4, 0.75] as SettingsColor,
            'act_phv': [0.4, 0.2, 0.4, 0.75] as SettingsColor,
            'act_ps': [0.5, 0.5, 0, 0.75] as SettingsColor,
        },
        width: 1,
    },
    antialiasing: false,
    border: {
        bottom: {
            color: [0.8, 0.8, 0.8, 1] as SettingsColor,
            style: 'solid',
            width: 2,
        },
        left: {
            color: [0.8, 0.8, 0.8, 1] as SettingsColor,
            style: 'solid',
            width: 2,
        },
    },
    channelSpacing: 1,
    compatibleView: 'biosignal',
    continuousBrowseDelay: 500,
    continuousBrowseInterval: 100,
    controlsBarHeight: '2.5rem',
    cursor: {
        active: {
            color: [0, 0, 1, 0.4] as SettingsColor,
            width: 3,
        },
        main: {
            color: [0.5, 0, 0, 0.4] as SettingsColor,
            width: 3,
        },
    },
    defaultMontage: 'rec',
    displayPolarity: -1,
    downsampleLimit: 250,
    epochMode: {
        enabled: false,
        epochLength: 0,
        onlyFullEpochs: false,
    },
    extraMontages: {},
    extraSetups: [],
    filters: {
        highpass: {
            availableValues: [0, 0.1, 0.3, 0.5, 0.7, 1, 1.5, 2, 2.5, 3, 4, 5],
            default: 0.3,
        },
        lowpass: {
            availableValues: [0, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 100],
            default: 70,
        },
        notch: {
            availableValues: [0, 50, 60],
            default: 0,
        },
    },
    grid: {
        major: {
            show: true,
            color: [0, 0, 0, 0.25] as SettingsColor,
            style: 'solid',
            width: 2,
        },
        minor: {
            show: true,
            color: [0, 0, 0, 0.15] as SettingsColor,
            style: 'solid',
            width: 1,
        },
        intersections: {
            show: true,
            color: [0, 0, 0, 0.1] as SettingsColor,
            style: 'solid',
            width: 1,
        },
    },
    groupSpacing: 1.5,
    highlights: {
        showCollars: true,
    },
    hotkeys: {
        annotation: {
            code: 'KeyA',
            control: false,
            key: 'a',
            shift: false,
        },
        examine: {
            code: 'KeyE',
            control: false,
            key: 'e',
            shift: false,
        },
        fft: {
            code: 'KeyF',
            control: false,
            key: 'f',
            shift: false,
        },
        inspect: {
            code: 'KeyI',
            control: false,
            key: 'i',
            shift: false,
        },
        montage1: {
            code: 'Digit1',
            control: false,
            key: '1',
            shift: false,
        },
        montage2: {
            code: 'Digit2',
            control: false,
            key: '2',
            shift: false,
        },
        montage3: {
            code: 'Digit3',
            control: false,
            key: '3',
            shift: false,
        },
        montage4: {
            code: 'Digit4',
            control: false,
            key: '4',
            shift: false,
        },
        notch: {
            code: 'KeyN',
            control: false,
            key: 'n',
            shift: false,
        },
        report: {
            code: 'KeyR',
            control: false,
            key: 'r',
            shift: false,
        },
        topogram: {
            code: 'KeyT',
            control: false,
            key: 't',
            shift: false,
        },
    },
    isoelLine: {
        show: false,
        color: [0.9, 0.9, 0.9, 1] as SettingsColor,
        style: 'solid',
        width: 1,
    },
    markers: {
        active: {
            color: [0, 0.25, 0.75, 1] as SettingsColor,
            style: 'line',
            width: 2,
        },
        focused: {
            color: [0, 0, 1, 1] as SettingsColor,
            style: 'line',
            width: 2,
        },
        inactive: {
            color: [0, 0, 0, 0.4] as SettingsColor,
            style: 'line',
            width: 2,
        },
    },
    minorGrid: {
        show: true,
        color: [0, 0, 0, 0.15] as SettingsColor,
        style: 'solid',
        width: 1,
    },
    minSignalSelection: 0.2,
    navigator: {
        annotationColor: [0, 0, 1, 0.5] as SettingsColor,
        borderColor: [0, 0, 0, 0.2] as SettingsColor,
        cachedColor: [0, 0.75, 0, 0.5] as SettingsColor,
        interruptionColor: [0, 0, 0, 0.1] as SettingsColor,
        loadedColor: [0, 0.35, 0, 0.5] as SettingsColor,
        loadingColor: [0.05, 0.20, 0.05, 0.5] as SettingsColor,
        theme: 'default',
        tickColor: [0, 0, 0, 0.2] as SettingsColor,
        viewBoxColor: [1, 0.2, 0.2, 0.25] as SettingsColor,
    },
    notchDefaultFrequency: 50,
    pageLength: 10,
    scale: {
        availableValues: [-9, -6, -3, -2, -1, 0, 1, 2, 3, 6, 9],
        default: 0,
    },
    selectionBound: {
        color: [0.5, 0, 0.5, 0.25] as SettingsColor,
        style: 'dashed',
        width: 2,
    },
    sensitivity: {
        // Sensitivity units must be integers as they are rounded to account for float errors from scaling.
        uVperCm: {
            availableValues: [10, 20, 30, 50, 70, 100, 125, 150, 175, 200, 250, 300, 400, 500, 1000],
            default: 100,
            // We need to convert from sensitivity uV into base unit V, so apply a scale of 10^-6.
            scale: 1e-6,
        },
    },
    sensitivityUnit: 'uVperCm',
    services: {
        pyodide: {
            topogramColorbar: true,
        },
    },
    timebase: {
        secPerPage: {
            availableValues: [5, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25, 30, 35, 40, 45, 50, 55, 60],
            default: 10,
            label: 'Seconds/page',
            unit: 's/pg',
        },
        cmPerSec: {
            availableValues: [3],
            default: 3,
            label: 'cm/second',
            unit: 'cm/s',
        },
    },
    timebaseUnit: 'cmPerSec',
    timeline: {
        labelSpacing: 2,
    },
    tools: {
        cursorLine: {
            color: [0.5, 0, 0, 0.4] as SettingsColor,
            style: 'solid',
            width: 2,
        },
        excludeArea: {
            color: [0.5, 0.5, 0.5, 0.2] as SettingsColor,
            style: 'solid',
            width: 1,
        },
        guideLine: {
            color: [0.5, 0.5, 0.5, 0.25] as SettingsColor,
            style: 'solid',
            width: 1,
        },
        guideLineSymbol: {
            color: [0.5, 0.5, 0.5, 0.5] as SettingsColor,
        },
        highlightArea: {
            color: [1, 1, 0.5, 0.5] as SettingsColor,
        },
        poiMarkerLine: {
            color: [0.9, 0.7, 0.6, 1] as SettingsColor,
            dasharray: [2, 1],
            style: 'dashed',
            width: 1,
        },
        poiMarkerCircle: {
            color: [0.9, 0.7, 0.6, 1] as SettingsColor,
            radius: 5,
            style: 'solid',
            width: 2,
        },
        signals: [
            {
                color: [0, 0.4, 0.9, 1] as SettingsColor,
                style: 'solid',
                width: 1,
            },
            {
                color: [0.75, 0, 0.2, 1] as SettingsColor,
                style: 'solid',
                width: 1,
            },
            {
                color: [0, 0.6, 0.2, 1] as SettingsColor,
                style: 'solid',
                width: 1,
            },
        ],
        signalBaseline: {
            color: [0.9, 0.8, 0.8, 1] as SettingsColor,
            dasharray: [8, 2],
            style: 'dashed',
            width: 1,
        },
    },
    trace: {
        color: {
            eeg: [0, 0, 0, 1] as SettingsColor,
                sin: [0.5, 0, 0, 1] as SettingsColor,
                dex: [0, 0, 0.5, 1] as SettingsColor,
                mid: [0, 0.5, 0, 1] as SettingsColor,
            ekg: [0.75, 0, 0, 1] as SettingsColor,
            emg: [0.3, 0, 0, 1] as SettingsColor,
            eog: [0, 0, 0.75, 1] as SettingsColor,
            res: [0, 0.8, 0, 1] as SettingsColor,
            act: [0.1, 0.1, 0.1, 1] as SettingsColor,
            meta: [0, 0, 0, 0] as SettingsColor, // Hide meta channel signal as failsafe
            default: [0.2, 0.2, 0.2, 1] as SettingsColor,
        },
        colorSides: false,
        highlight: {
            color: [1, 0, 0, 0.2] as SettingsColor,
        },
        selections: {
            color: [0, 0, 1, 0.075] as SettingsColor,
        },
        theme: 'default',
        width: {
            eeg: 1,
            ekg: 1,
            eog: 1,
        },
    },
    yPadding: 1,
})
