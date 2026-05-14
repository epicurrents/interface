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
        const montage = context.RESOURCE?.activeMontage
        if (!montage) {
            trends.value = []
            redraw()
            return
        }
        trends.value = (Object.values(montage.trends) as BiosignalTrend[])
            .filter((t) => t.derivation.type === derivationType)
        for (const trend of trends.value) {
            trend.addEventListener('trend-epoch', scheduleRedraw, context.ID)
            trend.addEventListener('trend-complete', redraw, context.ID)
        }
        redraw()
    }

    const montageChanged = () => {
        context.RESOURCE.activeMontage?.onPropertyChange('trends', refreshTrends, context.ID)
        refreshTrends()
    }

    const recompute = () => {
        // Each modality currently exposes a single trend setup hook. When additional trend types
        // land they can register their own setup methods and the resolution moves to the trend
        // registry; for now aEEG is the only trend so calling the hook unconditionally is fine.
        const resource = context.RESOURCE as unknown as { ensureAeegTrendSetup?: () => void }
        resource.ensureAeegTrendSetup?.()
    }

    onMounted(() => {
        context.RESOURCE.onPropertyChange('activeMontage', montageChanged, context.ID)
        context.RESOURCE.activeMontage?.onPropertyChange('trends', refreshTrends, context.ID)
        refreshTrends()
    })

    onBeforeUnmount(() => {
        for (const trend of trends.value) {
            trend.removeAllEventListeners(context.ID)
        }
        context.RESOURCE.activeMontage?.removeAllEventListeners(context.ID)
        context.RESOURCE.removeAllEventListeners(context.ID)
    })

    return {
        ...context,
        trends,
        recompute,
        scheduleRedraw,
    }
}
