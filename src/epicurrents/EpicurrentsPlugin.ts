/**
 * Epicurrents plugin for Vue3.
 * @package    epicurrents/interface
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { EpicurrentsApp, InterfaceModule } from '@epicurrents/core/types'
import { App } from 'vue'

export class EpicurrentsPlugin {
    protected _app: EpicurrentsApp
    /**
     * EpicurrentsPlugin constructor.
     * @param {Epicurrents} epicurrents - The Epicurrents instance.
     */
    constructor(epicurrents: EpicurrentsApp) {
        this._app = epicurrents
    }
    install (app: App, options: InterfaceModule) {
        // Provide Epicurrents instance and other utilities to the app.
        app.provide('$config', window.__EPICURRENTS__?.SETUP || {})
        app.provide('$epicurrents', this._app)
        app.provide('$interface', options)
        app.provide('$eventBus', this._app.eventBus)
        app.provide('$runtime', this._app.runtime)
        app.config.globalProperties.$config = window.__EPICURRENTS__?.SETUP || {}
        app.config.globalProperties.$epicurrents = this._app
        app.config.globalProperties.$interface = options
        app.config.globalProperties.$eventBus = this._app.eventBus
        app.config.globalProperties.$runtime = this._app.runtime
    }
}
export default EpicurrentsPlugin
