/**
 * Switching the application view: a view that sets a component's visibility sets it on entry, whether the view is
 * chosen directly or entered by opening a resource, and leaving it puts back what the component had before, unless
 * the user set the component while the view was active. What a view holds to put back is kept in the store's state,
 * so each store keeps its own.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { describe, expect, it } from 'vitest'
import { actions, ActionTypes } from '#store/actions'
import { mutations } from '#store/mutations'
import { applicationViews } from '#config'

/**
 * A store context whose commits run the store's own mutations on its state, starting in the biosignal view with every
 * component shown.
 */
const store = () => {
    const state = {
        APP: {
            uiComponentVisible: { controls: true, footer: true, navigator: true } as Record<string, boolean>,
            view: applicationViews.get('biosignal'),
            visibilityBeforeView: {} as Record<string, boolean>,
        },
    }
    const commit = (type: string, payload: unknown) => {
        (mutations as unknown as Record<string, (s: unknown, p: unknown) => void>)[type](state, payload)
    }
    return { commit, dispatch: () => undefined, state }
}

const act = (type: ActionTypes, injectee: ReturnType<typeof store>, payload: unknown) => {
    (actions[type as keyof typeof actions] as (i: unknown, p: unknown) => void)(injectee, payload)
}

const setView = (injectee: ReturnType<typeof store>, view: string) => {
    act(ActionTypes.SET_VIEW, injectee, view)
}

describe('switching the view', () => {
    it('hides the navigator in the radiology view and shows it again on leaving', () => {
        const injectee = store()
        setView(injectee, 'radiology')
        expect(injectee.state.APP.uiComponentVisible.navigator).toBe(false)
        setView(injectee, 'biosignal')
        expect(injectee.state.APP.uiComponentVisible.navigator).toBe(true)
        expect(injectee.state.APP.visibilityBeforeView).toEqual({})
    })

    it('puts back a navigator the user had hidden before entering', () => {
        const injectee = store()
        injectee.state.APP.uiComponentVisible.navigator = false
        setView(injectee, 'radiology')
        setView(injectee, 'media')
        expect(injectee.state.APP.uiComponentVisible.navigator).toBe(false)
    })

    it('leaves alone a component no view sets', () => {
        const injectee = store()
        setView(injectee, 'radiology')
        setView(injectee, 'biosignal')
        expect(injectee.state.APP.uiComponentVisible.controls).toBe(true)
        expect(injectee.state.APP.uiComponentVisible.footer).toBe(true)
    })

    it('keeps a navigator the user showed inside the view, although it was hidden before entering', () => {
        const injectee = store()
        injectee.state.APP.uiComponentVisible.navigator = false
        setView(injectee, 'radiology')
        act(ActionTypes.TOGGLE_UI_COMPONENT, injectee, 'navigator')
        expect(injectee.state.APP.uiComponentVisible.navigator).toBe(true)
        setView(injectee, 'biosignal')
        expect(injectee.state.APP.uiComponentVisible.navigator).toBe(true)
    })

    it('keeps a navigator the user set inside the view through the visibility action', () => {
        const injectee = store()
        setView(injectee, 'radiology')
        act(ActionTypes.SET_UI_COMPONENT_VISIBLE, injectee, { component: 'navigator', value: false })
        setView(injectee, 'biosignal')
        expect(injectee.state.APP.uiComponentVisible.navigator).toBe(false)
    })

    it('holds what to put back per store', () => {
        const entered = store()
        const other = store()
        other.state.APP.uiComponentVisible.navigator = false
        setView(entered, 'radiology')
        // Another store that leaves a view it never entered puts nothing back from the first.
        setView(other, 'media')
        expect(other.state.APP.uiComponentVisible.navigator).toBe(false)
        setView(entered, 'biosignal')
        expect(entered.state.APP.uiComponentVisible.navigator).toBe(true)
    })
})

describe('setting a component visible', () => {
    it('shows the component it names', () => {
        const injectee = store()
        injectee.state.APP.uiComponentVisible.navigator = false
        act(ActionTypes.SET_UI_COMPONENT_VISIBLE, injectee, { component: 'navigator', value: true })
        expect(injectee.state.APP.uiComponentVisible.navigator).toBe(true)
    })
})
