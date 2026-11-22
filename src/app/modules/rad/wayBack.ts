/**
 * The way back from a radiology study, step by step: the dataset, then the resource the study is listed under, if it
 * is a child of one. The radiology footer shows the steps as a trail, and the framed page's Back button takes the nearest one.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { DataResource } from '@epicurrents/core/types'
import type { Store } from 'vuex'
import { applicationViews } from '#config'
import type { State } from '#store'
import type RadiologyResource from './RadiologyResource'
import { RADIOLOGY_MODALITY, RADIOLOGY_RETURN_MESSAGE } from './RadiologyResource'
import { resolveViewerUrl } from './viewerUrl'

/** Name of the application view that frames a radiology study. */
export const RADIOLOGY_VIEW = 'radiology'

/** The view the dataset step returns to when it is available. */
const DATASET_VIEW = 'default'

type ResourceContext = { resource: DataResource }

/**
 * The radiology study shown in the active dataset: an active member, or the open child of an active member.
 * @param state - The application store state.
 */
export const activeStudy = (state: State): RadiologyResource | null => {
    const active = (state.APP.activeDataset?.activeResources ?? []) as DataResource[]
    const study = active.find(resource => resource.modality === RADIOLOGY_MODALITY) as RadiologyResource | undefined
    return study?.viewerUrl ? study : null
}

/**
 * Whether the active dataset still holds `study`, as a member or as a child of one, and the study has not been
 * destroyed. A study it does not hold has nothing to go back to and nothing to show.
 * @param state - The application store state.
 * @param study - The radiology study.
 */
export const datasetHolds = (state: State, study: RadiologyResource | null | undefined) => {
    if (!study || study.state === 'destroyed' || !study.viewerUrl) {
        return false
    }
    const resources = (state.APP.activeDataset?.resources ?? []) as ReadonlyArray<ResourceContext>
    return resources.some(
        ctx => ctx.resource.id === study.id || ctx.resource.childResources.some(child => child.id === study.id)
    )
}

/**
 * Whether a message posted to the application window is a request to go back that the radiology view honours: sent
 * by the window of its own frame, from the origin of the page the frame was pointed at, while the radiology view is
 * the one shown and `study` is still the study shown in the active dataset. The view stays mounted and hidden behind
 * the other views, so a request that arrives late would otherwise close what the user has moved on to.
 * @param event - The message, of which the data, the origin and the source are read.
 * @param frame - The window of the view's frame, or null when it has none.
 * @param state - The application store state.
 * @param study - The radiology study the frame shows.
 */
export const isReturnRequest = (
    event: Pick<MessageEvent, 'data' | 'origin' | 'source'>,
    frame: Window | null | undefined,
    state: State,
    study: RadiologyResource | null | undefined,
) => {
    if (!frame || event.source !== frame || !study) {
        return false
    }
    if ((event.data as { type?: string } | null)?.type !== RADIOLOGY_RETURN_MESSAGE) {
        return false
    }
    const page = resolveViewerUrl(study.viewerUrl)
    if (!page || event.origin !== page.origin) {
        return false
    }
    if (state.APP.view?.name !== RADIOLOGY_VIEW) {
        return false
    }
    return datasetHolds(state, study) && activeStudy(state)?.id === study.id
}

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
 * The view that lists the dataset: the default view, or where no view of that name is registered the first
 * registered view other than the radiology view, so the step always leads somewhere.
 * @param views - Names of the registered views, in their order.
 */
export const datasetView = (views: Iterable<string> = applicationViews.keys()) => {
    const names = [...views]
    if (names.includes(DATASET_VIEW)) {
        return DATASET_VIEW
    }
    return names.find(name => name !== RADIOLOGY_VIEW) ?? null
}

/**
 * Close every resource and then show the view that lists the dataset. The view is switched only once the action
 * that closes the resources has settled, so the two never run unordered.
 * @param store - The application store.
 * @param views - Names of the registered views; the application's own by default.
 */
export const showDataset = async (store: Store<State>, views?: Iterable<string>) => {
    await store.dispatch('set-active-resource', null)
    const view = datasetView(views)
    if (view) {
        await store.dispatch('set-view', view)
    }
}

/**
 * Take the nearest step back from `study`: its parent when it has one, the dataset otherwise.
 * @param store - The application store.
 * @param study - The radiology study the user is leaving.
 */
export const stepBack = async (store: Store<State>, study: RadiologyResource | null | undefined) => {
    const parent = parentOf(store.state, study)
    if (parent) {
        await store.dispatch('set-active-child-resource', { child: null, parent })
    } else {
        await showDataset(store)
    }
}
