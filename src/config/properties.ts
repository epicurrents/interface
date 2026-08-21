/**
 * Module runtime property registry.
 *
 * A module's UI state lives in two places. Properties of the *resource* — sensitivity, timebase,
 * the active montage — belong to the core module and reach the resource through
 * `StateManager.setModulePropertyValue`. Properties of the *interface* — which sidebar is open,
 * whether the trend strip is shown — belong to the interface module's `runtime` object, which is a
 * plain object rather than an asset and therefore emits nothing of its own when a field is
 * assigned.
 *
 * That asymmetry is what this registry closes. A module declares the interface-side properties it
 * owns, and {@link createPropertySetter} builds the setter that validates a write, applies it, and
 * broadcasts the change on the shared event bus under the interface scope — the same treatment
 * interface settings already get. A caller then addresses any property of a module by name without
 * having to know which of the two owners holds it, and a watcher hears about every change rather
 * than only those a store action happened to announce.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { dispatchPropertyChange, EventScopes } from '@epicurrents/core'
import { Log } from 'scoped-event-log'

const SCOPE = 'module-properties'

/**
 * Declaration of one interface-owned module property.
 */
export type ModulePropertySpec = {
    /** Name of the field on the module's `runtime` object that holds the value. */
    field: string
    /**
     * Constructor name the value must match (`'String'`, `'Boolean'`, `'Number'`), suffixed with
     * `'?'` when `null` is also accepted. This is the notation worker commissions use for their
     * required properties.
     */
    type: string
}
/**
 * Interface-owned properties of one module, keyed by the name callers address them with. Names are
 * kebab-case to match the property vocabulary the core modules already use (`active-montage`,
 * `highpass-filter`), even though the runtime field behind one is a camel-case identifier.
 */
export type ModulePropertyRegistry = { readonly [name: string]: ModulePropertySpec }

/** Registries of every loaded module, keyed by module code. */
const _registries = new Map<string, ModulePropertyRegistry>()

/**
 * Record a module's property registry so a watcher can resolve `<code>.<property>` without holding
 * a reference to the module itself.
 * @param moduleCode - Code of the module, e.g. `eeg`.
 * @param registry - The module's interface-owned property declarations.
 */
export const registerModuleProperties = (moduleCode: string, registry: ModulePropertyRegistry) => {
    _registries.set(moduleCode, registry)
}

/**
 * Check whether `<code>.<property>` names an interface-owned module property.
 * @param path - Fully qualified property name, e.g. `eeg.trend-visible`.
 */
export const isModuleProperty = (path: string): boolean => {
    const separator = path.indexOf('.')
    if (separator < 0) {
        return false
    }
    return Boolean(_registries.get(path.slice(0, separator))?.[path.slice(separator + 1)])
}

/** True when `value` satisfies the constructor named by `type`, honouring a `'?'` null suffix. */
const valueMatches = (value: unknown, type: string): boolean => {
    if (type.endsWith('?')) {
        if (value === null || value === undefined) {
            return true
        }
        type = type.slice(0, -1)
    }
    return value !== null && value !== undefined && (value as object).constructor?.name === type
}

/**
 * Build the `setPropertyValue` implementation for a module's interface-owned properties.
 *
 * The returned setter reports whether the property was **its own**, not whether a value changed:
 * `false` means no such interface property exists and the caller should forward the write to the
 * core module, while a rejected value returns `true` so a write that failed validation is not
 * retried against a second owner under the same name.
 *
 * @param moduleCode - Code of the module, e.g. `eeg`.
 * @param runtime - Accessor for the module's runtime object, whose fields the registry addresses. It is an accessor rather than the object because a module declares its setter inside the very literal that becomes that object, where a direct reference is still in the temporal dead zone.
 * @param registry - The module's interface-owned property declarations.
 */
export const createPropertySetter = (
    moduleCode: string,
    runtime: () => Record<string, unknown>,
    registry: ModulePropertyRegistry,
) => {
    return (property: string, value: unknown): boolean => {
        const spec = registry[property]
        if (!spec) {
            return false
        }
        if (!valueMatches(value, spec.type)) {
            Log.warn(
                `Cannot set '${moduleCode}.${property}'; expected a value of type '${spec.type}'.`,
            SCOPE)
            return true
        }
        const fields = runtime()
        const previous = fields[spec.field]
        if (previous === value) {
            return true
        }
        fields[spec.field] = value
        const bus = window.__EPICURRENTS__?.EVENT_BUS
        if (bus) {
            // No event-name override: the helper then names the event
            // `property-change:<module>.<property>`, so a watcher subscribes to the one property it
            // cares about instead of filtering a shared event by its detail. This is the same
            // convention assets use for their own properties.
            dispatchPropertyChange(
                bus, EventScopes.INTERFACE, `${moduleCode}.${property}`, value, previous, 'after',
                { origin: fields },
            )
        }
        return true
    }
}
