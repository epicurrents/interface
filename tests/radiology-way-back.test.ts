/**
 * The way back from a radiology study: to the resource it is listed under while the dataset holds it, and to the
 * dataset, every resource closed and the default view shown, otherwise.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import { describe, expect, it } from 'vitest'
import type { DataResource } from '@epicurrents/core/types'
import RadiologyResource from '#app/modules/rad/RadiologyResource'
import { parentOf, stepBack } from '#app/modules/rad/wayBack'

/** A dataset member with `children` listed under it. */
const member = (name: string, children: DataResource[] = []) =>
    ({ childResources: children, name, modality: 'eeg' }) as unknown as DataResource

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

const study = () => new RadiologyResource('US', '/viewer/a')

describe('the way back from a radiology study', () => {
    it('steps back to the resource the study is listed under', () => {
        const attached = study()
        const recording = member('EEG 1', [attached])
        const injectee = store([recording])
        expect(parentOf(injectee.state, attached)).toBe(recording)
        stepBack(injectee as never, attached)
        expect(injectee.dispatched).toEqual([['set-active-child-resource', { child: null, parent: recording }]])
    })

    it('steps back to the dataset from a study that is a dataset member', () => {
        const alone = study()
        const injectee = store([member('EEG 1'), alone])
        expect(parentOf(injectee.state, alone)).toBeNull()
        stepBack(injectee as never, alone)
        expect(injectee.dispatched).toEqual([['set-active-resource', null], ['set-view', 'default']])
    })

    it('treats a parent the dataset no longer holds as none', () => {
        const attached = study()
        const injectee = store([member('EEG 2')])
        expect(parentOf(injectee.state, attached)).toBeNull()
        stepBack(injectee as never, attached)
        expect(injectee.dispatched[1]).toEqual(['set-view', 'default'])
    })
})
