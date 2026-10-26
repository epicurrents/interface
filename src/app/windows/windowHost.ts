/**
 * The document's single detachable window.
 *
 * One host per document owns one window slot, shared by every application on the page: the viewer and its host
 * page are separate bundles with separate Vue applications, so the host is kept on `globalThis` under a registered
 * symbol, and the first bundle to ask installs it. Opening a window while another is open closes the other first,
 * through its request's `onClose`, so at most one exists at a time.
 *
 * A window opens the way the user last showed it: as a Document Picture-in-Picture window where the browser offers one
 * and the request allows it, or as a non-modal window floating over the page. A button in the window's corner moves
 * it to the other, the content going straight from one window to the next, and the choice is remembered per window
 * name. Picture-in-Picture needs a user activation, so a request made outside one falls back to the in-page window.
 * The window's body holds an empty element the caller moves its content into; it carries the request's context
 * classes, which stand in for the ancestors the content leaves behind. In Picture-in-Picture the page's stylesheets,
 * the content root's stylesheets and the class of the document element are mirrored into the window for as long as
 * it is open, and the style bridge carries the content's shadow-root sheets across. The window's corner button takes
 * room at the top right of the body, published to the content as `--epicurrents-window-actions-width`.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { installStyleBridge, type StyleBridge } from './styleBridge'

/** How a window is shown. */
export type WindowMode = 'inline' | 'picture-in-picture'

/** An open window, as returned to the caller that opened it. */
export interface WindowHandle {
    /** The element the content goes into. */
    readonly body: HTMLElement
    /** How the window is shown. */
    readonly mode: WindowMode
    /**
     * Close the window without calling the request's `onClose`. The content must have left the body first, or it
     * goes with the window.
     */
    close (): void
    /**
     * Change the window's title.
     * @param title - The new title.
     */
    setTitle (title: string): void
}

/** The document's window host. */
export interface WindowHost {
    /** Version of the host contract; a host installed by another bundle may be older or newer. */
    readonly version: number
    /**
     * Finish moving a subtree between documents: restore the shadow-root stylesheets its move cleared.
     * @param node - Root of the subtree that moved.
     */
    finishMove (node: Node): void
    /**
     * Put the window styles in the root of a node, for content that is shown in place before any window opens.
     * @param node - A node in the document or shadow root that needs the styles.
     */
    installStyles (node: Node): void
    /**
     * Open a window, closing the open one first. Rejects when a later request replaces this one before it opens.
     * @param request - What to open.
     */
    open (request: WindowRequest): Promise<WindowHandle>
    /**
     * Prepare a subtree for moving between documents. Call it before the move, while the subtree is styled.
     * @param node - Root of the subtree about to move.
     */
    prepareMove (node: Node): void
}

/** A request for a window. */
export interface WindowRequest {
    /** A node where the content belongs; its root node supplies the styles and holds an in-page window. */
    anchor: Node
    /** Accessible name of the close button of an in-page window. */
    closeLabel: string
    /**
     * Classes standing in for the ancestors the content leaves behind. They go on an element that generates no box,
     * so descendant rules and inherited values reach the content while rules styling the classes' own element, such
     * as an application root's layout, have nothing to act on.
     */
    contextClass: string[]
    /** Accessible name of the in-page window's button that moves it into Picture-in-Picture. */
    detachLabel: string
    /** Height of the content area in pixels, inside the window's padding; updated as the user resizes the window. */
    height: number
    /** Distance of an in-page window from the left edge of the viewport, or null to centre it; updated as it moves. */
    left: number | null
    /**
     * Names the window for remembering how it was last shown. A window shown either way by the user opens that way
     * the next time; one with no name, or never switched, follows the last switch made in any window.
     */
    name?: string
    /** Whether a Picture-in-Picture window may be used where the browser offers one. */
    pictureInPicture: boolean
    /**
     * Whether the window's size may change. A Picture-in-Picture window can always be resized by the user, so a
     * fixed one keeps its body at the requested size, centred, and scrolls when the window is smaller.
     */
    resizable: boolean
    /** Accessible name of the Picture-in-Picture window's button that moves it back into the page. */
    returnLabel: string
    /** The window's title. */
    title: string
    /** Distance of an in-page window from the top edge of the viewport, or null to centre it; updated as it moves. */
    top: number | null
    /** Width of the content area in pixels, inside the window's padding; updated as the user resizes the window. */
    width: number
    /**
     * Called when the window closes other than through its handle: the user closed it, or another window replaced
     * it. A returned promise is awaited before the window is removed, so the content can be moved out first; a
     * Picture-in-Picture window the user closes is going away regardless and is not waited for.
     */
    onClose: () => void | Promise<void>
    /**
     * Called when the user has moved an in-page window.
     * @param left - New distance from the left edge of the viewport.
     * @param top - New distance from the top edge of the viewport.
     */
    onMove?: (left: number, top: number) => void
    /**
     * Called when the user switches the window between the page and Picture-in-Picture, with the handle of the window
     * that replaces it. The content moves into the new handle's body before the returned promise settles; the old
     * window is removed after that.
     * @param handle - The new window.
     */
    onMoveTo: (handle: WindowHandle) => void | Promise<void>
    /**
     * Called when the user has resized a resizable window.
     * @param width - New width of the content area.
     * @param height - New height of the content area.
     */
    onResize?: (width: number, height: number) => void
}

