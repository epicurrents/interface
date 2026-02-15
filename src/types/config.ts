import {
    Annotation,
    PropertyChangeHandler,
    RuntimeAppModule,
    SafeObject,
    SettingsColor,
    SettingsValue,
    StateManager,
} from "@epicurrents/core/types"
import { Modify } from "@epicurrents/core/types"
import { AppModuleSettings } from "#app/modules/app"
import type { ControlElement, SupportedView } from './interface'
import { BiosignalPlot, PlotLineStyles } from './plot'

/** Application view properties. */
export type ApplicationView = {
    /**Properties for supported components. */
    components: Record<InterfaceComponent,
        /** Component proterties for supported components or `false` if the component is not supported. */
        InterfaceComponentProperties | false
    >
    /** Does this view use the light or the dark theme by default. */
    defaultTheme: 'light' | 'dark'
    /** Short description for this view. */
    description: string
    /** Icon to display in the menu bar. */
    icon: string
    /** User-facing label for this view. */
    label: string
    /** Identifying name of the view. */
    name: SupportedView
    /** Currently active theme in this view (null for the default theme). */
    theme: 'dark' | 'light' | null
}

export type AugmentedRuntimeAppModule = Modify<RuntimeAppModule, {
    /** Currently active application scope. */
    activeScope: string
    /** Currently active resource type. */
    activeModality: string
    /** Application views that are available for use. */
    availableViews: string[]
    /** Component level dstyles that have already been loaded. */
    componentStyles: string[]
    /** Id of the DOM container the application resides in. */
    containerId: string
    /** Does the current view have redoable actions. */
    hasRedoableAction: boolean
    /** Does the current view have undoable actions. */
    hasUndoableAction: boolean
    /** Is the application in fullscreen mode. */
    isFullscreen: boolean
    /** List of available plots as <name, plot-instance|null>. */
    plots: Map<string, BiosignalPlot | null>
    /** Are the settings open. */
    settingsOpen: boolean
    /** The shadow root of the application if mounted inside one. */
    shadowRoot: ShadowRoot | null
    /** Should the overlay (for capturing pointer interactions) be shown over the application. */
    showOverlay: boolean
    /** Are the listen UI component visible or not. */
    uiComponentVisible: Record<InterfaceComponent, boolean>
    /** Main application view. */
    view: ApplicationView
}>

export type AugmentedRuntimeState = Modify<StateManager, {
    APP: AugmentedRuntimeAppModule
    INTERFACE: InterfaceRuntime
}>
/**
 * Settings that must be present in all biosignal interface modules.
 */
