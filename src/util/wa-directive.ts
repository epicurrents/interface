/**
 * Epicurrents Interface WebAwesome directive for property binding.
 * @package    epicurrents/interface
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { watch, type Directive } from 'vue'

const decimalSep = 1.1.toLocaleString().substring(1, 2)

type ElEntry = { handler: EventListener; eventName: string; stop: () => void }
const elMap = new WeakMap<HTMLInputElement, ElEntry>()

const setValue = (el: HTMLInputElement, value: unknown) => {
    if (el.tagName === 'WA-SWITCH' || el.tagName === 'WA-CHECKBOX') {
        el.checked = Boolean(value ?? false)
    } else if (el.tagName === 'WA-INPUT' && typeof value === 'number') {
        el.value = value.toLocaleString()
    } else {
        el.value = (value ?? '') as string
    }
}

const waDirective: Directive = {
    beforeMount (el, binding) {
        const instance = binding.instance
        const property = binding.value
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
        // WA-SWITCH, WA-INPUT, WA-TEXTAREA, WA-COMBOBOX dispatch `input`.
        const eventName = (el.tagName === 'WA-SELECT' || el.tagName === 'WA-CHECKBOX')
            ? 'change'
            : 'input'
        const inputHandler = function inputHandler (event: InputEvent) {
            const target = event.target as HTMLInputElement
            if (target) {
                if (el.tagName === 'WA-INPUT' && el.type === 'number') {
                    instance[property as keyof typeof instance] = target.value.includes(decimalSep)
                                                                ? parseFloat(target.value)
                                                                : parseInt(target.value)
                } else if (el.tagName === 'WA-SWITCH' || el.tagName === 'WA-CHECKBOX') {
                    instance[property as keyof typeof instance] = target.checked
                } else {
                    instance[property as keyof typeof instance] = target.value
                }
            }
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
        const property = binding.value
        if (!instance || !property) {
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