/** The contract version this module implements. */
export const WINDOW_HOST_VERSION = 2

/** Pixels of an in-page window's title bar that dragging always leaves inside the viewport. */
const KEEP_VISIBLE = 48
const HOST_KEY = Symbol.for('epicurrents.window-host')
/** Padding around the content of a Picture-in-Picture window, which the window is requested larger by. */
const PIP_PADDING = 16
/** Storage key of the remembered window mode; a named window's own choice is kept under `<key>.<name>`. */
const MODE_KEY = 'epicurrents.window-mode'
const STYLE_ID = 'epicurrents-window-styles'

/** Styles of the window chrome, put once in each document or shadow root that shows a window. */
const WINDOW_CSS = `
.epicurrents-window {
    background-color: var(--wa-color-surface-raised, #fff);
    border: 1px solid var(--wa-color-surface-border, #d0d4d9);
    border-radius: var(--wa-border-radius-l, 0.5rem);
    box-shadow: var(--wa-shadow-l, 0 0.5rem 1.5rem rgb(0 0 0 / 20%));
    box-sizing: border-box;
    color: var(--wa-color-text-normal, #1b1d20);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: fixed;
    z-index: 1000;
}
.epicurrents-window.is-resizable {
    min-height: 8rem;
    min-width: 12rem;
    resize: both;
}
.epicurrents-window__header {
    align-items: center;
    cursor: move;
    display: flex;
    flex: 0 0 auto;
    gap: 0.5rem;
    padding: 0.5rem 0.5rem 0.5rem 1rem;
    touch-action: none;
    user-select: none;
}
.epicurrents-window__title {
    flex: 1 1 auto;
    font-family: var(--wa-font-family-heading, sans-serif);
    font-size: var(--wa-font-size-l, 1.125rem);
    font-weight: var(--wa-font-weight-heading, 600);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.epicurrents-window__action,
.epicurrents-window__close {
    align-items: center;
    background: none;
    border: none;
    border-radius: var(--wa-border-radius-m, 0.25rem);
    color: var(--wa-color-text-quiet, #5f6670);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    height: 2rem;
    justify-content: center;
    padding: 0;
    width: 2rem;
}
.epicurrents-window__action:hover,
.epicurrents-window__action:focus-visible,
.epicurrents-window__close:hover,
.epicurrents-window__close:focus-visible {
    background-color: var(--wa-color-neutral-fill-quiet, #eceef0);
    color: var(--wa-color-text-normal, #1b1d20);
}
.epicurrents-window__action svg,
.epicurrents-window__close svg {
    fill: currentColor;
    height: 1rem;
    width: 1rem;
}
.epicurrents-window__action svg {
    /* The Material glyphs carry their own padding. */
    height: 1.375rem;
    width: 1.375rem;
}
.epicurrents-window__body {
    box-sizing: content-box;
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 0 1rem 1rem;
    position: relative;
}
.epicurrents-window__body > .epicurrents-window__context {
    display: contents;
}
.epicurrents-window-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
}
.epicurrents-window-content.is-inline {
    display: contents;
}
html.epicurrents-pip-document,
html.epicurrents-pip-document > body {
    height: 100%;
    margin: 0;
}
html.epicurrents-pip-document > body {
    background-color: var(--wa-color-surface-raised, #fff);
    color: var(--wa-color-text-normal, #1b1d20);
    overflow: auto;
}
html.epicurrents-pip-document .epicurrents-window__body {
    padding: ${PIP_PADDING}px;
}
html.epicurrents-pip-document > body:not(.is-fixed) > .epicurrents-window__body {
    box-sizing: border-box;
    height: 100%;
}
html.epicurrents-pip-document .epicurrents-window__action {
    position: absolute;
    right: 1rem;
    top: 1rem;
    z-index: 1;
}
html.epicurrents-pip-document .epicurrents-window__context {
    --epicurrents-window-actions-width: 2.5rem;
}
html.epicurrents-pip-document > body.is-fixed {
    display: grid;
    place-items: center;
}
html.epicurrents-pip-document > body.is-fixed > .epicurrents-window__body {
    flex: none;
}
`