export type CommonBiosignalInterfaceSettings = CommonInterfaceSettings & {
    annotations: {
        classes: {
            default: {
                codes: Record<string, number | string>
                color: SettingsColor
                label: string
                name: Annotation['type']
                quickCode: number
            }
            [type: string]: {
                codes: Record<string, number | string>
                color: SettingsColor
                label: string
                name: Annotation['type']
                quickCode: number
            }
        }
        color: SettingsColor
        /**
         * Don't allow annotations to span outside the recording (i.e. start < 0 or end > recording length).
         * This only restricts annotation editing and does not affect already existing annotations.
         */
        containWithinRecording: boolean
        /** Save changes to recording annotations to the output dataset. */
        saveToDataset: boolean
        typeColors: Record<string, SettingsColor>
        width: number
    }
    /** Should antialiasing be used when drawing tha trace. */
    antialiasing: boolean
    border: {
        bottom?: PlotLineStyles
        left?: PlotLineStyles
        right?: PlotLineStyles
        top?: PlotLineStyles
    }
    channelSpacing: number
    controlsBarHeight: string
    /** Vertical cursor lines spanning the height of the signal plot. */
    cursor: {
        /** Styles applied to active cursors. */
        active: {
            color: SettingsColor
            width: number
        }
        /** Styles applied to the main cursor. */
        main: {
            color: SettingsColor
            width: number
        }
        /** Styles applied to disabled cursors. */
        disabled?: {
            color: SettingsColor
            width: number
        }
        /** Styles applied to inactive cursors. */
        inactive?: {
            color: SettingsColor
            width: number
        }
    }
    displayPolarity: 1 | -1
    /**
     * The sampling rate limit when applying downsampling to signals. The sampling rate will never fall below this
     * value, meaning that the minimum sampling rate that downsampling can be applied to is 2*downsampleLimit.
     * Zero will disable downsampling.
     */
    downsampleLimit: number
    epochMode: {
        /**
         * Browse the data in epochs. Epoch length must be defined, otherwise this setting has no effect.
         * First epoch starts at the beginning of the recording by default.
         */
        enabled: boolean
        /**
         * Length of a single epoch. This effectively enforces a page width of _n_ seconds.
         * Setting this value to zero disables the feature.
         */
        epochLength: number
        /**
         * Only allow browsing full epochs. If a part of the recording exceeds the last full epoch, the user will not
         * be able to view it.
         */
        onlyFullEpochs: boolean
    },
    filters: {
        highpass: {
            availableValues: number[]
            default: number
        }
        lowpass: {
            availableValues: number[]
            default: number
        }
        notch: {
            availableValues: number[]
            default: number
        }
    }
    highlights: {
        /** Display a fading collar before and after a highlight. */
        showCollars: boolean
    }
    grid: {
        major: PlotLineStyles
        minor: PlotLineStyles
        intersections: PlotLineStyles
    }
    /** Line showing the isoelectric level (zero voltage). */
    isoelLine: PlotLineStyles
    markers: {
        active: PlotLineStyles
        focused: PlotLineStyles
        inactive: PlotLineStyles
    }
    /** Minimum duration of a selection to qualify for signal analysis. */
    minSignalSelection: number
    /** The default length of one page when browsing forward or backward. */
    pageLength: number
    /** Scale to apply to a signal's amplitude as an exponent of 10. */
    scale: {
        availableValues: number[]
        default: number
    }
    /** The vertical marker showing the edge of a selection range. */
    selectionBound: {
        color: SettingsColor
        width: number
        style?: string
    }
    sensitivity: {
        [unit: string]: {
            availableValues: number[]
            default: number
            /**
             * Scale to apply to a signal's amplitude as a multiplier to convert values into base unit.
             * This exists so that available values can be in the unit of sensitivity instead of the base unit.
             * For example, to convert from sensitivity values in uV to V, a scale of 1e-6 must be applied.
             * If the sensitivity unit is the base physical unit, scale can be omitted.
             */
            scale?: number
        }
    }
    sensitivityUnit: string
    /** Available timebases. */
    timebase: {
        [unit: string]: {
            /** Array of available values in this timebase. */
            availableValues: number[]
            /** Default value to use if none is explicitly set. */
            default: number
            /** Label (name) of this timebase. */
            label: string
            /** Unit to show after the value. */
            unit: string
        }
    }
    timebaseUnit: string
    tools: {
        cursorLine: {
            color: SettingsColor
            width: number
            dasharray?: number[]
            style?: string
        }
        highlightArea: {
            color: SettingsColor
        }
        signalBaseline: {
            color: SettingsColor
            width: number
            dasharray?: number[]
            style?: string
        }
    }
    /** Trace (signal line) settings. */
    trace: {
        /** Color used for the trace(s) as a single color or a mapping of channel types to colors. */
        color: SettingsColor | { [key: string]: SettingsColor }
        /** Use different colors for each side of the body. */
        colorSides: boolean
        /** Trace highlight settings. */
        highlight: {
            /** Trace highlight color. */
            color: SettingsColor
        }
        /** Signal selection settings. */
        selections: {
            /** Color used to highlight selected signal segments. */
            color: SettingsColor
        }
        /** Trace theme. */
        theme: string
        /** Width of the trace line as a single value or a mapping of channel types to widths. */
        width: number | { [key: string]: number }
    }
}
/**
 * Settings that are common to all interface modules.
 */
export type CommonInterfaceSettings = SafeObject & {
    _userDefinable: {
        [key: string]: BooleanConstructor | NumberConstructor | StringConstructor
    }
    /**
     * The view compatible with this module.
     */
    compatibleView: string
}
/** Properties for hotkey actions. */
export type HotkeyProperties = {
    /** Key code corresponding to KeyboarEvent.code. */
    code: KeyboardEvent['code']
    /** Require control to be pressed. */
    control: boolean
    /** Key name corresponding to KeyboardEevent.key (lower case for letters). */
    key: KeyboardEvent['key']
    /** Require shift to be pressed. */
    shift: boolean
}
/**
 * Names of components that can be shown or hidden in the interface.
 */
export type InterfaceComponent = 'controls' | 'footer' | 'navigator'
/**
 * Properties for interface components.
 */
