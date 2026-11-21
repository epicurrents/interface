/**
 * Tests for opening a deferred resource, a dataset member listing a study that loads only when it is opened.
 *
 * Activation goes through one store action whether it starts from the navigator, the next and previous controls or a
 * host. For a deferred resource the action asks the application to load the study and activates the loaded resource
 * that takes its place, never the listing itself; a request made while the study loads supersedes it, so clicking on
 * to another recording does not get pulled back when the first finishes loading.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { actions, ActionTypes } from '#store/actions'
import NavigatorItem from '#app/navigator/NavigatorItem.vue'
import { init } from '#i18n'
import type { DataResource } from '@epicurrents/core/types'

const listing = (name: string) => ({
    getMainProperties: () => new Map([['duration', 60]]),
    isDeferred: true,
    isReady: false,
    name,
    state: 'added',
    study: { loader: 'eeg/edf-file', name, source: name },
}) as unknown as DataResource

/** Install an application whose loads resolve when the test says so. */
const installApp = () => {
    const pending = new Map<string, (resource: DataResource | null) => void>()
    const app = {
        openDeferredResource: vi.fn((resource: DataResource) => new Promise<DataResource | null>(resolve => {
            pending.set(resource.name, resolve)
        })),
    }
    ;(window as unknown as { __EPICURRENTS__: unknown }).__EPICURRENTS__ = { APP: app }
    return { app, pending }
}

/** The dataset active when a request is made. */
const DATASET = { name: 'dataset' }

const activate = (resource: DataResource | null) => {
    const injectee = { dispatch: vi.fn(), commit: vi.fn(), state: { APP: { activeDataset: DATASET as unknown } } }
    ;(actions[ActionTypes.SET_ACTIVE_RESOURCE] as (i: unknown, p: unknown) => void)(injectee, resource)
    return injectee
}

afterEach(() => {
    ;(window as unknown as { __EPICURRENTS__: unknown }).__EPICURRENTS__ = undefined
})

describe('activating a deferred resource', () => {
    it('loads the study and activates the loaded resource', async () => {
        const { app, pending } = installApp()
        const resource = listing('a')
        const injectee = activate(resource)
        expect(app.openDeferredResource).toHaveBeenCalledWith(resource)
        expect(injectee.commit).not.toHaveBeenCalled()
        const loaded = { name: 'loaded a' } as DataResource
        pending.get('a')!(loaded)
        await vi.waitFor(() => {
            expect(injectee.dispatch).toHaveBeenCalledWith(ActionTypes.SET_ACTIVE_RESOURCE, loaded)
        })
    })
    it('activates nothing when the study fails to load', async () => {
        const { pending } = installApp()
        const injectee = activate(listing('a'))
        pending.get('a')!(null)
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(injectee.dispatch).not.toHaveBeenCalled()
    })
    it('drops a load that a later request has superseded', async () => {
        const { pending } = installApp()
        const first = activate(listing('a'))
        const second = activate(listing('b'))
        pending.get('a')!({ name: 'loaded a' } as DataResource)
        const loadedB = { name: 'loaded b' } as DataResource
        pending.get('b')!(loadedB)
        await vi.waitFor(() => {
            expect(second.dispatch).toHaveBeenCalledWith(ActionTypes.SET_ACTIVE_RESOURCE, loadedB)
        })
        expect(first.dispatch).not.toHaveBeenCalled()
    })
    it('drops a load when another dataset has become active meanwhile', async () => {
        const { pending } = installApp()
        const injectee = activate(listing('a'))
        // The loaded resource would be activated against the dataset active now, which does not hold it.
        injectee.state.APP.activeDataset = { name: 'another' }
        pending.get('a')!({ name: 'loaded a' } as DataResource)
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(injectee.dispatch).not.toHaveBeenCalled()
    })
})

describe('a deferred resource in the navigator', () => {
    const options = NavigatorItem as unknown as {
        methods: {
            $t: (key: string, params?: object, capitalized?: boolean) => string
            resourceClicked: () => void
            resourceUpdated: () => void
        }
    }
    beforeAll(() => {
        init(createApp({}), 'en')
    })
    const stub = (resource: DataResource) => ({
        $options: { name: 'NavigatorItem' },
        $emit: vi.fn(),
        $store: { dispatch: vi.fn(), state: { MODULES: new Map() } },
        $t: options.methods.$t,
        isDeferred: false,
        isReady: false,
        resource,
        resourceProps: [] as object[],
    })

    it('is marked deferred and shows the properties it was listed with', () => {
        const item = stub(listing('a'))
        options.methods.resourceUpdated.call(item)
        expect(item.isDeferred).toBe(true)
        expect(item.resourceProps).toEqual([expect.objectContaining({ icon: 'clock' })])
    })
    it('opens on click although it is not ready', () => {
        const resource = listing('a')
        const item = stub(resource)
        options.methods.resourceClicked.call(item)
        expect(item.$store.dispatch).toHaveBeenCalledWith('set-active-resource', resource)
    })
    it('leaves a loading resource that is not deferred unclickable', () => {
        const item = stub({ isReady: false, name: 'b' } as DataResource)
        options.methods.resourceClicked.call(item)
        expect(item.$store.dispatch).not.toHaveBeenCalled()
    })
})