/** The Font Awesome xmark glyph. */
const CLOSE_ICON = '<svg viewBox="0 0 384 512" aria-hidden="true"><path d="M55.1 73.4c-12.5-12.5-32.8-12.5-45.3 '
    + '0s-12.5 32.8 0 45.3L146.7 256 9.9 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 329.4 438.6c'
    + '12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 374.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 '
    + '0L192 210.7 55.1 73.4z"/></svg>'

/** The Material Symbols pip glyph, for moving a window into Picture-in-Picture. */
const DETACH_ICON = '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M80-520v-60h178L57-780l43-43 200 '
    + '200v-177h60v280H80Zm60 360q-24 0-42-18t-18-42v-230h60v230h340v60H140Zm680-280v-300H430v-60h390q24 0 42 18t18 '
    + '42v300h-60ZM540-160v-220h340v220H540Z"/></svg>'

/** The Material Symbols pip_exit glyph, for moving a window back into the page. */
const RETURN_ICON = '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M140-160q-24 0-42-18t-18-42v-300h60v'
    + '300h680v-520H440v-60h380q24 0 42 18t18 42v520q0 24-18 42t-42 18H140Zm557-140 43-43-151-150h118v-60H487v220h60v'
    + '-117l150 150ZM80-580v-220h300v220H80Zm400 100Z"/></svg>'

/** The parts of the Document Picture-in-Picture API this module uses. */
interface PictureInPictureApi {
    requestWindow (options: {
        disallowReturnToOpener?: boolean
        height: number
        width: number
    }): Promise<Window & typeof globalThis>
}

/** What opening a window of one mode returns to the host. */
interface OpenedWindow {
    dispose: () => void
    handle: WindowHandle
}

/** Switches the open window to the other mode, from one of its buttons. */
type ModeSwitch = (mode: WindowMode) => Promise<void>

/** The bookkeeping of an open window, kept by the host. */
interface OpenWindow {
    /** Remove the window and stop everything it keeps running. */
    dispose: () => void
    /** The handle given to the caller, once the window has opened. */
    handle: WindowHandle | null
    request: WindowRequest
}

// Nodes are told apart by node type and name rather than by `instanceof`, because a Picture-in-Picture window is
// another realm: its document and the elements it creates fail every `instanceof` against this window's classes.

/**
 * Whether a node is a document, of any realm.
 * @param node - The node.
 */
const isDocument = (node: Node): node is Document => node.nodeType === Node.DOCUMENT_NODE

/**
 * Whether a node is a shadow root, of any realm.
 * @param node - The node.
 */
const isShadowRoot = (node: Node): node is ShadowRoot => {
    return node.nodeType === Node.DOCUMENT_FRAGMENT_NODE && 'host' in node
}

/**
 * Whether an element is a stylesheet link, of any realm.
 * @param element - The element.
 */
const isStylesheetLink = (element: Element): element is HTMLLinkElement => {
    return element.localName === 'link' && (element as HTMLLinkElement).relList.contains('stylesheet')
}

/**
 * Whether an element is a style element, of any realm.
 * @param element - The element.
 */
const isStyleElement = (element: Element): element is HTMLStyleElement => element.localName === 'style'

/**
 * Put the window chrome styles in a document or shadow root that does not have them yet.
 * @param root - Where the styles go: a document's head, or the shadow root itself.
 */
const ensureWindowStyles = (root: Document | ShadowRoot) => {
    if (root.querySelector(`#${STYLE_ID}`)) {
        return
    }
    const ownerDocument = isDocument(root) ? root : root.ownerDocument
    const style = ownerDocument.createElement('style')
    style.id = STYLE_ID
    style.textContent = WINDOW_CSS
    if (isDocument(root)) {
        root.head.append(style)
    } else {
        root.append(style)
    }
}

