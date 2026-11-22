/**
 * Epicurrents Interface Vuex store actions.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { nextTick } from "vue"
import { ActionContext } from "vuex"
import type { State } from "#store"
import { Log } from "scoped-event-log"
import { MixedMediaDataset } from "@epicurrents/core"
import type {
    ConnectorType,
    DataResource,
    DatasourceConnector,
    Entries,
    FileSystemItem,
} from "@epicurrents/core/types"
import { MutationTypes } from './mutations'
import { applicationViews, useContext } from '#config'
import { T } from '#i18n'
import type { ApplicationView, InterfaceComponent } from '#types/config'
import type { WebDAVClient } from 'webdav'

const SCOPE = "StoreActions"
/** Subscriber name of the listeners that follow a shown resource for a failure. */
const FAILURE_SUBSCRIBER = `${SCOPE}:failed-load`

export type ScopedResource = {
    /** Application scope for the resource. */
    scope: string
    resource: DataResource
}
export type ConnectorProperties = UrlWithCredentials & {
    /** Name of the connector displayed in the UI. */
    name: string
    /** Type of the connector. */
    type: ConnectorType
    /** Optional mapping of database column names to property names. */
    nameMap?: Record<string, string>
    /** Access mode for the connector (`r`ead, `w`rite, or `r`ead-`w`rite; default `r`). */
    mode?: 'r' | 'rw' | 'w'
    /** Optional override properties for the return StudyContext. */
    overrideProperties?: Record<string, any>
    /** Optional parameter method for database connectors. */
    paramMethod?: 'get' | 'inject' | 'post'
    /** Optional override for the WebDAV client instance. */
    wdClient?: WebDAVClient
}
export type UrlWithCredentials = {
    /** URL to the resource. */
    url: string
    /** Username for basic authentication. */
    username: string
    /** Password for basic authentication. */
    password: string
}

/**
 * Map of components and their associated styles.
 */
const COMPONENT_STYLES = new Map<string, string[]>()
/**
 * Count of requests to set the active resource. A request waits for the other resources to deactivate, and one made in
 * the meantime supersedes it, so only the latest request activates its resource.
 */
let activeResourceRequests = 0

/** Length of the crossfade between two themes, in milliseconds. */
export const THEME_CROSSFADE_MS = 600

/** The theme a view is shown in: the one chosen for it, or its default. */
const themeOf = (view: ApplicationView) => view.theme || view.defaultTheme

/**
 * Make `view` the application view: set the components it names a visibility for, and put back the visibility of
 * those the departing view had set and this one leaves alone. Every view switch goes through here, so a component
 * hidden by one view is never left hidden in another that never asked for it. A view sets a component's visibility
 * only while it is active: what the component had before is kept in the store's `visibilityBeforeView` and put back
 * on leaving, even for a view entered by opening a resource, unless the user set the component in the meantime.
 *
 * A switch that changes the theme crossfades the whole page from the old theme to the new one through the View
 * Transitions API, where the browser has it. The browser fades one image of the page as it was into the page as it
 * is, so every component changes at the same pace, nested ones, shadow roots and framed pages included; transitioning
 * the colours of each element instead runs at a different pace per component, and an instant switch between a dark
 * and a light page is harsh on the eyes. Without the API the switch is instant. The returned promise resolves once
 * the new view is in the store, which is before the fade has finished.
 * @param injectee - The store action context.
 * @param view - The view to switch to.
 */
const switchView = async (injectee: ActionContext<State, State>, view: ApplicationView) => {
    type ViewTransition = { ready: Promise<void>, updateCallbackDone: Promise<void> }
    const doc = document as Document & { startViewTransition?: (update: () => Promise<void>) => ViewTransition }
    if (themeOf(injectee.state.APP.view) === themeOf(view) || typeof doc.startViewTransition !== 'function') {
        applyView(injectee, view)
        return
    }
    const transition = doc.startViewTransition(async () => {
        applyView(injectee, view)
        await nextTick()
    })
    // The pseudo-elements live on the document, outside the shadow root the application's styles go to, so the fade
    // is set on them directly. These animations outlast the browser's own crossfade and so decide its length.
    transition.ready.then(() => {
        const timing = { duration: THEME_CROSSFADE_MS, easing: 'ease-in-out', fill: 'both' as const }
        doc.documentElement.animate(
            { opacity: [1, 0] }, { ...timing, pseudoElement: '::view-transition-old(root)' }
        )
        doc.documentElement.animate(
            { opacity: [0, 1] }, { ...timing, pseudoElement: '::view-transition-new(root)' }
        )
    }).catch(() => {
        // A transition skipped by the browser has applied the view already.
    })
    await transition.updateCallbackDone
}

