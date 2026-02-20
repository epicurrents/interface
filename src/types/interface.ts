/**
 * Epicurrents Interface type definitions.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import type {
    BiosignalChannel,
    ChannelPositionProperties,
    InterfaceModuleConstructor,
    SafeObject,
    SettingsValue,
} from '@epicurrents/core/types'
import { TranslateResult } from 'vue-i18n'
import { InterfaceSettingsCommon } from './config'
import { ResourceModuleContext } from '../store'

export type ContextMenuContext = {
    // This is currently only for biosignal resources.
    channel: BiosignalChannel | null
    position: number[]
    target: string
    timestamp: number
    props: unknown
}
/**
 * A single element for the viewer controls bar.
 */
export interface ControlElement {
    /** Unique ID for the control. */
    id: string
    /** User-facing label. */
    label: string | string[]
    /** One of valid control types. */
    type: 'button' | 'dropdown' | 'on-off' | 'up-down'
    /** Version number to increase to force reloading the component. */
    version: number
    // Optional properties
    align?: 'left' | 'right'
    /** Is this control element or subelement enabled. */
    enabled?: boolean | boolean[]
    /** Is this control element the first one on the controls row. */
    firstInRow?: boolean
    /** Option groups for dropdown-type controls. */
    groups?: DropdownGroup[]
    /** Shoelace icon name. */
    iconName?: string
    /** Join this element with the one to the left, removing margin and border on that side. */
    joinLeft?: boolean
    /** Join this element with the one to the right, removing border on that side. */
    joinRight?: boolean
    /** Should up and down navigation buttons be shown by the component (dropdown). */
    navButtons?: boolean
    /**
     * Store action to perform when the control or sub-element is clicked as either `action` without an argument or
     * [`action name`, `action argument`].
     */
    onclick?: string | [string, any] | [string, any][]
    /** Is the dropdown control in open state. */
    open?: boolean
    /** List of dropdown control options to list before any grouped options. */
    options?: DropdownItem[]
    /** Placeholder to display instead of an empty value. */
    placeholder?: string
    /** Prefix to display before the control value. */
    prefix?: string
    /** Suffix to display after the control value. */
    suffix?: string
    /** Store mutations to listen to and reload this control on (i.e. mutations that change this control's value). */
    reloadOn?: string[]
    /** Current value of the control. */
    value?: string | number | boolean
    /** Control CSS width. */
    width?: string
}
/**
 * Constructor for the default interface module.
 */
export interface DefaultInterfaceModuleConstructor extends InterfaceModuleConstructor {
    MODULES: Record<string, ResourceModuleContext>
}
/**
 * A group of dropdown items.
 */
export interface DropdownGroup {
    id: string
    label: string
    items: DropdownItem[]
}
/**
 * A single dropdown item.
 */
export interface DropdownItem
{
    id: string
    enabled: boolean
    label: string
    onclick: [string, any]
    active?: boolean
    icon?: string
    suffix?: string
    /** Option value, if not same as id. */
    value?: string | number | null
}