export type InterfaceComponentProperties = {
    /**
     * Is the component visible in this view.
     * - `boolean` - The component visibility is set to this value when switching the view.
     * - `null` - The component visibility is not changed when switching the view.
     */
    visible: boolean | null
}
/**
 * Interface-specific settings for a module. These settings are appended to general module settings and duplicate
 * keys in the interface settings will override properties that exist in the general settings.
 */
export type InterfaceModuleConfig = SafeObject & {
    /**
     * Schemas to use for constructing some interface sections.
     */
    schemas?: SafeObject
    /**
     * Module level interface settings.
     */
    settings?: SafeObject
}
export type InterfaceModuleSchema = SafeObject & {
    /** Module name. */
    module: string
    /** A list of controls for the viewer controls bar. */
    controls: ControlElement[]
    /** Instructions for the usage of this module. */
    instructions: {
        /** The actual instructions content as markdown. */
        content: string
        /** Short description of the module. */
        description: string
        /** Label variants for the instructions. */
        label: {
            /** Full label for the title. */
            full: string
            /** Short label for menus etc. */
            short: string
        }
    },
    /** User-definable settings for this module. */
    settings: {
        /** Short description for the settings tab. */
        description: string
        /**
         * Set of fields according to which the settings are constructed.
         * Each field is a "row" in the settings tab and they are displayed in the order they are defined.
         */
        fields: InterfaceSettingsField[]
        /** Settings label variants. */
        label: {
            /** Full label string for the title. */
            full: string
            /** Short string for the tab. */
            short: string
        }
    }
    /**
     * Get the input value corresponding to a settings `field` value. Checks if field can be altered by the user
     * and takes into account possible mapped values. Can be used to convert a value stored in settings to a value
     * to use in an input field.
     * @param field - Name of the setting field.
     * @param setting - Value stored in settings.
     * @returns Input field value or undefined if not alterable/not found.
     */
    getInputForSetting (field: string, setting: SettingsValue): SettingsValue
    /**
     * Get the setting `field` value corresponding to an `input` value. Checks if field can be altered by the user
     * and takes into account possible mapped values. Can be used to convert a value of an input field to a value
     * to store in the settings.
     * @param field - Name of the setting field.
     * @param input - Value of the input field.
     * @returns Setting field value or undefined if not alterable/not found.
     */
    getSettingForInput (field: string, input: string | number | boolean): SettingsValue
}
/** Properties common to all settings fields. */
export type InterfaceSettingsCommon = {
    /** Type of the field. */
    type: string
    /**
     * Is memory manager required to either be enabled or disabled for this setting to be available.
     * - `true` requires memory manager to be enabled.
     * - `false` requires memory manager to be disabled.
     * - `undefined` ignores if memory manager is available or not.
     */
    memoryManager?: boolean
    /** Override tooltip for the reload required icon. */
    reloadTooltip?: string
    /** Changing this setting requires reloading the application. */
    requiresReload?: boolean
    /** Service that this setting depends on (it won't be displayed if the service is not active). */
    service?: string
    /** Optional CSS width of the setting element to align text start positions. */
    width?: string
}
/** Available interface settings components. */
export type InterfaceSettingsComponent = 'settings-checkbox'
                                       | 'settings-colorpicker'
                                       | 'settings-dropdown'
                                       | 'settings-number'
/** A description for a field (row) in the interface settings tab. */
export type InterfaceSettingsField = InterfaceSettingsCommon & (
                                        InterfaceSettingsDropdown
                                        | InterfaceSettingsInput
                                        | InterfaceSettingsPreset
                                        | InterfaceSettingsSubtitle
                                    )
