/**
 * Tests for opening a resource listed under another, such as a study attached to a recording.
 *
 * One store action opens a child and closes it again. Opening a child makes it its parent's active child, loads it in
 * place if it is a listing, and activates the parent behind it, so the view follows the child's modality while the
 * parent stays set up for the way back. Activating a resource the ordinary way shows the resource itself. In the
 * navigator, a child's item opens through that action and is marked as shown only while its parent shows it; a member
 * lists its children when it is opened and while it is active, and marks its shown child in its place while they are
 * hidden, which the navigator remembers while the member is scrolled out of view. The module registered for a modality
 * names the navigator's group headers and leads each row's properties.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { actions, ActionTypes } from '#store/actions'
import { MutationTypes } from '#store/mutations'
import DatasetNavigator from '#app/navigator/DatasetNavigator.vue'
import NavigatorEntry from '#app/navigator/NavigatorEntry.vue'
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
    // The action follows an activated resource for a failure.
    onPropertyChange: vi.fn(),
    state: 'ready',
    ...extra,
}) as unknown as DataResource

/**
 * A store context in the view `view`, whose modules map `rad` and `eeg` to their views and whose active dataset holds
 * `members`.
 */
const context = (view: string, ...members: DataResource[]) => ({
    commit: vi.fn(),
    dispatch: vi.fn(),
    state: {
        APP: { activeDataset: { resources: members.map(member => ({ resource: member })) }, view: { name: view } },
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
        const injectee = context('radiology', parent)
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
        openChild(context('radiology', parent), { child, parent })
        expect(parent.activeChildResource).toBe(child)
        expect(child.load).not.toHaveBeenCalled()
    })

    it('refuses a resource that is not a child of the parent', () => {
        const stranger = resource('CT', 'rad')
        const parent = resource('EEG', 'eeg')
        const injectee = context('radiology', parent)
        openChild(injectee, { child: stranger, parent })
        expect(parent.activeChildResource).toBeNull()
        expect(injectee.commit).not.toHaveBeenCalled()
    })

    it('closes the child and shows the parent again', async () => {
        const child = resource('US', 'rad')
        const parent = resource('EEG', 'eeg', { activeChildResource: child, childResources: [child] })
        const injectee = context('biosignal', parent)
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
    const stub = (item: DataResource, parent: DataResource | null, expanded = true) => ({
        $emit: vi.fn(),
        $options: { name: 'NavigatorItem' },
        $store: { dispatch: vi.fn(), state: { MODULES: new Map() } },
        $t: options.methods.$t,
        childCount: parent ? 0 : item.childResources.length,
        expanded,
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

    it('leads its properties with the name of the module for its modality', () => {
        const member = resource('EEG', 'eeg', {
            getMainProperties: () => new Map([['duration', 60], ['signals', 20]]),
        } as Partial<DataResource>)
        const item = stub(member, null)
        item.$store.state.MODULES = new Map([['eeg', { moduleName: { code: 'eeg', full: 'EEG', short: 'EEG' } }]])
        options.methods.resourceUpdated.call(item)
        expect(item.resourceProps.map(p => (p as { text: string }).text)).toEqual(['EEG', '20', '01:00'])
    })

    it('marks a collapsed member in place of its shown child', () => {
        const child = resource('US', 'rad')
        const parent = resource('EEG', 'eeg', {
            activeChildResource: child,
            childResources: [child],
            isActive: true,
        } as Partial<DataResource>)
        const parentItem = stub(parent, null, false)
        options.methods.resourceUpdated.call(parentItem)
        expect(parentItem.isShown).toBe(true)
    })
})

describe('a member with children in the navigator', () => {
    const options = NavigatorEntry as unknown as {
        methods: {
            entryUpdated: () => void
            openChildren: () => void
            toggleChildren: () => void
        }
    }
    const stub = (member: DataResource, disclosure = { isOpen: false, wasActive: false }) => ({
        children: [] as DataResource[],
        disclosure,
        resource: member,
    })

    it('lists its children while it is active and hides them when it stops', () => {
        const child = resource('US', 'rad')
        const member = resource('EEG', 'eeg', { childResources: [child] })
        const entry = stub(member)
        options.methods.entryUpdated.call(entry)
        expect(entry.children).toEqual([child])
        expect(entry.disclosure.isOpen).toBe(false)
        ;(member as { isActive: boolean }).isActive = true
        options.methods.entryUpdated.call(entry)
        expect(entry.disclosure.isOpen).toBe(true)
        ;(member as { isActive: boolean }).isActive = false
        options.methods.entryUpdated.call(entry)
        expect(entry.disclosure.isOpen).toBe(false)
    })

    it('lists its children when the member is opened again after they were hidden', () => {
        const child = resource('US', 'rad')
        const member = resource('EEG', 'eeg', { childResources: [child], isActive: true } as Partial<DataResource>)
        const entry = stub(member)
        options.methods.entryUpdated.call(entry)
        options.methods.toggleChildren.call(entry)
        expect(entry.disclosure.isOpen).toBe(false)
        const itemOptions = NavigatorItem as unknown as { methods: { resourceClicked: () => void } }
        const item = {
            $emit: vi.fn(),
            $store: { dispatch: vi.fn() },
            isListing: false,
            parent: null,
            resource: member,
        }
        itemOptions.methods.resourceClicked.call(item)
        expect(item.$emit).toHaveBeenCalledWith('selected')
        options.methods.openChildren.call(entry)
        expect(entry.disclosure.isOpen).toBe(true)
    })

    it('keeps a toggled list as it is until the member changes its activity', () => {
        const child = resource('US', 'rad')
        const member = resource('EEG', 'eeg', { childResources: [child], isActive: true } as Partial<DataResource>)
        const entry = stub(member)
        options.methods.entryUpdated.call(entry)
        options.methods.toggleChildren.call(entry)
        expect(entry.disclosure.isOpen).toBe(false)
        // A new child changes the list, not whether it is shown.
        ;(member as { childResources: DataResource[] }).childResources = [child, resource('CT', 'rad')]
        options.methods.entryUpdated.call(entry)
        expect(entry.children).toHaveLength(2)
        expect(entry.disclosure.isOpen).toBe(false)
    })

    it('keeps a toggled list as it is when its entry is mounted again', () => {
        const child = resource('US', 'rad')
        const member = resource('EEG', 'eeg', { childResources: [child], isActive: true } as Partial<DataResource>)
        const entry = stub(member)
        options.methods.entryUpdated.call(entry)
        options.methods.toggleChildren.call(entry)
        // Scrolled out of view and back: a new entry for the member, with the state the navigator kept.
        const remounted = stub(member, entry.disclosure)
        options.methods.entryUpdated.call(remounted)
        expect(remounted.disclosure.isOpen).toBe(false)
    })
})

describe('the navigator groups', () => {
    const options = DatasetNavigator as unknown as {
        computed: { groups: () => { header: string, key: string, resources: unknown[] }[] }
        methods: { $t: (key: string) => string }
    }
    beforeAll(() => {
        init(createApp({}), 'en')
    })
    const navigator = (scheme: string, sorted: Map<string, unknown[]>) => ({
        $options: { name: 'AppNavigator' },
        $store: {
            state: {
                APP: { activeDataset: { resourceSorting: { scheme }, sortedResources: sorted } },
                MODULES: new Map([
                    ['eeg', { moduleName: { code: 'eeg', full: 'Electroencephalography', short: 'EEG' } }],
                    ['rad', { moduleName: { code: 'rad', full: 'Radiology', short: 'Radiology' } }],
                ]),
            },
        },
        $t: options.methods.$t,
        updateCounter: 0,
    })

    it('heads each modality with its module name, and skips empty groups', () => {
        const groups = options.computed.groups.call(navigator('modality', new Map([
            ['eeg', [{}]],
            ['rad', [{}]],
            ['pdf', []],
            ['meg', [{}]],
        ])))
        expect(groups.map(g => g.header)).toEqual(['EEG', 'Radiology', 'MEG'])
    })

    it('takes no headers when sorted otherwise', () => {
        const groups = options.computed.groups.call(navigator('alphabetical', new Map([['A', [{}]], ['E', [{}]]])))
        expect(groups.map(g => g.header)).toEqual(['', ''])
    })
})