/**
 * The size of a window body's content area, inside its padding.
 * @param body - The window body.
 */
const contentSize = (body: HTMLElement) => {
    const style = (body.ownerDocument.defaultView ?? window).getComputedStyle(body)
    return {
        height: body.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
        width: body.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    }
}

/**
 * The element the content goes into, carrying the context classes.
 * @param ownerDocument - The document of the window.
 * @param contextClass - The request's context classes.
 */
const contextElement = (ownerDocument: Document, contextClass: string[]) => {
    const context = ownerDocument.createElement('div')
    context.className = 'epicurrents-window__context'
    context.classList.add(...contextClass)
    return context
}

/**
 * A button of the window chrome.
 * @param ownerDocument - The document of the window.
 * @param className - The button's class.
 * @param icon - The button's glyph.
 * @param label - The button's accessible name.
 * @param action - What a click does.
 */
const chromeButton = (ownerDocument: Document, className: string, icon: string, label: string, action: () => void) => {
    const button = ownerDocument.createElement('button')
    button.className = className
    button.innerHTML = icon
    button.setAttribute('aria-label', label)
    button.setAttribute('title', label)
    button.setAttribute('type', 'button')
    button.addEventListener('click', action)
    return button
}

/**
 * How a window was last shown by the user's choice: its own, else the last made in any window, else in
 * Picture-in-Picture. Storage that cannot be read gives the default.
 * @param name - The window's name, if it has one.
 */
const preferredMode = (name?: string): WindowMode => {
    try {
        const stored = (name && localStorage.getItem(`${MODE_KEY}.${name}`)) || localStorage.getItem(MODE_KEY)
        return stored === 'inline' ? 'inline' : 'picture-in-picture'
    } catch {
        return 'picture-in-picture'
    }
}

/**
 * Remember how the user chose to show a window. Storage that cannot be written forgets it.
 * @param mode - The chosen mode.
 * @param name - The window's name, if it has one.
 */
const rememberMode = (mode: WindowMode, name?: string) => {
    try {
        if (name) {
            localStorage.setItem(`${MODE_KEY}.${name}`, mode)
        }
        localStorage.setItem(MODE_KEY, mode)
    } catch {
        // A choice that cannot be stored is not remembered.
    }
}

/** The Document Picture-in-Picture API of this window, where the browser offers it. */
const pictureInPictureApi = (): PictureInPictureApi | null => {
    const api = Reflect.get(window, 'documentPictureInPicture') as PictureInPictureApi | undefined
    return api && typeof api.requestWindow === 'function' ? api : null
}

/**
 * Keeps a target document's stylesheets in step with those of the source documents and shadow roots. A source
 * document contributes the style and stylesheet-link elements of its head, a shadow root those of its top level,
 * and both their adopted sheets, which are copied into the target's window.
 */
class StyleMirror {
    protected _clones = new Map<HTMLLinkElement | HTMLStyleElement, Element>()
    protected _observed = new Set<Node>()
    protected _observer: MutationObserver
    protected _sources: (Document | ShadowRoot)[]
    protected _target: Document

    /**
     * Start mirroring.
     * @param sources - The documents and shadow roots whose styles are copied, in cascade order.
     * @param target - The document receiving the copies.
     */
    constructor (sources: (Document | ShadowRoot)[], target: Document) {
        this._sources = sources
        this._target = target
        this._observer = new MutationObserver(() => this._sync())
        for (const source of sources) {
            this._observe(isDocument(source) ? source.head : source, { childList: true })
        }
        this._sync()
    }

    /**
     * The style elements of a source.
     * @param source - A source document or shadow root.
     */
    protected _elementsOf (source: Document | ShadowRoot) {
        const container = isDocument(source) ? source.head : source
        return Array.from(container.children).filter((element): element is HTMLLinkElement | HTMLStyleElement => {
            return isStyleElement(element) || isStylesheetLink(element)
        })
    }

    /**
     * Observe a node once.
     * @param node - The node.
     * @param options - What to observe.
     */
    protected _observe (node: Node, options: MutationObserverInit) {
        if (!this._observed.has(node)) {
            this._observed.add(node)
            this._observer.observe(node, options)
        }
    }

