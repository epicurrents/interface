/**
 * Epicurrents interface settings.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import type {
    AppSettings,
    BiosignalResource,
    CommonBiosignalSettings,
    Modify,
    PropertyChangeHandler,
    SettingsValue,
    StateManager,
} from "@epicurrents/core/types"
import { rgbaToSettingsColor, hexToSettingsColor } from "@epicurrents/core/util"
import { type PythonInterpreterService } from '@epicurrents/pyodide-service/types'
import type {
    ApplicationView,
    CommonBiosignalInterfaceSettings,
    InterfaceSettingsField,
    InterfaceSettingsInput,
    InterfaceModuleConfig,
    InterfaceSettings,
} from "#types/config"
import { AppModuleSettings, settings as appSettings } from '#app/modules/app'
import { Log } from "scoped-event-log"
import { EpiCStore } from "#store"
// View configs.
import { config as biosignalViewConfig } from '#app/views/biosignal'
import { config as defaultViewConfig } from '#app/views/default'
import { config as mediaViewConfig } from '#app/views/media'
import { config as radiologyViewConfig } from '#app/views/radiology'

const SCOPE = 'InterfaceSettings'

const _PropertyChangeHandlers = [] as {
    /** Name of the caller (owner) of this handler, if specified. */
    caller: string | null
    /** Name of the field to watch. Updates to this field and any of it's children trigger the hander. */
    field: string
    /** Handler to execute on field update. */
    handler: PropertyChangeHandler
}[]

export const applicationViews = new Map<string, ApplicationView>([
    ['biosignal', biosignalViewConfig],
    ['default', defaultViewConfig],
    ['media', mediaViewConfig],
    ['radiology', radiologyViewConfig],
])

/**
 * Get the setting `field` value corresponding to an `input` value. Checks if field can be altered by the user
 * and takes into account possible mapped values. Can be used to convert a value of an input field to a value
 * to store in the settings.
 * @param fieldName - Name of the setting field.
 * @param value - Value of the input field.
 * @param fields - List of settings fields for the module.
 * @param settings - Module settings object.
 * @returns Setting field value or undefined if not alterable/not found.
 */
export const getSettingForInput = (
    fieldName: string,
    value: string | number | boolean,
    fields: InterfaceSettingsField[],
    settings: InterfaceModuleConfig['settings']
): SettingsValue => {
    // Check that the setting can be modified.
    if (Object.keys(settings!._userDefinable as Object).includes(fieldName)) {
        return undefined
    }
    const settingField = fields.filter(f => {
        if (typeof (f as InterfaceSettingsInput).setting === undefined) {
            return false
        } else {
            return (f as InterfaceSettingsInput).setting === fieldName
        }
    })[0] as InterfaceSettingsInput
    if (settingField) {
        const settingForValue = settingField.valueMap?.filter(v => v[1] === value)[0]
        if (settingForValue) {
            // Found a mapped value for the setting.
            return settingForValue[0]
        } else {
            // No mapped value, just return the input value.
            return value
        }
    } else {
        // Setting field was not found.
        return undefined
    }
}
/**
 * Get the input value corresponding to a settings `field` value. Checks if field can be altered by the user
 * and takes into account possible mapped values. Can be used to convert a value stored in settings to a value
 * to use in an input field.
 * @param fieldName - Name of the setting field.
 * @param value - Settings field value (does not have to be the currently stored value).
 * @param fields - List of settings fields for the module.
 * @param settings - Module settings object.
 * @returns Input field value or undefined if not alterable/not found.
 */
export const getInputForSetting = (
    fieldName: string,
    value: SettingsValue,
    fields: InterfaceSettingsField[],
    settings: InterfaceModuleConfig['settings']
): SettingsValue => {
    // Check that the setting can be modified.
    if (Object.keys(settings!._userDefinable as Object).includes(fieldName)) {
        return undefined
    }
    const settingField = fields.filter(f => {
        if (typeof (f as InterfaceSettingsInput).setting === undefined) {
            return false
        } else {
            return (f as InterfaceSettingsInput).setting === fieldName
        }
    })[0] as InterfaceSettingsInput
    if (settingField) {
        const settingForValue = settingField.valueMap?.filter(v => v[0] === value)[0]
        if (settingForValue) {
            // Found a mapped value for the setting.
            return settingForValue[1]
        } else {
            // No mapped value, just return the setting value.
            return value
        }
    } else {
        // Setting field was not found.
        return undefined
    }
}