/**
 * Commit `view` and the component visibility it implies; the part of a view switch that changes the store.
 * @param injectee - The store action context.
 * @param view - The view to switch to.
 */
const applyView = (injectee: ActionContext<State, State>, view: ApplicationView) => {
    const visible = injectee.state.APP.uiComponentVisible
    const setVisible = (component: InterfaceComponent, value: boolean) => {
        if (visible[component] !== value) {
            injectee.commit(MutationTypes.SET_UI_COMPONENT_VISIBLE, { component, value })
        }
    }
    // Read before any commit: setting a component drops what was held for it.
    const restore = new Map(
        Object.entries(injectee.state.APP.visibilityBeforeView) as [InterfaceComponent, boolean][]
    )
    const held = {} as Partial<Record<InterfaceComponent, boolean>>
    injectee.commit(MutationTypes.SET_VIEW, view)
    type SupportedComponents = Entries<typeof view.components>
    for (const [key, uiCmp] of Object.entries(view.components) as SupportedComponents) {
        if (uiCmp && uiCmp.visible !== null) {
            // A component the departing view had also set keeps the value from before either of them.
            held[key] = restore.get(key) ?? visible[key]
            restore.delete(key)
            setVisible(key, uiCmp.visible)
        }
    }
    for (const [key, value] of restore) {
        setVisible(key, value)
    }
    injectee.commit(MutationTypes.SET_VISIBILITY_BEFORE_VIEW, held)
}

/**
 * Deactivate every resource of the active dataset except `skip`, and wait until each has released its memory.
 * @param state - The store state.
 * @param skip - The resource to leave as it is; null deactivates every resource.
 */
const disableAllOtherResources = async (state: State, skip: DataResource | null) => {
    if (state.APP.activeDataset) {
        const managed = new Map<string, boolean>()
        const usesMemoryManager = (modality: string) => {
            if (!managed.has(modality)) {
                managed.set(
                    modality,
                    Boolean(state.SETTINGS.app.useMemoryManager
                            && useContext({ state }, modality).SETTINGS.useMemoryManager)
                )
            }
            return managed.get(modality) as boolean
        }
        // A copy, since the dataset's resources may change while a deactivation is awaited.
        for (const item of [...state.APP.activeDataset.resources]) {
            if (skip && item.resource.id === skip.id) {
                continue
            }
            // Checked before assigning, because every assignment triggers possible property update watchers.
            if (item.resource.isActive) {
                item.resource.isActive = false
            }
            if (usesMemoryManager(item.resource.modality)) {
                // Block until the resource has finished releasing AND rearranging the shared
                // buffer. `isActive = false` flips the flag synchronously but runs the actual
                // teardown in the background, so awaiting the `isActive` property event would
                // return too early — the next recording would then allocate and start caching
                // while this resource's rearrange is still moving buffer regions, corrupting
                // the new allocation. `awaitDeactivation` resolves only once the release and
                // rearrange have completed. It is awaited for a resource that is already inactive
                // too, since an earlier request may have started a deactivation that is still
                // running; it resolves at once for a resource with none.
                await item.resource.awaitDeactivation()
            }
        }
        return
    }
    /*
    for (let i=0; i<injectee.state.DOC.resources.length; i++) {
        const doc = injectee.state.DOC.resources[i]
        if (doc.isActive &&(!skip || (scope !== 'document' || doc.id !== skip.id))) {
            doc.isActive = false
        }
    }
    for (let i=0; i<injectee.state.EEG.resources.length; i++) {
        const eeg = injectee.state.EEG.resources[i]
        if (eeg.isActive && (!skip || (scope !== 'eeg' || eeg.id !== skip.id))) {
            eeg.isActive = false
        }
    }
    for (let i=0; i<injectee.state.EMG.resources.length; i++) {
        const emg = injectee.state.EMG.resources[i]
        if (emg.isActive && (!skip || (scope !== 'emg' || emg.id !== skip.id))) {
            emg.isActive = false
        }
    }
    for (let i=0; i<injectee.state.NCS.resources.length; i++) {
        const ncs = injectee.state.NCS.resources[i]
        if (ncs.isActive && (!skip || (scope !== 'ncs' || ncs.id !== skip.id))) {
            ncs.isActive = false
        }
    }
    for (let i=0; i<injectee.state.MEG.resources.length; i++) {
        const meg = injectee.state.MEG.resources[i]
        if (meg.isActive && (!skip || (scope !== 'meg' || meg.id !== skip.id))) {
            meg.isActive = false
        }
    }
    */
}

