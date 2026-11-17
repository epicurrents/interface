/**
 * Native media module: video, audio and raster images, rendered by the browser's own media elements.
 *
 * One modality per media element, each registered under its own name and each with its own module objects, since
 * registration rebinds a module's property setter to the name it is registered by. `registerNativeMedia` registers
 * one modality with its file and URL importers, `media/<modality>-file` and `media/<modality>-url`; a host that
 * holds the file's address loads it through the latter, and no reader is involved in either.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { DataResource, ResourceModule } from '@epicurrents/core/types'
import { safeObjectFrom } from '@epicurrents/core/util'
import { Log } from 'scoped-event-log'
import type { InterfaceResourceModule, ResourceModuleContext } from '#store'
import { loadAsyncComponent } from '#util'
import type { CommonInterfaceSettings } from '#types/config'
import type { SetupContext } from '#setups/index'
import NativeMediaLoader from './NativeMediaLoader'
import NativeMediaResource, { NATIVE_MEDIA_MODALITIES, type NativeMediaModality } from './NativeMediaResource'

const SCOPE = 'native-media-module'

const NAMES: Record<NativeMediaModality, { full: string, short: string }> = {
    audio: { full: 'Audio', short: 'Audio' },
    image: { full: 'Image', short: 'Image' },
    video: { full: 'Video', short: 'Video' },
}

/**
 * The core and interface halves of the module for one native media modality.
 * @param modality - The modality to create the module for: `audio`, `image` or `video`.
 */
export const nativeMediaModules = (modality: NativeMediaModality) => {
    const core: ResourceModule = {
        runtime: safeObjectFrom({
            moduleName: { code: modality, ...NAMES[modality] },
            applyConfiguration () {
                return Promise.resolve()
            },
            setPropertyValue (property: string, _value: unknown, _resource?: DataResource) {
                // The media element owns playback; the module keeps no properties of its own.
                Log.debug(`Native media module '${modality}' has no property '${property}' to set.`, SCOPE)
            },
        }),
        settings: {
            useMemoryManager: false,
        },
    }
    const ui: ResourceModuleContext = {
        runtime: {
            moduleName: { code: modality, ...NAMES[modality] },
            async applyConfiguration () {
            },
            getControlsComponent: () => {
                return loadAsyncComponent(() => import('#app/controls/ControlsBar.vue'))
            },
            getFooterComponent: () => {
                return loadAsyncComponent(() => import('#app/footers/DefaultFooter.vue'))
            },
            getViewerComponent: () => {
                return loadAsyncComponent(() => import('./components/NativeMediaViewer.vue'))
            },
            /** Replaced when the module is registered. */
            setPropertyValue () {
                Log.warn(`setPropertyValue in '${modality}' has not been overridden.`, SCOPE)
            },
            resourceLifecycleHooks: {
                beforeDestroy () {
                },
                created () {
                },
                destroyed () {
                },
            },
        } as InterfaceResourceModule,
        settings: safeObjectFrom({
            _userDefinable: {},
            compatibleView: 'media',
        }) as CommonInterfaceSettings,
    }
    return { core, ui }
}

/**
 * Register one native media modality: its core module, its file and URL importers and its interface module.
 * @param context - The setup context of the registering build.
 * @param modality - The modality to register: `audio`, `image` or `video`.
 */
export const registerNativeMedia = (
    { app, registerInterfaceModule }: Pick<SetupContext, 'app' | 'registerInterfaceModule'>,
    modality: NativeMediaModality,
) => {
    const { core, ui } = nativeMediaModules(modality)
    const label = NAMES[modality].full.toLowerCase()
    app.registerModule(modality, core)
    const loader = new NativeMediaLoader(modality)
    app.registerStudyImporter(`media/${modality}-file`, `Open ${label} file`, 'file', loader)
    app.registerStudyImporter(`media/${modality}-url`, `Open ${label} from URL`, 'url', loader)
    registerInterfaceModule(modality, ui)
}

export {
    NATIVE_MEDIA_MODALITIES,
    NativeMediaLoader,
    NativeMediaResource,
    type NativeMediaModality,
}
