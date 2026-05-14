/**
 * Trend type registry — maps the `selectedTrend` runtime field to a pair of dynamic components
 * (renderer + settings panel). `EegTrend.vue` looks the active entry up and slots the components
 * into the trend strip's body and controls drawer.
 *
 * Adding a new trend type:
 *   1. Implement the renderer + settings components under a new folder (e.g. `./bsi/`).
 *   2. Add an entry below with the new key and the matching `BiosignalTrend.derivation.type`.
 *   3. Append a radio-style item to the `trends` submenu in `AppMenubar.vue`.
 */
import type { Component } from 'vue'
import { loadAsyncComponent } from '#util'
import type { BiosignalTrend } from '@epicurrents/core/types'

export type TrendRegistryEntry = {
    /** Derivation type identifier on `BiosignalTrend.derivation.type` — used by the chrome to
     *  filter `montage.trends` so the renderer only sees trends it can draw. */
    derivationType: BiosignalTrend['derivation']['type']
    /** Async loader for the body component (label gutter + canvases + scale). */
    getRendererComponent: () => Component
    /** Async loader for the settings panel rendered inside the controls drawer. */
    getSettingsComponent: () => Component
}

export const TREND_REGISTRY: Record<string, TrendRegistryEntry> = {
    aeeg: {
        derivationType: 'amplitude',
        getRendererComponent: () => loadAsyncComponent(() => import('./aeeg/AeegRenderer.vue')),
        getSettingsComponent: () => loadAsyncComponent(() => import('./aeeg/AeegSettings.vue')),
    },
}
