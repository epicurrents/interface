/**
 * The native media loader: a study from a URL or a file becomes one resource that holds the file's address, ready on
 * creation, and only an object URL the loader minted is revoked with the resource.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import NativeMediaLoader from '#app/modules/native/NativeMediaLoader'
import type NativeMediaResource from '#app/modules/native/NativeMediaResource'

/** Load a study through the loader the way the application does, returning the resource it yields. */
const load = async (loader: NativeMediaLoader, study: Awaited<ReturnType<NativeMediaLoader['loadFromUrl']>>) => {
    const idx = await loader.useStudy(study!)
    return await loader.getResource(idx) as NativeMediaResource | null
}

// jsdom implements neither, so each test that needs them sets its own and the originals are put back.
const { createObjectURL, revokeObjectURL } = URL

describe('NativeMediaLoader', () => {
    afterEach(() => {
        URL.createObjectURL = createObjectURL
        URL.revokeObjectURL = revokeObjectURL
    })

    it('makes a URL study into a ready resource of its modality that keeps the URL', async () => {
        const loader = new NativeMediaLoader('video')
        const resource = await load(loader, await loader.loadFromUrl('/media/api/v1/ABC/file', { name: 'Talk' }))
        expect(resource?.modality).toBe('video')
        expect(resource?.name).toBe('Talk')
        expect(resource?.url).toBe('/media/api/v1/ABC/file')
        expect(resource?.isReady).toBe(true)
    })

    it('names a URL study after the last path segment when no name is given', async () => {
        const loader = new NativeMediaLoader('image')
        const resource = await load(loader, await loader.loadFromUrl('/fixtures/scan%201.png?v=2'))
        expect(resource?.name).toBe('scan 1.png')
    })

    it('makes each study into one resource only', async () => {
        const loader = new NativeMediaLoader('audio')
        const idx = await loader.useStudy((await loader.loadFromUrl('/a.wav'))!)
        expect(await loader.getResource(idx)).not.toBeNull()
        expect(await loader.getResource(idx)).toBeNull()
    })

    it('revokes an object URL it minted for a file, and leaves alone one the caller minted', async () => {
        const revoke = vi.fn()
        URL.createObjectURL = () => 'blob:minted'
        URL.revokeObjectURL = revoke
        const loader = new NativeMediaLoader('image')
        const file = new File([new Uint8Array([1])], 'scan.png', { type: 'image/png' })
        const own = await load(loader, await loader.loadFromFile(file))
        const callers = await load(loader, await loader.loadFromFile(file, { url: 'blob:callers' }))
        expect(own?.url).toBe('blob:minted')
        expect(own?.mimeType).toBe('image/png')
        expect(callers?.url).toBe('blob:callers')
        callers?.destroy()
        expect(revoke).not.toHaveBeenCalled()
        own?.destroy()
        expect(revoke).toHaveBeenCalledWith('blob:minted')
    })

    it('refuses a directory, which holds no single file to hand to an element', async () => {
        const loader = new NativeMediaLoader('video')
        expect(await loader.loadFromDirectory({} as never)).toBeNull()
    })
})
