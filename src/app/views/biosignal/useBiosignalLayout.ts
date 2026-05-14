/**
 * Composable for signal-plot layout calculations shared across all biosignal
 * viewers. Absorbs the former useBiosignalViewerComputed and adds the full
 * resize/px-per-second pipeline.
 *
 * Design contract:
 *   plotDimensions[0] = viewerSize[0] - xOffset
 *   plotDimensions[1] = viewerSize[1] - yOffset
 *   pxPerSecond = plotDimensions[0] / secPerPage  (or cmPerSec formula)
 *   visibleRange = (plotDimensions[0] - sidebarWidth) / pxPerSecond when sidebar open,
 *                  plotDimensions[0] / pxPerSecond otherwise
 *
 * The sidebar is NEVER included in xOffset — it overlays the signal area and
 * is accounted for only in visibleRange (navigation) and by the overlay clip.
 *
 * xOffset defaults to borderWidth.left + borderWidth.right when not provided,
 * which is correct for NCS. EEG passes yAxisWidth; EMG passes ref(0).
 *
 * navigatorHeight is passed as a writable ref by viewers that have a
 * resizable navigator strip (EEG, EMG). NCS omits it; its yOffset defaults
 * to borderWidth.top + borderWidth.bottom.
 */

import { computed, ref } from 'vue'
import { settingsColorToRgba } from '@epicurrents/core/util'
import type { ComputedRef, Ref } from 'vue'
import type { SettingsColor } from '@epicurrents/core/dist/types'

type BorderSide = { show?: boolean, width?: number } | undefined
type LayoutSettings = {
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

export function useBiosignalLayout (
    settings: LayoutSettings,
    viewerSize: Ref<number[]>,
    secPerPage: Ref<number>,
    sidebarOpen: Ref<string | null>,
    sidebarWidth: Ref<number>,
    /** Template refs used to gate resizeElements — pass the plot and navigator refs. */
    readyRefs: { plot: Ref<unknown>, navigator?: Ref<unknown> },
    cursors: Ref<{ updateCursors(): void } | undefined | null>,
    xOffset?: Ref<number> | ComputedRef<number>,
    navigatorHeight?: Ref<number>,
    /** EEG-only: used when secPerPage is 0 and timebase is expressed as cm/s. */
    cmPerSec?: Ref<number>,
    /** EEG-only: getter for store screenPPI (avoids passing the whole store). */
    screenPPI?: () => number,
) {
    // ── Border / selection styles (absorbs useBiosignalViewerComputed) ────────

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

    // ── Resolved offsets ──────────────────────────────────────────────────────

    const resolvedXOffset = xOffset
        ?? computed(() => borderWidth.value.left + borderWidth.value.right)

    const resolvedYOffset = navigatorHeight
        ?? computed(() => borderWidth.value.top + borderWidth.value.bottom)

    // ── Layout state ──────────────────────────────────────────────────────────

    const plotDimensions = ref([0, 0])
    const pxPerSecond = ref(0)

    const visibleRange = computed(() => {
        if (!pxPerSecond.value) {
            return 0
        }
        const base = plotDimensions.value[0] / pxPerSecond.value
        if (sidebarOpen.value !== null) {
            return Math.max(0, plotDimensions.value[0] - sidebarWidth.value) / pxPerSecond.value
        }
        return base
    })

    // ── Methods ───────────────────────────────────────────────────────────────

    function resizeElements () {
        if (!readyRefs.plot.value || (readyRefs.navigator && !readyRefs.navigator.value)) {
            return
        }
        plotDimensions.value = [
            viewerSize.value[0] - resolvedXOffset.value,
            viewerSize.value[1] - resolvedYOffset.value,
        ]
        cursors.value?.updateCursors()
    }

    function calculatePxPerSecond () {
        if (secPerPage.value) {
            pxPerSecond.value = Math.max(0, plotDimensions.value[0]) / secPerPage.value
        } else if (cmPerSec?.value && screenPPI) {
            pxPerSecond.value = (screenPPI() / 2.54) * cmPerSec.value
        }
    }

    /**
     * Timestamp (performance.now()) until which `handleNavigatorResize` should ignore incoming
     * resize events. Used to suppress the wa-split-panel ↔ navigatorHeight feedback loop that
     * happens around programmatic updates: setting `navigatorHeight` causes wa-split-panel to
     * emit `wa-reposition` with intermediate / stale `offsetHeight` values during its layout
     * transition, which would otherwise be written back into `navigatorHeight` and ping-pong.
     */
    let suppressResizeUntil = 0
    function suppressResizeFor (durationMs: number) {
        suppressResizeUntil = performance.now() + durationMs
    }
    function handleNavigatorResize (value: { start: number, end: number }) {
        const current = navigatorHeight?.value ?? 0
        const next = value.end
        // eslint-disable-next-line no-console
        console.log(`[trend-debug] handleNavigatorResize end=${next} (was ${current}) suppressed=${performance.now() < suppressResizeUntil}`)
        if (performance.now() < suppressResizeUntil) {
            return
        }
        // Reject non-finite or non-positive values. wa-split-panel can transiently report
        // NaN/Infinity (e.g. during initial connectedCallback before the host element is
        // laid out and size=0) or 0/negative (user dragged the divider past the min clamp
        // — the CSS clamp keeps the displayed slot at min, but the internal positionInPixels
        // is unclamped). Letting either propagate into navigatorHeight breaks the plot
        // dimensions computation (`plotDimensions[1] = viewerSize - navigatorHeight`).
        if (!Number.isFinite(next) || next <= 0) {
            return
        }
        // Ignore sub-pixel oscillations only. `SplitPanelView.handleDividerMove` reads the
        // wa-split-panel's `positionInPixels` directly (authoritative live value, not the
        // post-event-pre-render `offsetHeight`), so the value we receive matches what
        // wa-split-panel actually stored. Float-precision round-trips (size → percentage →
        // size) can still produce sub-pixel deltas, but real user drags move by at least one
        // whole pixel per event, so a sub-pixel threshold filters echoes without blocking the
        // smallest legitimate drag step.
        if (Math.abs(next - current) < 0.5) {
            return
        }
        if (navigatorHeight) {
            navigatorHeight.value = next
        }
        resizeElements()
    }

    function handleSidebarResize (value: { start: number, end: number }) {
        sidebarWidth.value = value.end
        resizeElements()
    }

    return {
        borderWidth,
        calculatePxPerSecond,
        handleNavigatorResize,
        handleSidebarResize,
        plotDimensions,
        pxPerSecond,
        resizeElements,
        selectionStyles,
        suppressResizeFor,
        visibleRange,
    }
}
