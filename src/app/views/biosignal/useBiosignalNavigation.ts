/**
 * Composable for view navigation shared across all biosignal viewers that
 * support paging (EEG, EMG). NCS has no navigation and does not use this.
 *
 * Handles both normal paging and epoch mode. The non-epoch behaviour of
 * handlePlotNavigation (triggered by double-click or navigator click) differs
 * between viewers and is injected via onPlotNavigate. When omitted the
 * composable simply calls goTo(position).
 *
 * Pass the viewer's `video` ref to enable `isVideoPlaying` and automatic
 * video pause on navigation. Viewers without video simply omit it.
 */

import { ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { BiosignalResource } from '@epicurrents/core/dist/types'

type NavigationSettings = {
    /**
     * Optional — modalities that don't surface an epoch view (e.g.
     * accelerometry) omit this, and the composable falls back to plain paging.
     */
    epochMode?: {
        enabled: boolean
        epochLength: number
        onlyFullEpochs: boolean
        /**
         * Optional — `'centered'` shows the focused epoch with faded context on each
         * side (semi-epoch mode). Absent or `'full'` shows the epoch alone.
         */
        display?: 'full' | 'centered'
        /** Optional — epochs of context per side in `'centered'` display (default 1). */
        contextEpochs?: number
    }
    pageLength: number
}

export function useBiosignalNavigation (
    resource: BiosignalResource,
    settings: NavigationSettings,
    visibleRange: Ref<number> | ComputedRef<number>,
    onPlotNavigate?: (position: number, goTo: (time: number) => void) => void,
    video?: Ref<HTMLVideoElement | undefined>,
) {
    const epochStart = ref(0)
    const focusedEpoch = ref(0)
    const isAtEnd = ref(false)
    const isAtStart = ref(false)
    const isInEpochMode = ref(false)

    function isVideoPlaying () {
        return !!video?.value && !video.value.paused && !video.value.ended
    }

    /**
     * Epoch grid geometry for the current settings. `context` is the seconds of
     * faded context shown on each side of the focused epoch in centered display
     * (zero in full display); `endEpoch` is the index of the last navigable epoch.
     */
    function epochGeometry () {
        const epochLength = settings.epochMode?.epochLength ?? 0
        const onlyFullEpochs = settings.epochMode?.onlyFullEpochs ?? false
        const centered = settings.epochMode?.display === 'centered'
        const contextEpochs = centered
            ? Math.max(0, Math.round(settings.epochMode?.contextEpochs ?? 1))
            : 0
        const nEpochs = epochLength > 0
            ? (resource.totalDuration - epochStart.value) / epochLength
            : 0
        const endEpoch = (onlyFullEpochs ? Math.floor(nEpochs) : Math.ceil(nEpochs)) - 1
        return { context: contextEpochs * epochLength, endEpoch, epochLength }
    }

    function checkEpochMode () {
        isInEpochMode.value = !!settings.epochMode?.enabled && (settings.epochMode?.epochLength ?? 0) > 0
        if (isInEpochMode.value) {
            const { endEpoch, epochLength } = epochGeometry()
            // Derive the focused epoch from the current view start. Called on entry
            // into epoch mode and on epoch-length change, where the view start is the
            // plain page position (not yet offset by a centered context), so this is
            // the epoch at the left of the view — matching full-mode paging.
            const index = epochLength > 0
                ? Math.floor((resource.viewStart - epochStart.value) / epochLength)
                : 0
            focusedEpoch.value = Math.min(Math.max(0, index), Math.max(0, endEpoch))
        }
    }

    /**
     * Position the view for the current `focusedEpoch`, clamping the index into
     * range and updating the start/end flags. In centered display the view start is
     * offset so the focused epoch sits in the middle; the offset is clamped so the
     * page never scrolls before the grid start.
     */
    function applyEpochView () {
        const { context, endEpoch, epochLength } = epochGeometry()
        if (epochLength <= 0) {
            return
        }
        focusedEpoch.value = Math.min(Math.max(0, focusedEpoch.value), Math.max(0, endEpoch))
        const focusedBoundary = epochStart.value + focusedEpoch.value * epochLength
        resource.viewStart = Math.max(epochStart.value, focusedBoundary - context)
        isAtStart.value = focusedEpoch.value <= 0
        isAtEnd.value = focusedEpoch.value >= endEpoch
    }

    function goBackward (step?: number) {
        if (isAtStart.value) {
            return
        }
        if (isInEpochMode.value && settings.epochMode) {
            focusedEpoch.value -= 1
            applyEpochView()
        } else {
            if (!step) {
                step = resource.activeMontage?.pageStep ?? Math.min(
                    resource.activeMontage?.pageLength ?? settings.pageLength,
                    Math.ceil(visibleRange.value) - 1
                )
            }
            if (resource.viewStart <= step) {
                // Snap to the very start. Route through goTo rather than setting
                // viewStart directly so isAtEnd is recomputed too: jumping to 0 in
                // one step from a view whose right edge is past the data end (a
                // short recording, where the last page is within one step of the
                // start) would otherwise leave isAtEnd stuck true. With isAtStart
                // now also true, both goForward and goBackward dead-end and all
                // paging freezes until the recording is reopened.
                goTo(0)
            } else {
                goTo(resource.viewStart - step)
            }
        }
    }

    function goForward (step?: number) {
        if (isAtEnd.value) {
            return
        }
        if (isInEpochMode.value && settings.epochMode) {
            focusedEpoch.value += 1
            applyEpochView()
        } else {
            if (!step) {
                step = resource.activeMontage?.pageStep ?? Math.min(
                    resource.activeMontage?.pageLength ?? settings.pageLength,
                    Math.ceil(visibleRange.value) - 1
                )
            }
            goTo(resource.viewStart + step)
        }
    }

    function goTo (time: number) {
        if (time < 0 || time >= resource.totalDuration) {
            return
        }
        const { endEpoch, epochLength } = epochGeometry()
        if (isInEpochMode.value && epochLength > 0) {
            // `time` is a content time (a click or jump target): focus the epoch
            // containing it, then position the view around that epoch.
            const index = time < epochStart.value
                ? 0
                : Math.floor((time - epochStart.value) / epochLength)
            focusedEpoch.value = Math.min(Math.max(0, index), Math.max(0, endEpoch))
            applyEpochView()
        } else {
            resource.viewStart = time
            isAtStart.value = !resource.viewStart
            isAtEnd.value = resource.viewStart + visibleRange.value >= resource.totalDuration
        }
    }

    function handlePlotNavigation (position: number) {
        if (isInEpochMode.value) {
            goTo(position)
        } else if (onPlotNavigate) {
            onPlotNavigate(position, goTo)
        } else {
            goTo(position)
        }
        if (isVideoPlaying()) {
            video!.value!.pause()
        }
    }

    return {
        applyEpochView,
        checkEpochMode,
        epochStart,
        focusedEpoch,
        goBackward,
        goForward,
        goTo,
        handlePlotNavigation,
        isAtEnd,
        isAtStart,
        isInEpochMode,
        isVideoPlaying,
    }
}