export enum ActionTypes {
    _DUMMY = '_dummy',
    ACCEPT_DISCLAIMER = 'accept-disclaimer',
    ADD_COMPONENT_STYLES = 'add-component-styles',
    ADD_CONNECTOR = 'add-connector',
    ADD_RESOURCE = 'add-resource',
    DISPLAY_CALLOUT = 'display-callout',
    DISPLAY_VIEWER = 'display-viewer',
    LOAD_DATASET_FOLDER = 'load-dataset-folder',
    LOAD_DATASET_PROGRESS = 'load-dataset-progress',
    LOAD_STUDY_FILE = 'load-study-file',
    LOAD_STUDY_FOLDER = 'load-study-folder',
    LOAD_STUDY_URL = 'load-study-url',
    OVERLAY_CLICKED = 'overlay-clicked',
    POINTER_LEFT_APP = 'pointer-left-app',
    REDO_ACTION = 'redo-action',
    REMOVE_CONNECTOR = 'remove-connector',
    SET_ACTIVE_CHILD_RESOURCE = 'set-active-child-resource',
    SET_ACTIVE_RESOURCE = 'set-active-resource',
    SET_ACTIVE_MODALITY = 'set-active-modality',
    SET_SETTINGS_VALUE = 'set-settings-value',
    SET_UI_COMPONENT_VISIBLE = 'set-ui-component-visible',
    SET_VIEW = 'set-view',
    TOGGLE_DIALOG = 'toggle-dialog',
    TOGGLE_EXPAND_VIEWER = 'toggle-expand-viewer',
    TOGGLE_FULLSCREEN = 'toggle-fullscreen',
    TOGGLE_UI_COMPONENT = 'toggle-ui-component',
    UNDO_ACTION = 'undo-action',
    // Datasets
    ADD_DATASET = 'add-dataset',
    CREATE_DATASET = 'create-dataset',
    SET_ACTIVE_DATASET = 'set-active-dataset',
}
export type Actions = {
    // TypeScript can't check the types of dynamically loaded module
    // actions, so this first one is just to avoid type check errors.
    [ActionTypes._DUMMY] (payload: any): any
    [ActionTypes.ACCEPT_DISCLAIMER] (): void
    [ActionTypes.ADD_COMPONENT_STYLES] (payload: { component?: string, styles: string | string[] }): void
    [ActionTypes.ADD_CONNECTOR] (payload: ConnectorProperties): void
    [ActionTypes.ADD_RESOURCE] (payload: ScopedResource): void
    [ActionTypes.DISPLAY_CALLOUT] (payload: { message: string, role: 'confirm' | 'error' | 'warning' }): void
    [ActionTypes.DISPLAY_VIEWER] (): void
    [ActionTypes.LOAD_DATASET_FOLDER] (payload: { folder: FileSystemItem, name?: string, context?: string }): void
    [ActionTypes.LOAD_DATASET_PROGRESS] (
        payload: { context: 'filesystem' | 'repository', loaded: number, total: number },
    ): void
    [ActionTypes.LOAD_STUDY_FILE] (payload: { loader: string, file: File, name?: string, url?: string }): void
    [ActionTypes.LOAD_STUDY_FOLDER] (
        payload: { loader: string, folder: FileSystemItem, name?: string, context?: string },
    ): void
    [ActionTypes.LOAD_STUDY_URL] (payload: { loader: string, url: string, name?: string }): void
    [ActionTypes.OVERLAY_CLICKED] (): void
    [ActionTypes.POINTER_LEFT_APP] (): void
    [ActionTypes.REDO_ACTION] (): void
    [ActionTypes.REMOVE_CONNECTOR] (payload: string): void
    [ActionTypes.SET_ACTIVE_CHILD_RESOURCE] (
        payload: { child: DataResource | null, parent: DataResource },
    ): Promise<boolean>
    [ActionTypes.SET_ACTIVE_RESOURCE] (payload: DataResource | null): Promise<boolean>
    [ActionTypes.SET_ACTIVE_MODALITY] (payload: string): void
    [ActionTypes.SET_SETTINGS_VALUE] (payload: { field: string, value: string | number | boolean }): void
    [ActionTypes.SET_UI_COMPONENT_VISIBLE] (payload: { component: InterfaceComponent, value: boolean }): void
    [ActionTypes.SET_VIEW] (payload: string): void
    [ActionTypes.TOGGLE_DIALOG] (payload: { name: string, value?: boolean }): void
    [ActionTypes.TOGGLE_EXPAND_VIEWER] (payload?: boolean): void
    [ActionTypes.TOGGLE_FULLSCREEN] (): void
    [ActionTypes.TOGGLE_UI_COMPONENT] (payload: InterfaceComponent): void
    [ActionTypes.UNDO_ACTION] (): void
    // Datasets
    [ActionTypes.ADD_DATASET] (payload?: MixedMediaDataset): void
    [ActionTypes.CREATE_DATASET] (payload?: { name: string, connector: DatasourceConnector | null }): void
    [ActionTypes.SET_ACTIVE_DATASET] (payload: MixedMediaDataset | null): void
}
/**
 * The application view for resources of `modality`, or null with an error logged if no module is registered for the
 * modality or the view its module names does not exist.
 * @param injectee - The store action context.
 * @param modality - Modality of the resource to show.
 * @param name - Name of the resource, for the error.
 */
