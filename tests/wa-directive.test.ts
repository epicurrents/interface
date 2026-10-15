/**
 * Tests for the interface v-wa directive's number inputs: values cross in the input's own '.'-decimal form whatever the
 * locale, and a cleared field reads as NaN. With a correction, the value is read on commit rather than on each
 * keystroke, the corrected value is kept, and the element is given it back even when the property already held it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, type ObjectDirective } from 'vue'

type Bound = Record<string, unknown>

/** A stand-in for a number-type wa-input: the directive reads only its tag name, type and value. */
function numberInput (): HTMLInputElement {
    // WebAwesome registers its own type for the tag; the directive only needs the input-like surface defined below.
    const el = document.createElement('wa-input') as unknown as HTMLInputElement
    Object.defineProperty(el, 'type', { value: 'number' })
    Object.defineProperty(el, 'value', { value: '', writable: true })
    return el
}

function type (el: HTMLInputElement, value: string) {
    el.value = value
    el.dispatchEvent(new Event('input'))
}

function commit (el: HTMLInputElement, value: string) {
    type(el, value)
    el.dispatchEvent(new Event('change'))
}

describe('v-wa on a number input', () => {
    let directive: ObjectDirective<HTMLInputElement, string>

    beforeEach(async () => {
        // A comma-decimal locale with a thousands separator, in force before the module loads, so any locale read at
        // import time sees it too.
        vi.spyOn(Number.prototype, 'toLocaleString').mockImplementation(function (this: number) {
            return this.toFixed(this % 1 ? 1 : 0).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
        })
        vi.resetModules()
        directive = (await import('#util/wa-directive')).default as typeof directive
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    function bind (state: Bound, correct?: (value: unknown) => unknown) {
        const el = numberInput()
        // The interface binds a property of the component instance by name.
        const value = correct ? ['n', correct] : 'n'
        directive.beforeMount!(el, { instance: state, value } as never, null as never, null as never)
        return el
    }

    it('reads a decimal without truncating it', () => {
        const state = reactive<Bound>({ n: '' })
        const el = bind(state)
        type(el, '12.5')
        expect(state.n).toBe(12.5)
    })

    it('reads a cleared field as NaN', () => {
        const state = reactive<Bound>({ n: 3 })
        const el = bind(state)
        type(el, '')
        expect(state.n).toBeNaN()
    })

    it('writes a number in the form the input accepts', async () => {
        const state = reactive<Bound>({ n: 12.5 })
        const el = bind(state)
        expect(el.value).toBe('12.5')
        state.n = 1234
        await nextTick()
        expect(el.value).toBe('1234')
    })

    it('writes NaN back as an empty field', async () => {
        const state = reactive<Bound>({ n: 1 })
        const el = bind(state)
        state.n = NaN
        await nextTick()
        expect(el.value).toBe('')
    })

    describe('with a correction', () => {
        const atMost10 = (value: unknown) => Number.isFinite(value) ? Math.min(value as number, 10) : null

        it('reads nothing until the value is committed', () => {
            const state = reactive<Bound>({ n: 3 })
            const el = bind(state, atMost10)
            type(el, '1')
            expect(state.n).toBe(3)
            commit(el, '15')
            expect(state.n).toBe(10)
        })

        it('keeps what the correction returns, a cleared field included', () => {
            const state = reactive<Bound>({ n: 3 })
            const el = bind(state, atMost10)
            commit(el, '')
            expect(state.n).toBeNull()
            expect(el.value).toBe('')
        })

        it('gives the corrected value back when the property already held it', () => {
            const state = reactive<Bound>({ n: 10 })
            const el = bind(state, atMost10)
            commit(el, '40')
            expect(state.n).toBe(10)
            expect(el.value).toBe('10')
        })

        it('leaves what is being typed alone when the component re-renders', async () => {
            const state = reactive<Bound>({ n: 3 })
            const el = bind(state, atMost10)
            type(el, '8')
            directive.updated!(el, { instance: state, value: ['n', atMost10] } as never, null as never, null as never)
            await new Promise(resolve => requestAnimationFrame(resolve))
            expect(el.value).toBe('8')
        })

        it('passes the value through untouched when it needs no correction', () => {
            const state = reactive<Bound>({ n: 3 })
            const el = bind(state, atMost10)
            commit(el, '7.5')
            expect(state.n).toBe(7.5)
            expect(el.value).toBe('7.5')
        })
    })
})