    /** Bring the target's copies up to date with the sources. */
    protected _sync () {
        const current = this._sources.flatMap((source) => this._elementsOf(source))
        for (const [source, clone] of this._clones) {
            if (!current.includes(source)) {
                clone.remove()
                this._clones.delete(source)
            }
        }
        for (const source of current) {
            const clone = this._clones.get(source)
            if (!clone) {
                const copy = this._target.createElement(source.tagName.toLowerCase())
                if (isStylesheetLink(source)) {
                    copy.setAttribute('rel', 'stylesheet')
                    // The resolved address: the window's own document has no base to resolve a relative one against.
                    copy.setAttribute('href', source.href)
                } else {
                    copy.textContent = source.textContent
                    this._observe(source, { characterData: true, childList: true, subtree: true })
                }
                if (source.hasAttribute('media')) {
                    copy.setAttribute('media', source.getAttribute('media') as string)
                }
                this._target.head.append(copy)
                this._clones.set(source, copy)
            } else if (isStyleElement(source) && clone.textContent !== source.textContent) {
                clone.textContent = source.textContent
            }
        }
        const adopted = this._sources.flatMap((source) => Array.from(source.adoptedStyleSheets ?? []))
        const targetWindow = this._target.defaultView
        if (targetWindow && (adopted.length || this._target.adoptedStyleSheets?.length)) {
            this._target.adoptedStyleSheets = adopted.map((sheet) => {
                const copy = new targetWindow.CSSStyleSheet()
                copy.replaceSync(Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n'))
                return copy
            })
        }
    }

    /** Stop mirroring. The copies stay in the target. */
    disconnect () {
        this._observer.disconnect()
        this._observed.clear()
    }
}

/** The host implementation installed by the first bundle that asks for one. */
class DocumentWindowHost implements WindowHost {
    protected _bridge: StyleBridge | null
    protected _current: OpenWindow | null = null
    /** Incremented by every request, so a request overtaken while it waits can tell. */
    protected _requestNr = 0

    constructor () {
        this._bridge = installStyleBridge(window)
    }

    get version () {
        return WINDOW_HOST_VERSION
    }

    /**
     * Close the window a handle belongs to, if it is still the open one.
     * @param handle - The handle.
     */
    protected _closeHandle (handle: WindowHandle) {
        const current = this._current
        if (current?.handle === handle) {
            this._current = null
            current.dispose()
        }
    }

