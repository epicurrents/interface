/**
 * The document's detachable window host: one window at a time, the in-page window, and the Picture-in-Picture
 * window, which an iframe's window stands in for because jsdom has no Document Picture-in-Picture.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWindowHost, type WindowHandle, type WindowRequest } from '#app/windows/windowHost'

const request = (overrides: Partial<WindowRequest> = {}): WindowRequest => ({
    anchor: document.body,
    closeLabel: 'Close',
    contextClass: [],
    detachLabel: 'Detach',
    height: 300,
    left: 100,
    pictureInPicture: false,
    resizable: false,
    returnLabel: 'Return',
    title: 'Tools',
    top: 50,
    width: 400,
    onClose: vi.fn(),
    onMoveTo: vi.fn(),
    ...overrides,
})

/** Install a stand-in for the Document Picture-in-Picture API whose windows are iframes. */
const fakePictureInPicture = () => {
    const windows: Window[] = []
    const api = {
        requestWindow: vi.fn(async () => {
            const frame = document.createElement('iframe')
            document.body.append(frame)
            const pip = frame.contentWindow as Window
            vi.spyOn(pip, 'close').mockImplementation(() => frame.remove())
            windows.push(pip)
            return pip
        }),
    }
    Reflect.set(window, 'documentPictureInPicture', api)
    return { api, windows }
}

const frames = (root: ParentNode = document) => root.querySelectorAll('.epicurrents-window')

afterEach(async () => {
    // Leave no window open for the next test.
    const handle = await getWindowHost().open(request())
    handle.close()
    Reflect.deleteProperty(window, 'documentPictureInPicture')
    localStorage.clear()
    document.body.innerHTML = ''
    document.head.querySelectorAll('[data-test]').forEach((element) => element.remove())
})

describe('the host', () => {
    it('is one per document, shared under a registered symbol', () => {
        const host = getWindowHost()
        expect(getWindowHost()).toBe(host)
        expect(Reflect.get(globalThis, Symbol.for('epicurrents.window-host'))).toBe(host)
    })

    it('closes the open window before opening another, awaiting its owner', async () => {
        const host = getWindowHost()
        const order: string[] = []
        const first = request({
            onClose: async () => {
                order.push(`closing with ${frames().length} open`)
            },
        })
        await host.open(first)
        await host.open(request({ title: 'Report' }))
        expect(order).toEqual(['closing with 1 open'])
        expect(frames()).toHaveLength(1)
        expect(frames()[0].getAttribute('aria-label')).toBe('Report')
    })

    it('opens the next window when the owner of the open one fails to take its content back', async () => {
        const host = getWindowHost()
        await host.open(request({
            onClose: () => {
                throw new Error('owner gone')
            },
        }))
        await host.open(request({ title: 'Report' }))
        expect(frames()).toHaveLength(1)
        expect(frames()[0].getAttribute('aria-label')).toBe('Report')
    })

    it('does not call the owner when the owner closes the window', async () => {
        const onClose = vi.fn()
        const handle = await getWindowHost().open(request({ onClose }))
        handle.close()
        expect(onClose).not.toHaveBeenCalled()
        expect(frames()).toHaveLength(0)
    })

    it('rejects a request a later one overtook while it waited', async () => {
        const host = getWindowHost()
        let release = () => {}
        await host.open(request({
            onClose: () => new Promise<void>((resolve) => {
                release = resolve
            }),
        }))
        const overtaken = host.open(request({ title: 'First' }))
        const later = host.open(request({ title: 'Second' }))
        release()
        await expect(overtaken).rejects.toMatchObject({ name: 'AbortError' })
        await later
        expect(frames()).toHaveLength(1)
        expect(frames()[0].getAttribute('aria-label')).toBe('Second')
    })
})

