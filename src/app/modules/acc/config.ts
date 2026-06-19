/**
 * Interface-level ACC module configuration. Cherry-picks from the EEG defaults
 * (the EEG presentation model is the closest fit for long-duration body-scale
 * signals) and adapts the numerical ranges and units for accelerometry —
 * seconds-per-page timebase, m/s² sensitivity, no trend strip, no epoch mode.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { safeObjectFrom } from '@epicurrents/core/util'
import type { SettingsColor, SettingsValue } from '@epicurrents/core/types'
import type { DropdownGroup, DropdownItem } from '#types/interface'
import type { InterfaceModuleSchema } from '#types/config'
import { getInputForSetting, getSettingForInput } from '#config'

export const schemas: InterfaceModuleSchema = safeObjectFrom({
    module: 'acc',
    controls: [
        {
            id: 'sensitivity',
            groups: [] as DropdownGroup[],
            joinLeft: true,
            label: 'Sensitivity',
            options: [] as DropdownItem[],
            reloadOn: ['resource:sensitivity'],
            type: 'dropdown',
            version: 0,
            width: '8rem',
        },
        {
            id: 'timebase',
            groups: [] as DropdownGroup[],
            joinLeft: true,
            label: 'Timebase',
            options: [] as DropdownItem[],
            reloadOn: ['resource:timebase'],
            type: 'dropdown',
            version: 0,
            width: '8rem',
        },
    ],
    instructions: {
        content: '',
        description: 'ACC module instructions.',
        label: {
            full: 'Accelerometry',
            short: 'ACC',
        },
    },
    settings: {
        description: 'Accelerometry settings.',
        fields: [],
        label: {
            full: 'Accelerometry',
            short: 'ACC',
        },
    },
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

export const settings = safeObjectFrom({
    _userDefinable: {
        'antialiasing': Boolean,
        'annotations.saveToDataset': Boolean,
        'channelSpacing': Number,
        'displayPolarity': Number,
        'filters.highpass.default': Number,
        'filters.lowpass.default': Number,
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
        'unloadOnClose': Boolean,
        'useMemoryManager': Boolean,
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
    displayPolarity: 1,
    downsampleLimit: 250,
    filters: {
        highpass: {
            availableValues: [0, 0.1, 0.3, 0.5, 1, 2, 5],
            // Accelerometry sits on a ~1 g gravity baseline (a 0 Hz DC offset, prominent on the vertical axis).
            // A 0.5 Hz high-pass removes it by default so traces centre on movement; set to 0 to see absolute g.
            default: 0.5,
        },
        lowpass: {
            availableValues: [0, 5, 10, 20, 30, 50],
            default: 0,
        },
        notch: {
            availableValues: [0],
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
            key: 'a',
            modKey: false,
        },
        examine: {
            code: 'KeyE',
            key: 'e',
            modKey: false,
        },
        fft: {
            code: 'KeyF',
            key: 'f',
            modKey: false,
        },
        inspect: {
            code: 'KeyI',
            key: 'i',
            modKey: false,
        },
        notch: {
            code: 'KeyN',
            key: 'n',
            modKey: false,
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
        signalColor: [0, 0, 0, 0.6] as SettingsColor,
        theme: 'default',
        tickColor: [0, 0, 0, 0.2] as SettingsColor,
        viewBoxColor: [1, 0.2, 0.2, 0.25] as SettingsColor,
    },
    notchDefaultFrequency: 0,
    // Default seconds per "page" of navigation — used by useBiosignalNavigation
    // when no active montage carries its own `pageLength`. Mirrors the
    // timebase default so ArrowLeft / ArrowRight with shift moves one page.
    pageLength: 20,
    selectionBound: {
        color: [0.5, 0, 0.5, 0.25] as SettingsColor,
        style: 'dashed',
        width: 2,
    },
    sensitivity: {
        // Sensitivity is the displayed amplitude per cm. ACC signals are
        // typically single-digit m/s² for body movement; the default centres
        // around 1 g (~9.8 m/s²). The key is `mssPerCm` (m/s² per cm) — not
        // `msPerCm`, which reads as milliseconds.
        mssPerCm: {
            availableValues: [1, 2, 5, 10, 20, 50],
            default: 10,
            scale: 1,
        },
    },
    sensitivityUnit: 'mssPerCm',
    services: {},
    timebase: {
        secPerPage: {
            availableValues: [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300],
            default: 20,
            label: 'Seconds/page',
            unit: 's/pg',
        },
    },
    timebaseUnit: 'secPerPage',
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
            acc: [0.1, 0.1, 0.1, 1] as SettingsColor,
            sin: [0.5, 0, 0, 1] as SettingsColor,
            dex: [0, 0, 0.5, 1] as SettingsColor,
            mid: [0, 0.5, 0, 1] as SettingsColor,
            meta: [0, 0, 0, 0] as SettingsColor,
            default: [0.2, 0.2, 0.2, 1] as SettingsColor,
        },
        // Per-axis colouring matches EEG hemisphere conventions: left/right
        // wrist (sinister/dexter) get distinct colours so left and right
        // signals are visually distinguishable.
        colorSides: true,
        highlight: {
            color: [1, 0, 0, 0.2] as SettingsColor,
        },
        selections: {
            color: [0, 0, 1, 0.075] as SettingsColor,
        },
        theme: 'default',
        width: {
            acc: 1,
        },
    },
    viewport: {
        horizontalDivs: 10,
        mainAxis: 'x',
        verticalDivs: 5,
    },
    yPadding: 1,
})
