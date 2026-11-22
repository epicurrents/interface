/**
 * The way back from a radiology study: to the resource it is listed under while the dataset holds it, and to the
 * dataset, every resource closed and then the default view shown, otherwise. A study the active dataset no longer
 * holds is not shown, and the framed page's request to go back is honoured only while its study is the one on screen.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import { describe, expect, it } from 'vitest'
import type { DataResource } from '@epicurrents/core/types'
import RadiologyFooter from '#app/modules/rad/components/RadiologyFooter.vue'
import RadiologyResource, { RADIOLOGY_RETURN_MESSAGE } from '#app/modules/rad/RadiologyResource'
import {
    activeStudy,
    datasetHolds,
    datasetView,
    isReturnRequest,
    parentOf,
    showDataset,
    stepBack,
} from '#app/modules/rad/wayBack'
import RadiologyInterface from '#app/views/radiology/RadiologyInterface.vue'

/** A dataset member with `children` listed under it, the first of them open when `open` is set. */
const member = (name: string, children: DataResource[] = [], open = false) => ({
    activeChildResource: open ? children[0] : null,
    childResources: children,
    id: name,
    isActive: false,
    modality: 'eeg',
    name,
}) as unknown as DataResource

/** The state of a store whose active dataset holds `resources`, of which `active` are active, in the view `view`. */
const stateOf = (resources: DataResource[], active: DataResource[] = [], view = 'radiology') => ({
    APP: {
        activeDataset: {
            activeResources: active.map(resource => resource.activeChildResource || resource),
            name: 'Set',
            resources: resources.map(resource => ({ resource })),
        },
        view: { name: view },
    },
})

/** A store whose active dataset holds `resources`, recording what is dispatched. */
const store = (resources: DataResource[], active: DataResource[] = []) => {
    const dispatched = [] as [string, unknown][]
    const dispatch = (type: string, payload: unknown) => {
        dispatched.push([type, payload])
    }
    // The helpers read only the active dataset and the view of the state.
    return { dispatch, dispatched, state: stateOf(resources, active) as never }
}

const study = (url = '/viewer/a') => new RadiologyResource('US', url)

describe('the way back from a radiology study', () => {
    it('steps back to the resource the study is listed under', async () => {
        const attached = study()
        const recording = member('EEG 1', [attached])
        const injectee = store([recording])
        expect(parentOf(injectee.state, attached)).toBe(recording)
        await stepBack(injectee as never, attached)
        expect(injectee.dispatched).toEqual([['set-active-child-resource', { child: null, parent: recording }]])
    })

    it('steps back to the dataset from a study that is a dataset member', async () => {
        const alone = study()
        const injectee = store([member('EEG 1'), alone])
        expect(parentOf(injectee.state, alone)).toBeNull()
        await stepBack(injectee as never, alone)
        expect(injectee.dispatched).toEqual([['set-active-resource', null], ['set-view', 'default']])
    })

    it('treats a parent the dataset no longer holds as none', async () => {
        const attached = study()
        const injectee = store([member('EEG 2')])
        expect(parentOf(injectee.state, attached)).toBeNull()
        await stepBack(injectee as never, attached)
        expect(injectee.dispatched[1]).toEqual(['set-view', 'default'])
    })

    it('switches the view only once the resources have been closed', async () => {
        const order = [] as string[]
        const injectee = {
            dispatch: async (type: string) => {
                order.push(`${type} started`)
                await new Promise(resolve => setTimeout(resolve, 5))
                order.push(`${type} done`)
            },
            state: stateOf([]),
        }
        await showDataset(injectee as never)
        expect(order).toEqual([
            'set-active-resource started',
            'set-active-resource done',
            'set-view started',
            'set-view done',
        ])
    })

    it('returns to the first other view where no default view is registered', async () => {
        expect(datasetView(['biosignal', 'default', 'radiology'])).toBe('default')
        expect(datasetView(['radiology', 'biosignal', 'media'])).toBe('biosignal')
        expect(datasetView(['radiology'])).toBeNull()
        const injectee = store([])
        await showDataset(injectee as never, ['radiology', 'media'])
        expect(injectee.dispatched).toEqual([['set-active-resource', null], ['set-view', 'media']])
        // The application's own views include the default one.
        expect(datasetView()).toBe('default')
    })
})