export type InterfaceSchema = SafeObject & {
    /** Viewer controls. */
    controls: ControlElement[]
    /** Instruction screen definitions. */
    instructions: {
        /** HTML content of the instructions. */
        content: string
        /** A short description shown below the tab row. */
        description: string
        /** Label to display in the instructions modal. */
        label: {
            /** Full value for a mouseover title. */
            full: string
            /** Short value to show on the tab. */
            short: string
        }
    }
    module: 'eeg'
    /** Settings menu definitions. */
    settings: {
        /** A short description shown below the tab row. */
        description: string
        /**
         * Settings fields available to the user. Settings listed here must also be found in the _userDefinable
         * property of the actual settings object.
         */
        fields: (InterfaceSettingsCommon & {
            /** Settings component used to display this field. */
            component?: string
            /** Info text to show if the info icon is clicked. */
            info?: string
            /** Maximum available value for the setting. */
            max?: number
            /** Minimum available value for the setting. */
            min?: number
            /** Dropdown options. */
            options?: DropdownItem[]
            /** Settings presets; fields in this array will be set to the corresponding values if the preset is selected. */
            presets?: {
                /** Setting field name. */
                setting: string
                /** Setting value to set. */
                value: SettingsValue
            }[]
            /** Setting field name. */
            setting?: string
            /** Numeric value step size. */
            step?: number
            /** Text to display. */
            text?: string
            /** Array of settings values (as stored in the settings) and corresponding input field values. */
            valueMap?: [SettingsValue, SettingsValue][]
            /** CSS width of the input field. */
            width?: string
            /** Treat the value zero as the setting being off. */
            zeroMeansOff?: boolean
        })[]
        /** Label to display in the settings modal. */
        label: {
            /** Full value for a mouseover title. */
            full: string
            /** Short value to show on the tab. */
            short: string
        }
    }
    /**
     * Get the `input` value corresponding to a settings `field` value. Checks if field can be altered by the user and
     * takes into account possible mapped values. Can be used to convert a value stored in settings to a value to use in an
     * input field.
     * @param field - Name of the setting field.
     * @param setting - Value stored in settings.
     * @returns Input field value or undefined if not alterable/not found.
     */
    getInputForSetting: (field: string, setting: SettingsValue) => SettingsValue
    /**
     * Get the setting `field` value corresponding to an `input` value. Checks if field can be altered by the user and
     * takes into account possible mapped values. Can be used to convert a value of an input field to a value to store
     * in the settings.
     * @param field - Name of the setting field.
     * @param input - Value of the input field.
     * @returns Setting field value or undefined if not alterable/not found.
     */
    getSettingForInput: (field: string, input: string | number | boolean) => SettingsValue
}

/**
 * Loading component properties.
 */
export type LoadingComponentProps = {
    height?: number
    rows?: number
    spinner?: boolean
    width?: number
}

/**
 * A single menu item in the menubar.
 */
export interface MenubarItem {
    /** Should the item be anchored to the left or right side (default left) */
    anchor?: 'left' | 'right'
    enabled: boolean
    id: string
    icon: string
    /** List of MenuItems in this Menu */
    items: MenuItem[]
    iteration: number
    label: TranslateResult
    open: boolean
    /** Should the menu stay open after an item is selected? */
    stayOpen?: boolean
    visible: boolean
}
/**
 * A single item in a MenubarMenu or MenuGroup.
 */
export interface MenuItem {
    active: boolean
    enabled: boolean
    id: string
    /**
     * Listing additional items under a MenuItem makes it a group.
     */
    items: MenuItem[]
    label: TranslateResult | TranslateResult[]
    /**
     * Function to execute when this item is clicked.
     * @return depends on function
     */
    onclick: (...params: any[]) => void
    type: string
    visible: boolean
    /** Does this item act as a checkbox? */
    checkbox?: boolean
    /**
     * Thematic group of items this item is a part of. Other items in the
     * same group can be identified and, e.g. toggled off when this item is
     * toggled on.
     */
    group?: string
    icon?: string | string[]
    /**
     * Should the menu stay open after this item is selected?
     * Default behavior is to close the menu on selection.
     */
    keepOpen?: boolean
    /**
     * Mutations to watch for and reload the menu when they occur.
     * First item is the mutation or array of mutations and second item is a method that takes the MenuItem as
     * argument and updates relevant properties.
     */
    reloadOn?: [string | string[], ((item: MenuItem) => void)]
    selected?: boolean
    suffix?: string | string[]
}
export type PointerEventHandler = { el: HTMLElement, handler: ((event: PointerEvent) => any)}
/**
 * Supported pointer interactions in the UI.
 */
export type PointerInteraction = 'drag'
export type SignalSelectionLimit = {
    channel: BiosignalChannel | null
    channelProps: ChannelPositionProperties | null
    position: number
}
export type SupportedView = 'biosignal' | 'default' | 'media' | 'radiology'
export type TouchEventHandler = { el: HTMLElement, handler: ((event: TouchEvent) => any)}

export type UndoOrRedoAction = {
    /** Action to undo or redo. */
    action: string
    /** Array of arguments to use. */
    args: unknown
}
