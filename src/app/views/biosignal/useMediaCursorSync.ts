/**
 * Composable that ties media playback to the main cursor of a biosignal viewer.
 *
 * A {@link MediaPlaybackClock} reports the current playback position in
 * recording seconds and whether it is advancing; the composable runs a
 * requestAnimationFrame loop that moves the main cursor to that position and
 * scrolls the view a page at a time as playback crosses page boundaries. It is
 * modality-agnostic — the synthesised-audio player drives it today, and a video
 * track reuses it unchanged later — so any clock source produces the same
 * cursor-follows-playback behaviour.
 */

import type { BiosignalResource } from '@epicurrents/core/dist/types'

/** A source of playback position, expressed in recording-relative seconds. */
export interface MediaPlaybackClock {
    /** Current playback position in recording seconds. */
    readonly currentTime: number
    /** Whether playback is actively advancing, so the view should follow it. */
    readonly isPlaying: boolean
}

export interface MediaCursorSyncOptions {
    /** Resolve once the plot has redrawn after a page jump. */
    awaitPlotUpdate: () => Promise<unknown>
    /** Resource whose `viewStart` / `totalDuration` the loop scrolls. */
    resource: BiosignalResource
    /** Move the main cursor to the given recording-time position (seconds). */
    setCursorPos: (seconds: number) => void
    /** Visible page length in seconds. */
    viewRange: () => number
}

/**
 * Drive a viewer's main cursor from a media playback clock.
 * @param options - Resource, page metrics, and the cursor / plot-update callbacks to drive.
 * @returns `follow(clock)` to start tracking a clock and `stop()` to end and cancel the loop.
 */
export function useMediaCursorSync (options: MediaCursorSyncOptions) {
    let clock: MediaPlaybackClock | null = null
    let frame = 0
    let lastTime = Number.NaN

    async function tick () {
        if (!clock) {
            return
        }
        const time = clock.currentTime
        if (time !== lastTime) {
            lastTime = time
            const viewStart = options.resource.viewStart
            const range = options.viewRange()
            if (clock.isPlaying && time >= viewStart + range) {
                // Playback crossed the page end — advance a full page and let the plot redraw
                // before the cursor is repositioned on the new page.
                options.resource.viewStart = Math.floor(time)
                await options.awaitPlotUpdate()
            } else if (time < viewStart || time >= viewStart + range) {
                // Position is off-page without playback advancing (e.g. a seek) — recentre on it.
                options.resource.viewStart = Math.min(
                    options.resource.totalDuration,
                    Math.max(0, Math.floor(time - range/2)),
                )
            }
            options.setCursorPos(time)
        }
        if (clock) {
            frame = requestAnimationFrame(tick)
        }
    }

    /**
     * Begin following the given clock, replacing any clock already tracked.
     * @param source - The playback clock to track.
     */
    function follow (source: MediaPlaybackClock) {
        clock = source
        lastTime = Number.NaN
        if (!frame) {
            frame = requestAnimationFrame(tick)
        }
    }

    /** Stop following the current clock and cancel the loop. */
    function stop () {
        clock = null
        if (frame) {
            cancelAnimationFrame(frame)
            frame = 0
        }
    }

    return { follow, stop }
}
