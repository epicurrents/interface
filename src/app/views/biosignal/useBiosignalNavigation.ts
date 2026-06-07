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
    epochMode: {
        enabled: boolean
        epochLength: number
        onlyFullEpochs: boolean
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
    const isAtEnd = ref(false)
    const isAtStart = ref(false)
    const isInEpochMode = ref(false)

    function isVideoPlaying () {
        return !!video?.value && !video.value.paused && !video.value.ended
    }

    function checkEpochMode () {
        isInEpochMode.value = settings.epochMode.enabled && settings.epochMode.epochLength > 0
    }

    function goBackward (step?: number) {
        if (isAtStart.value) {
            return
        }
        if (isInEpochMode.value) {
            goTo(resource.viewStart - settings.epochMode.epochLength)
        } else {
            if (!step) {
                step = resource.activeMontage?.pageStep ?? Math.min(
                    resource.activeMontage?.pageLength ?? settings.pageLength,
                    Math.ceil(visibleRange.value) - 1
                )
            }
            if (resource.viewStart <= step) {
                resource.viewStart = 0
                isAtStart.value = true
            } else {
                goTo(resource.viewStart - step)
            }
        }
    }

    function goForward (step?: number) {
        if (isAtEnd.value) {
            return
        }
        if (isInEpochMode.value) {
            step = settings.epochMode.epochLength
        } else {
            if (!step) {
                step = resource.activeMontage?.pageStep ?? Math.min(
                    resource.activeMontage?.pageLength ?? settings.pageLength,
                    Math.ceil(visibleRange.value) - 1
                )
            }
        }
        goTo(resource.viewStart + step)
    }

    function goTo (time: number) {
        if (time < 0 || time >= resource.totalDuration) {
            return
        }
        const nEpochs = (resource.totalDuration - epochStart.value) / (settings.epochMode.epochLength || 1)
        const endEpoch = (settings.epochMode.onlyFullEpochs ? Math.floor(nEpochs) : Math.ceil(nEpochs)) - 1
        if (isInEpochMode.value) {
            if (time < epochStart.value) {
                resource.viewStart = epochStart.value
            } else if ((time - epochStart.value) / settings.epochMode.epochLength >= endEpoch + 1) {
                resource.viewStart = epochStart.value + endEpoch * settings.epochMode.epochLength
            } else {
                const epochIndex = Math.min(
                    Math.floor((time - epochStart.value) / settings.epochMode.epochLength),
                    endEpoch
                )
                resource.viewStart = epochStart.value + epochIndex * settings.epochMode.epochLength
            }
        } else {
            resource.viewStart = time
        }
        if (!resource.viewStart || (isInEpochMode.value && resource.viewStart === epochStart.value)) {
            isAtStart.value = true
        } else {
            isAtStart.value = false
        }
        if (
            resource.viewStart + visibleRange.value >= resource.totalDuration
            || (isInEpochMode.value
                && resource.viewStart === epochStart.value + (nEpochs - 1) * settings.epochMode.epochLength
            )
        ) {
            isAtEnd.value = true
        } else {
            isAtEnd.value = false
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
        checkEpochMode,
        epochStart,
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
