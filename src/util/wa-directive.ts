/**
 * Epicurrents Interface WebAwesome directive for property binding.
 *
 * Registered as `v-property`. `v-property="'name'"` binds the component's `name` two-way: user input is written to it
 * as it is typed, and a change to it is reflected onto the element. `v-property="['name', correct]"` binds it through a
 * correction instead: the value is read when the user commits it (the `change` event, on Enter or when the field loses
 * focus), `correct` receives it and returns the value to keep, and the element is given that value back. Committing
 * rather than reading every keystroke keeps a correction from fighting the typing, such as a lower bound snapping away
 * the first digit of a larger number. A correction runs for user input only, so it may also update what depends on the
 * value, which a watcher could not tell apart from a programmatic change.
 *
 * @package    epicurrents/interface
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { watch, type Directive } from 'vue'

/**
 * Turn a value the user committed into the value to keep: a number input gives a number, NaN when cleared; a switch or
 * a checkbox a boolean; anything else a string.
 */
export type WaCorrection = (value: unknown) => unknown

/** What `v-property` takes: the name of the bound property, alone or with a correction. */
export type WaBinding = string | [string, WaCorrection]

type ElEntry = { handler: EventListener; eventName: string; stop: () => void }
const elMap = new WeakMap<HTMLInputElement, ElEntry>()

// A number input's value is always the plain, '.'-decimal form whatever the user's locale, and the browser renders it
// localised itself, so both directions convert without a locale. A cleared or incomplete field reads as NaN.
const readNumber = (value: string) => value.trim() === '' ? NaN : Number(value)

const setValue = (el: HTMLInputElement, value: unknown) => {
    if (el.tagName === 'WA-SWITCH' || el.tagName === 'WA-CHECKBOX') {
        el.checked = Boolean(value ?? false)
    } else if (el.tagName === 'WA-INPUT' && typeof value === 'number') {
        el.value = Number.isFinite(value) ? String(value) : ''
    } else {
        el.value = (value ?? '') as string
    }
}

/** The bound property's name, and the correction where one is given. */
const parseBinding = (value: WaBinding | null | undefined): [string | null, WaCorrection | null] => {
    if (Array.isArray(value)) {
        return [value[0] || null, typeof value[1] === 'function' ? value[1] : null]
    }
    return [value || null, null]
}

const waDirective: Directive<HTMLInputElement, WaBinding> = {
    beforeMount (el, binding) {
        const instance = binding.instance
        const [property, correct] = parseBinding(binding.value)
        if (!instance || !property) {
            return
        }
        // Bind whenever the named field exists on the instance — including when
        // it is currently `undefined` (a ref initialised to undefined). Only a
        // genuinely absent field (e.g. a typo) is skipped. The `in` check goes
        // through the Vue public-instance proxy, so it resolves setup state,
        // data, computed and props identically for Options and Composition use.
        if (!((property as PropertyKey) in instance)) {
            return
        }
        // WA-CHECKBOX dispatches only `change`; WA-SELECT also only `change`.
        // WA-SWITCH, WA-INPUT, WA-TEXTAREA, WA-COMBOBOX dispatch `input`, and `change` once the value is committed,
        // which is the event a correction runs on.
        const eventName = (correct || el.tagName === 'WA-SELECT' || el.tagName === 'WA-CHECKBOX')
            ? 'change'
            : 'input'
        const inputHandler = function inputHandler (event: InputEvent) {
            const target = event.target as HTMLInputElement
            if (!target) {
                return
            }
            let value: unknown
            if (el.tagName === 'WA-INPUT' && el.type === 'number') {
                value = readNumber(target.value)
            } else if (el.tagName === 'WA-SWITCH' || el.tagName === 'WA-CHECKBOX') {
                value = target.checked
            } else {
                value = target.value
            }
            if (!correct) {
                instance[property as keyof typeof instance] = value as never
                return
            }
            const kept = correct(value)
            instance[property as keyof typeof instance] = kept as never
            // Given back whether or not the property changed: when it already held the corrected value, nothing
            // re-renders the element, which would go on showing what was typed.
            setValue(el, kept)
        }
        setValue(el, instance[property as keyof typeof instance] ?? '')
        el.addEventListener(eventName, inputHandler as EventListener)
        // Reflect external changes to the bound property onto the element. The template
        // references the property only through this directive, not reactively, so a change
        // would not re-render the component on its own; watch it explicitly.
        const stop = watch(
            () => instance[property as keyof typeof instance],
            (value) => setValue(el, value),
        )
        elMap.set(el, { handler: inputHandler as EventListener, eventName, stop })
    },
    updated (el, binding) {
        const instance = binding.instance
        const [property, correct] = parseBinding(binding.value)
        // A corrected binding is left to the watcher: its property changes only on commit, so a re-render while the
        // person is typing would otherwise put the last committed value back over what they have typed so far.
        if (!instance || !property || correct) {
            return
        }
        // Wait for all updates to finish.
        requestAnimationFrame(() => {
            setValue(el, instance[property as keyof typeof instance] ?? '')
        })
    },
    beforeUnmount (el) {
        const entry = elMap.get(el)
        if (entry) {
            el.removeEventListener(entry.eventName, entry.handler)
            entry.stop()
            elMap.delete(el)
        }
    },
}
export default waDirective
