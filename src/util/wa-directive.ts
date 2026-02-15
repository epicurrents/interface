/**
 * Epicurrents Interface WebAwesome directive for property binding.
 * @package    epicurrents/interface
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { Directive } from 'vue'

const decimalSep = 1.1.toLocaleString().substring(1, 2)
const elMap = new WeakMap()
const setValue = (el: HTMLInputElement, value: any) => {
    if (el.tagName === 'WA-SWITCH' || el.tagName == 'WA-CHECKBOX') {
        el.checked = (value ?? false) || undefined
    } else if (el.tagName === 'WA-INPUT' && typeof value === 'number') {
        el.value = (value ?? '').toLocaleString()
    } else {
        el.value = (value ?? '')
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
                } else if (el.tagName === 'WA-SWITCH' || el.tagName == 'WA-CHECKBOX') {
                    instance[property as keyof typeof instance] = target.checked
                } else {
                    instance[property as keyof typeof instance] = target.value
                }
            }
        }
        elMap.set(el, inputHandler)
        setValue(el, instance[property as keyof typeof instance] ?? '')
        el.addEventListener(eventName, inputHandler)
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
        const inputHandler = elMap.get(el)
        el.removeEventListener(el, inputHandler)
        elMap.delete(el)
    },
}
export default waDirective