    /**
     * Open an in-page window over the content's own root, so the content keeps the styles of that root.
     * @param request - What to open.
     * @param closedByUser - Called when the user presses the close button.
     * @param switchMode - Moves the window into Picture-in-Picture, from the detach button shown where it is offered.
     */
    protected _openInline (request: WindowRequest, closedByUser: () => void, switchMode: ModeSwitch): OpenedWindow {
        const anchorRoot = request.anchor.getRootNode()
        const root = isShadowRoot(anchorRoot) ? anchorRoot : document
        ensureWindowStyles(root)
        const frame = document.createElement('div')
        frame.className = 'epicurrents-window'
        frame.classList.toggle('is-resizable', request.resizable)
        frame.setAttribute('aria-label', request.title)
        frame.setAttribute('aria-modal', 'false')
        frame.setAttribute('role', 'dialog')
        const header = document.createElement('div')
        header.className = 'epicurrents-window__header'
        const title = document.createElement('span')
        title.className = 'epicurrents-window__title'
        title.textContent = request.title
        const close = chromeButton(document, 'epicurrents-window__close', CLOSE_ICON, request.closeLabel, closedByUser)
        header.append(title)
        if (request.pictureInPicture && pictureInPictureApi()) {
            header.append(chromeButton(document, 'epicurrents-window__action', DETACH_ICON, request.detachLabel, () => {
                void switchMode('picture-in-picture')
            }))
        }
        header.append(close)
        const body = document.createElement('div')
        body.className = 'epicurrents-window__body'
        body.style.height = `${request.height}px`
        body.style.width = `${request.width}px`
        const context = contextElement(document, request.contextClass)
        body.append(context)
        frame.append(header, body)
        if (isShadowRoot(root)) {
            root.append(frame)
        } else {
            document.body.append(frame)
        }
        // The frame is sized by its body until the user resizes it; after that the body follows the frame.
        const frameRect = frame.getBoundingClientRect()
        /** Where the frame is, as last placed. */
        const position = { left: 0, top: 0 }
        const place = (left: number, top: number) => {
            const maxLeft = Math.max(0, window.innerWidth - KEEP_VISIBLE)
            const maxTop = Math.max(0, window.innerHeight - KEEP_VISIBLE)
            position.left = Math.min(Math.max(left, KEEP_VISIBLE - frame.offsetWidth), maxLeft)
            position.top = Math.min(Math.max(top, 0), maxTop)
            frame.style.left = `${position.left}px`
            frame.style.top = `${position.top}px`
        }
        place(
            request.left ?? Math.round((window.innerWidth - frameRect.width)/2),
            request.top ?? Math.round((window.innerHeight - frameRect.height)/2),
        )
        let drag: { pointerId: number, startLeft: number, startTop: number, x: number, y: number } | null = null
        const dragStart = (event: PointerEvent) => {
            if (event.button !== 0 || (event.target as Element).closest?.('button')) {
                return
            }
            drag = {
                pointerId: event.pointerId,
                startLeft: position.left,
                startTop: position.top,
                x: event.clientX,
                y: event.clientY,
            }
            header.setPointerCapture(event.pointerId)
            event.preventDefault()
        }
        const dragMove = (event: PointerEvent) => {
            if (drag?.pointerId === event.pointerId) {
                place(drag.startLeft + event.clientX - drag.x, drag.startTop + event.clientY - drag.y)
            }
        }
        const dragEnd = (event: PointerEvent) => {
            if (drag?.pointerId !== event.pointerId) {
                return
            }
            drag = null
            if (header.hasPointerCapture(event.pointerId)) {
                header.releasePointerCapture(event.pointerId)
            }
            request.left = position.left
            request.top = position.top
            request.onMove?.(position.left, position.top)
        }
        header.addEventListener('pointerdown', dragStart)
        header.addEventListener('pointermove', dragMove)
        header.addEventListener('pointerup', dragEnd)
        header.addEventListener('pointercancel', dragEnd)
        let resizeObserver: ResizeObserver | null = null
        if (request.resizable && typeof ResizeObserver !== 'undefined') {
            let initial = true
            resizeObserver = new ResizeObserver(() => {
                // The first report is the size the window opened at.
                if (initial) {
                    initial = false
                    return
                }
                body.style.height = ''
                body.style.width = ''
                frame.style.height = `${frame.offsetHeight}px`
                frame.style.width = `${frame.offsetWidth}px`
                const size = contentSize(body)
                request.height = size.height
                request.width = size.width
                request.onResize?.(size.width, size.height)
            })
            resizeObserver.observe(frame)
        }
        const handle: WindowHandle = {
            body: context,
            mode: 'inline',
            close: () => this._closeHandle(handle),
            setTitle (newTitle: string) {
                title.textContent = newTitle
                frame.setAttribute('aria-label', newTitle)
            },
        }
        const dispose = () => {
            resizeObserver?.disconnect()
            frame.remove()
        }
        return { dispose, handle }
    }

    /**
     * Open a Picture-in-Picture window and mirror the page's styles into it.
     * @param api - The browser's Document Picture-in-Picture API.
     * @param request - What to open.
     * @param closedByUser - Called when the window goes away other than by the host closing it.
     * @param switchMode - Moves the window back into the page, from the window's return button.
     */
    protected async _openPictureInPicture (
        api: PictureInPictureApi,
        request: WindowRequest,
        closedByUser: () => void,
        switchMode: ModeSwitch,
    ): Promise<OpenedWindow> {
        // The browser's own return button would close the window like its close button does, indistinguishably;
        // the window's return button moves the content back into the page instead.
        const pip = await api.requestWindow({
            disallowReturnToOpener: true,
            height: request.height + 2*PIP_PADDING,
            width: request.width + 2*PIP_PADDING,
        })
        const target = pip.document
        target.title = request.title
        target.documentElement.className = document.documentElement.className
        target.documentElement.classList.add('epicurrents-pip-document')
        if (document.documentElement.lang) {
            target.documentElement.lang = document.documentElement.lang
        }
        const anchorRoot = request.anchor.getRootNode()
        const sources: (Document | ShadowRoot)[] = [document]
        if (isShadowRoot(anchorRoot)) {
            sources.push(anchorRoot)
        }
        const mirror = new StyleMirror(sources, target)
        ensureWindowStyles(target)
        // A theme switched on the page follows into the window.
        const classObserver = new MutationObserver(() => {
            target.documentElement.className = document.documentElement.className
            target.documentElement.classList.add('epicurrents-pip-document')
        })
        classObserver.observe(document.documentElement, { attributeFilter: ['class'], attributes: true })
        target.body.classList.toggle('is-fixed', !request.resizable)
        const body = target.createElement('div')
        body.className = 'epicurrents-window__body'
        if (!request.resizable) {
            body.style.height = `${request.height}px`
            body.style.width = `${request.width}px`
        }
        const context = contextElement(target, request.contextClass)
        const returnButton = chromeButton(target, 'epicurrents-window__action', RETURN_ICON, request.returnLabel, () => {
            void switchMode('inline')
        })
        body.append(context, returnButton)
        target.body.append(body)
        let closing = false
        const resized = () => {
            const size = contentSize(body)
            request.height = size.height
            request.width = size.width
            request.onResize?.(size.width, size.height)
        }
        const pageHide = () => {
            if (!closing) {
                closedByUser()
            }
        }
        pip.addEventListener('pagehide', pageHide)
        if (request.resizable) {
            pip.addEventListener('resize', resized)
        }
        const handle: WindowHandle = {
            body: context,
            mode: 'picture-in-picture',
            close: () => this._closeHandle(handle),
            setTitle (newTitle: string) {
                target.title = newTitle
            },
        }
        const dispose = () => {
            closing = true
            classObserver.disconnect()
            mirror.disconnect()
            pip.removeEventListener('pagehide', pageHide)
            pip.removeEventListener('resize', resized)
            pip.close()
        }
        return { dispose, handle }
    }

