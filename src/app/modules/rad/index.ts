/**
 * Radiology module: studies rendered by a viewer page the host serves, framed by the radiology view.
 *
 * The application reads nothing of a radiology study. A host that serves a viewer for its studies (a DICOM viewer on
 * its own mount, typically) lists each study by the address of its page, and `registerRadiology` registers the module
 * with the importer `rad/viewer-url` that turns that address into a resource. Keeping the viewer in a page of its own
 * is deliberate: a radiology viewer brings global styles, a router reading the page URL, document-wide hotkeys and,
 * often, a content policy of its own, none of which can share the application's document.
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
import RadiologyLoader from './RadiologyLoader'
import RadiologyResource, { RADIOLOGY_MODALITY, RADIOLOGY_RETURN_MESSAGE } from './RadiologyResource'
import { getAllowedViewerOrigins, isAllowedViewerUrl, resolveViewerUrl, setAllowedViewerOrigins } from './viewerUrl'

const SCOPE = 'radiology-module'

const NAME = { code: RADIOLOGY_MODALITY, full: 'Radiology', short: 'Radiology' }

/** The core and interface halves of the radiology module. */
export const radiologyModules = () => {
    const core: ResourceModule = {
        runtime: safeObjectFrom({
            moduleName: NAME,
            applyConfiguration () {
                return Promise.resolve()
            },
            setPropertyValue (property: string, _value: unknown, _resource?: DataResource) {
                // The framed viewer owns its state; the module keeps no properties of its own.
                Log.debug(`The radiology module has no property '${property}' to set.`, SCOPE)
            },
        }),
        settings: {
            useMemoryManager: false,
        },
    }
    const ui: ResourceModuleContext = {
        runtime: {
            moduleName: NAME,
            async applyConfiguration () {
            },
            // The radiology view frames the viewer page itself and shows no controls of its own.
            getControlsComponent: () => {
                return loadAsyncComponent(() => null)
            },
            getFooterComponent: () => {
                return loadAsyncComponent(() => import('./components/RadiologyFooter.vue'))
            },
            getViewerComponent: () => {
                return loadAsyncComponent(() => null)
            },
            /** Replaced when the module is registered. */
            setPropertyValue () {
                Log.warn(`setPropertyValue in '${RADIOLOGY_MODALITY}' has not been overridden.`, SCOPE)
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
            compatibleView: 'radiology',
        }) as CommonInterfaceSettings,
    }
    return { core, ui }
}

/** Options of `registerRadiology`. */
export type RadiologyOptions = {
    /**
     * Origins a study's viewer page may have besides the application's own, such as `https://viewer.example.org`.
     * A study whose page is of any other origin, or is not an `http:` or `https:` page, is refused when it is listed or
     * loaded and is never framed. The application's own origin is always allowed, so a host that serves its viewer
     * from its own mount names nothing.
     */
    allowedViewerOrigins?: string[]
}

/**
 * Register the radiology module: its core module, the `rad/viewer-url` importer and its interface module.
 *
 * The view frames a study's viewer page inside the application, so the page has to be one the host answers for:
 * `options.allowedViewerOrigins` names the origins it may have besides the application's own. Registering again
 * replaces the origins named before.
 * @param context - The setup context of the registering build.
 * @param options - Options of the module; `allowedViewerOrigins` lists the origins a viewer page may have besides the application's own.
 */
export const registerRadiology = (
    { app, registerInterfaceModule }: Pick<SetupContext, 'app' | 'registerInterfaceModule'>,
    options: RadiologyOptions = {},
) => {
    setAllowedViewerOrigins(options.allowedViewerOrigins)
    const { core, ui } = radiologyModules()
    app.registerModule(RADIOLOGY_MODALITY, core)
    const loader = new RadiologyLoader()
    app.registerStudyImporter(`${RADIOLOGY_MODALITY}/viewer-url`, 'Open radiology study from URL', 'url', loader)
    registerInterfaceModule(RADIOLOGY_MODALITY, ui)
}

export {
    RADIOLOGY_MODALITY,
    RADIOLOGY_RETURN_MESSAGE,
    RadiologyLoader,
    RadiologyResource,
    getAllowedViewerOrigins,
    isAllowedViewerUrl,
    resolveViewerUrl,
    setAllowedViewerOrigins,
}
