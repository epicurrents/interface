/**
 * Tests for the key guard: which key events a control owns, and that the guard keeps exactly those from the `window`
 * hotkey listeners while the control itself still receives them.
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { installKeyGuard, keyEventOwnedByControl, OWNS_KEYS_ATTRIBUTE } from '#util/key-guard'

/** Append `el` to the document, dispatch a bubbling, composed key event from `from`, and say whether it was owned. */
function press (el: Element, from: Element = el, key = 'ArrowRight', type = 'keydown') {
    if (!el.isConnected) {
        document.body.appendChild(el)
    }
    const event = new KeyboardEvent(type, { bubbles: true, composed: true, key })
    let owned: boolean | null = null
    // Read during dispatch, while the event still carries its path.
    from.addEventListener(type, (ev) => {
        owned = keyEventOwnedByControl(ev as KeyboardEvent)
    }, { once: true })
    from.dispatchEvent(event)
    return owned
}

function input (type = 'text', readOnly = false) {
    const el = document.createElement('input')
    el.type = type
    el.readOnly = readOnly
    return el
}

afterEach(() => {
    document.body.innerHTML = ''
})

describe('keyEventOwnedByControl', () => {
    it('gives a field that takes typing its keys', () => {
        expect(press(input())).toBe(true)
        expect(press(input('number'))).toBe(true)
        expect(press(document.createElement('textarea'))).toBe(true)
        expect(press(document.createElement('select'))).toBe(true)
    })

    it('leaves the keys of a field that takes no typing to the hotkeys', () => {
        expect(press(input('checkbox'))).toBe(false)
        expect(press(input('button'))).toBe(false)
        expect(press(input('text', true))).toBe(false)
        expect(press(document.createElement('div'))).toBe(false)
    })

    it('never owns Escape', () => {
        const field = input()
        expect(press(field, field, 'Escape')).toBe(false)
    })

    it('finds a field inside a shadow root', () => {
        const host = document.createElement('wa-fictional-field')
        const field = input()
        host.attachShadow({ mode: 'open' }).appendChild(field)
        document.body.appendChild(host)
        expect(press(host, field)).toBe(true)
    })

    it('gives a WebAwesome text control its keys from its host', () => {
        expect(press(document.createElement('wa-input'))).toBe(true)
    })

    it('gives a select, menu or dialog its keys only while it is open', () => {
        for (const tag of ['wa-select', 'wa-dropdown', 'wa-dialog']) {
            const control = document.createElement(tag) as HTMLElement & { open?: boolean }
            const button = document.createElement('button')
            control.appendChild(button)
            control.open = false
            expect(press(control, button)).toBe(false)
            control.open = true
            expect(press(control, button)).toBe(true)
        }
    })

    it('gives a marked composite control the keys of everything inside it', () => {
        const panel = document.createElement('div')
        panel.setAttribute(OWNS_KEYS_ATTRIBUTE, '')
        const button = document.createElement('button')
        panel.appendChild(button)
        expect(press(panel, button)).toBe(true)
    })
})

describe('installKeyGuard', () => {
    let hotkey: Mock<(event: Event) => void>
    let remove: () => void

    beforeEach(() => {
        hotkey = vi.fn<(event: Event) => void>()
        window.addEventListener('keydown', hotkey)
        window.addEventListener('keyup', hotkey)
        remove = installKeyGuard()
    })

    afterEach(() => {
        remove()
        window.removeEventListener('keydown', hotkey)
        window.removeEventListener('keyup', hotkey)
    })

    it('keeps a key typed into a field from the hotkeys, while the field still gets it', () => {
        const field = input()
        const own = vi.fn()
        field.addEventListener('keydown', own)
        press(field)
        press(field, field, 'a', 'keyup')
        expect(own).toHaveBeenCalledOnce()
        expect(hotkey).not.toHaveBeenCalled()
    })

    it('lets every other key through to the hotkeys', () => {
        press(document.createElement('div'))
        press(input('checkbox'))
        expect(hotkey).toHaveBeenCalledTimes(2)
    })

    it('lets Escape through from a field', () => {
        const field = input()
        press(field, field, 'Escape')
        expect(hotkey).toHaveBeenCalledOnce()
    })

    it('stops guarding once removed', () => {
        remove()
        press(input())
        expect(hotkey).toHaveBeenCalledOnce()
    })
})
