/**
 * The way back from a radiology study, step by step: the dataset, then the resource the study is listed under, if it
 * is a child of one. The radiology footer shows the steps as a trail, and the framed page's Back button takes the nearest one.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { DataResource } from '@epicurrents/core/types'
import type { Store } from 'vuex'
import type { State } from '#store'
import type RadiologyResource from './RadiologyResource'

/**
 * The resource of the active dataset `study` is listed under as a child; null for a study that is a member of the
 * dataset itself.
 * @param state - The application store state.
 * @param study - The radiology study.
 */
export const parentOf = (state: State, study: RadiologyResource | null | undefined): DataResource | null => {
    if (!study) {
        return null
    }
    return state.APP.activeDataset?.resources?.find(
        (ctx: { resource: DataResource }) => ctx.resource.childResources.some(child => child.id === study.id)
    )?.resource ?? null
}

/**
 * Close every resource and return to the default view, which lists the dataset.
 * @param store - The application store.
 */
export const showDataset = (store: Store<State>) => {
    store.dispatch('set-active-resource', null)
    store.dispatch('set-view', 'default')
}

/**
 * Take the nearest step back from `study`: its parent when it has one, the dataset otherwise.
 * @param store - The application store.
 * @param study - The radiology study the user is leaving.
 */
export const stepBack = (store: Store<State>, study: RadiologyResource | null | undefined) => {
    const parent = parentOf(store.state, study)
    if (parent) {
        store.dispatch('set-active-child-resource', { child: null, parent })
    } else {
        showDataset(store)
    }
}
