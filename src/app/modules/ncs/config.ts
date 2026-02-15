/**
 * Expanded NCS module configuration for the interface part. These settings are pretty much a copy of the EEG module
 * settings for testing purposes and must be updated to fit the needs of the NCS module.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { SettingsValue, type SettingsColor } from '@epicurrents/core/types'
import { type NcsInterfaceSettings } from './types'
import type {
    DropdownGroup,
    DropdownItem,
} from "#types/interface"
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

export const schemas: InterfaceModuleSchema = {
    __proto__: null,
    module: 'ncs',
    controls: [
        ////////////////      SENSITIVITY    //////////////////
        {
            id: 'sensitivity',
            groups: [] as DropdownGroup[],
            joinLeft: true,
            label: 'Sensitivity',
            options: [] as DropdownItem[],
            reloadOn: ['resource:sensitivity'],
            type: 'dropdown',
            version: 0,
            width: '6.5rem',
        },
    ],
    instructions: {
        content: '',
        description: 'NCS module instructions.',
        label: {
            full: 'Nerve Conduction Studies',
            short: 'NCS',
        },
    },
    settings: {
        description: 'Nerve Conduction Studies settings.',
        fields: [
            {
                text: 'Memory management',
                type: 'subtitle',
                info: 'Control how NCS resource memory is being managed.',
            },
            {
                component: 'settings-checkbox',
                setting: 'ncs.useMemoryManager',
                text: 'Use the application memory manager with NCS resources.',
                type: 'setting',
                memoryManager: true,
                reloadTooltip: 'Change only applies to files opened after the setting is changed.',
                requiresReload: true,
                width: '3em',
            },
            {
                component: 'settings-checkbox',
                setting: 'ncs.unloadOnClose',
                text: 'Unload cached signal data when NCS resources are closed.',
                type: 'setting',
                width: '3em',
            },
            {
                text: 'Display options',
                type: 'subtitle',
                info: 'Alter the default appearance of NCS traces.',
            },
            {
                component: 'settings-checkbox',
                setting: 'ncs.displayPolarity',
                text: 'Invert NCS trace polarity.',
                type: 'setting',
                valueMap: [[1, false], [-1, true]],
                width: '3em',
            },
            {
                component: 'settings-checkbox',
                setting: 'ncs.antialiasing',
                text: 'Apply antialiasing to NCS traces.',
                type: 'setting',
                width: '3em',
            },
            {
                text: 'Color options',
                type: 'subtitle',
                info: 'Select the color of the NCS traces.',
            },
            {
                component: 'settings-colorpicker',
                setting: 'ncs.trace.color.eeg',
                text: 'Default color of the NCS traces.',
                type: 'setting',
                width: '3em',
            },
            {
                text: 'Grid options',
                type: 'subtitle',
                info: 'Change the properties of the background grid.',
            },
            {
                component: 'settings-checkbox',
                setting: 'ncs.majorGrid.show',
                text: 'Display major grid lines.',
                type: 'setting',
                width: '3.25em',
            },
            {
                component: 'settings-number',
                setting: 'ncs.majorGrid.width',
                min: 1,
                max: 5,
                text: 'Width of the major grid in pixels.',
                type: 'setting',
                width: '3.25em',
            },
            {
                component: 'settings-colorpicker',
                setting: 'ncs.majorGrid.color',
                text: 'Color of the major grid lines.',
                type: 'setting',
                width: '3.25em',
            },
            {
                component: 'settings-checkbox',
                setting: 'ncs.minorGrid.show',
                text: 'Display minor grid lines.',
                type: 'setting',
                width: '3.25em',
            },
            {
                component: 'settings-number',
                setting: 'ncs.minorGrid.width',
                min: 1,
                max: 5,
                text: 'Width of the minor grid in pixels.',
                type: 'setting',
                width: '3.25em',
            },
            {
                component: 'settings-colorpicker',
                setting: 'ncs.minorGrid.color',
                text: 'Color of the minor grid lines.',
                type: 'setting',
                width: '3.25em',
            },
            {
                text: 'Channel isoelectric lines',
                type: 'subtitle',
                info: 'Change the properties of the isoelectric line for signals.',
            },
            {
                component: 'settings-checkbox',
                setting: 'ncs.isoelLine.show',
                text: 'Display channel isoelectric lines.',
                type: 'setting',
                width: '3.25em',
            },
            {
                component: 'settings-number',
                setting: 'ncs.isoelLine.width',
                min: 1,
                max: 5,
                text: 'Width of the isoelectric lines in pixels.',
                type: 'setting',
                width: '3.25em',
            },
            {
                component: 'settings-colorpicker',
                setting: 'ncs.isoelLine.color',
                text: 'Color of the isoelectric lines.',
                type: 'setting',
                width: '3.25em',
            },
            {
                text: 'Epoch mode options',
                type: 'subtitle',
                info: 'Options to control epoch-based data browsing.',
            },
            // Not adding these to the _userDefinable object will prevent them from being saved in the cookie.
            {
                component: 'settings-checkbox',
                setting: 'ncs.epochMode.enabled',
                text: 'Use epoch-based data browsing (requires setting an epoch length).',
                type: 'setting',
                width: '3.25em',
            },
            {
                component: 'settings-checkbox',
                setting: 'ncs.epochMode.onlyFullEpochs',
                text: 'Only display full epochs (hide possible partial last epoch).',
                type: 'setting',
                width: '3.25em',
            },
            {
                component: 'settings-number',
                setting: 'ncs.epochMode.epochLength',
                text: 'Length of a single epoch in seconds (set to zero to disable).',
                min: 0,
                max: 60,
                zeroMeansOff: true,
                type: 'setting',
                width: '3.25em',
            },
        ],
        label: {
            full: 'Nerve Conduction Studies',
            short: 'NCS',
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
}

export const settings: NcsInterfaceSettings = {
    __proto__: null,
    _userDefinable: {
        'antialiasing': Boolean,
        'annotations.saveToDataset': Boolean,
        'channelSpacing': Number,
        'displayPolarity': Number,
        'filters.highpass.default': Number,
        'filters.lowpass.default': Number,
        'filters.notch.default': Number,
        'isoelLine.color': String,
        'isoelLine.show': Boolean,
        'isoelLine.width': Number,
        'majorGrid.color': String,
        'majorGrid.show': Boolean,
        'majorGrid.width': Number,
        'minorGrid.color': String,
        'minorGrid.show': Boolean,
        'minorGrid.width': Number,
        'trace.color': String,
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
        },
        color: [0, 0, 1, 0.75] as SettingsColor,
        containWithinRecording: true,
        saveToDataset: false,
        typeColors: {},
        width: 1,
    },
    antialiasing: false,
    border: {
    },
    channelSpacing: 1,
    compatibleView: 'biosignal',
    continuousBrowseDelay: 500,
    continuousBrowseInterval: 100,
    controlsBarHeight: '2.5rem',
    cursor: {
        active: {
            color: [0.5, 0, 0, 0.4] as SettingsColor,
            width: 2,
        },
        main: {
            color: [0.5, 0, 0, 0.4] as SettingsColor,
            width: 2,
        }
    },
    displayPolarity: -1,
    downsampleLimit: 3000,
    epochMode: {
        enabled: false,
        epochLength: 0,
        onlyFullEpochs: false,
    },
    filters: {
        highpass: {
            availableValues: [],
            default: 0,
        },
        lowpass: {
            availableValues: [],
            default: 0,
        },
        notch: {
            availableValues: [0, 50, 60],
            default: 0,
        },
    },
    grid: {
        major: {
            show: false,
            color: [0, 0, 0, 0.25] as SettingsColor,
            style: 'solid',
            width: 2,
        },
        minor: {
            show: false,
            color: [0, 0, 0, 0.15] as SettingsColor,
            style: 'solid',
            width: 1,
        },
        intersections: {
            show: true,
            color: [0, 0, 0, 0.25] as SettingsColor,
            style: 'solid',
            width: 2,
        },
    },
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
        inspect: {
            code: 'KeyI',
            control: false,
            key: 'i',
            shift: false,
        },
        notch: {
            code: 'KeyN',
            control: false,
            key: 'n',
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
    minSignalSelection: 0.002,
    navigator: {
        annotationColor: [0, 0, 1, 0.5] as SettingsColor,
        borderColor: [0, 0, 0, 0.2] as SettingsColor,
        cachedColor: [0, 0.75, 0, 0.5] as SettingsColor,
        interruptionColor: [1, 0, 0, 0.5] as SettingsColor,
        loadedColor: [0, 0.35, 0, 0.5] as SettingsColor,
        loadingColor: [0.05, 0.20, 0.05, 0.5] as SettingsColor,
        signalColor: [0, 0.4, 0.9, 0.5] as SettingsColor,
        theme: 'default',
        tickColor: [0, 0, 0, 0.2] as SettingsColor,
        viewBoxColor: [1, 0.2, 0.2, 0.25] as SettingsColor,
    },
    notchDefaultFrequency: 50,
    pageLength: 0, // Not used in EMG.
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
        default: {
            availableValues: [10, 20, 30, 40, 50, 100, 200, 300, 500],
            default: 100,
            scale: 1e-6,
        },
        fwave: {
            availableValues: [100, 200, 300, 400, 500, 1000, 2000, 3000, 5000],
            default: 500,
            scale: 1e-6,
        },
        hreflex: {
            availableValues: [10, 20, 30, 40, 50, 100, 200, 300, 500],
            default: 100,
            scale: 1e-6,
        },
        motor: {
            availableValues: [100, 200, 300, 400, 500, 1000, 2000, 3000, 5000],
            default: 2000,
            scale: 1e-6,
        },
        sensory: {
            availableValues: [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 100, 200],
            default: 10,
            scale: 1e-6,
        },
    },
    sensitivityUnit: 'default',
    services: {},
    showHiddenChannels: false,
    showMissingChannels: false,
    timebase: {
        default: {
            availableValues: [0.2, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 25, 50],
            default: 1,
            label: 'ms/Div',
            unit: 'ms/D',
        },
        fwave: {
            availableValues: [0.2, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 25, 50],
            default: 5,
            label: 'ms/Div',
            unit: 'ms/D',
        },
        hreflex: {
            availableValues: [0.2, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 25, 50],
            default: 2,
            label: 'ms/Div',
            unit: 'ms/D',
        },
        motor: {
            availableValues: [0.2, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 25, 50],
            default: 2,
            label: 'ms/Div',
            unit: 'ms/D',
        },
        sensory: {
            availableValues: [0.2, 0.5, 1, 2, 3, 5, 7, 10, 15, 20, 25, 50],
            default: 1,
            label: 'ms/Div',
            unit: 'ms/D',
        },
    },
    timebaseUnit: 'default',
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
        color: [0, 0, 0, 1] as SettingsColor,
        colorSides: false,
        highlight: {
            color: [1, 0, 0, 0.2] as SettingsColor,
        },
        selections: {
            color: [0, 0, 1, 0.075] as SettingsColor,
        },
        theme: 'default',
        width: 1,
    },
    viewport: {
        horizontalDivs: 10,
        mainAxis: 'y',
        verticalDivs: 10,
    },
}