const viewForModality = (injectee: ActionContext<State, State>, modality: string, name: string) => {
    const modView = injectee.state.INTERFACE.modules.get(modality)?.settings?.compatibleView as string | undefined
    if (!modView) {
        Log.error(`Cannot show ${name}, modality '${modality}' is not available.`, SCOPE)
        return null
    }
    const view = applicationViews.get(modView)
    if (!view) {
        Log.error(
            `Cannot show ${name}, the view '${modView}' required by modality '${modality}' is not available.`,
            SCOPE
        )
        return null
    }
    return view
}

/** Resources whose failure the store follows, so each is subscribed to once. */
const failureFollowed = new WeakSet<DataResource>()

/**
 * Follow `resource` for a failure while it is shown, from the first time it is activated or opened. A member that
 * fails is deactivated by core's runtime, and a child that fails is closed here, the parent taking its place; either
 * way the views are told through the store's mutation, which is what they follow, and the user through one callout
 * naming the resource and the reason. The resource keeps its reason, and its navigator row offers the retry.
 *
 * Whether the resource was shown is read in the `before` phase of the state change, ahead of whatever deactivates it
 * in the `after` phase, so a failure of a resource nobody was looking at, such as a preload, raises nothing.
 * @param injectee - The store action context.
 * @param resource - The resource being activated or opened.
 * @param parent - The resource `resource` is opened under as a child, or null for a dataset member.
 */
const followFailure = (injectee: ActionContext<State, State>, resource: DataResource, parent: DataResource | null) => {
    if (failureFollowed.has(resource) || resource.state === 'destroyed') {
        return
    }
    failureFollowed.add(resource)
    let wasShown = false
    resource.onPropertyChange('state', (state) => {
        if (state === 'error') {
            wasShown = parent ? parent.activeChildResource?.id === resource.id : resource.isActive
        }
    }, FAILURE_SUBSCRIBER, 'before')
    resource.onPropertyChange('state', (state) => {
        if (state !== 'error' || !wasShown) {
            return
        }
        wasShown = false
        reportFailedLoad(injectee, resource, parent)
    }, FAILURE_SUBSCRIBER)
}

