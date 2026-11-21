/**
 * Tests for resources listed in a dataset and loaded in place on their first activation.
 *
 * Media and radiology studies need nothing read, so their loaders list them ready and activating one loads nothing.
 * A listed study that does load stays selectable in the navigator while it loads, and its view holds the modality
 * viewer back behind one loading state until the resource is ready, so the viewer never mounts against a recording
 * that has no channels or service yet.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { Epicurrents, GenericResource } from '@epicurrents/core'
import type { DataResource, MediaDataset } from '@epicurrents/core/types'
import NativeMediaLoader from '#app/modules/native/NativeMediaLoader'
import type NativeMediaResource from '#app/modules/native/NativeMediaResource'
import RadiologyLoader from '#app/modules/rad/RadiologyLoader'
import type RadiologyResource from '#app/modules/rad/RadiologyResource'
import NavigatorItem from '#app/navigator/NavigatorItem.vue'
import ResourceGate from '#app/views/ResourceGate.vue'
import { init } from '#i18n'

/** A resource that loads when the test says so, once its load has read the study and reached `_load`. */
class SlowResource extends GenericResource {
    finish = null as ((loaded: boolean) => void) | null

    constructor (name: string) {
        super(name, 'test')
    }

    protected _load () {
        return new Promise<boolean>(resolve => {
            this.finish = resolve
        })
    }
}

/** A resource listed as it would be through `listStudy`, with a study read for it on load. */
const listedResource = (name: string) => {
    const resource = new SlowResource(name)
    resource.setListing({ options: {}, readStudy: async () => ({ files: [], meta: {} }) as never })
    return resource
}

const settle = async () => {
    for (let i = 0; i < 5; i++) {
        await nextTick()
        await Promise.resolve()
    }
}

beforeAll(() => {
    init(createApp({}), 'en')
})

describe('listing media and radiology studies', () => {
    let app: Epicurrents
    let dataset: MediaDataset

    beforeEach(() => {
        ;(window as unknown as { __EPICURRENTS__: undefined }).__EPICURRENTS__ = undefined
        app = new Epicurrents()
        app.runtime.APP.datasets.length = 0
        app.runtime.APP.activeDataset = null
        app.registerModule('rad', { runtime: {}, settings: {} } as never)
        app.registerModule('video', { runtime: {}, settings: {} } as never)
        app.registerStudyImporter('rad/url', 'Radiology', 'url', new RadiologyLoader())
        app.registerStudyImporter('video/url', 'Video', 'url', new NativeMediaLoader('video'))
        dataset = app.createDataset('dataset', true)
    })

    it('lists a radiology study ready, and activating it loads nothing and keeps the object', () => {
        const listed = app.listStudy({ loader: 'rad/url', name: 'US', source: '/viewer/a' }, { dataset })
        expect((listed as RadiologyResource | null)?.viewerUrl).toBe('/viewer/a')
        expect(listed?.isReady).toBe(true)
        const load = vi.spyOn(listed!, 'load')
        app.runtime.setActiveResource(listed)
        expect(load).not.toHaveBeenCalled()
        expect(dataset.resources.map(ctx => ctx.resource)).toEqual([listed])
        expect(listed?.isActive).toBe(true)
    })

    it('lists a media file from its address ready to play', () => {
        const listed = app.listStudy({ loader: 'video/url', name: 'Clip', source: '/media/clip.mp4' }, { dataset })
        expect((listed as NativeMediaResource | null)?.url).toBe('/media/clip.mp4')
        expect(listed?.isReady).toBe(true)
    })

    it('refuses a listing that gives no address', () => {
        const loader = new RadiologyLoader()
        expect(loader.createListedResource({ loader: 'rad/url', name: 'US', source: [] })).toBeNull()
        expect(new NativeMediaLoader('video').createListedResource({ loader: 'video/url', name: 'Clip', source: '' }))
            .toBeNull()
    })

    it('mints an object URL for a listed local file and revokes it with the resource', () => {
        const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:clip')
        const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
        const file = new File([], 'clip.mp4', { type: 'video/mp4' })
        const resource = new NativeMediaLoader('video')
            .createListedResource({ loader: 'video/file', name: 'Clip', source: file })
        expect(create).toHaveBeenCalledWith(file)
        expect(resource?.mimeType).toBe('video/mp4')
        resource?.destroy()
        expect(revoke).toHaveBeenCalledWith('blob:clip')
        create.mockRestore()
        revoke.mockRestore()
    })
})

