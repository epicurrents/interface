/**
 * Backing-canvas helper for canvas-based trend renderers.
 *
 * Problem: a trend strip that redraws all epochs on every resize is O(epochs) per
 * pixel of drag. For long recordings (thousands of epochs) this makes resize
 * noticeably sluggish even though individual epoch draws are fast.
 *
 * Solution: draw all trend data to an offscreen *backing* canvas. The visible
 * display canvas is populated by a single `ctx.drawImage` blit from the backing.
 *
 *   - **Incremental draw** (new epoch arrives): draw to backing, call `blit`.
 *   - **Resize**: call `resizeAndPreserve` (scales existing backing content to the
 *     new dimensions — one drawImage), then `blit` the display. Schedule a
 *     debounced quality-redraw (`scheduleRedraw`) so crisp content is restored
 *     after the user stops dragging.
 *   - **Full invalidation** (mode change, recompute): call `reset` then redraw.
 *
 * The composable is intentionally data-agnostic: it knows nothing about epochs,
 * bins, or trend types. Any canvas-based renderer can use it.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { onUnmounted } from 'vue'

export type TrendCanvas = ReturnType<typeof useTrendCanvas>

/**
 * @param initialWidth  - Initial backing canvas width in pixels.
 * @param initialHeight - Initial backing canvas height in pixels.
 * @param debounceMs    - Delay (ms) before a `scheduleRedraw` callback fires after
 *                        the last call. Defaults to 150 ms.
 */
export function useTrendCanvas (
    initialWidth  = 1,
    initialHeight = 1,
    debounceMs    = 150,
) {
    const backing = document.createElement('canvas')
    backing.width  = Math.max(1, initialWidth)
    backing.height = Math.max(1, initialHeight)

    let _debounceTimer: ReturnType<typeof setTimeout> | null = null

    /** 2D context of the backing canvas. Draw trend data here. */
    function getContext (): CanvasRenderingContext2D | null {
        return backing.getContext('2d')
    }

    /**
     * Copy the backing canvas onto `displayCanvas`, scaling to fill its current
     * width × height. When backing and display are the same size this is a
     * pixel-perfect blit; when sizes differ the browser GPU-accelerates the scale.
     */
    function blit (displayCanvas: HTMLCanvasElement | null) {
        if (!displayCanvas) {
            return
        }
        const ctx = displayCanvas.getContext('2d')
        if (!ctx || !backing.width || !backing.height) {
            return
        }
        ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height)
        ctx.drawImage(backing, 0, 0, displayCanvas.width, displayCanvas.height)
    }

    /**
     * Resize the backing canvas to `newWidth × newHeight`, scaling the existing
     * content to fit. Use this on the *fast path* during a resize drag so the
     * display stays responsive; follow up with `scheduleRedraw` to restore crisp
     * content after the drag settles.
     */
    function resizeAndPreserve (newWidth: number, newHeight: number) {
        const w = Math.max(1, newWidth)
        const h = Math.max(1, newHeight)
        if (w === backing.width && h === backing.height) {
            return
        }
        // Snapshot the existing content, then restore it scaled.
        const snap = document.createElement('canvas')
        snap.width  = backing.width
        snap.height = backing.height
        snap.getContext('2d')?.drawImage(backing, 0, 0)
        backing.width  = w
        backing.height = h
        backing.getContext('2d')?.drawImage(snap, 0, 0, w, h)
    }

    /**
     * Clear the backing canvas and set it to `newWidth × newHeight` without
     * preserving content. Use before a full quality-redraw.
     */
    function reset (newWidth?: number, newHeight?: number) {
        const w = Math.max(1, newWidth ?? backing.width)
        const h = Math.max(1, newHeight ?? backing.height)
        if (w !== backing.width || h !== backing.height) {
            backing.width  = w
            backing.height = h
        } else {
            backing.getContext('2d')?.clearRect(0, 0, w, h)
        }
    }

    /**
     * Schedule `callback` to run after `debounceMs` of inactivity. Each call
     * resets the timer, so only the final resize in a drag sequence triggers a
     * redraw. The callback typically calls `reset(w, h)` then redraws everything.
     *
     * @param callback - Full-quality redraw function, called with no arguments.
     */
    function scheduleRedraw (callback: () => void) {
        if (_debounceTimer !== null) {
            clearTimeout(_debounceTimer)
        }
        _debounceTimer = setTimeout(() => {
            _debounceTimer = null
            callback()
        }, debounceMs)
    }

    /** Cancel any pending debounced redraw (e.g. on unmount or explicit invalidation). */
    function cancelScheduledRedraw () {
        if (_debounceTimer !== null) {
            clearTimeout(_debounceTimer)
            _debounceTimer = null
        }
    }

    onUnmounted(() => {
        cancelScheduledRedraw()
    })

    return {
        backing,
        getContext,
        blit,
        resizeAndPreserve,
        reset,
        scheduleRedraw,
        cancelScheduledRedraw,
    }
}
