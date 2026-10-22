/**
 * Tests for the pointer overlay's handling of a second button pressed during tracking, which browsers report as a
 * pointer move rather than a pointer down.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { createApp } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OverlayComponent from '#app/overlays/PointerEventOverlay.vue'
import type { PointerEventOverlay } from '#app/overlays/PointerEventOverlay.vue'

const hosts = [] as HTMLElement[]

function mountOverlay () {
    const host = document.createElement('div')
    document.body.appendChild(host)
    hosts.push(host)
    return createApp(OverlayComponent).mount(host) as unknown as PointerEventOverlay
}

function pointer (type: string, button: number) {
    return new PointerEvent(type, { bubbles: true, button, clientX: 10, clientY: 10 })
}

afterEach(() => {
    hosts.splice(0).forEach(host => host.remove())
})

describe('chorded button presses', () => {
    it('reports the other button pressed mid-drag to the chord handler and ends tracking', () => {
        const overlay = mountOverlay()
        const handlers = { chord: vi.fn(), move: vi.fn(), up: vi.fn() }
        overlay.trackPointer(pointer('pointerdown', 0), handlers)
        overlay.component.dispatchEvent(pointer('pointermove', -1))
        expect(handlers.move).toHaveBeenCalledTimes(1)
        overlay.component.dispatchEvent(pointer('pointermove', 2))
        expect(handlers.chord).toHaveBeenCalledTimes(1)
        expect(handlers.move).toHaveBeenCalledTimes(1)
        expect(overlay.component.style.pointerEvents).toBe('none')
        // The tracked button's release no longer reaches the handlers.
        overlay.component.dispatchEvent(pointer('pointermove', -1))
        overlay.component.dispatchEvent(pointer('pointerup', 0))
        expect(handlers.move).toHaveBeenCalledTimes(1)
        expect(handlers.up).not.toHaveBeenCalled()
    })

    it('takes the tracked button changing state as its own, not as a chord', () => {
        const overlay = mountOverlay()
        const handlers = { chord: vi.fn(), move: vi.fn(), up: vi.fn() }
        overlay.trackPointer(pointer('pointerdown', 2), handlers)
        overlay.component.dispatchEvent(pointer('pointermove', 2))
        overlay.component.dispatchEvent(pointer('pointerup', 2))
        expect(handlers.chord).not.toHaveBeenCalled()
        expect(handlers.up).toHaveBeenCalledTimes(1)
    })

    it('leaves a chorded press to the move handler when no chord handler is given', () => {
        const overlay = mountOverlay()
        const handlers = { move: vi.fn(), up: vi.fn() }
        overlay.trackPointer(pointer('pointerdown', 0), handlers)
        overlay.component.dispatchEvent(pointer('pointermove', 2))
        overlay.component.dispatchEvent(pointer('pointerup', 0))
        expect(handlers.move).toHaveBeenCalledTimes(1)
        expect(handlers.up).toHaveBeenCalledTimes(1)
    })
})
