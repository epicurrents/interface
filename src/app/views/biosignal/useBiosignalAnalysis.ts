/**
 * Composable for the floating analysis window shared across all biosignal
 * viewers. Manages the window state and the signal-loading step that must
 * complete before the window can be shown.
 *
 * Single-channel recordings (NCS, EMG) are handled transparently: when the
 * resource has exactly one channel, that channel is used as the fallback for
 * selections that carry no channel reference.
 */

import { reactive } from 'vue'
import { Log } from 'scoped-event-log'
import type { BiosignalResource } from '@epicurrents/core/dist/types'
import type { PlotSelection } from '#app/views/biosignal/types'

export function useBiosignalAnalysis (
    resource: BiosignalResource,
    plotSelections: PlotSelection[],
    scope: string,
) {
    const analysisWindow = reactive({
        height: 600,
        left: window.innerWidth / 2 - 350,
        /** Incremented each time the window opens to discard any cached data. */
        nr: 0,
        open: false,
        tab: 'fft',
        top: window.innerHeight / 2 - 300,
        width: 700,
    })

    function closeAnalysisWindow () {
        analysisWindow.open = false
    }

    async function loadSelectionSignals (): Promise<boolean> {
        const result = await Promise.all(plotSelections.map(async (selection) => {
            const channel = resource.channels.length === 1
                ? resource.channels[0]
                : selection.channel
            if (channel) {
                const signal = await resource.getChannelSignal(
                    channel.name,
                    [...selection.range].sort((a, b) => a - b),
                )
                if (signal) {
                    selection.signal = signal.signals[0]
                    return true
                }
                return false
            }
            return true
        }))
        return result.every((value) => value !== false)
    }

    async function openAnalysisWindow (tab?: string) {
        analysisWindow.nr++
        if (tab) {
            analysisWindow.tab = tab
        }
        if (!analysisWindow.open) {
            if (!(await loadSelectionSignals())) {
                Log.error(`Could not load signal data to trace selections.`, scope)
            } else {
                analysisWindow.open = true
            }
        }
    }

    return {
        analysisWindow,
        closeAnalysisWindow,
        loadSelectionSignals,
        openAnalysisWindow,
    }
}
