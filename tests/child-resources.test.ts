/**
 * Tests for opening a resource listed under another, such as a study attached to a recording.
 *
 * One store action opens a child and closes it again. Opening a child makes it its parent's active child, loads it in
 * place if it is a listing, and activates the parent behind it, so the view follows the child's modality while the
 * parent stays set up for the way back. Activating a resource the ordinary way shows the resource itself. In the
 * navigator, a child's item opens through that action and is marked as shown only while its parent shows it.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { actions, ActionTypes } from '#store/actions'
import { MutationTypes } from '#store/mutations'
import NavigatorItem from '#app/navigator/NavigatorItem.vue'
import { init } from '#i18n'
import type { DataResource } from '@epicurrents/core/types'

/** A resource with just what the action and the item read. */
const resource = (name: string, modality: string, extra: Partial<DataResource> = {}) => ({
    activeChildResource: null,
    childResources: [],
    getMainProperties: () => new Map(),
    id: name,
    isActive: false,
    isListed: false,
    isReady: true,
    load: vi.fn(async () => true),
    modality,
    name,
    state: 'ready',
    ...extra,
}) as unknown as DataResource

/** A store context in the view `view`, whose modules map `rad` and `eeg` to their views. */
const context = (view: string) => ({
    commit: vi.fn(),
    dispatch: vi.fn(),
    state: {
        APP: { activeDataset: { resources: [] }, view: { name: view } },
        INTERFACE: {
            modules: new Map([
                ['eeg', { settings: { compatibleView: 'biosignal' } }],
                ['rad', { settings: { compatibleView: 'radiology' } }],
            ]),
        },
    },
})

const openChild = (injectee: unknown, payload: { child: DataResource | null, parent: DataResource }) => {
    (actions[ActionTypes.SET_ACTIVE_CHILD_RESOURCE] as (i: unknown, p: unknown) => void)(injectee, payload)
}

describe('opening a child resource', () => {
    it('makes it the active child, loads a listing in place and activates the parent behind it', async () => {
        const child = resource('US', 'rad', { isListed: true, isReady: false, state: 'added' } as Partial<DataResource>)
        const parent = resource('EEG', 'eeg', { childResources: [child] })
        const injectee = context('radiology')
        openChild(injectee, { child, parent })
        expect(parent.activeChildResource).toBe(child)
        expect(child.load).toHaveBeenCalledTimes(1)
        await vi.waitFor(() => {
            expect(injectee.commit).toHaveBeenCalledWith(MutationTypes.SET_ACTIVE_RESOURCE, parent)
        })
    })

    it('loads nothing for a child that is ready', () => {
        const child = resource('US', 'rad')
        const parent = resource('EEG', 'eeg', { childResources: [child] })
        openChild(context('radiology'), { child, parent })
        expect(child.load).not.toHaveBeenCalled()
    })

    it('refuses a resource that is not a child of the parent', () => {
        const stranger = resource('CT', 'rad')
        const parent = resource('EEG', 'eeg')
        const injectee = context('radiology')
        openChild(injectee, { child: stranger, parent })
        expect(parent.activeChildResource).toBeNull()
        expect(injectee.commit).not.toHaveBeenCalled()
    })

    it('closes the child and shows the parent again', async () => {
        const child = resource('US', 'rad')
        const parent = resource('EEG', 'eeg', { activeChildResource: child, childResources: [child] })
        const injectee = context('biosignal')
        openChild(injectee, { child: null, parent })
        expect(parent.activeChildResource).toBeNull()
        await vi.waitFor(() => {
            expect(injectee.commit).toHaveBeenCalledWith(MutationTypes.SET_ACTIVE_RESOURCE, parent)
        })
    })

    it('shows the resource itself when it is activated the ordinary way', () => {
        const child = resource('US', 'rad')
        const parent = resource('EEG', 'eeg', { activeChildResource: child, childResources: [child] })
        ;(actions[ActionTypes.SET_ACTIVE_RESOURCE] as (i: unknown, p: unknown) => void)(context('biosignal'), parent)
        expect(parent.activeChildResource).toBeNull()
    })
})

describe('a child resource in the navigator', () => {
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
    const stub = (item: DataResource, parent: DataResource | null) => ({
        $options: { name: 'NavigatorItem' },
        $store: { dispatch: vi.fn() },
        $t: options.methods.$t,
        isDeferred: false,
        isListing: false,
        isReady: false,
        isSelectableNow: false,
        isShown: false,
        parent,
        resource: item,
        resourceProps: [] as object[],
    })

    it('opens through the child action', () => {
        const child = resource('US', 'rad')
        const parent = resource('EEG', 'eeg', { childResources: [child] })
        const item = stub(child, parent)
        options.methods.resourceClicked.call(item)
        expect(item.$store.dispatch).toHaveBeenCalledWith('set-active-child-resource', { child, parent })
    })

    it('is shown while its active parent shows it, and its parent is not', () => {
        const child = resource('US', 'rad')
        const parent = resource('EEG', 'eeg', {
            activeChildResource: child,
            childResources: [child],
            isActive: true,
        } as Partial<DataResource>)
        const childItem = stub(child, parent)
        const parentItem = stub(parent, null)
        options.methods.resourceUpdated.call(childItem)
        options.methods.resourceUpdated.call(parentItem)
        expect(childItem.isShown).toBe(true)
        expect(parentItem.isShown).toBe(false)
        parent.activeChildResource = null
        options.methods.resourceUpdated.call(childItem)
        options.methods.resourceUpdated.call(parentItem)
        expect(childItem.isShown).toBe(false)
        expect(parentItem.isShown).toBe(true)
    })
})