    finishMove (node: Node) {
        this._bridge?.reapply(node)
    }

    installStyles (node: Node) {
        const root = node.getRootNode()
        ensureWindowStyles(isShadowRoot(root) ? root : document)
    }

    async open (request: WindowRequest) {
        const requestNr = ++this._requestNr
        const previous = this._current
        this._current = null
        if (previous) {
            try {
                await previous.request.onClose()
            } catch {
                // The previous owner failing to take its content back does not keep its window open.
            }
            previous.dispose()
        }
        if (requestNr !== this._requestNr) {
            throw new DOMException('A later window request replaced this one.', 'AbortError')
        }
        const entry: OpenWindow = { dispose: () => {}, handle: null, request }
        const closedByUser = async () => {
            if (this._current !== entry) {
                return
            }
            this._current = null
            try {
                await request.onClose()
            } finally {
                entry.dispose()
            }
        }
        const switchMode: ModeSwitch = async (mode) => {
            if (this._current !== entry || entry.handle?.mode === mode) {
                return
            }
            let next: OpenedWindow
            if (mode === 'inline') {
                next = this._openInline(request, closedByUser, switchMode)
            } else {
                const pictureInPicture = pictureInPictureApi()
                if (!pictureInPicture) {
                    return
                }
                try {
                    next = await this._openPictureInPicture(pictureInPicture, request, closedByUser, switchMode)
                } catch {
                    // Refused: the window stays where it is.
                    return
                }
            }
            if (this._current !== entry) {
                next.dispose()
                return
            }
            const replaced = entry.dispose
            entry.dispose = next.dispose
            entry.handle = next.handle
            try {
                await request.onMoveTo(next.handle)
            } finally {
                replaced()
            }
            rememberMode(mode, request.name)
        }
        const api = request.pictureInPicture && preferredMode(request.name) === 'picture-in-picture'
            ? pictureInPictureApi()
            : null
        let opened: OpenedWindow | null = null
        if (api) {
            try {
                opened = await this._openPictureInPicture(api, request, closedByUser, switchMode)
            } catch {
                // No user activation, or the browser refused: the in-page window serves instead.
                opened = null
            }
        }
        if (requestNr !== this._requestNr) {
            opened?.dispose()
            throw new DOMException('A later window request replaced this one.', 'AbortError')
        }
        opened ??= this._openInline(request, closedByUser, switchMode)
        entry.dispose = opened.dispose
        entry.handle = opened.handle
        this._current = entry
        return opened.handle
    }

    prepareMove (node: Node) {
        this._bridge?.snapshot(node)
    }
}

/**
 * The document's window host, installed on first use. A host another bundle installed is returned as it is, so
 * every application on the page shares one window slot.
 */
export function getWindowHost (): WindowHost {
    const existing = Reflect.get(globalThis, HOST_KEY) as WindowHost | undefined
    if (existing) {
        return existing
    }
    const host = new DocumentWindowHost()
    Reflect.set(globalThis, HOST_KEY, host)
    return host
}