const INTERFACE = {
    app: appSettings,
    modules: new Map<string, InterfaceModuleConfig>(),
    addPropertyChangeHandler (field: string, handler: PropertyChangeHandler, caller?: string) {
        if (typeof field !== 'string' || !field) {
            Log.error(`Invalid field supplied to addPropertyChangeHandler.`, SCOPE)
            return
        }
        const newHandler = {
            field: field,
            handler: handler,
            caller: caller || null,
        }
        for (let i=0; i<_PropertyChangeHandlers.length; i++) {
            const update = _PropertyChangeHandlers[i]
            if (handler === update.handler) {
                if (field === update.field) {
                    Log.debug(`The given handler already existed for field ${field}.`, SCOPE)
                } else if (field.startsWith(`${update.field}.`)) {
                    // Listeners of a parent field are notified on updates.
                    Log.debug(
                        `The given handler already existed for parent '${update.field}' of the field '${field}'.`,
                    SCOPE)
                } else if (update.field.startsWith(`${field}.`)) {
                    // Replace the child field handler with the new, more general parent field handler.
                    Log.debug(
                        `The given handler already existed for child '${update.field}' of the field '${field}' ` +
                        `and was replaced.`,
                    SCOPE)
                    _PropertyChangeHandlers.splice(i, 1, newHandler)
                }
                return
            }
        }
        _PropertyChangeHandlers.push(newHandler)
        Log.debug(`Added a handler for ${field}.`, SCOPE)
    },
    getFieldValue (field: string, depth?: number) {
        // Traverse field's "path" to target property
        const fPath = field.split('.')
        // First see if this is a module.
        const modSettings = INTERFACE.modules.get(fPath[0])?.settings
        if (modSettings) {
            fPath.shift() // Remove the module identifier.
        }
        // This is incredibly difficult to type, maybe one day I'll get it right...
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const configFields = modSettings ? [modSettings] : [INTERFACE] as any[]
        let i = 0
        for (const f of fPath) {
            const nextField = configFields[i][f as keyof typeof configFields]
            if (nextField === undefined) {
                Log.debug(`Field '${fPath.join('.')}' was not found in interface settings.`, SCOPE)
                return undefined
            }
            if (
                (depth !== undefined && (
                    depth >= 0 && i === depth ||
                    depth < 0 && i === fPath.length - 1 + depth
                )) ||
                (depth === undefined && i === fPath.length - 1)
            ) {
                // Final field
                const config = configFields.pop()
                return config[f]
            } else {
                configFields.push(nextField)
            }
            i++
        }
        return undefined
    },
    onPropertyUpdate (field: string, newValue?: SettingsValue, oldValue?: SettingsValue) {
        for (const handlerContext of _PropertyChangeHandlers) {
            if (field === handlerContext.field || field.startsWith(`${handlerContext.field}.`)) {
                Log.debug(
                    `Executing ${field} update handler` +
                    (handlerContext.caller ? ' for ' + handlerContext.caller : '') +
                    `.`,
                SCOPE)
                handlerContext.handler(newValue, oldValue)
            }
        }
    },
    removeAllPropertyChangeHandlers () {
        const removed = _PropertyChangeHandlers.splice(0)
        for (const { field, handler } of removed) {
            INTERFACE.removePropertyChangeHandler(field, handler)
        }
        Log.debug(`Removed all ${removed.length} property update handlers.`, SCOPE)
    },
    removeAllPropertyChangeHandlersFor (caller: string) {
        for (let i=0; i<_PropertyChangeHandlers.length; i++) {
            const update = _PropertyChangeHandlers[i]
            if (caller === update.caller) {
                INTERFACE.removePropertyChangeHandler(update.field, update.handler)
                i--
            }
        }
    },
    removePropertyChangeHandler (field: string, handler: PropertyChangeHandler) {
        for (let i=0; i<_PropertyChangeHandlers.length; i++) {
            const update = _PropertyChangeHandlers[i]
            if ((field === update.field || field.startsWith(`${update.field}.`)) && handler === update.handler) {
                const caller = _PropertyChangeHandlers.splice(i, 1)[0].caller || ''
                Log.debug(`Removed ${field} handler${caller ? ' for '+ caller : ''}.`, SCOPE)
                return
            }
        }
        Log.debug(`Could not locate the requested ${field} handler.`, SCOPE)
    },
    setFieldValue (field: string, value: SettingsValue) {
        // Settings object should have the reference to object proto removed, but just in case.
        if (field.includes('__proto__')) {
            Log.warn(
                `Field ${field} passed to setFieldValue contains insecure property name '_proto__' and weas ignored.`,
            SCOPE)
            return
        }
        // Traverse field's "path" to target property.
        const fPath = field.split('.')
        // First see if this is a module.
        const modSettings = fPath[0] === 'app' ? INTERFACE.app : INTERFACE.modules.get(fPath[0])?.settings
        if (modSettings) {
            fPath.shift() // Remove the module identifier.
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settingsField = modSettings ? [modSettings] : [INTERFACE] as any[]
        let i = 0
        for (const f of fPath) {
            if (i === fPath.length - 1) {
                if (
                    settingsField[i] === undefined ||
                    settingsField[i][f as keyof typeof settingsField] === undefined
                ) {
                    Log.debug(
                        `Settings field '${fPath.join('.')}' was not found in interface settings.`,
                        SCOPE
                    )
                    return false
                }
                // Final field.
                const local = settingsField.pop()
                if (typeof value === 'string') {
                    // Parse possible color code.
                    value = rgbaToSettingsColor(value) ||
                            hexToSettingsColor(value) ||
                            value
                }
                // Check constructors for type match (TODO: Should null be a valid settings value?).
                if (local[f].constructor === value?.constructor) {
                    const old = local[f]
                    local[f] = value
                    Log.debug(`Changed settings field '${field}' value.`, SCOPE)
                    INTERFACE.onPropertyUpdate(field, value, old)
                }
                return true
            } else {
                settingsField.push(settingsField[i][f as keyof typeof settingsField])
            }
            i++
        }
        // Is it even possible to reach this point?
        Log.error(`Could not change interface settings field '${field}'; the field was not found.`, SCOPE)
        return false
    }
} as InterfaceSettings
export default INTERFACE

/**
 * Get component properties for the active resource context.
 * @param store - The vuex store object.
 * @param component - Possible calling component name.
 * @returns Scoped component properties.
 */
export const useActiveContext = (store: EpiCStore, component?: string) => {
    const activeModality = store.getters.getActiveResource()?.modality || ''
    return useContext(store, activeModality, component)
}

/**
 * Get component properties for the app context.
 * @param store - The vuex store object.
 * @param component - Possible calling component name.
 * @returns Scoped component properties.
 */
export const useAppContext = (store: EpiCStore, component?: string) => {
    const scopeProps = useContext(store, 'app', component)
    const typifiedProps = scopeProps as unknown as Modify<typeof scopeProps, {
        SETTINGS: AppSettings & AppModuleSettings
    }>
    return typifiedProps
}

/**
 * Get component properties for biosignal context resources.
 * @param store - The vuex store object.
 * @param component - Possible calling component name.
 * @returns Scoped biosignal component properties.
 */
export const useBiosignalContext = (store: EpiCStore, component?: string) => {
    const activeModality = store.getters.getActiveResource()?.modality || ''
    const scopeProps = useContext(store, activeModality, component)
    const typifiedProps = scopeProps as unknown as Modify<typeof scopeProps, {
        SETTINGS: typeof scopeProps['SETTINGS'] & CommonBiosignalSettings & CommonBiosignalInterfaceSettings
    }>
    return {
        /**
         * Currently active biosignal resource.
         * @remarks
         * These scoped properties are only meant to be used inside components that display
         * data from active resources and expect that active recording cannot be null.
         */
        RESOURCE: store.getters.getActiveResource() as BiosignalResource,
        ...typifiedProps,
    }
}

/**
 * Get component properties for the given resource `context`.
 * @param store - The vuex store object.
 * @param context - Resource context to use.
 * @param component - Possible calling component name.
 * @returns Component properties for the given context.
 */
export const useContext = (store: Pick<EpiCStore, "state">, context: string, component?: string) => {
    const modMemoryManager = store.state.SETTINGS.modules[context]?.useMemoryManager
    const activeSettings = context === 'app' ? {
        ...store.state.SETTINGS.app,
        ...INTERFACE.app,
    } : {
        ...store.state.SETTINGS.modules[context],
        ...INTERFACE.modules.get(context)?.settings,
        useMemoryManager: modMemoryManager && store.state.SETTINGS.app.useMemoryManager,
    }
    const activeSchemas = context === 'app'
                        ? undefined
                        : INTERFACE.modules.get(context)?.schemas
    const settingsProxy = new Proxy(activeSettings, {
        get (_target, name, receiver) {
            // Overwrite property values with up-to-date values from the settings.
            const intfSettings = context === 'app'
                               ? INTERFACE.app
                               : INTERFACE.modules.get(context)?.settings
            if (intfSettings && Reflect.has(intfSettings, name)) {
                return Reflect.get(intfSettings, name, receiver)
            }
            const mainSettings = context === 'app'
                               ? store.state.SETTINGS.app
                               : store.state.SETTINGS.modules[context]
            if (mainSettings && Reflect.has(mainSettings, name)) {
                return Reflect.get(mainSettings, name, receiver)
            }
            return undefined
        },
        set (_target, name, value, receiver) {
            const mainSettings = store.state.SETTINGS.modules[context]
            if (mainSettings && Reflect.has(mainSettings, name)) {
                return Reflect.set(mainSettings, name, value, receiver)
            }
            const intfSettings = INTERFACE.modules.get(context)
            if (intfSettings) {
                // Set new values to interface settings by default.
                return Reflect.set(intfSettings, name, value, receiver)
            }
            return false
        },
    })
    // Include reference to possible Pyodide service and information about SharedArrayBuffer support.
    const pyodide = {
        /** Pyodide service or null if not available. */
        service: window.__EPICURRENTS__?.RUNTIME?.SERVICES?.get('pyodide') as PythonInterpreterService || null,
        /** Is memory manager and SharedArrayBuffer support available. */
        usesMemoryManager: window.__EPICURRENTS__?.RUNTIME?.SETTINGS?.app?.useMemoryManager || false as boolean,
    }
    return {
        /** A unique id created for this method call. */
        ID: `${component || 'Component'}-${store.state.APP.runningId++}`,
        /** Epicurrents runtime state manager. */
        RUNTIME: window.__EPICURRENTS__.RUNTIME as StateManager,
        /** Possibe Pyodide service properties. */
        PYODIDE: pyodide,
        SCOPE: context,
        SCHEMAS: activeSchemas,
        SETTINGS: settingsProxy as AppSettings['app'] & { [key: string]: unknown },
        /**
         * Utility method to get the value of the given settings `field` primarily from the interface settings
         * or failing that the core app settings.
         * @param field - Name of the settings field.
         * @param depth - Optional depth to match.
         * @returns Value of the field or undefined if not found.
         */
        getFieldValue: (field: string, depth?: number) => {
            const intfValue = INTERFACE.getFieldValue(field, depth)
            if (intfValue !== undefined) {
                return intfValue
            }
            return store.state.SETTINGS.getFieldValue(field, depth)
        },
        /**
         * Utility method to set the `value` of the given settings `field` primarily in the interface settings
         * or failing that in the core app settings. This will not save the field value to local storage.
         * @param field - Name of the settings field.
         * @param value - New value to set.
         * @returns Value of the field or undefined if not found.
         */
        setFieldValue: (field: string, value: SettingsValue) => {
            if (INTERFACE.setFieldValue(field, value)) {
                return true
            }
            return store.state.SETTINGS.setFieldValue(field, value)
        },
    }
}
