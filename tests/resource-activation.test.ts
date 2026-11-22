/**
 * Tests for activating resources through the store, run against a real store over a real runtime.
 *
 * Activating a resource waits for the others to release their memory, so requests overlap: the latest request is the
 * one shown, a request made for a dataset that is no longer active is dropped, and a deactivation an earlier request
 * started is waited for like one this request starts. A request that cannot be shown changes nothing, and one that
 * fails on the way leaves nothing open. A child opens only under a live member of the active dataset and only when
 * its modality can be shown, and closing the active resource closes its child with it.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { Epicurrents, GenericResource } from '@epicurrents/core'
import type { DataResource, MediaDataset } from '@epicurrents/core/types'
import AppStore from '#store'
import { shownResourceKey } from '#app/views/shownResourceKey'
import { init } from '#i18n'

/** A ready resource whose deactivation finishes when the test says so. */
class TestResource extends GenericResource {
    deactivation = Promise.resolve()
    loads = 0

    constructor (name: string, modality = 'test') {
        super(name, modality)
        this.state = 'ready'
    }

    async awaitDeactivation () {
        await this.deactivation
    }

    async load () {
        this.loads++
        return true
    }
}

/** A real resource whose every load attempt is settled by the test, failing with a reason of its own. */
class FailingResource extends GenericResource {
    attempts = 0
    /** Settle the load attempt in progress. */
    finish = (_loaded: boolean) => {}

    constructor (name: string, modality = 'test') {
        super(name, modality)
        // What a load sets up from; a failure keeps it, which is what makes the resource retryable.
        this._source = { files: [], meta: {}, modality, name } as never
    }

    protected _load () {
        this.attempts++
        return new Promise<boolean>(resolve => {
            this.finish = (loaded: boolean) => {
                if (!loaded) {
                    this._errorReason = 'Worker setup failed'
                }
                resolve(loaded)
            }
        })
    }
}

/** A promise settled from outside. */
const pending = () => {
    let resolve = () => {}
    let reject = (_reason: Error) => {}
    const promise = new Promise<void>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, reject, resolve }
}

const settle = async () => {
    for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 0))
    }
}

beforeAll(() => {
    // The callout a failed load raises is a translated message.
    init(createApp({}), 'en')
})

