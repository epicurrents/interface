/**
 * Configuration merge for the application setup.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { safeObjectFrom } from '@epicurrents/core/dist/util'

/**
 * Property names that address an object's prototype rather than the object. A host's SETUP is
 * untrusted input — it may be JSON the page parsed from a URL — and the defaults it merges into are
 * prototype-free, so the merge must not be the step that reintroduces a prototype pointer at depth.
 */
const UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype']

/**
 * Is `value` a bare data object, as opposed to something whose identity matters?
 *
 * Only bare objects are merged key by key. Arrays, functions, class instances and primitives are
 * carried over whole, because merging them would produce a value neither side described: a montage
 * list spliced together from two configurations, or a provider function with another object's
 * properties grafted onto it.
 * @param value - Value to classify.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false
    }
    const proto = Object.getPrototypeOf(value)
    return proto === null || proto === Object.prototype
}

/**
 * Merge `sources` into `target` in place and return `target`, recursing into object-valued keys
 * rather than overwriting them.
 *
 * Recursion is what makes an object-valued setup key partially specifiable. Under a shallow copy
 * every such key is all-or-nothing, so a host that sets `modules.eeg.leadFieldProvider` — which it
 * must, since a function cannot be expressed in the JSON a page declares — supplies the whole
 * `modules` object and loses every module default it did not restate, the built-in cascade montages
 * among them. Nothing reports that: the affected list is one entry shorter than it should be, which
 * reads as a configuration choice rather than a loss.
 *
 * A host cannot make up the difference on its own without copying the interface's defaults into its
 * own code, where they drift the moment one of them changes here. So the merge is the layer that
 * has to preserve them.
 *
 * Later sources win over earlier ones and every source wins over `target`. A `null` or `undefined`
 * source is skipped, as is a key whose value is `undefined`: naming a key without a value must not
 * blank the default underneath it.
 *
 * @param target - Object to merge into. Mutated in place.
 * @param sources - Objects to merge, in ascending order of precedence.
 */
export const mergeConfig = <T extends object>(target: T, ...sources: (object | undefined | null)[]): T => {
    const merged = target as Record<string, unknown>
    for (const source of sources) {
        if (!source) {
            continue
        }
        for (const key of Object.keys(source)) {
            if (UNSAFE_KEYS.includes(key)) {
                continue
            }
            const value = (source as Record<string, unknown>)[key]
            if (value === undefined) {
                continue
            }
            if (isPlainObject(value)) {
                // Copied into an object of our own making rather than assigned by reference, so the
                // resolved setup never aliases the source (mutating either afterwards leaves the
                // other alone) and stays prototype-free at every depth.
                const existing = merged[key]
                merged[key] = mergeConfig(isPlainObject(existing) ? existing : safeObjectFrom({}), value)
            } else {
                merged[key] = value
            }
        }
    }
    return target
}
