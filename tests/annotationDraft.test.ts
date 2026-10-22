/**
 * The annotation editor's draft: kept on closing unsaved, restored for the same annotation, dropped otherwise.
 */

import { afterEach, describe, expect, it } from 'vitest'
import {
    clearAnnotationDraft,
    keepAnnotationDraft,
    takeAnnotationDraft,
} from '#app/views/biosignal/annotationDraft'

const STORED = { class: 'event', codes: {}, label: '' }
const EDITED = { class: 'technical', codes: { hed: '(Spike, Sensor-list/F7)' }, label: 'Note' }

afterEach(() => {
    clearAnnotationDraft()
})

describe('annotation draft', () => {
    it('is restored for the annotation it was kept for, as often as it is asked', () => {
        keepAnnotationDraft('a', EDITED, STORED)
        expect(takeAnnotationDraft('a')).toEqual(EDITED)
        expect(takeAnnotationDraft('a')).toEqual(EDITED)
    })

    it('is dropped by opening another annotation', () => {
        keepAnnotationDraft('a', EDITED, STORED)
        expect(takeAnnotationDraft('b')).toBeNull()
        expect(takeAnnotationDraft('a')).toBeNull()
    })

    it('is not kept when nothing was changed, and a later unchanged close drops it', () => {
        keepAnnotationDraft('a', { ...STORED, codes: {} }, STORED)
        expect(takeAnnotationDraft('a')).toBeNull()
        keepAnnotationDraft('a', EDITED, STORED)
        keepAnnotationDraft('a', STORED, STORED)
        expect(takeAnnotationDraft('a')).toBeNull()
    })

    it('holds a copy, so later edits to the editor state do not reach it', () => {
        const edited = { ...EDITED, codes: { ...EDITED.codes } }
        keepAnnotationDraft('a', edited, STORED)
        edited.codes.hed = 'Spike'
        expect(takeAnnotationDraft('a')?.codes.hed).toBe(EDITED.codes.hed)
    })
})
