import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventBus } from 'scoped-event-bus'
import { createPropertySetter, isModuleProperty, registerModuleProperties } from '../src/config/properties'

const bus = new EventBus()
;(globalThis as Record<string, unknown>).window = globalThis
;(globalThis as Record<string, unknown>).__EPICURRENTS__ = { EVENT_BUS: bus }

const registry = {
    'trend-visible': { field: 'trendVisible', type: 'Boolean' },
    'open-sidebar': { field: 'openSidebar', type: 'String?' },
}
let runtime: Record<string, unknown>
let set: ReturnType<typeof createPropertySetter>

// The setter writes through to the runtime object, so the cases below cannot share one: a case
// that leaves a property changed makes a later write of the same value a no-op, and a no-op is
// indistinguishable from the setter having refused it. Rebuilt per case rather than reset, so the
// registry the setter reads always points at the object this case will assert on.
beforeEach(() => {
    runtime = { trendVisible: false, openSidebar: null }
    set = createPropertySetter('eeg', () => runtime, registry)
    registerModuleProperties('eeg', registry, () => runtime)
})

describe('module property setter', () => {
    it('applies a valid write and announces it under the qualified name', () => {
        const seen = vi.fn()
        bus.addScopedEventListener('property-change:eeg.trend-visible', seen, 'test', 'interface', 'after')
        expect(set('trend-visible', true)).toBe(true)
        expect(runtime.trendVisible).toBe(true)
        expect(seen).toHaveBeenCalledTimes(1)
        expect(seen.mock.calls[0][0].detail.newValue).toBe(true)
        expect(seen.mock.calls[0][0].detail.oldValue).toBe(false)
    })
    it('accepts null for a nullable type', () => {
        expect(set('open-sidebar', 'annotations')).toBe(true)
        expect(set('open-sidebar', null)).toBe(true)
        expect(runtime.openSidebar).toBe(null)
    })
    it('claims the name but refuses a mistyped value', () => {
        const before = runtime.trendVisible
        expect(set('trend-visible', 'yes')).toBe(true)
        expect(runtime.trendVisible).toBe(before)
    })
    it('does not claim a name it never declared, so the caller can forward it', () => {
        expect(set('sensitivity', 100)).toBe(false)
    })
    it('stays silent when the value is unchanged', () => {
        const seen = vi.fn()
        runtime.trendVisible = true
        bus.addScopedEventListener('property-change:eeg.trend-visible', seen, 'test2', 'interface', 'after')
        expect(set('trend-visible', true)).toBe(true)
        expect(seen).not.toHaveBeenCalled()
    })
    it('resolves qualified names, and only registered ones', () => {
        expect(isModuleProperty('eeg.trend-visible')).toBe(true)
        expect(isModuleProperty('eeg.sensitivity')).toBe(false)
        expect(isModuleProperty('trend-visible')).toBe(false)
    })
})
