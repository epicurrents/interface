/**
 * Tests for the components that follow the resource shown: the controls bar's place in the dataset, the default
 * footer's trail and the wiring of a biosignal resource to the interpreter.
 *
 * A member showing one of its children keeps its place in the dataset's order, so the next and previous controls
 * step from the member. The footer hears of a child set on the resource itself, past any reactive proxy. A biosignal
 * resource is wired to the interpreter once, whether it arrives as the object or as a proxy of it, and only counts as
 * wired once the wiring happened.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { Epicurrents, GenericResource } from '@epicurrents/core'
import type { BiosignalResource, DataResource, MediaDataset } from '@epicurrents/core/types'
import ControlsBar from '#app/controls/ControlsBar.vue'
import DefaultFooter from '#app/footers/DefaultFooter.vue'
import { createBiosignalWiring } from '#root/src/epicurrents/biosignalWiring'

class TestResource extends GenericResource {
    /** The property a biosignal resource is recognised by. */
    protected _signalCacheStatus = [0, 0]

    constructor (name: string) {
        super(name, 'test')
        this.state = 'ready'
    }
}

let app: Epicurrents
let dataset: MediaDataset

beforeEach(() => {
    ;(window as unknown as { __EPICURRENTS__: undefined }).__EPICURRENTS__ = undefined
    app = new Epicurrents()
    app.runtime.APP.datasets.length = 0
    app.runtime.APP.activeDataset = null
    dataset = app.createDataset('dataset', true)
})

const member = (name: string) => {
    const resource = new TestResource(name)
    dataset.addResource({ resource })
    return resource
}

describe('the next and previous controls', () => {
    const options = ControlsBar as unknown as {
        methods: Record<
            'activeMember' | 'checkResourcePosition' | 'openNeighbour' | 'openNextResource' | 'openPrevResource'
            | 'orderedResources',
            (...args: unknown[]) => unknown
        >
    }
    const bar = () => {
        const stub = {
            $store: { dispatch: vi.fn(), state: { APP: { activeDataset: dataset } } },
            hasNextResource: false,
            hasPrevResource: false,
            positionCheckPending: false,
        } as Record<string, unknown> & { $store: { dispatch: ReturnType<typeof vi.fn> } }
        for (const [name, method] of Object.entries(options.methods)) {
            stub[name] = (...args: unknown[]) => method.apply(stub, args)
        }
        return stub as typeof stub & Record<keyof typeof options.methods, (...args: unknown[]) => unknown>
    }

    it('step from the member when one of its children is shown', () => {
        const [first, second, third] = [member('a'), member('b'), member('c')]
        const child = new TestResource('child')
        second.childResources = [child]
        second.activeChildResource = child
        second.isActive = true
        const controls = bar()
        controls.checkResourcePosition()
        expect(controls.hasPrevResource).toBe(true)
        expect(controls.hasNextResource).toBe(true)
        controls.openNextResource()
        expect(controls.$store.dispatch).toHaveBeenLastCalledWith('set-active-resource', third)
        controls.openPrevResource()
        expect(controls.$store.dispatch).toHaveBeenLastCalledWith('set-active-resource', first)
    })

    it('offer no step past either end of the dataset', () => {
        const [first, last] = [member('a'), member('b')]
        const child = new TestResource('child')
        last.childResources = [child]
        last.activeChildResource = child
        last.isActive = true
        const controls = bar()
        controls.checkResourcePosition()
        expect(controls.hasPrevResource).toBe(true)
        expect(controls.hasNextResource).toBe(false)
        controls.openNextResource()
        expect(controls.$store.dispatch).not.toHaveBeenCalled()
        last.isActive = false
        first.isActive = true
        controls.checkResourcePosition()
        expect(controls.hasPrevResource).toBe(false)
        expect(controls.hasNextResource).toBe(true)
    })

    it('offer nothing when no resource is active', () => {
        member('a')
        const controls = bar()
        controls.checkResourcePosition()
        expect(controls.hasPrevResource).toBe(false)
        expect(controls.hasNextResource).toBe(false)
    })
})

