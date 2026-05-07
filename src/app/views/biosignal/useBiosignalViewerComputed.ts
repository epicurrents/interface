/**
 * Composable for computed properties that are identical across all biosignal viewers.
 * Accepts the module settings object and returns computed refs that can be spread
 * into setup() so they are accessible as `this.<property>` in the Options API.
 */

import { computed } from 'vue'
import { settingsColorToRgba } from '@epicurrents/core/util'
import type { SettingsColor } from '@epicurrents/core/dist/types'

/** Minimal shape of the settings fields consumed by this composable. */
type BorderSide = { show?: boolean, width?: number } | undefined
type ViewerComputedSettings = {
    border: {
        bottom?: BorderSide
        left?: BorderSide
        right?: BorderSide
        top?: BorderSide
    }
    trace: {
        selections: { color: SettingsColor }
    }
}

export function useBiosignalViewerComputed (settings: ViewerComputedSettings) {

    const borderWidth = computed(() => {
        const side = (s: BorderSide) => s !== undefined && s.show !== false
        return {
            bottom: side(settings.border.bottom) ? settings.border.bottom?.width ?? 0 : 0,
            left:   side(settings.border.left)   ? settings.border.left?.width   ?? 0 : 0,
            right:  side(settings.border.right)  ? settings.border.right?.width  ?? 0 : 0,
            top:    side(settings.border.top)    ? settings.border.top?.width    ?? 0 : 0,
        }
    })

    const selectionStyles = computed(() => [
        `background-color:${settingsColorToRgba(settings.trace.selections.color)}`,
        `cursor:pointer`,
    ].join(';'))

    return { borderWidth, selectionStyles }
}
