/**
 * Carries shadow-root stylesheets across documents.
 *
 * A constructed stylesheet belongs to the document whose window constructed it, and Chromium enforces this in two
 * ways: assigning one to a shadow root in another document throws `NotAllowedError`, and moving an element into
 * another document clears its shadow root's `adoptedStyleSheets` without a word. Web Awesome components are styled
 * only through constructed sheets, so without this bridge a component moved into a Picture-in-Picture window
 * renders unstyled, a component created there renders empty, and one moved back stays unstyled.
 *
 * The bridge patches the `adoptedStyleSheets` setter of this window's `ShadowRoot` once. Every assignment is
 * remembered as given and applied as copies built by the shadow root's own window, cached per sheet and window.
 * `snapshot` records the sheets of a subtree that was styled before the bridge saw it, and must run before the
 * subtree moves, while those sheets are still in place; `reapply` restores the remembered sheets after the move.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

/** Restores the stylesheets of shadow roots in a subtree that moves between documents. */
export interface StyleBridge {
    /**
     * Restore the remembered sheets of every shadow root in the subtree, in the subtree's current document.
     * @param node - Root of the subtree that has moved.
     */
    reapply (node: Node): void
    /**
     * Remember the current sheets of every shadow root in the subtree that has none remembered yet.
     * @param node - Root of the subtree about to move.
     */
    snapshot (node: Node): void
}

type SheetWindow = Window & typeof globalThis

/** The bridge installed in each window, so a window's setter is patched once. */
const BRIDGES = new WeakMap<SheetWindow, StyleBridge>()

/**
 * Visit every open shadow root in the subtree, including those nested inside other shadow roots.
 * @param node - Root of the subtree.
 * @param visit - Called once per shadow root.
 */
const forEachShadowRoot = (node: Node, visit: (root: ShadowRoot) => void) => {
    const walk = (element: Element) => {
        if (element.shadowRoot) {
            visit(element.shadowRoot)
            element.shadowRoot.querySelectorAll('*').forEach(walk)
        }
    }
    // By node type, because a subtree that has moved may hold elements of another realm.
    if (node.nodeType === Node.ELEMENT_NODE) {
        walk(node as Element)
    }
    if ('querySelectorAll' in node) {
        (node as ParentNode).querySelectorAll('*').forEach(walk)
    }
}

/**
 * Install the bridge in the given window, or return null where the platform has no constructed stylesheets. The
 * setter is patched once per window; a second call returns a bridge sharing the first one's records.
 * @param win - The window whose `ShadowRoot` prototype is patched; shadow roots created there are covered.
 */
export function installStyleBridge (win: SheetWindow): StyleBridge | null {
    const descriptor = Object.getOwnPropertyDescriptor(win.ShadowRoot?.prototype ?? {}, 'adoptedStyleSheets')
    if (!descriptor?.get || !descriptor.set) {
        return null
    }
    const existing = BRIDGES.get(win)
    if (existing) {
        return existing
    }
    const { get, set } = descriptor
    /** Sheets as last assigned to each shadow root, before any translation. */
    const assigned = new WeakMap<ShadowRoot, CSSStyleSheet[]>()
    /** Copies of each sheet, per window that needed one. */
    const copies = new WeakMap<CSSStyleSheet, WeakMap<SheetWindow, CSSStyleSheet>>()
    const copyFor = (sheet: CSSStyleSheet, target: SheetWindow) => {
        // Widened so the check does not narrow: both windows' sheet classes share one type.
        if ((sheet as unknown) instanceof target.CSSStyleSheet) {
            return sheet
        }
        let perWindow = copies.get(sheet)
        if (!perWindow) {
            perWindow = new WeakMap()
            copies.set(sheet, perWindow)
        }
        let copy = perWindow.get(target)
        if (!copy) {
            copy = new target.CSSStyleSheet()
            copy.replaceSync(Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n'))
            perWindow.set(target, copy)
        }
        return copy
    }
    const apply = (root: ShadowRoot, sheets: CSSStyleSheet[]) => {
        const target = root.ownerDocument.defaultView as SheetWindow | null
        set.call(root, target ? sheets.map((sheet) => copyFor(sheet, target)) : sheets)
    }
    Object.defineProperty(win.ShadowRoot.prototype, 'adoptedStyleSheets', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get () {
            return get.call(this)
        },
        set (sheets: CSSStyleSheet[]) {
            const given = Array.from(sheets)
            assigned.set(this as ShadowRoot, given)
            apply(this as ShadowRoot, given)
        },
    })
    const bridge: StyleBridge = {
        reapply (node) {
            forEachShadowRoot(node, (root) => {
                const sheets = assigned.get(root)
                if (sheets) {
                    apply(root, sheets)
                }
            })
        },
        snapshot (node) {
            forEachShadowRoot(node, (root) => {
                if (!assigned.has(root)) {
                    assigned.set(root, Array.from(get.call(root) as CSSStyleSheet[]))
                }
            })
        },
    }
    BRIDGES.set(win, bridge)
    return bridge
}