/**
 * Take a failed resource out of the view and tell the user; see {@link followFailure}.
 */
const reportFailedLoad = (
    injectee: ActionContext<State, State>,
    resource: DataResource,
    parent: DataResource | null,
) => {
    if (parent) {
        // Stepping back to the parent is the child's deactivation.
        if (parent.activeChildResource?.id === resource.id) {
            parent.activeChildResource = null
            if (parent.isActive) {
                injectee.commit(MutationTypes.SET_ACTIVE_RESOURCE, parent)
            }
        }
    } else {
        // The runtime deactivates the member from the same state change, in whichever order the two listeners run,
        // so the check waits for the dispatch to finish. Nothing is committed when another resource is shown by then.
        Promise.resolve().then(() => {
            const dataset = injectee.state.APP.activeDataset
            if (
                !resource.isActive && injectee.state.APP.activeModality
                && dataset?.resources.some(ctx => ctx.resource.id === resource.id)
                && !dataset.activeResources.length
            ) {
                injectee.commit(MutationTypes.SET_ACTIVE_RESOURCE, null)
            }
        }).catch(error => {
            Log.error(`Closing the failed resource ${resource.name} failed: ${error}`, SCOPE)
        })
    }
    const reason = resource.errorReason
    injectee.dispatch(ActionTypes.DISPLAY_CALLOUT, {
        message: reason
            ? T('Loading {name} failed: {reason}', null, { name: resource.name, reason: T(reason) })
            : T('Loading {name} failed.', null, { name: resource.name }),
        role: 'error',
    })
}

/**
 * Activate `payload` in the active dataset and show the view of its active child, or of the resource itself when it
 * has none. Other resources are deactivated first, and waiting for them takes time, so the request is dropped if a
 * later one was made or another dataset became active in the meantime: the latest request is the one that is shown.
 * @param injectee - The store action context.
 * @param payload - The resource to activate, or null to close the active one.
 * @returns Null if the request was refused before anything changed. Otherwise a promise that settles once the request
 * has run its course: true if the resource was made active (or, for null, every resource closed), false if the request
 * was superseded or failed. It never rejects.
 */
const activateResource = (
    injectee: ActionContext<State, State>,
    payload: DataResource | null,
): Promise<boolean> | null => {
    // The resource is activated in the dataset active now, so a switch to another one supersedes the request as a
    // newer request does.
    const dataset = injectee.state.APP.activeDataset
    // The view is resolved before anything changes, so a resource that cannot be shown leaves the one shown now as it
    // is. It follows the modality of the resource's active child when it has one.
    let view = null as ApplicationView | null
    if (payload) {
        const shown = payload.activeChildResource || payload
        view = viewForModality(injectee, shown.modality, shown.name)
        if (!view) {
            return null
        }
    }
    const request = ++activeResourceRequests
    const isLatest = () => request === activeResourceRequests && dataset === injectee.state.APP.activeDataset
    // Disable other resources before enabling the new one (to avoid race conditions in shared memory buffer ops).
    return disableAllOtherResources(injectee.state, payload).then(async () => {
        if (!isLatest()) {
            return false
        }
        if (view && injectee.state.APP.view.name !== view.name) {
            await switchView(injectee, view)
            if (!isLatest()) {
                return false
            }
        }
        // Followed before the commit, which is where the runtime loads the resource or retries a failed one.
        if (payload) {
            followFailure(injectee, payload, null)
        }
        injectee.commit(MutationTypes.SET_ACTIVE_RESOURCE, payload)
        return true
    }).catch(error => {
        Log.error(`Activating ${payload?.name ?? 'no resource'} failed: ${error}`, SCOPE)
        if (!isLatest()) {
            return false
        }
        // Other resources may have been deactivated already, so nothing is left open rather than a view left showing
        // a resource that is no longer active.
        try {
            injectee.commit(MutationTypes.SET_ACTIVE_RESOURCE, null)
        } catch (closeError) {
            Log.error(`Closing the active resource failed: ${closeError}`, SCOPE)
        }
        return false
    })
}

