/**
 * Epicurrents Interface WebAwesome directive for property binding.
 * @package    epicurrents/interface
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { Directive } from 'vue'

const decimalSep = 1.1.toLocaleString().substring(1, 2)

type ElEntry = { handler: EventListener; eventName: string }
const elMap = new WeakMap<HTMLInputElement, ElEntry>()

const setValue = (el: HTMLInputElement, value: unknown) => {
    if (el.tagName === 'WA-SWITCH' || el.tagName === 'WA-CHECKBOX') {
        el.checked = Boolean(value ?? false)
    } else if (el.tagName === 'WA-INPUT' && typeof value === 'number') {
        el.value = (value ?? '').toLocaleString()
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
        if (typeof instance[property as keyof typeof instance] === 'undefined') {
            return
        }
        const eventName = el.tagName === 'WA-SELECT' ? 'change' : 'input'
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
        elMap.set(el, { handler: inputHandler as EventListener, eventName })
        setValue(el, instance[property as keyof typeof instance] ?? '')
        el.addEventListener(eventName, inputHandler as EventListener)
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
            elMap.delete(el)
        }
    },
}
export default waDirective
