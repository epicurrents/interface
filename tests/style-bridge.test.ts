/**
 * The style bridge, which carries shadow-root stylesheets across documents. jsdom has no constructed stylesheets,
 * so each window is given a stand-in sheet class and the shadow-root prototype a plain accessor before the bridge
 * patches it; an iframe's window stands in for a Picture-in-Picture window.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { installStyleBridge, type StyleBridge } from '#app/windows/styleBridge'

/** A stand-in for a constructed stylesheet; each window gets its own subclass, as each realm has its own class. */
class FakeSheet {
    text = ''
    constructor (text = '') {
        this.text = text
    }
    get cssRules () {
        return [{ cssText: this.text }]
    }
    replaceSync (text: string) {
        this.text = text
    }
}

const stored = new WeakMap<ShadowRoot, FakeSheet[]>()
let bridge: StyleBridge
let other: Window & typeof globalThis

beforeAll(() => {
    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
        configurable: true,
        get () {
            return stored.get(this) ?? []
        },
        set (sheets: FakeSheet[]) {
            stored.set(this, sheets)
        },
    })
    Reflect.set(window, 'CSSStyleSheet', class MainSheet extends FakeSheet {})
    const frame = document.createElement('iframe')
    document.body.append(frame)
    other = frame.contentWindow as Window & typeof globalThis
    Reflect.set(other, 'CSSStyleSheet', class OtherSheet extends FakeSheet {})
    bridge = installStyleBridge(window) as StyleBridge
})

/** An element with an open shadow root, holding a nested element with one of its own. */
const styledTree = () => {
    const outer = document.createElement('div')
    const outerRoot = outer.attachShadow({ mode: 'open' })
    const inner = document.createElement('span')
    outerRoot.append(inner)
    const innerRoot = inner.attachShadow({ mode: 'open' })
    return { innerRoot, outer, outerRoot }
}

describe('the style bridge', () => {
    it('is installed once per window', () => {
        expect(bridge).not.toBeNull()
        expect(installStyleBridge(window)).toBe(bridge)
    })

    it('is not installed where shadow roots have no adopted sheets', () => {
        expect(installStyleBridge({ ShadowRoot: { prototype: {} } } as unknown as Window & typeof globalThis))
            .toBeNull()
    })

    it('gives a shadow root in another document copies built by that document', () => {
        const { outer, outerRoot } = styledTree()
        other.document.body.append(outer)
        const sheet = new window.CSSStyleSheet() as unknown as FakeSheet
        sheet.replaceSync(':host { color: red; }')
        outerRoot.adoptedStyleSheets = [sheet as unknown as CSSStyleSheet]
        const adopted = stored.get(outerRoot) as FakeSheet[]
        expect(adopted).toHaveLength(1)
        expect(Object.getPrototypeOf(adopted[0])).toBe(other.CSSStyleSheet.prototype)
        expect(adopted[0].text).toBe(':host { color: red; }')
    })

    it('restores the sheets of a moved subtree, nested shadow roots included, in either direction', () => {
        const { innerRoot, outer, outerRoot } = styledTree()
        document.body.append(outer)
        const outerSheet = new window.CSSStyleSheet() as unknown as FakeSheet
        const innerSheet = new window.CSSStyleSheet() as unknown as FakeSheet
        outerSheet.replaceSync('.outer {}')
        innerSheet.replaceSync('.inner {}')
        // Assigned past the bridge, as a sheet set before the bridge was installed would be.
        stored.set(outerRoot, [outerSheet])
        stored.set(innerRoot, [innerSheet])
        bridge.snapshot(outer)
        other.document.body.append(outer)
        // The browser clears the sheets on the move.
        stored.set(outerRoot, [])
        stored.set(innerRoot, [])
        bridge.reapply(outer)
        expect((stored.get(outerRoot) as FakeSheet[])[0].text).toBe('.outer {}')
        expect(Object.getPrototypeOf((stored.get(innerRoot) as FakeSheet[])[0])).toBe(other.CSSStyleSheet.prototype)
        document.body.append(outer)
        stored.set(outerRoot, [])
        bridge.reapply(outer)
        expect((stored.get(outerRoot) as FakeSheet[])[0]).toBe(outerSheet)
    })

    it('builds one copy per sheet and document', () => {
        const first = styledTree()
        const second = styledTree()
        other.document.body.append(first.outer, second.outer)
        const sheet = new window.CSSStyleSheet()
        first.outerRoot.adoptedStyleSheets = [sheet]
        second.outerRoot.adoptedStyleSheets = [sheet]
        expect((stored.get(first.outerRoot) as FakeSheet[])[0]).toBe((stored.get(second.outerRoot) as FakeSheet[])[0])
    })
})