export const actions = {
    [ActionTypes.ACCEPT_DISCLAIMER] (injectee: ActionContext<State, State>) {
        injectee.commit(MutationTypes.ACCEPT_DISCLAIMER)
    },
    [ActionTypes.ADD_COMPONENT_STYLES] (
        injectee: ActionContext<State, State>,
        payload: { component?: string, styles: string | string[] }
    ) {
        const styles = Array.isArray(payload.styles) ? payload.styles : [payload.styles as string]
        const newStyles = [] as string[]
        const existing = COMPONENT_STYLES.get(payload.component || 'unknown')
        if (!existing) {
                COMPONENT_STYLES.set(payload.component || 'unknown', styles)
                newStyles.push(...styles)
        } else {
            for (const style of styles) {
                if (!existing.includes(style)) {
                    existing.push(style)
                    newStyles.push(style)
                }
            }
        }
        // Add any new styles.
        injectee.commit(MutationTypes.ADD_STYLES, { component: payload.component || 'unknown', styles: styles })
    },
    [ActionTypes.ADD_CONNECTOR] (injectee: ActionContext<State, State>, payload: ConnectorProperties) {
        injectee.commit(MutationTypes.ADD_CONNECTOR, payload)
    },
    [ActionTypes.ADD_RESOURCE] (injectee: ActionContext<State, State>, payload: ScopedResource) {
        injectee.commit(MutationTypes.ADD_RESOURCE, payload)
    },
    [ActionTypes.DISPLAY_CALLOUT] (
        _injectee: ActionContext<State, State>,
        _payload: { message: string, role: 'confirm' | 'error' | 'warning' }
    ) {
        // Broadcast.
    },
    [ActionTypes.DISPLAY_VIEWER] () {
        // Broadcast.
    },
    [ActionTypes.LOAD_DATASET_FOLDER] (
        injectee: ActionContext<State, State>,
        payload: { folder: FileSystemItem, name?: string, context?: string }
    ) {
        injectee.commit(MutationTypes.LOAD_DATASET_FOLDER, payload)
    },
    [ActionTypes.LOAD_DATASET_PROGRESS] (
        _injectee: ActionContext<State, State>,
        _payload: { context: 'filesystem' | 'repository', loaded: number, total: number }
    ) {
        // Broadcast.
    },
    [ActionTypes.LOAD_STUDY_FILE] (
        injectee: ActionContext<State, State>,
        payload: { file: File, loader: string, name?: string, url?: string }
    ) {
        let promiseResolve, promiseReject
        const promise = new Promise((resolve, reject) => {
            // This promise is resolved when the study file has loaded
            promiseResolve = resolve
            promiseReject = reject
        })
        injectee.commit(MutationTypes.LOAD_STUDY_FILE, {
            study: payload,
            promise: { resolve: promiseResolve, reject: promiseReject },
        })
        return promise
    },
    [ActionTypes.LOAD_STUDY_FOLDER] (
        injectee: ActionContext<State, State>,
        payload: { folder: FileSystemItem, loader: string, name?: string, context?: string }
    ) {
        let promiseResolve, promiseReject
        const promise = new Promise((resolve, reject) => {
            // This promise is resolved when the study folder has loaded
            promiseResolve = resolve
            promiseReject = reject
        })
        injectee.commit(MutationTypes.LOAD_STUDY_FOLDER, {
            study: payload,
            promise: { resolve: promiseResolve, reject: promiseReject },
        })
        return promise
    },
    [ActionTypes.LOAD_STUDY_URL] (
        injectee: ActionContext<State, State>,
        payload: { loader: string, url: string, name?: string }
    ) {
        let promiseResolve, promiseReject
        const promise = new Promise((resolve, reject) => {
            promiseResolve = resolve
            promiseReject = reject
        })
        injectee.commit(MutationTypes.LOAD_STUDY_URL, {
            study: payload,
            promise: { resolve: promiseResolve, reject: promiseReject },
        })
        return promise
    },
    [ActionTypes.OVERLAY_CLICKED] (injectee: ActionContext<State, State>) {
        injectee.commit(MutationTypes.HIDE_OVERLAY)
    },
    [ActionTypes.POINTER_LEFT_APP] (injectee: ActionContext<State, State>) {
        injectee.commit(MutationTypes.HIDE_OVERLAY)
    },
    [ActionTypes.REDO_ACTION] () {
        // Broadcast that a redo action has been performed.
    },
    [ActionTypes.REMOVE_CONNECTOR] (injectee: ActionContext<State, State>, payload: string) {
        injectee.commit(MutationTypes.REMOVE_CONNECTOR, payload)
    },
    [ActionTypes.SET_ACTIVE_MODALITY] (injectee: ActionContext<State, State>, payload: string) {
        injectee.commit(MutationTypes.SET_ACTIVE_MODALITY, payload)
    },
    [ActionTypes.SET_ACTIVE_CHILD_RESOURCE] (
        injectee: ActionContext<State, State>,
        payload: { child: DataResource | null, parent: DataResource },
    ) {
        // The action resolves as SET_ACTIVE_RESOURCE does, with the outcome of activating the parent; a child still
        // loading in place does not hold it back.
        const { parent } = payload
        if (parent.state === 'destroyed') {
            Log.error(`Cannot open a child of ${parent.name}, the resource has been destroyed.`, SCOPE)
            return Promise.resolve(false)
        }
        if (!injectee.state.APP.activeDataset?.resources.some(ctx => ctx.resource.id === parent.id)) {
            Log.error(`Cannot open a child of ${parent.name}, the resource is not in the active dataset.`, SCOPE)
            return Promise.resolve(false)
        }
        const child = payload.child
                      ? parent.childResources.find(r => r.id === payload.child!.id) ?? null
                      : null
        if (payload.child && !child) {
            Log.error(`Cannot open ${payload.child.name}, it is not a child of ${parent.name}.`, SCOPE)
            return Promise.resolve(false)
        }
        // A child that cannot be shown is refused before it becomes the active child: a parent left holding one
        // would hand it to every view as the resource to show.
        if (child && !viewForModality(injectee, child.modality, child.name)) {
            return Promise.resolve(false)
        }
        const previous = parent.activeChildResource
        if (previous?.id !== child?.id) {
            parent.activeChildResource = child
        }
        // The parent is activated behind its child, so the child is opened in its context and the way back to the
        // parent is instant.
        const activation = activateResource(injectee, parent)
        if (!activation) {
            if (parent.activeChildResource?.id !== previous?.id) {
                parent.activeChildResource = previous
            }
            return Promise.resolve(false)
        }
        // A listed child loads in place as it opens, and its view shows the loading state until it is ready. One whose
        // load failed is retried. Core has no activation for a child, so a failure is followed here: the child is
        // closed, the parent shown in its place, and the child's row keeps the reason and the retry.
        if (child) {
            followFailure(injectee, child, parent)
        }
        const retried = child?.state === 'error' && child.canRetryLoad
        if (child && (retried || child.state === 'added' || child.state === 'loaded')) {
            (retried ? child.retryLoad() : child.load()).then(loaded => {
                if (!loaded) {
                    Log.error(`Loading the child resource ${child.name} failed.`, SCOPE)
                }
            }).catch(error => {
                Log.error(`Loading the child resource ${child.name} failed: ${error}`, SCOPE)
            })
        }
        return activation
    },
    /**
     * Activate `payload` in the active dataset, or close every resource with null. The returned promise settles once
     * the request has run its course, the deactivation of the other resources included, so a caller that has to act
     * after a close awaits the dispatch. It resolves true if the request went through and false if it was refused,
     * superseded by a later request or failed; it never rejects.
     */
    [ActionTypes.SET_ACTIVE_RESOURCE] (injectee: ActionContext<State, State>, payload: DataResource | null) {
        if (!payload) {
            // Closing closes the open child with its parent, so the parent shows itself when it is next opened.
            for (const ctx of injectee.state.APP.activeDataset?.resources ?? []) {
                if (ctx.resource.isActive && ctx.resource.activeChildResource) {
                    ctx.resource.activeChildResource = null
                }
            }
            return activateResource(injectee, payload) ?? Promise.resolve(false)
        }
        // Activating a resource shows the resource itself; a child of it opens through SET_ACTIVE_CHILD_RESOURCE.
        // The child is put back if the resource cannot be shown, so the one shown now stays as it is.
        const child = payload.activeChildResource
        if (child) {
            payload.activeChildResource = null
        }
        const activation = activateResource(injectee, payload)
        if (!activation && child) {
            payload.activeChildResource = child
        }
        return activation ?? Promise.resolve(false)
    },
    [ActionTypes.SET_SETTINGS_VALUE] (
        injectee: ActionContext<State, State>,
        payload: { field: string, value: string | number | boolean }
    ) {
        injectee.commit(MutationTypes.SET_SETTINGS_VALUE, payload)
    },
    [ActionTypes.SET_UI_COMPONENT_VISIBLE] (
        injectee: ActionContext<State, State>,
        payload: { component: InterfaceComponent, value: boolean }
    ) {
        if (!Object.hasOwn(injectee.state.APP.uiComponentVisible, payload.component)) {
            Log.error(`Cannot set UI component '${payload.component}' visibility.`, SCOPE)
            return
        }
        injectee.commit(MutationTypes.SET_UI_COMPONENT_VISIBLE, payload)
    },
    [ActionTypes.SET_VIEW] (injectee: ActionContext<State, State>, payload: string) {
        const view = applicationViews.get(payload)
        if (!view) {
            Log.error(`Cannot set application view to invalid value '${payload}'.`, SCOPE)
            return
        }
        if (injectee.state.APP.view.name === view.name) {
            Log.debug(`Application view '${view.name}' is already active.`, SCOPE)
            return
        }
        return switchView(injectee, view)
    },
    [ActionTypes.TOGGLE_DIALOG] (_injectee: ActionContext<State, State>, _payload: { name: string, value?: boolean }) {
        // Broadcast.
    },
    [ActionTypes.TOGGLE_EXPAND_VIEWER] (injectee: ActionContext<State, State>, payload?: boolean) {
        injectee.commit(MutationTypes.TOGGLE_EXPAND_VIEWER, payload)
    },
    [ActionTypes.TOGGLE_FULLSCREEN] (injectee: ActionContext<State, State>) {
        const appCont = document.querySelector(`#epicurrents${injectee.state.APP.containerId}`) as HTMLDivElement | null
        if (document.fullscreenElement !== null) {
            document.exitFullscreen()
            if (document.fullscreenElement === appCont) {
                return // Don't re-request fullscreen
            }
        }
        appCont?.requestFullscreen()
    },
    [ActionTypes.TOGGLE_UI_COMPONENT] (injectee: ActionContext<State, State>, payload: InterfaceComponent) {
        if (!Object.hasOwn(injectee.state.APP.uiComponentVisible, payload)) {
            Log.error(`Cannot toggle UI component '${payload}'.`, SCOPE)
            return
        }
        injectee.commit(
            MutationTypes.SET_UI_COMPONENT_VISIBLE,
            {
                component: payload,
                value: !injectee.state.APP.uiComponentVisible[payload],
            }
        )
    },
    [ActionTypes.UNDO_ACTION] () {
        // Broadcast that an undo action has been performed.
    },
    // Datasets
    [ActionTypes.ADD_DATASET] (injectee: ActionContext<State, State>, payload?: MixedMediaDataset) {
        if (!payload) {
            payload = new MixedMediaDataset(
                `Dataset ${injectee.state.APP.datasets.length + 1}`
            )
        }
        injectee.commit(MutationTypes.ADD_DATASET, payload)
    },
    [ActionTypes.CREATE_DATASET] (
        _injectee: ActionContext<State, State>,
        _payload?: { name: string, connector: DatasourceConnector | null }
    ) {
        // Broadcast.
        null
    },
    [ActionTypes.SET_ACTIVE_DATASET] (
        injectee: ActionContext<State, State>,
        payload: MixedMediaDataset | number | null
    ) {
        if (payload === null) {
            injectee.commit(MutationTypes.SET_ACTIVE_DATASET, payload)
        } else if (typeof payload === 'number') {
            if (injectee.state.APP.datasets[payload]) {
                injectee.commit(MutationTypes.SET_ACTIVE_DATASET, injectee.state.APP.datasets[payload])
            } else {
                Log.error(`Cannot set active dataset, array index ${payload} is out of bounds.`, SCOPE)
            }
        } else {
            injectee.commit(MutationTypes.SET_ACTIVE_DATASET, payload)
        }
    },
}
