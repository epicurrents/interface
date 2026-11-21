/**
 * The way back from a radiology study: to the resource it is attached to while its dataset still holds it, and to the
 * dataset, every resource closed and the default view shown, otherwise.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import { describe, expect, it } from 'vitest'
import type { DataResource } from '@epicurrents/core/types'
import RadiologyResource from '#app/modules/rad/RadiologyResource'
import { parentOf, stepBack } from '#app/modules/rad/wayBack'

const recording = { name: 'EEG 1', modality: 'eeg' } as unknown as DataResource

/** A store whose active dataset holds `resources`, recording what is dispatched. */
const store = (resources: DataResource[]) => {
    const dispatched = [] as [string, unknown][]
    const state = { APP: { activeDataset: { resources: resources.map(resource => ({ resource })) } } }
    const dispatch = (type: string, payload: unknown) => {
        dispatched.push([type, payload])
    }
    // The helpers read only the active dataset's resources of the state.
    return { dispatch, dispatched, state: state as never }
}

const study = (parent: DataResource | null) => {
    const resource = new RadiologyResource('US', '/viewer/a')
    resource.parent = parent
    return resource
}

describe('the way back from a radiology study', () => {
    it('steps back to the resource the study is attached to', () => {
        const attached = study(recording)
        const injectee = store([recording, attached])
        expect(parentOf(injectee.state, attached)).toBe(recording)
        stepBack(injectee as never, attached)
        expect(injectee.dispatched).toEqual([['set-active-resource', recording]])
    })

    it('steps back to the dataset from a study standing on its own', () => {
        const alone = study(null)
        const injectee = store([alone])
        stepBack(injectee as never, alone)
        expect(injectee.dispatched).toEqual([['set-active-resource', null], ['set-view', 'default']])
    })

    it('treats a parent its dataset no longer holds as none', () => {
        const attached = study(recording)
        const injectee = store([attached])
        expect(parentOf(injectee.state, attached)).toBeNull()
        stepBack(injectee as never, attached)
        expect(injectee.dispatched[1]).toEqual(['set-view', 'default'])
    })

    it('forgets the parent when the study is destroyed', () => {
        const attached = study(recording)
        attached.destroy()
        expect(attached.parent).toBeNull()
    })
})
