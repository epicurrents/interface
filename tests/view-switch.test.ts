/**
 * Switching the application view: a view that sets a component's visibility sets it on entry, whether the view is
 * chosen directly or entered by opening a resource, and leaving it puts back what the component had before.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { describe, expect, it } from 'vitest'
import { actions, ActionTypes } from '#store/actions'
import { MutationTypes } from '#store/mutations'
import { applicationViews } from '#config'

/** A store context whose commits change its state, starting in the biosignal view with every component shown. */
const store = () => {
    const state = {
        APP: {
            uiComponentVisible: { controls: true, footer: true, navigator: true } as Record<string, boolean>,
            view: applicationViews.get('biosignal'),
        },
    }
    const commit = (type: string, payload: unknown) => {
        if (type === MutationTypes.SET_VIEW) {
            state.APP.view = payload as typeof state.APP.view
        } else if (type === MutationTypes.SET_UI_COMPONENT_VISIBLE) {
            const { component, value } = payload as { component: string, value: boolean }
            state.APP.uiComponentVisible[component] = value
        }
    }
    return { commit, dispatch: () => undefined, state }
}

const setView = (injectee: ReturnType<typeof store>, view: string) => {
    ;(actions[ActionTypes.SET_VIEW] as (i: unknown, p: unknown) => void)(injectee, view)
}

describe('switching the view', () => {
    it('hides the navigator in the radiology view and shows it again on leaving', () => {
        const injectee = store()
        setView(injectee, 'radiology')
        expect(injectee.state.APP.uiComponentVisible.navigator).toBe(false)
        setView(injectee, 'biosignal')
        expect(injectee.state.APP.uiComponentVisible.navigator).toBe(true)
    })

    it('puts back a navigator the user had hidden before entering', () => {
        const injectee = store()
        injectee.state.APP.uiComponentVisible.navigator = false
        setView(injectee, 'radiology')
        setView(injectee, 'media')
        expect(injectee.state.APP.uiComponentVisible.navigator).toBe(false)
        setView(injectee, 'biosignal')
    })

    it('leaves alone a component no view sets', () => {
        const injectee = store()
        setView(injectee, 'radiology')
        setView(injectee, 'biosignal')
        expect(injectee.state.APP.uiComponentVisible.controls).toBe(true)
        expect(injectee.state.APP.uiComponentVisible.footer).toBe(true)
    })
})

describe('setting a component visible', () => {
    it('shows the component it names', () => {
        const injectee = store()
        injectee.state.APP.uiComponentVisible.navigator = false
        ;(actions[ActionTypes.SET_UI_COMPONENT_VISIBLE] as (i: unknown, p: unknown) => void)(
            injectee, { component: 'navigator', value: true }
        )
        expect(injectee.state.APP.uiComponentVisible.navigator).toBe(true)
    })
})
