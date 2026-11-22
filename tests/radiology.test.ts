/**
 * The radiology loader: a study from a viewer address becomes one resource that holds the address, ready on creation,
 * and a file or a directory, which has no page to render it, is refused.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import { afterEach, describe, expect, it } from 'vitest'
import { registerRadiology } from '#app/modules/rad'
import RadiologyLoader from '#app/modules/rad/RadiologyLoader'
import type RadiologyResource from '#app/modules/rad/RadiologyResource'
import {
    getAllowedViewerOrigins,
    isAllowedViewerUrl,
    resolveViewerUrl,
    setAllowedViewerOrigins,
} from '#app/modules/rad/viewerUrl'

afterEach(() => {
    setAllowedViewerOrigins()
})

describe('the address of a viewer page', () => {
    const own = window.location.origin

    it('is resolved against the document when it is of the application\'s own origin', () => {
        expect(resolveViewerUrl('/viewer/page?url=%2Fstudy.json')?.href).toBe(`${own}/viewer/page?url=%2Fstudy.json`)
        expect(resolveViewerUrl('viewer/a')?.href).toBe(`${own}/viewer/a`)
        expect(resolveViewerUrl(`${own}/viewer/a#series`)?.href).toBe(`${own}/viewer/a#series`)
    })

    it.each([
        'javascript:alert(document.domain)',
        ' javascript:alert(1)',
        'JaVaScRiPt:alert(1)',
        'java\nscript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'blob:http://localhost:3000/5a1c',
        'about:blank',
        'file:///etc/passwd',
        'ftp://localhost/viewer',
        'https://elsewhere.example/viewer',
        '//elsewhere.example/viewer',
        'http://localhost.elsewhere.example/viewer',
        `${own}@elsewhere.example/viewer`,
        'https://',
        '',
        '   ',
    ])('is refused as %j', address => {
        expect(resolveViewerUrl(address)).toBeNull()
        expect(isAllowedViewerUrl(address)).toBe(false)
    })

    it.each([null, undefined, 3, {}, []])('is refused when it is not a string: %j', address => {
        expect(resolveViewerUrl(address)).toBeNull()
    })

    it('may be of an origin the host allowed, and of no other', () => {
        setAllowedViewerOrigins(['https://viewer.example.org', 'https://pacs.example.org:8443/ohif/'])
        expect(getAllowedViewerOrigins()).toEqual([own, 'https://viewer.example.org', 'https://pacs.example.org:8443'])
        expect(isAllowedViewerUrl('https://viewer.example.org/study/1')).toBe(true)
        expect(isAllowedViewerUrl('https://pacs.example.org:8443/ohif/viewer?id=1')).toBe(true)
        expect(isAllowedViewerUrl('https://pacs.example.org/ohif/viewer')).toBe(false)
        expect(isAllowedViewerUrl('http://viewer.example.org/study/1')).toBe(false)
        expect(isAllowedViewerUrl('https://viewer.example.org.elsewhere.example/')).toBe(false)
        expect(isAllowedViewerUrl('/viewer/a')).toBe(true)
        setAllowedViewerOrigins()
        expect(isAllowedViewerUrl('https://viewer.example.org/study/1')).toBe(false)
    })

    it('takes no origin that is not a web origin into the allowed ones', () => {
        setAllowedViewerOrigins(['javascript:alert(1)', 'data:text/html,x', '*', 'null', '/viewer', 3 as never])
        expect(getAllowedViewerOrigins()).toEqual([own])
        expect(isAllowedViewerUrl('javascript:alert(1)')).toBe(false)
        expect(isAllowedViewerUrl('https://elsewhere.example/')).toBe(false)
    })

    it('is allowed for the origins registerRadiology is given', () => {
        const context = {
            app: { registerModule () {}, registerStudyImporter () {} },
            registerInterfaceModule () {},
        }
        registerRadiology(context as never, { allowedViewerOrigins: ['https://viewer.example.org'] })
        expect(isAllowedViewerUrl('https://viewer.example.org/study/1')).toBe(true)
        registerRadiology(context as never)
        expect(isAllowedViewerUrl('https://viewer.example.org/study/1')).toBe(false)
    })
})

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

    it('refuses an address that may not be framed, loaded or listed', async () => {
        const loader = new RadiologyLoader()
        for (const address of ['javascript:alert(1)', 'https://elsewhere.example/viewer', 'data:text/html,x']) {
            expect(await loader.loadFromUrl(address, { name: 'US' })).toBeNull()
            expect(loader.createListedResource({ loader: 'rad/viewer-url', name: 'US', source: address })).toBeNull()
        }
        expect(loader.createListedResource({ loader: 'rad/viewer-url', name: 'US', source: '/viewer/a' }))
            .not.toBeNull()
    })

    it('makes no resource of a study whose address stopped being allowed', async () => {
        setAllowedViewerOrigins(['https://viewer.example.org'])
        const loader = new RadiologyLoader()
        const study = await loader.loadFromUrl('https://viewer.example.org/study/1')
        expect(study).not.toBeNull()
        const idx = await loader.useStudy(study!)
        setAllowedViewerOrigins()
        expect(await loader.getResource(idx)).toBeNull()
    })

    it('makes no resource of a study given an address past loadFromUrl', async () => {
        const loader = new RadiologyLoader()
        const study = (await loader.loadFromUrl('/viewer/a'))!
        study.files[0].url = 'javascript:alert(1)'
        expect(await loader.getResource(await loader.useStudy(study))).toBeNull()
    })

    it('holds only so many studies nobody asked the resource of', async () => {
        const loader = new RadiologyLoader()
        const first = await loader.useStudy((await loader.loadFromUrl('/viewer/first'))!)
        const indexes = [] as number[]
        for (let i = 0; i < 8; i++) {
            indexes.push(await loader.useStudy((await loader.loadFromUrl(`/viewer/${i}`))!))
        }
        expect(await loader.getResource(first)).toBeNull()
        for (const idx of indexes) {
            expect(await loader.getResource(idx)).not.toBeNull()
        }
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