describe('the default footer', () => {
    const options = DefaultFooter as unknown as {
        methods: Record<'checkActiveResource' | 'deactivateChild' | 'readActiveChild', () => void>
    }
    const footer = () => {
        const stub = {
            $store: { dispatch: vi.fn(), state: { APP: { activeDataset: dataset } } },
            ID: 'DefaultFooter-test',
            RESOURCE: null as DataResource | null,
            activeChild: null as DataResource | null,
            checkActiveResource: () => options.methods.checkActiveResource.call(stub),
            deactivateChild: () => options.methods.deactivateChild.call(stub),
            readActiveChild: () => options.methods.readActiveChild.call(stub),
        }
        return stub
    }

    it('follows a child set on the resource itself', () => {
        const parent = member('parent')
        const child = new TestResource('child')
        parent.childResources = [child]
        parent.isActive = true
        const trail = footer()
        trail.checkActiveResource()
        expect(trail.RESOURCE).toBe(parent)
        expect(trail.activeChild).toBeNull()
        parent.activeChildResource = child
        expect(trail.activeChild).toBe(child)
        parent.activeChildResource = null
        expect(trail.activeChild).toBeNull()
    })

    it('stops following a resource that is no longer the active one', () => {
        const [first, second] = [member('a'), member('b')]
        const child = new TestResource('child')
        first.childResources = [child]
        first.isActive = true
        const trail = footer()
        trail.checkActiveResource()
        first.isActive = false
        second.isActive = true
        trail.checkActiveResource()
        expect(trail.RESOURCE).toBe(second)
        first.activeChildResource = child
        expect(trail.activeChild).toBeNull()
    })

    it('closes the child through the child action', () => {
        const parent = member('parent')
        const child = new TestResource('child')
        parent.childResources = [child]
        parent.activeChildResource = child
        parent.isActive = true
        const trail = footer()
        trail.checkActiveResource()
        trail.deactivateChild()
        expect(trail.$store.dispatch).toHaveBeenCalledWith('set-active-child-resource', { child: null, parent })
    })
})

describe('wiring a biosignal resource to the interpreter', () => {
    const interpreter = () => ({
        initialSetup: new Promise<boolean>(() => {}),
        loadDefaultScript: vi.fn(),
    })
    const recording = (name: string) => new TestResource(name) as unknown as BiosignalResource & TestResource

    beforeEach(() => {
        app.runtime.SETTINGS.app.useMemoryManager = true
        app.runtime.SERVICES.delete('pyodide')
    })

    it('adds the dependencies once, whether the resource arrives as itself or as a reactive proxy', () => {
        app.runtime.SERVICES.set('pyodide', interpreter() as never)
        const wire = createBiosignalWiring(true)
        const resource = recording('a')
        expect(wire(reactive(resource) as never)).toBe(true)
        expect(wire(resource)).toBe(false)
        expect(wire(reactive(resource) as never)).toBe(false)
        expect(resource.dependenciesMissing).toEqual(['pyodide-core', 'pyodide-biosignal'])
    })

    it('wires on a later activation a resource first activated before the service was registered', () => {
        const wire = createBiosignalWiring(true)
        const resource = recording('a')
        expect(wire(resource)).toBe(false)
        expect(resource.isReady).toBe(true)
        app.runtime.SERVICES.set('pyodide', interpreter() as never)
        expect(wire(resource)).toBe(true)
        expect(resource.isReady).toBe(false)
    })

    it('leaves a resource alone when the montage is not computed in the interpreter', () => {
        app.runtime.SERVICES.set('pyodide', interpreter() as never)
        const wire = createBiosignalWiring(false)
        const resource = recording('a')
        expect(wire(resource)).toBe(false)
        expect(resource.isReady).toBe(true)
    })
})