describe('the in-page window', () => {
    it('is a non-modal dialog with the request title, context classes and body size', async () => {
        const handle = await getWindowHost().open(request({ contextClass: ['epicv-app', 'wa-light'] }))
        const frame = frames()[0] as HTMLElement
        expect(handle.mode).toBe('inline')
        expect(frame.getAttribute('role')).toBe('dialog')
        expect(frame.getAttribute('aria-modal')).toBe('false')
        expect(frame.querySelector('.epicurrents-window__title')?.textContent).toBe('Tools')
        const sized = frame.querySelector('.epicurrents-window__body') as HTMLElement
        expect(handle.body.parentElement).toBe(sized)
        expect(handle.body.classList.contains('epicv-app')).toBe(true)
        expect(sized.style.width).toBe('400px')
        expect(sized.style.height).toBe('300px')
        expect(frame.style.left).toBe('100px')
        expect(frame.style.top).toBe('50px')
        expect(frame.classList.contains('is-resizable')).toBe(false)
        handle.setTitle('Renamed')
        expect(frame.getAttribute('aria-label')).toBe('Renamed')
    })

    it('keeps the context classes off the sized body, on an element that generates no box', async () => {
        // A context class may style its own element as an application root; that layout must not reach the window.
        const handle = await getWindowHost().open(request({ contextClass: ['epicv-app'] }))
        const sized = frames()[0].querySelector('.epicurrents-window__body') as HTMLElement
        expect(sized.classList.contains('epicv-app')).toBe(false)
        expect(handle.body.classList.contains('epicurrents-window__context')).toBe(true)
        const rules = (document.getElementById('epicurrents-window-styles') as HTMLStyleElement).textContent ?? ''
        expect(rules).toMatch(/\.epicurrents-window__context\s*{\s*display: contents;/)
    })

    it('stays reachable when asked to open outside the viewport', async () => {
        await getWindowHost().open(request({ left: 5000, top: -40 }))
        const frame = frames()[0] as HTMLElement
        expect(frame.style.left).toBe(`${window.innerWidth - 48}px`)
        expect(frame.style.top).toBe('0px')
    })

    it('marks a resizable window', async () => {
        await getWindowHost().open(request({ resizable: true }))
        expect(frames()[0].classList.contains('is-resizable')).toBe(true)
    })

    it('lets the owner move the content out before the close button removes it', async () => {
        let openWhenCalled = -1
        await getWindowHost().open(request({
            onClose: () => {
                openWhenCalled = frames().length
            },
        }))
        const close = frames()[0].querySelector('.epicurrents-window__close') as HTMLButtonElement
        expect(close.getAttribute('aria-label')).toBe('Close')
        close.click()
        await vi.waitFor(() => expect(frames()).toHaveLength(0))
        expect(openWhenCalled).toBe(1)
    })

    it('opens over a shadow root the content belongs to, with the styles put there', async () => {
        const host = document.createElement('div')
        document.body.append(host)
        const shadow = host.attachShadow({ mode: 'open' })
        const anchor = document.createElement('span')
        shadow.append(anchor)
        await getWindowHost().open(request({ anchor }))
        expect(frames(shadow)).toHaveLength(1)
        expect(frames(document)).toHaveLength(0)
        expect(shadow.querySelector('#epicurrents-window-styles')).not.toBeNull()
    })
})

describe('the Picture-in-Picture window', () => {
    it('is used where the browser offers it and the request allows it', async () => {
        const { api, windows } = fakePictureInPicture()
        const handle = await getWindowHost().open(request({ contextClass: ['epicv-app'], pictureInPicture: true }))
        expect(api.requestWindow).toHaveBeenCalledWith({ disallowReturnToOpener: true, height: 332, width: 432 })
        expect(handle.mode).toBe('picture-in-picture')
        expect(handle.body.ownerDocument).toBe(windows[0].document)
        expect(handle.body.classList.contains('epicv-app')).toBe(true)
        expect(windows[0].document.title).toBe('Tools')
        expect(frames()).toHaveLength(0)
    })

    it('is not used when the request does not allow it', async () => {
        const { api } = fakePictureInPicture()
        const handle = await getWindowHost().open(request())
        expect(api.requestWindow).not.toHaveBeenCalled()
        expect(handle.mode).toBe('inline')
    })

    it('falls back to the in-page window when the browser refuses', async () => {
        const { api } = fakePictureInPicture()
        api.requestWindow.mockRejectedValueOnce(new DOMException('No activation', 'NotAllowedError'))
        const handle = await getWindowHost().open(request({ pictureInPicture: true }))
        expect(handle.mode).toBe('inline')
        expect(frames()).toHaveLength(1)
    })

    it('mirrors the page styles and the document class, and keeps them in step', async () => {
        const { windows } = fakePictureInPicture()
        const link = document.createElement('link')
        link.dataset.test = ''
        link.rel = 'stylesheet'
        link.href = 'styles/app.css'
        const style = document.createElement('style')
        style.dataset.test = ''
        style.textContent = '.a { color: red; }'
        document.head.append(link, style)
        document.documentElement.className = 'wa-light'
        await getWindowHost().open(request({ pictureInPicture: true }))
        const target = windows[0].document
        expect(target.head.querySelector('link')?.getAttribute('href')).toBe(link.href)
        expect(target.documentElement.classList.contains('wa-light')).toBe(true)
        expect(target.documentElement.classList.contains('epicurrents-pip-document')).toBe(true)
        style.textContent = '.a { color: blue; }'
        document.documentElement.className = 'wa-dark'
        const added = document.createElement('style')
        added.dataset.test = ''
        added.textContent = '.b { color: green; }'
        document.head.append(added)
        await vi.waitFor(() => {
            const texts = Array.from(target.head.querySelectorAll('style'), (element) => element.textContent)
            expect(texts).toContain('.a { color: blue; }')
            expect(texts).toContain('.b { color: green; }')
            expect(target.documentElement.classList.contains('wa-dark')).toBe(true)
        })
        document.documentElement.className = ''
    })

    it('mirrors the styles of the shadow root the content belongs to', async () => {
        const { windows } = fakePictureInPicture()
        const host = document.createElement('div')
        document.body.append(host)
        const shadow = host.attachShadow({ mode: 'open' })
        const anchor = document.createElement('span')
        const style = document.createElement('style')
        style.textContent = '.viewer { color: red; }'
        shadow.append(anchor, style)
        await getWindowHost().open(request({ anchor, pictureInPicture: true }))
        const texts = () => Array.from(windows[0].document.head.querySelectorAll('style'), (el) => el.textContent)
        expect(texts()).toContain('.viewer { color: red; }')
        style.innerHTML = '.viewer { color: blue; }'
        await vi.waitFor(() => expect(texts()).toContain('.viewer { color: blue; }'))
    })

    it('keeps a fixed body at its size and lets a resizable one follow the window', async () => {
        const { windows } = fakePictureInPicture()
        const fixed = await getWindowHost().open(request({ pictureInPicture: true }))
        expect(windows[0].document.body.classList.contains('is-fixed')).toBe(true)
        expect((fixed.body.parentElement as HTMLElement).style.width).toBe('400px')
        const resizable = await getWindowHost().open(request({ pictureInPicture: true, resizable: true }))
        expect(windows[1].document.body.classList.contains('is-fixed')).toBe(false)
        expect((resizable.body.parentElement as HTMLElement).style.width).toBe('')
    })

    it('tells the owner when the user closes it, and not when the owner does', async () => {
        const { windows } = fakePictureInPicture()
        const onClose = vi.fn()
        await getWindowHost().open(request({ onClose, pictureInPicture: true }))
        windows[0].dispatchEvent(new Event('pagehide'))
        await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
        const second = vi.fn()
        const handle = await getWindowHost().open(request({ onClose: second, pictureInPicture: true }))
        handle.close()
        expect(windows[1].close).toHaveBeenCalled()
        expect(second).not.toHaveBeenCalled()
    })
})

describe('switching between the page and Picture-in-Picture', () => {
    const detachButton = () => frames()[0].querySelector('.epicurrents-window__action') as HTMLButtonElement | null

    it('offers the in-page window a detach button only where Picture-in-Picture is offered and allowed', async () => {
        await getWindowHost().open(request())
        expect(detachButton()).toBeNull()
        fakePictureInPicture()
        localStorage.setItem('epicurrents.window-mode', 'inline')
        await getWindowHost().open(request({ pictureInPicture: true }))
        expect(detachButton()?.getAttribute('aria-label')).toBe('Detach')
    })

    it('moves the content into Picture-in-Picture, then removes the in-page window and remembers the choice', async () => {
        const { api, windows } = fakePictureInPicture()
        localStorage.setItem('epicurrents.window-mode', 'inline')
        let openWhenMoved = -1
        const onMoveTo = vi.fn((_handle: WindowHandle) => {
            openWhenMoved = frames().length
        })
        await getWindowHost().open(request({ name: 'tools', onMoveTo, pictureInPicture: true }))
        detachButton()?.click()
        await vi.waitFor(() => expect(onMoveTo).toHaveBeenCalledTimes(1))
        expect(api.requestWindow).toHaveBeenCalledWith(expect.objectContaining({ disallowReturnToOpener: true }))
        const handle = onMoveTo.mock.calls[0][0]
        expect(handle.mode).toBe('picture-in-picture')
        expect(handle.body.ownerDocument).toBe(windows[0].document)
        expect(openWhenMoved).toBe(1)
        expect(frames()).toHaveLength(0)
        expect(localStorage.getItem('epicurrents.window-mode.tools')).toBe('picture-in-picture')
        expect(localStorage.getItem('epicurrents.window-mode')).toBe('picture-in-picture')
    })

    it('moves the content back into the page from the Picture-in-Picture window, where the window was left', async () => {
        const { windows } = fakePictureInPicture()
        const onClose = vi.fn()
        const onMoveTo = vi.fn()
        await getWindowHost().open(request({ name: 'tools', onClose, onMoveTo, pictureInPicture: true }))
        const back = windows[0].document.querySelector('.epicurrents-window__action') as HTMLButtonElement
        expect(back.getAttribute('aria-label')).toBe('Return')
        back.click()
        await vi.waitFor(() => expect(onMoveTo).toHaveBeenCalledTimes(1))
        expect((onMoveTo.mock.calls[0][0] as { mode: string }).mode).toBe('inline')
        expect(frames()).toHaveLength(1)
        expect((frames()[0] as HTMLElement).style.left).toBe('100px')
        expect(windows[0].close).toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
        expect(localStorage.getItem('epicurrents.window-mode.tools')).toBe('inline')
    })

    it('opens a window the way the user last showed it, by name before the last choice anywhere', async () => {
        const { api } = fakePictureInPicture()
        localStorage.setItem('epicurrents.window-mode.tools', 'inline')
        localStorage.setItem('epicurrents.window-mode', 'picture-in-picture')
        const tools = await getWindowHost().open(request({ name: 'tools', pictureInPicture: true }))
        expect(tools.mode).toBe('inline')
        expect(api.requestWindow).not.toHaveBeenCalled()
        const report = await getWindowHost().open(request({ name: 'report', pictureInPicture: true }))
        expect(report.mode).toBe('picture-in-picture')
    })

    it('stays where it is when the browser refuses Picture-in-Picture', async () => {
        const { api } = fakePictureInPicture()
        localStorage.setItem('epicurrents.window-mode', 'inline')
        const onMoveTo = vi.fn()
        await getWindowHost().open(request({ onMoveTo, pictureInPicture: true }))
        api.requestWindow.mockRejectedValueOnce(new DOMException('No activation', 'NotAllowedError'))
        detachButton()?.click()
        await Promise.resolve()
        await Promise.resolve()
        expect(onMoveTo).not.toHaveBeenCalled()
        expect(frames()).toHaveLength(1)
        expect(localStorage.getItem('epicurrents.window-mode')).toBe('inline')
    })
})