describe('a listed resource in the navigator', () => {
    const options = NavigatorItem as unknown as {
        methods: {
            $t: (key: string, params?: object, capitalized?: boolean) => string
            resourceClicked: () => void
            resourceUpdated: () => void
        }
    }
    const stub = (resource: DataResource) => ({
        $options: { name: 'NavigatorItem' },
        $emit: vi.fn(),
        $store: { dispatch: vi.fn(), state: { MODULES: new Map() } },
        $t: options.methods.$t,
        isDeferred: false,
        isListing: false,
        isReady: false,
        isSelectableNow: false,
        resource,
        resourceProps: [] as object[],
    })

    it('is selectable before it has loaded', () => {
        const resource = listedResource('a')
        const item = stub(resource)
        options.methods.resourceUpdated.call(item)
        expect(item.isSelectableNow).toBe(true)
        options.methods.resourceClicked.call(item)
        expect(item.$store.dispatch).toHaveBeenCalledWith('set-active-resource', resource)
    })

    it('stays selectable while it loads', () => {
        const resource = listedResource('a')
        const item = stub(resource)
        options.methods.resourceUpdated.call(item)
        resource.load()
        expect(resource.isListed).toBe(false)
        options.methods.resourceUpdated.call(item)
        expect(item.isSelectableNow).toBe(true)
        expect(item.isListing).toBe(true)
    })

    it('is not selectable once its load has failed', async () => {
        const resource = listedResource('a')
        const item = stub(resource)
        options.methods.resourceUpdated.call(item)
        const load = resource.load()
        await vi.waitFor(() => expect(resource.finish).not.toBeNull())
        resource.finish!(false)
        await load
        options.methods.resourceUpdated.call(item)
        expect(item.isSelectableNow).toBe(false)
        options.methods.resourceClicked.call(item)
        expect(item.$store.dispatch).not.toHaveBeenCalled()
    })
})

describe('the view of a resource that is still loading', () => {
    const apps = [] as { unmount: () => void }[]
    const Viewer = defineComponent({
        setup () {
            return () => h('p', { class: 'viewer' }, 'viewer')
        },
    })

    /** Mount a gate in front of the test viewer, with the store parts the gate reads. */
    const mountGate = (resource: DataResource) => {
        const place = document.createElement('div')
        document.body.append(place)
        const store = { dispatch: vi.fn(), state: { APP: { runningId: 0 } } }
        const gateApp = createApp({ render: () => h(ResourceGate, { resource }, () => h(Viewer)) })
        gateApp.provide('store', store)
        gateApp.config.globalProperties.$store = store as never
        gateApp.component('app-icon', defineComponent({ render: () => h('i') }))
        gateApp.config.compilerOptions.isCustomElement = tag => tag.startsWith('wa-')
        gateApp.mount(place)
        apps.push(gateApp)
        return place
    }

    afterEach(() => {
        apps.splice(0).forEach(gateApp => gateApp.unmount())
    })

    it('mounts the viewer only once the resource is ready', async () => {
        const resource = listedResource('a')
        const place = mountGate(resource)
        const load = resource.load()
        await settle()
        expect(place.querySelector('.viewer')).toBeNull()
        expect(place.querySelector('wa-spinner')).not.toBeNull()
        resource.finish!(true)
        await load
        await settle()
        expect(place.querySelector('.viewer')).not.toBeNull()
    })

    it('shows the reason a load failed in place of the viewer', async () => {
        const resource = listedResource('a')
        const place = mountGate(resource)
        const load = resource.load()
        await vi.waitFor(() => expect(resource.finish).not.toBeNull())
        resource.errorReason = 'Recording study is incomplete'
        resource.finish!(false)
        await load
        await settle()
        expect(place.querySelector('.viewer')).toBeNull()
        expect(place.querySelector('.error')?.textContent).toContain('Recording study is incomplete')
    })
})