describe('the study a dataset holds', () => {
    it('finds the active study as a member and as the open child of an active member', () => {
        const alone = study()
        expect(activeStudy(stateOf([alone], [alone]) as never)).toBe(alone)
        const attached = study()
        const recording = member('EEG 1', [attached], true)
        expect(activeStudy(stateOf([recording], [recording]) as never)).toBe(attached)
        expect(activeStudy(stateOf([recording, alone]) as never)).toBeNull()
        expect(activeStudy({ APP: { activeDataset: null } } as never)).toBeNull()
    })

    it('holds a member and a child of a member, and neither after another dataset became active', () => {
        const alone = study()
        const attached = study()
        const first = stateOf([member('EEG 1', [attached]), alone])
        expect(datasetHolds(first as never, alone)).toBe(true)
        expect(datasetHolds(first as never, attached)).toBe(true)
        const second = stateOf([member('EEG 2')])
        expect(datasetHolds(second as never, alone)).toBe(false)
        expect(datasetHolds(second as never, attached)).toBe(false)
        expect(datasetHolds({ APP: { activeDataset: null } } as never, alone)).toBe(false)
        expect(datasetHolds(first as never, null)).toBe(false)
    })

    it('does not hold a destroyed study', () => {
        const alone = study()
        const state = stateOf([alone])
        ;(alone as unknown as { _viewerUrl: string })._viewerUrl = ''
        expect(datasetHolds(state as never, alone)).toBe(false)
        const other = study()
        Object.defineProperty(other, 'state', { value: 'destroyed' })
        expect(datasetHolds(stateOf([other]) as never, other)).toBe(false)
    })
})

describe('a framed page asking for the way back', () => {
    const frame = {} as Window
    const message = (over: Partial<MessageEvent> = {}) => ({
        data: { type: RADIOLOGY_RETURN_MESSAGE },
        origin: window.location.origin,
        source: frame,
        ...over,
    }) as MessageEvent

    it('is honoured from the frame of the study on screen', () => {
        const shown = study()
        expect(isReturnRequest(message(), frame, stateOf([shown], [shown]) as never, shown)).toBe(true)
    })

    it('is refused from another window, another origin or with another message', () => {
        const shown = study()
        const state = stateOf([shown], [shown]) as never
        expect(isReturnRequest(message({ source: {} as Window }), frame, state, shown)).toBe(false)
        expect(isReturnRequest(message({ origin: 'https://elsewhere.example' }), frame, state, shown)).toBe(false)
        expect(isReturnRequest(message({ data: { type: 'other' } }), frame, state, shown)).toBe(false)
        expect(isReturnRequest(message({ data: null }), frame, state, shown)).toBe(false)
        expect(isReturnRequest(message(), null, state, shown)).toBe(false)
        expect(isReturnRequest(message(), frame, state, null)).toBe(false)
    })

    it('is refused while another view is shown', () => {
        const shown = study()
        const state = stateOf([shown], [shown], 'biosignal') as never
        expect(isReturnRequest(message(), frame, state, shown)).toBe(false)
    })

    it('is refused once the study is no longer the one open', () => {
        const shown = study()
        const recording = member('EEG 1')
        // Still a member, with another resource active.
        expect(isReturnRequest(message(), frame, stateOf([shown, recording], [recording]) as never, shown)).toBe(false)
        // Another dataset is active.
        expect(isReturnRequest(message(), frame, stateOf([recording], [recording]) as never, shown)).toBe(false)
        // Another study is the one open.
        const other = study('/viewer/b')
        expect(isReturnRequest(message(), frame, stateOf([shown, other], [other]) as never, shown)).toBe(false)
    })
})