/** A dropdown with a preset set of options. */
export type InterfaceSettingsDropdown = {
    /** Settings component name. */
    component: 'settings-dropdown'
    /** Name (path) of the settings field this setting controls. */
    setting: string
    /** The text to show on the settings row. */
    text: string
    type: 'setting'
    /** Dropdown options. */
    options: InterfaceSettingsDropdownOption[]
}
/** An option for a settings dropdown. */
export type InterfaceSettingsDropdownOption = {
    /** Value to set in the settings when this option is selected. */
    value: SettingsValue
    /** Display text for the option. */
    label?: string
    /** Prefix to show before the label. */
    prefix?: string
    /** Suffix to show after the label. */
    suffix?: string
}
/** An input to change one of the settings values. */
export type InterfaceSettingsInput = {
    /** Settings component name. */
    component: InterfaceSettingsComponent
    /** Name (path) of the settings field this setting controls. */
    setting: string
    /** The text to show on the settings row. */
    text: string
    type: 'setting'
    /** Height of the setting element. */
    height?: string
    /** Maximum available value for the setting. */
    max?: number
    /** Minimum available value for the setting. */
    min?: number
    /** Numeric value step size. */
    step?: number
    /** Treat the value zero as the setting being turned off (a visual cue). */
    zeroMeansOff?: boolean
    /**  Optional list of form field values and corresponding setting values. */
    valueMap?: [string | number | boolean, SettingsValue][]
}
/** A preset button that applies a number of settings at once. */
export type InterfaceSettingsPreset = {
    component: 'settings-preset'
    /** Array of setting names (paths) and the values to apply to them. */
    presets: { setting: string, value: SettingsValue }[]
    /** Descriptive text for the preset. */
    text: string
    type: 'preset'
}
/** A subtitle to demark sections of settings. */
export type InterfaceSettingsSubtitle = {
    /** Displayed subtitle text. */
    text: string
    type: 'subtitle'
    /** Optional information to display as a tooltip on an info icon. */
    info?: string
}
/**
 * Interface settings are separated to app level and individual module levels.
 * Modules are static in the sense that additional modules cannot be added after the interface has been registered.
 */
export interface InterfaceSettings {
    /**
     * Main application interface settings.
     */
    app: AppModuleSettings
    /**
     * Module level interface schemas and settings.
     */
    modules: Map<string, InterfaceModuleConfig>
    /**
     * Add a new update handler for the settings `field`.
     * @param field - Name of the field to watch. Direct updates this this field and any of its children trigger the handler.
     * @param handler - Handler method for the update.
     * @param caller - Optional unique caller name (for bulk removals).
     * @example
     * // Setup
     * addPropertyChangeHandler('high.level.field', handler, 'caller')
     * // Update scenarios
     * onPropertyUpdate('high.level.field') // Triggers handler (field updated).
     * onPropertyUpdate('high.level.field.grand.child') // Triggers handler (child field updated).
     * onPropertyUpdate('high.level') // Does not trigger update.
     */
    addPropertyChangeHandler (field: string, handler: PropertyChangeHandler, caller?: string): void
    /**
     * Get the value stored at the given settings `field`.
     * @param field - Name of the settings field.
     * @param depth - Optional settings field depth. Positive values function as an index to the "field array" and negative values as an offset to the depth.
     * @example
     * getFieldValue('settings.field.somewhere.deep') // Returns the value of the property 'deep'.
     * getFieldValue('settings.field.somewhere.deep', 1) // Returns the value of 'field' ('settings' being index 0).
     * getFieldValue('settings.field.somewhere.deep', -1) // Returns the value of 'somewhere' (-1 offset from 'deep').
     */
    getFieldValue (field: string, depth?: number): SettingsValue
    /**
     * Signal that a settings property has updated, executing any handlers watching it or its parents.
     * @param field - Name of the updated field.
     * @param newValue - New value set to the field (optional).
     * @param oldValue - Previous value of the field (optional).
     */
    onPropertyUpdate (field: string, newValue?: SettingsValue, oldValue?: SettingsValue): void
    /**
     * Remove all registered property update handlers.
     */
    removeAllPropertyChangeHandlers (): void
    /**
     * Remove all property update handlers registered to the given `caller`.
     * @param caller - Unique name of the caller.
     */
    removeAllPropertyChangeHandlersFor (caller: string): void
    /**
     * Remove the given `handler` from the given `field`'s watchers.
     * @param field - Name of the settings field. Applies to handlers watching this field and any of its children.
     * @param handler - The handler to remove.
     * @example
     * // Setup
     * addPropertyChangeHandler('high.level.field', handler)
     * // Removal scenarios
     * removePropertyChangeHandler('high.level.field', handler) // Handler is removed (field match).
     * removePropertyChangeHandler('high.level', handler) // Handler is removed (parent field match).
     * removePropertyChangeHandler('high.level.field.grand.child', handler) // Not removed (child field match).
     */
    removePropertyChangeHandler (field: string, handler: PropertyChangeHandler): void
    /**
     * Set a new `value` the the given settings `field`.
     * @param field - Name of the settings field.
     * @param value - New value for the field.
     * @returns true if field was found, false otherwise.
     */
    setFieldValue (field: string, value: SettingsValue): boolean
}
/** Subset of interface settings properties that are required at runtime. */
export type InterfaceRuntime = Pick<InterfaceSettings, "app" | "modules">
/** Partial modifier extending to all child properties. */
export type RecursivePartial<T> = {
    [P in keyof T]?: RecursivePartial<T[P]>;
}
