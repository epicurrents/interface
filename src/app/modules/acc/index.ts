/**
 * Epicurrents Interface Vuex store ACC module. Owns the interface-side state
 * for accelerometry recordings: actions, settings, lifecycle hooks, and the
 * Vue component getters that the runtime resolves via the resource's modality.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { type ActionContext } from "vuex"
import type { Modify } from "@epicurrents/core/types"
import { EpiCStore, type InterfaceResourceModule, type State } from "#store"
import { loadAsyncComponent } from "#util"
import { Log } from "scoped-event-log"
import { useContext } from '#config'
import { schemas, settings } from './config'
import type { AccInterfaceSettings, AccModuleConfiguration, AccModuleSettings, AccResource } from './types'

const SCOPE = "vue-interface-acc-module"

enum AccActionTypes {
    AUDIO_REWIND = 'acc.audio-rewind',
    AUDIO_TOGGLE = 'acc.audio-toggle',
    SET_ACTIVE_MONTAGE = 'acc.set-active-montage',
    SET_CURSOR_TOOL = 'acc.set-cursor-tool',
    SET_HIGHPASS_FILTER = 'acc.set-highpass-filter',
    SET_LOWPASS_FILTER = 'acc.set-lowpass-filter',
    SET_NOTCH_FILTER = 'acc.set-notch-filter',
    SET_OPEN_SIDEBAR = 'acc.set-open-sidebar',
    SET_SENSITIVITY = 'acc.set-sensitivity',
    SET_TIMEBASE = 'acc.set-timebase',
    TOGGLE_ANNOTATION_SIDEBAR = 'acc.toggle-annotation-sidebar',
    VIDEO_TOGGLE = 'acc.video-toggle',
}

export const actions = {
    [AccActionTypes.AUDIO_REWIND] (_injectee: ActionContext<State, State>, _payload: null) {
        // Broadcast only; handled by AccViewer.
    },
    [AccActionTypes.AUDIO_TOGGLE] (_injectee: ActionContext<State, State>, _payload: null) {
        // Broadcast only; handled by AccViewer.
    },
    [AccActionTypes.SET_ACTIVE_MONTAGE] (_injectee: ActionContext<State, State>, payload: number | string | null) {
        runtime.setPropertyValue('active-montage', payload)
    },
    [AccActionTypes.SET_CURSOR_TOOL] (_injectee: ActionContext<State, State>, payload: string | null) {
        runtime.cursorToolActive = payload
    },
    [AccActionTypes.SET_HIGHPASS_FILTER] (_injectee: ActionContext<State, State>, payload: number | null) {
        runtime.setPropertyValue('highpass-filter', payload)
    },
    [AccActionTypes.SET_LOWPASS_FILTER] (_injectee: ActionContext<State, State>, payload: number | null) {
        runtime.setPropertyValue('lowpass-filter', payload)
    },
    [AccActionTypes.SET_NOTCH_FILTER] (_injectee: ActionContext<State, State>, payload: number | null) {
        runtime.setPropertyValue('notch-filter', payload)
    },
    [AccActionTypes.SET_OPEN_SIDEBAR] (_injectee: ActionContext<State, State>, payload: string) {
        runtime.openSidebar = payload
    },
    [AccActionTypes.SET_SENSITIVITY] (_injectee: ActionContext<State, State>, payload: number) {
        runtime.setPropertyValue('sensitivity', payload)
    },
    [AccActionTypes.SET_TIMEBASE] (_injectee: ActionContext<State, State>, payload: [string, number]) {
        runtime.setPropertyValue('timebase-unit', payload[0])
        runtime.setPropertyValue('timebase', payload[1])
    },
    [AccActionTypes.TOGGLE_ANNOTATION_SIDEBAR] (_injectee: ActionContext<State, State>, _payload: boolean | undefined) {
        // Broadcast only.
    },
    [AccActionTypes.VIDEO_TOGGLE] (_injectee: ActionContext<State, State>, payload: boolean | null) {
        // Flip when no explicit target is given; AccViewer reacts to show/hide
        // the video panel and AccControls reads the flag for the toggle state.
        runtime.videoVisible = typeof payload === 'boolean' ? payload : !runtime.videoVisible
    },
}

export const mutations = {}

export const runtime = {
    __proto__: null,
    moduleName: {
        code: 'acc',
        full: 'Accelerometry',
        short: 'ACC',
    },
    cursorToolActive: null as string | null,
    openSidebar: null as string | null,
    videoVisible: false,
    async applyConfiguration (config: AccModuleConfiguration) {
        if (config.moduleName?.full) {
            runtime.moduleName.full = config.moduleName.full
        }
        if (config.moduleName?.short) {
            runtime.moduleName.short = config.moduleName.short
        }
        // `extraMontages`, `cascadeMontages`, `extraSetups`: when the ACC module
        // grows a montage story, mirror the EEG handler here. For now the
        // default ACC setup with magnitude derivations is the only path.
    },
    getControlsComponent: () => {
        return loadAsyncComponent(() => import('./components/AccControls.vue'))
    },
    getFooterComponent: () => {
        return loadAsyncComponent(() => import('#app/footers/DefaultFooter.vue'))
    },
    getViewerComponent: () => {
        return loadAsyncComponent(() => import('./components/AccViewer.vue'))
    },
    resourceLifecycleHooks: {
        beforeDestroy (_resource: AccResource) {
            // Reserved.
        },
        created (_resource: AccResource) {
            // ACC has no `extraSetups` / `extraMontages` story yet — the
            // default setup is built in `AccRecording._applyDefaultSetups`
            // before this hook fires.
        },
        destroyed (_resource: AccResource) {
            // Reserved.
        },
    },
    /** Overridden by the runtime when the module is registered. */
    setPropertyValue (_property, _value) {
        Log.warn(`setPropertyValue method in 'acc' has not been overridden, state will not be altered.`, SCOPE)
    },
} as InterfaceResourceModule & {
    cursorToolActive: string | null
    openSidebar: string | null
    videoVisible: boolean
}

/** Re-exports from config so consumers can `import { settings } from '#app/modules/acc'`. */
export { schemas, settings }

/**
 * Get scoped component properties for the ACC scope.
 */
export const useAccContext = (store: EpiCStore, component?: string) => {
    const scopeProps = useContext(store, 'acc', component)
    const typifiedProps = scopeProps as unknown as Modify<typeof scopeProps, {
        SETTINGS: typeof scopeProps['SETTINGS'] & AccModuleSettings & AccInterfaceSettings
    }>
    return {
        RESOURCE: store.getters.getActiveResource() as AccResource,
        ...typifiedProps,
    }
}