describe('the radiology view', () => {
    type Methods = Record<string, (...args: unknown[]) => unknown>
    const options = RadiologyInterface as unknown as { methods: Methods }

    /** The view's state and methods over a store state that can be replaced. */
    const view = (state: unknown) => {
        const vm = {
            $options: { name: 'RadiologyInterface' },
            $store: { state },
            attempt: 0,
            failed: false,
            loading: false,
            study: null as RadiologyResource | null,
            studyId: '',
            viewerTitle: '',
            viewerUrl: '',
        } as Record<string, unknown>
        for (const [name, method] of Object.entries(options.methods)) {
            vm[name] = method.bind(vm)
        }
        return vm as typeof vm & { $store: { state: unknown }, checkActiveResource: () => void }
    }

    it('frames the resolved address of the active study and shows it loading', () => {
        const shown = study('/viewer/a?x=1')
        const vm = view(stateOf([shown], [shown]))
        vm.checkActiveResource()
        expect(vm.viewerUrl).toBe(`${window.location.origin}/viewer/a?x=1`)
        expect(vm.viewerTitle).toBe('US')
        expect(vm.study).toBe(shown)
        expect(vm.loading).toBe(true)
    })

    it('keeps the frame while its study is closed and the dataset still holds it', () => {
        const shown = study()
        const recording = member('EEG 1')
        const vm = view(stateOf([shown, recording], [shown]))
        vm.checkActiveResource()
        const url = vm.viewerUrl
        vm.$store.state = stateOf([shown, recording], [recording], 'biosignal')
        vm.checkActiveResource()
        expect(vm.viewerUrl).toBe(url)
        expect(vm.study).toBe(shown)
    })

    it('drops the frame when another dataset becomes active', () => {
        const shown = study()
        const vm = view(stateOf([shown], [shown]))
        vm.checkActiveResource()
        vm.$store.state = stateOf([member('EEG 2')], [], 'default')
        vm.checkActiveResource()
        expect(vm.viewerUrl).toBe('')
        expect(vm.viewerTitle).toBe('')
        expect(vm.study).toBeNull()
        expect(vm.loading).toBe(false)
    })

    it('drops the frame when its study is removed from the dataset', () => {
        const shown = study()
        const vm = view(stateOf([shown], [shown]))
        vm.checkActiveResource()
        vm.$store.state = stateOf([], [])
        vm.checkActiveResource()
        expect(vm.viewerUrl).toBe('')
        expect(vm.study).toBeNull()
    })

    it('gives another study a frame of its own, and the same study none', () => {
        const first = study('/viewer/a')
        const second = study('/viewer/a')
        const vm = view(stateOf([first, second], [first]))
        vm.checkActiveResource()
        vm.loading = false
        vm.checkActiveResource()
        expect(vm.loading).toBe(false)
        vm.$store.state = stateOf([first, second], [second])
        vm.checkActiveResource()
        // The same address under another study is still another frame.
        expect(vm.studyId).toBe(second.id)
        expect(vm.loading).toBe(true)
    })

    it('takes the name of the study before deciding whether the frame changes', () => {
        const shown = study()
        const vm = view(stateOf([shown], [shown]))
        vm.checkActiveResource()
        shown.name = 'CT'
        vm.checkActiveResource()
        expect(vm.viewerTitle).toBe('CT')
    })

    it('frames no address that is not allowed', () => {
        const shown = study()
        ;(shown as unknown as { _viewerUrl: string })._viewerUrl = 'javascript:alert(1)'
        const vm = view(stateOf([shown], [shown]))
        vm.checkActiveResource()
        expect(vm.viewerUrl).toBe('')
        expect(vm.study).toBeNull()
    })

    it('reports a page that loaded blank or unreadable, and frames it anew on a retry', () => {
        const shown = study()
        const vm = view(stateOf([shown], [shown])) as ReturnType<typeof view> & {
            frameLoaded: (event: unknown) => void
            retry: () => void
        }
        vm.checkActiveResource()
        const loaded = { contentWindow: { location: { href: `${window.location.origin}/viewer/a` } } }
        vm.frame = loaded
        vm.frameLoaded({ target: loaded })
        expect(vm.loading).toBe(false)
        expect(vm.failed).toBe(false)
        const blank = { contentWindow: { location: { href: 'about:blank' } } }
        vm.frame = blank
        vm.frameLoaded({ target: blank })
        expect(vm.failed).toBe(true)
        vm.retry()
        expect([vm.failed, vm.loading, vm.attempt]).toEqual([false, true, 1])
        const unreadable = {
            contentWindow: {
                get location (): Location {
                    throw new DOMException('Blocked a frame from accessing a cross-origin frame.')
                },
            },
        }
        vm.frame = unreadable
        vm.frameLoaded({ target: unreadable })
        expect(vm.failed).toBe(true)
        // A frame that has been replaced reports nothing.
        vm.retry()
        vm.frameLoaded({ target: blank })
        expect([vm.failed, vm.loading]).toEqual([false, true])
    })
})

describe('the radiology footer', () => {
    type Methods = Record<string, (...args: unknown[]) => unknown>
    const options = RadiologyFooter as unknown as { methods: Methods }

    const footer = (state: unknown) => {
        const vm = {
            $store: { state },
            datasetName: '',
            parent: null,
            parentName: '',
            study: null,
            studyName: '',
        } as Record<string, unknown>
        for (const [name, method] of Object.entries(options.methods)) {
            vm[name] = method.bind(vm)
        }
        return vm as typeof vm & { $store: { state: unknown }, checkActiveResource: () => void }
    }

    it('keeps the trail behind another view and empties it when the dataset changes', () => {
        const attached = study()
        const recording = member('EEG 1', [attached], true)
        const vm = footer(stateOf([recording], [recording]))
        vm.checkActiveResource()
        expect([vm.datasetName, vm.parentName, vm.studyName]).toEqual(['Set', 'EEG 1', 'US'])
        recording.activeChildResource = null
        vm.$store.state = stateOf([recording], [recording], 'biosignal')
        vm.checkActiveResource()
        expect([vm.datasetName, vm.parentName, vm.studyName]).toEqual(['Set', 'EEG 1', 'US'])
        vm.$store.state = stateOf([member('EEG 2')], [], 'default')
        vm.checkActiveResource()
        expect([vm.datasetName, vm.parentName, vm.studyName]).toEqual(['', '', ''])
        expect(vm.parent).toBeNull()
    })
})