describe('activating a resource', () => {
    let app: Epicurrents
    let dataset: MediaDataset
    let store: NonNullable<AppStore['instance']>
    /** Names of the resources committed as active, in order. */
    let committed: (string | null)[]

    const add = (resource: TestResource) => {
        dataset.addResource({ resource })
        return resource
    }
    const activeNames = () => dataset.resources.filter(ctx => ctx.resource.isActive).map(ctx => ctx.resource.name)

    beforeEach(() => {
        ;(window as unknown as { __EPICURRENTS__: undefined }).__EPICURRENTS__ = undefined
        app = new Epicurrents()
        app.runtime.APP.datasets.length = 0
        app.runtime.APP.activeDataset = null
        app.runtime.SETTINGS.app.useMemoryManager = true
        const manager = new AppStore(app.runtime)
        for (const modality of ['test', 'doc']) {
            manager.addModule(modality, {
                runtime: {} as never,
                settings: { compatibleView: 'media', useMemoryManager: true } as never,
            })
        }
        store = manager.instance
        dataset = app.createDataset('dataset', true)
        committed = []
        store.subscribe(mutation => {
            if (mutation.type === 'set-active-resource') {
                committed.push((mutation.payload as DataResource | null)?.name ?? null)
            }
        })
    })

    it('shows the latest request when an earlier one is still waiting', async () => {
        const previous = add(new TestResource('previous'))
        const first = add(new TestResource('first'))
        const second = add(new TestResource('second'))
        await store.dispatch('set-active-resource', previous)
        await settle()
        const release = pending()
        previous.deactivation = release.promise
        store.dispatch('set-active-resource', first)
        store.dispatch('set-active-resource', second)
        await settle()
        expect(committed).toEqual(['previous'])
        release.resolve()
        await settle()
        expect(committed).toEqual(['previous', 'second'])
        expect(activeNames()).toEqual(['second'])
    })

    it('drops a request when another dataset has become active while it waited', async () => {
        const previous = add(new TestResource('previous'))
        const next = add(new TestResource('next'))
        await store.dispatch('set-active-resource', previous)
        await settle()
        const release = pending()
        previous.deactivation = release.promise
        store.dispatch('set-active-resource', next)
        await settle()
        const another = app.createDataset('another', false)
        store.commit('set-active-dataset', another)
        release.resolve()
        await settle()
        expect(committed).toEqual(['previous'])
        expect(next.isActive).toBe(false)
    })

    it('waits for a deactivation that was already under way', async () => {
        const releasing = add(new TestResource('releasing'))
        const next = add(new TestResource('next'))
        const release = pending()
        releasing.deactivation = release.promise
        expect(releasing.isActive).toBe(false)
        store.dispatch('set-active-resource', next)
        await settle()
        expect(next.isActive).toBe(false)
        release.resolve()
        await settle()
        expect(next.isActive).toBe(true)
    })

    it('leaves nothing open when a deactivation fails', async () => {
        const previous = add(new TestResource('previous'))
        const next = add(new TestResource('next'))
        await store.dispatch('set-active-resource', previous)
        await settle()
        previous.deactivation = Promise.reject(new Error('release failed'))
        store.dispatch('set-active-resource', next)
        await settle()
        expect(committed).toEqual(['previous', null])
        expect(activeNames()).toEqual([])
        expect(store.state.APP.activeModality).toBe('')
    })

    it('changes nothing for a resource whose modality cannot be shown', async () => {
        const previous = add(new TestResource('previous'))
        const orphan = add(new TestResource('orphan', 'unregistered'))
        await store.dispatch('set-active-resource', previous)
        await settle()
        store.dispatch('set-active-resource', orphan)
        await settle()
        expect(committed).toEqual(['previous'])
        expect(activeNames()).toEqual(['previous'])
    })

    describe('with a child', () => {
        const withChild = (childModality: string) => {
            const child = new TestResource('child', childModality)
            child.state = 'added'
            const parent = add(new TestResource('parent'))
            parent.childResources = [child]
            return { child, parent }
        }

        it('opens the child, loads it and shows it through the parent', async () => {
            const { child, parent } = withChild('doc')
            store.dispatch('set-active-child-resource', { child, parent })
            await settle()
            expect(parent.activeChildResource).toBe(child)
            expect(child.loads).toBe(1)
            expect(parent.isActive).toBe(true)
            expect(store.state.APP.activeModality).toBe('doc')
        })

        it('refuses a child whose modality cannot be shown, before it becomes the active child', async () => {
            const { child, parent } = withChild('unregistered')
            await store.dispatch('set-active-resource', parent)
            await settle()
            store.dispatch('set-active-child-resource', { child, parent })
            await settle()
            expect(parent.activeChildResource).toBeNull()
            expect(child.loads).toBe(0)
            expect(dataset.activeResources).toEqual([parent])
            expect(store.state.APP.activeModality).toBe('test')
        })

        it('refuses a parent that is not in the active dataset', async () => {
            const child = new TestResource('child', 'doc')
            const parent = new TestResource('parent')
            parent.childResources = [child]
            store.dispatch('set-active-child-resource', { child, parent })
            await settle()
            expect(parent.activeChildResource).toBeNull()
            expect(committed).toEqual([])
        })

        it('refuses a parent that has been destroyed', async () => {
            const { child, parent } = withChild('doc')
            parent.destroy()
            store.dispatch('set-active-child-resource', { child, parent })
            await settle()
            expect(parent.activeChildResource).toBeNull()
            expect(committed).toEqual([])
        })

        it('closes the child with its parent when the active resource is closed', async () => {
            const { child, parent } = withChild('doc')
            store.dispatch('set-active-child-resource', { child, parent })
            await settle()
            store.dispatch('set-active-resource', null)
            await settle()
            expect(parent.isActive).toBe(false)
            expect(parent.activeChildResource).toBeNull()
        })

        it('commits the mutation without a core event when a child changes under an active parent', async () => {
            const { child, parent } = withChild('doc')
            const sibling = new TestResource('sibling', 'doc')
            parent.childResources = [child, sibling]
            store.dispatch('set-active-child-resource', { child, parent })
            await settle()
            const heard = vi.fn()
            app.runtime.addEventListener('set-active-resource', heard, 'test')
            const keyBefore = shownResourceKey(store.state.APP.activeModality, dataset, dataset.activeResources)
            store.dispatch('set-active-child-resource', { child: sibling, parent })
            await settle()
            expect(heard).not.toHaveBeenCalled()
            expect(committed).toEqual(['parent', 'parent'])
            // The key the views give their controls and footer is what tells them of the change.
            const keyAfter = shownResourceKey(store.state.APP.activeModality, dataset, dataset.activeResources)
            expect(keyBefore).toBe(`doc-${child.id}`)
            expect(keyAfter).toBe(`doc-${sibling.id}`)
        })

        it('keys a member on its modality alone', () => {
            const member = add(new TestResource('member'))
            expect(shownResourceKey('test', dataset, [member])).toBe('test')
        })
    })

    describe('whose load fails', () => {
        /** Callouts the store was asked to display, in order. */
        let callouts: { message: string, role: string }[]

        beforeEach(() => {
            callouts = []
            store.subscribeAction(action => {
                if (action.type === 'display-callout') {
                    callouts.push(action.payload)
                }
            })
        })

        const addMember = (resource: FailingResource) => {
            dataset.addResource({ resource })
            return resource
        }

        it('is deactivated by the runtime, closed in the store and reported once with its reason', async () => {
            const previous = add(new TestResource('previous'))
            const failing = addMember(new FailingResource('failing'))
            await store.dispatch('set-active-resource', previous)
            await settle()
            await store.dispatch('set-active-resource', failing)
            expect(failing.isActive).toBe(true)
            expect(failing.state).toBe('loading')
            expect(store.state.APP.activeModality).toBe('test')
            failing.finish(false)
            await settle()
            expect(failing.state).toBe('error')
            expect(failing.errorReason).toBe('Worker setup failed')
            expect(failing.isActive).toBe(false)
            expect(dataset.activeResources).toEqual([])
            // The views follow the store's mutation, so the close is committed for them.
            expect(committed).toEqual(['previous', 'failing', null])
            expect(store.state.APP.activeModality).toBe('')
            expect(callouts).toEqual([{ message: 'Loading failing failed: Worker setup failed', role: 'error' }])
        })

        it('is retried when it is activated again, and stays shown once it loads', async () => {
            const failing = addMember(new FailingResource('failing'))
            await store.dispatch('set-active-resource', failing)
            failing.finish(false)
            await settle()
            expect(failing.canRetryLoad).toBe(true)
            await store.dispatch('set-active-resource', failing)
            expect(failing.state).toBe('loading')
            expect(failing.errorReason).toBe('')
            expect(failing.isActive).toBe(true)
            expect(store.state.APP.activeModality).toBe('test')
            failing.finish(true)
            await settle()
            expect(failing.state).toBe('ready')
            expect(failing.isActive).toBe(true)
            expect(failing.attempts).toBe(2)
            expect(committed).toEqual(['failing', null, 'failing'])
            expect(callouts).toHaveLength(1)
        })

        it('is reported again when the retry fails too', async () => {
            const failing = addMember(new FailingResource('failing'))
            await store.dispatch('set-active-resource', failing)
            failing.finish(false)
            await settle()
            await store.dispatch('set-active-resource', failing)
            failing.finish(false)
            await settle()
            expect(failing.isActive).toBe(false)
            expect(committed).toEqual(['failing', null, 'failing', null])
            expect(callouts).toHaveLength(2)
        })

        it('leaves another resource shown when it fails after the user has moved on', async () => {
            const failing = addMember(new FailingResource('failing'))
            const next = add(new TestResource('next'))
            await store.dispatch('set-active-resource', failing)
            await store.dispatch('set-active-resource', next)
            await settle()
            failing.finish(false)
            await settle()
            expect(failing.state).toBe('error')
            expect(activeNames()).toEqual(['next'])
            expect(committed).toEqual(['failing', 'next'])
            // Nobody was looking at it when it failed; its row carries the reason.
            expect(callouts).toEqual([])
        })

        it('is reported when it fails after it has loaded', async () => {
            const failing = addMember(new FailingResource('failing'))
            await store.dispatch('set-active-resource', failing)
            failing.finish(true)
            await settle()
            expect(failing.isActive).toBe(true)
            failing.errorReason = 'Signal caching failed'
            failing.state = 'error'
            await settle()
            expect(failing.isActive).toBe(false)
            expect(committed).toEqual(['failing', null])
            expect(callouts).toEqual([{ message: 'Loading failing failed: Signal caching failed', role: 'error' }])
        })

        it('is reported once, with the hint its module put in the reason', async () => {
            // A recording module raises no callout of its own for a failure that ends in `error`: the reason is the
            // one carrier of what the user is told, so the hint has to arrive through it.
            const reason = 'Signal caching failed; the recording may be too large for the configured memory budget'
            const failing = addMember(new FailingResource('failing'))
            await store.dispatch('set-active-resource', failing)
            failing.finish(true)
            await settle()
            failing.errorReason = reason
            failing.state = 'error'
            await settle()
            expect(callouts).toEqual([{ message: `Loading failing failed: ${reason}`, role: 'error' }])
        })

        describe('as a child', () => {
            const withFailingChild = () => {
                const child = new FailingResource('child', 'doc')
                const parent = add(new TestResource('parent'))
                parent.childResources = [child]
                return { child, parent }
            }

            it('steps back to the parent, which stays active, and is reported once', async () => {
                const { child, parent } = withFailingChild()
                await store.dispatch('set-active-child-resource', { child, parent })
                await settle()
                expect(parent.activeChildResource).toBe(child)
                expect(store.state.APP.activeModality).toBe('doc')
                child.finish(false)
                await settle()
                expect(child.state).toBe('error')
                expect(child.canRetryLoad).toBe(true)
                expect(parent.activeChildResource).toBeNull()
                expect(parent.isActive).toBe(true)
                expect(dataset.activeResources).toEqual([parent])
                expect(committed).toEqual(['parent', 'parent'])
                expect(store.state.APP.activeModality).toBe('test')
                expect(callouts).toEqual([{ message: 'Loading child failed: Worker setup failed', role: 'error' }])
            })

            it('is retried when it is opened again', async () => {
                const { child, parent } = withFailingChild()
                await store.dispatch('set-active-child-resource', { child, parent })
                await settle()
                child.finish(false)
                await settle()
                await store.dispatch('set-active-child-resource', { child, parent })
                await settle()
                expect(child.state).toBe('loading')
                expect(parent.activeChildResource).toBe(child)
                child.finish(true)
                await settle()
                expect(child.state).toBe('ready')
                expect(child.attempts).toBe(2)
                expect(parent.activeChildResource).toBe(child)
                expect(store.state.APP.activeModality).toBe('doc')
                expect(callouts).toHaveLength(1)
            })
        })
    })
})
