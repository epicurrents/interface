/**
 * The radiology loader: a study from a viewer address becomes one resource that holds the address, ready on creation,
 * and a file or a directory, which has no page to render it, is refused.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import { describe, expect, it } from 'vitest'
import RadiologyLoader from '#app/modules/rad/RadiologyLoader'
import type RadiologyResource from '#app/modules/rad/RadiologyResource'

describe('RadiologyLoader', () => {
    it('makes a URL study into a ready radiology resource that keeps the viewer address', async () => {
        const loader = new RadiologyLoader()
        const url = '/viewer/page?url=%2Fstudy.json'
        const idx = await loader.useStudy((await loader.loadFromUrl(url, { name: 'US' }))!)
        const resource = await loader.getResource(idx) as RadiologyResource | null
        expect(resource?.modality).toBe('rad')
        expect(resource?.name).toBe('US')
        expect(resource?.viewerUrl).toBe(url)
        expect(resource?.isReady).toBe(true)
    })

    it('makes each study into one resource only', async () => {
        const loader = new RadiologyLoader()
        const idx = await loader.useStudy((await loader.loadFromUrl('/viewer/a'))!)
        expect(await loader.getResource(idx)).not.toBeNull()
        expect(await loader.getResource(idx)).toBeNull()
    })

    it('refuses a file and a directory', async () => {
        const loader = new RadiologyLoader()
        expect(await loader.loadFromFile(new File([], 'a.dcm'))).toBeNull()
        expect(await loader.loadFromDirectory({} as never)).toBeNull()
    })

    it('forgets the address when destroyed', async () => {
        const loader = new RadiologyLoader()
        const idx = await loader.useStudy((await loader.loadFromUrl('/viewer/a'))!)
        const resource = await loader.getResource(idx) as RadiologyResource
        resource.destroy()
        expect(resource.viewerUrl).toBe('')
    })
})
