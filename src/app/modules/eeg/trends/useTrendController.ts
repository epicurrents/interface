/**
 * Shared trend-context helper for trend renderer + settings components.
 *
 * - Maintains a reactive `trends` list filtered by `derivationType` on the active montage.
 * - Subscribes to montage `'trends'` property changes and to each trend's `'trend-epoch'` /
 *   `'trend-complete'` events. Progressive (`'trend-epoch'`) updates are coalesced through
 *   `requestAnimationFrame` to keep the main thread responsive while a long compute streams.
 * - Exposes a `recompute()` helper that triggers the resource's per-trend setup hook.
 *
 * The caller passes a `redraw` callback; the composable invokes it whenever the trends list
 * or signal data changes, removing the need for every renderer to duplicate the subscription
 * scaffolding.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import { useEegContext } from '..'
import type { BiosignalTrend } from '@epicurrents/core/types'

export function useTrendController (
    componentName: string,
    derivationType: BiosignalTrend['derivation']['type'],
    redraw: () => void
) {
    const store = useStore()
    const context = useEegContext(store, componentName)
    const trends = ref([] as BiosignalTrend[])
    let drawScheduled = false

    const scheduleRedraw = () => {
        if (drawScheduled) {
            return
        }
        drawScheduled = true
        requestAnimationFrame(() => {
            drawScheduled = false
            redraw()
        })
    }

    const refreshTrends = () => {
        for (const trend of trends.value) {
            trend.removeAllEventListeners(context.ID)
        }
        trends.value = (Object.values(context.RESOURCE?.trends ?? {}) as BiosignalTrend[])
            .filter((t) => t.derivation.type === derivationType)
        for (const trend of trends.value) {
            trend.addEventListener('trend-epoch', scheduleRedraw, context.ID)
            trend.addEventListener('trend-complete', redraw, context.ID)
        }
        redraw()
    }


    const recompute = () => {
        // Clear existing trends first so the guard in _buildAmplitudeTrends does not
        // short-circuit the rebuild when trends already exist.
        const resource = context.RESOURCE as unknown as {
            ensureTrendSetup?: () => void
            removeAllTrends?: () => void
        }
        resource.removeAllTrends?.()
        resource.ensureTrendSetup?.()
    }

    onMounted(() => {
        context.RESOURCE.onPropertyChange('trends', refreshTrends, context.ID)
        refreshTrends()
    })

    onBeforeUnmount(() => {
        for (const trend of trends.value) {
            trend.removeAllEventListeners(context.ID)
        }
        context.RESOURCE.removeAllEventListeners(context.ID)
    })

    return {
        ...context,
        trends,
        recompute,
        scheduleRedraw,
    }
}
