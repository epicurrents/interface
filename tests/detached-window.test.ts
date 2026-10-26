/**
 * The detached window component: content moved into the window without remounting, moved back when it closes, and
 * one window per document across components.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { createApp, defineComponent, h, nextTick, onMounted, reactive } from 'vue'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import DetachedWindow from '#app/windows/DetachedWindow.vue'

/** Counts its mounts, so a remount of the content shows. */
const mounts = { count: 0 }
const Probe = defineComponent({
    setup () {
        onMounted(() => {
            mounts.count++
        })
        return () => h('p', { class: 'probe' }, 'content')
    },
})

const apps = [] as { unmount: () => void }[]

/**
 * Mount a detached window with reactive props in a placeholder of its own.
 * @param initial - The props to start with.
 */
const mountWindow = (initial: Record<string, unknown>) => {
    const state = reactive({ open: false, title: 'Tools', ...initial })
    const events = { close: vi.fn(), left: vi.fn(), top: vi.fn() }
    const place = document.createElement('div')
    place.className = 'place'
    document.body.append(place)
    const app = createApp({
        render: () => h(DetachedWindow, {
            ...state,
            onClose: () => {
                events.close()
                state.open = false
            },
            'onUpdate:left': events.left,
            'onUpdate:top': events.top,
        }, () => h(Probe)),
    })
    app.mount(place)
    apps.push(app)
    return { app, events, place, state }
}

const settle = async () => {
    for (let i = 0; i < 5; i++) {
        await nextTick()
        await Promise.resolve()
    }
}

const windowBodies = () => document.querySelectorAll('.epicurrents-window__body')

beforeAll(() => {
    // jsdom has no pointer capture.
    HTMLElement.prototype.setPointerCapture = () => {}
    HTMLElement.prototype.hasPointerCapture = () => true
    HTMLElement.prototype.releasePointerCapture = () => {}
})

afterEach(() => {
    apps.splice(0).forEach((app) => app.unmount())
    Reflect.deleteProperty(window, 'documentPictureInPicture')
    localStorage.clear()
    document.body.innerHTML = ''
    mounts.count = 0
})

describe('inline content', () => {
    it('is shown in place, moves into the window and back, and is never remounted', async () => {
        const { place, state } = mountWindow({ inline: true })
        await settle()
        const probe = place.querySelector('.probe')
        expect(probe).not.toBeNull()
        expect(windowBodies()).toHaveLength(0)
        state.open = true
        await settle()
        expect(windowBodies()).toHaveLength(1)
        expect(windowBodies()[0].querySelector('.probe')).toBe(probe)
        expect(place.querySelector('.probe')).toBeNull()
        state.open = false
        await settle()
        expect(windowBodies()).toHaveLength(0)
        expect(place.querySelector('.probe')).toBe(probe)
        expect(mounts.count).toBe(1)
    })

    it('comes back in place when the user closes the window', async () => {
        const { events, place, state } = mountWindow({ inline: true, open: true })
        await settle()
        const close = document.querySelector('.epicurrents-window__close') as HTMLButtonElement
        close.click()
        await settle()
        expect(events.close).toHaveBeenCalledTimes(1)
        expect(state.open).toBe(false)
        expect(windowBodies()).toHaveLength(0)
        expect(place.querySelector('.probe')).not.toBeNull()
        expect(mounts.count).toBe(1)
    })
})

describe('window-only content', () => {
    it('exists only while the window is open', async () => {
        const { place, state } = mountWindow({})
        await settle()
        expect(document.querySelector('.probe')).toBeNull()
        state.open = true
        await settle()
        expect(windowBodies()[0].querySelector('.probe')).not.toBeNull()
        expect(place.querySelector('.probe')).toBeNull()
        state.open = false
        await settle()
        expect(document.querySelector('.probe')).toBeNull()
    })

    it('closes its window when the component goes away', async () => {
        const { app } = mountWindow({ open: true })
        await settle()
        expect(windowBodies()).toHaveLength(1)
        app.unmount()
        apps.splice(apps.indexOf(app), 1)
        expect(windowBodies()).toHaveLength(0)
    })
})

describe('one window per document', () => {
    it('closes the window of another component when one opens, returning that content in place', async () => {
        const first = mountWindow({ inline: true, open: true, title: 'Review' })
        await settle()
        const second = mountWindow({ title: 'Tools' })
        await settle()
        second.state.open = true
        await settle()
        expect(first.events.close).toHaveBeenCalledTimes(1)
        expect(windowBodies()).toHaveLength(1)
        expect(document.querySelector('.epicurrents-window')?.getAttribute('aria-label')).toBe('Tools')
        expect(first.place.querySelector('.probe')).not.toBeNull()
    })
})

describe('context classes', () => {
    it('follow a change while the window is open', async () => {
        const { state } = mountWindow({ contextClass: ['epicv-app', 'wa-light'], open: true })
        await settle()
        const body = windowBodies()[0].querySelector('.epicurrents-window__context') as HTMLElement
        expect(body.classList.contains('wa-light')).toBe(true)
        Object.assign(state, { contextClass: ['epicv-app', 'wa-dark'] })
        await settle()
        expect(body.classList.contains('wa-light')).toBe(false)
        expect(body.classList.contains('wa-dark')).toBe(true)
        expect(body.classList.contains('epicv-app')).toBe(true)
    })
})

describe('switching windows', () => {
    it('moves the content straight into the new window without remounting it', async () => {
        const frame = document.createElement('iframe')
        document.body.append(frame)
        const pip = frame.contentWindow as Window
        vi.spyOn(pip, 'close').mockImplementation(() => {})
        Reflect.set(window, 'documentPictureInPicture', { requestWindow: async () => pip })
        localStorage.setItem('epicurrents.window-mode', 'inline')
        mountWindow({ open: true, pictureInPicture: true })
        await settle()
        const probe = document.querySelector('.probe')
        ;(document.querySelector('.epicurrents-window__action') as HTMLButtonElement).click()
        await settle()
        expect(pip.document.querySelector('.probe')).toBe(probe)
        expect(document.querySelectorAll('.epicurrents-window')).toHaveLength(0)
        ;(pip.document.querySelector('.epicurrents-window__action') as HTMLButtonElement).click()
        await settle()
        expect(windowBodies()[0].querySelector('.probe')).toBe(probe)
        expect(mounts.count).toBe(1)
    })
})

describe('moving', () => {
    it('reports where the user dragged the window', async () => {
        const { events } = mountWindow({ left: 100, open: true, top: 50 })
        await settle()
        const header = document.querySelector('.epicurrents-window__header') as HTMLElement
        const pointer = (type: string, x: number, y: number) => {
            return new PointerEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 1 })
        }
        header.dispatchEvent(pointer('pointerdown', 10, 10))
        header.dispatchEvent(pointer('pointermove', 40, 30))
        header.dispatchEvent(pointer('pointerup', 40, 30))
        expect(events.left).toHaveBeenCalledWith(130)
        expect(events.top).toHaveBeenCalledWith(70)
    })
})
