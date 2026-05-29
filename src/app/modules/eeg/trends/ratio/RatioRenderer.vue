<template>
    <div data-component="ratio-renderer">
        <div class="labels" :class="`layout-${labelMode}`">
            <div
                v-for="(entry, i) in labelEntries"
                :key="entry.side"
                class="side-label"
                :style="labelStyles[i]"
            >
                <span class="dot" :style="{ background: entry.colorCss }"></span>
                {{ entry.label }}
            </div>
        </div>
        <div class="plot">
            <canvas
                ref="trendCanvas"
                :height="canvasHeight"
                :width="canvasWidth"
                @dblclick="handleDblClick"
            ></canvas>
            <canvas
                ref="viewboxCanvas"
                class="viewbox"
                :height="VIEWBOX_BITMAP_HEIGHT"
                :style="{
                    top: '1px',
                    width: canvasWidth + 'px',
                    height: Math.max(0, canvasHeight - 2) + 'px',
                }"
                :width="canvasWidth"
            ></canvas>
            <div v-if="scaleMarkers.length" class="scale" :style="{ right: rightReservedWidth + 'px' }">
                <div
                    v-for="m in scaleMarkers"
                    :key="m.key"
                    class="scale-marker"
                    :class="['anchor-' + m.anchor, { labelled: !!m.label }]"
                    :style="{ top: m.y + 'px' }"
                >
                    <span class="scale-tick"></span>
                    <span v-if="m.label" class="scale-text">{{ m.label }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * RatioRenderer — draws hemisphere-level EEG ratio indices (TAR, DAR, DTABR)
 * as two per-hemisphere line+fill traces on a fixed [−1, +1] y-axis.
 *
 * Trend layout (from `BiosignalTrend.signal`):
 *   One trend per hemisphere — `ratio-left`, `ratio-right` — each with one scalar per
 *   epoch (`signal[i]`). The hemisphere is inferred from the trend name; trends that
 *   don't match either suffix are skipped.
 *
 * Display modes
 * ─────────────
 * separate      Two equal-height slots stacked vertically, one per hemisphere.
 *               Zero line is at mid-slot; fill expands toward the top (positive).
 * superimposed  Both hemisphere traces on a single full-height slot.
 * mirrored      (separate only) Axes mirror at the separator so pathological fills
 *               expand outward from the center line — L upward, R downward.
 *
 * Fill semantics
 * ──────────────
 * The area between the zero line and the trace is filled at low opacity when the
 * value is positive (more slow activity = more pathological = more visible color).
 * Negative values produce no fill.
 *
 * Threshold crossing
 * ──────────────────
 * When showThreshold is on, a dashed threshold line is drawn alongside the dashed
 * zero line. The threshold value is set from the trend settings drawer; there is no
 * dedicated right-axis tick because the canvas y-scale is anchored to the full
 * canvas and would misalign in separate mode where each slot occupies half.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useStore } from 'vuex'
import { T } from '#i18n'
import { settingsColorToRgba } from '@epicurrents/core/util'
import { useTrendController } from '../useTrendController'
import type { BiosignalTrend, SettingsColor } from '@epicurrents/core/types'

const SCOPE = 'RatioRenderer'
const VIEWBOX_BITMAP_HEIGHT = 1
const LABEL_GUTTER_WIDTH = 80
const Y_MIN = -1
const Y_MAX = 1
// Must match `padding-top` on `[data-component="ratio-renderer"]` below — the canvas
// extends past the wrapper's content box by this amount otherwise, hiding the bottom
// border (and the last sample of the trace) under the container's overflow.
const TOP_PADDING = 8

const props = defineProps<{
    controlsOpen: boolean
    displayMode: 'separate' | 'superimposed' | null
    height: number
    visibleRange: number
    width: number
}>()

const emit = defineEmits<{ navigation: [position: number] }>()

const t = (key: string, params: Record<string, unknown> = {}) => T(key, SCOPE, params)

const trendCanvas = ref<HTMLCanvasElement | null>(null)
const viewboxCanvas = ref<HTMLCanvasElement | null>(null)

const store = useStore()
const controller = useTrendController(SCOPE, 'ratio', () => drawTrends())
const { ID, RESOURCE, SETTINGS, trends } = controller

const rightReservedWidth = computed(() => props.controlsOpen ? 210 : 30)
const canvasHeight = computed(() => Math.max(0, props.height - TOP_PADDING))
const canvasWidth = computed(() =>
    Math.max(0, props.width - LABEL_GUTTER_WIDTH - rightReservedWidth.value))

// ── Display settings ──────────────────────────────────────────────────────────
// SETTINGS is a non-reactive proxy — Vue computeds wrapping reads from it never
// invalidate when the store changes (the values land in the INTERFACE singleton,
// not in reactive state). The pattern used here mirrors `AeegRenderer.vue`:
// hold each setting in a plain ref, seeded from SETTINGS at mount and refreshed
// by an action subscription whenever `set-settings-value` fires for one of our
// trend's fields. Watchers (or the subscription handler itself) then trigger a
// redraw.
type RatioSettings = {
    displayMode?: 'separate' | 'superimposed'
    mirrorMode?: boolean
    showThreshold?: boolean
    showFill?: boolean
    threshold?: number
}
const readRatioSettings = (): RatioSettings =>
    (SETTINGS as Record<string, unknown> & { trends?: { ratio?: RatioSettings } }).trends?.ratio ?? {}

const initial = readRatioSettings()
const settingsDisplayMode = ref<'separate' | 'superimposed'>(initial.displayMode ?? 'separate')
const mirrorMode    = ref<boolean>(!!initial.mirrorMode)
const showThreshold = ref<boolean>(initial.showThreshold !== false)
const showFill      = ref<boolean>(initial.showFill !== false)
const threshold     = ref<number>(initial.threshold ?? 0.26)

const refreshSettings = () => {
    const s = readRatioSettings()
    settingsDisplayMode.value = s.displayMode ?? 'separate'
    mirrorMode.value     = !!s.mirrorMode
    showThreshold.value  = s.showThreshold !== false
    showFill.value       = s.showFill !== false
    threshold.value      = s.threshold ?? 0.26
}

const unsubscribeAction = store.subscribeAction({
    after: (action) => {
        if (
            action.type === 'set-settings-value'
            && typeof action.payload?.field === 'string'
            && action.payload.field.startsWith('eeg.trends.ratio.')
        ) {
            refreshSettings()
            drawTrends()
        }
    },
})

const labelMode = computed<'separate' | 'superimposed'>(() =>
    props.displayMode ?? settingsDisplayMode.value
)

// ── Colors ────────────────────────────────────────────────────────────────────

const leftColor = computed((): SettingsColor =>
    (SETTINGS as Record<string, unknown> & { trace?: { color?: { sin?: SettingsColor } } })
        .trace?.color?.sin ?? [0.70, 0.20, 0.20, 1.0]
)
const rightColor = computed((): SettingsColor =>
    (SETTINGS as Record<string, unknown> & { trace?: { color?: { dex?: SettingsColor } } })
        .trace?.color?.dex ?? [0.10, 0.30, 0.80, 1.0]
)

const labelEntries = computed(() => [
    { side: 'L', label: t('Left'),  colorCss: settingsColorToRgba(leftColor.value)  },
    { side: 'R', label: t('Right'), colorCss: settingsColorToRgba(rightColor.value) },
])

const labelStyles = computed(() => {
    const h = canvasHeight.value
    if (labelMode.value === 'separate') {
        return [
            { position: 'absolute' as const, bottom: (h / 2 + 2) + 'px' },
            { position: 'absolute' as const, bottom: '2px' },
        ]
    }
    return [
        { position: 'absolute' as const, bottom: '2px' },
        { display: 'none' },
    ]
})

// ── Scale markers (right-side axis) ──────────────────────────────────────────
// Each slot in separate mode is its own [-1, +1] axis, so a full-canvas −1/0/+1 row
// would be misleading. The marker set below adapts to the layout:
//   superimposed         — three ticks: +1 / 0 / −1
//   separate, normal     — five ticks: +1, 0 (top slot mid), ∓1 (top reads −1,
//                          bottom reads +1 at the slot separator), 0 (bottom slot
//                          mid), −1
//   separate, mirrored   — five ticks: +1, 0, −1 (both slots pin to −1 at the
//                          separator in mirror mode), 0, +1 (mirror inverts the
//                          right slot so its bottom edge reads +1)
// The `anchor` field positions the label without it spilling past the canvas:
// `top` aligns the label below the tick line, `bottom` aligns it above, `middle`
// centres it.
type ScaleAnchor = 'top' | 'middle' | 'bottom'
type ScaleMarker = { key: string; y: number; label: string; anchor: ScaleAnchor }

const scaleMarkers = computed<ScaleMarker[]>(() => {
    if (!canvasHeight.value) return []
    const h = canvasHeight.value
    if (labelMode.value === 'superimposed') {
        return [
            { key: '+1', y: 1,     label: '+1', anchor: 'top'    },
            { key:  '0', y: h / 2, label:  '0', anchor: 'middle' },
            { key: '-1', y: h - 1, label: '−1', anchor: 'bottom' },
        ]
    }
    const separatorLabel = mirrorMode.value ? '−1' : '∓1'
    const bottomLabel    = mirrorMode.value ? '+1' : '−1'
    return [
        { key: '+1-top',     y: 1,           label: '+1',           anchor: 'top'    },
        { key: '0-top',      y: h / 4,       label: '0',            anchor: 'middle' },
        { key: 'separator',  y: h / 2,       label: separatorLabel, anchor: 'middle' },
        { key: '0-bottom',   y: 3 * h / 4,   label: '0',            anchor: 'middle' },
        { key: 'bottom',     y: h - 1,       label: bottomLabel,    anchor: 'bottom' },
    ]
})

// ── Canvas geometry helpers ───────────────────────────────────────────────────

function slotFor(side: 'L' | 'R'): { top: number; bottom: number } {
    const h = canvasHeight.value
    if (labelMode.value === 'separate') {
        const half = Math.floor(h / 2)
        return side === 'L' ? { top: 1, bottom: half } : { top: half, bottom: h - 1 }
    }
    return { top: 1, bottom: h - 1 }
}

/**
 * Map a ratio value to a canvas y-coordinate within a slot.
 *
 * @param v      value in [Y_MIN, Y_MAX]
 * @param slot   pixel bounds of the slot
 * @param invert true for the mirrored right slot (−1 at top, +1 at bottom)
 */
function valueToY(v: number, slot: { top: number; bottom: number }, invert: boolean): number {
    const h = slot.bottom - slot.top
    return invert
        ? slot.top  + (v - Y_MIN) / (Y_MAX - Y_MIN) * h
        : slot.bottom - (v - Y_MIN) / (Y_MAX - Y_MIN) * h
}

// ── Hemisphere trace drawing ──────────────────────────────────────────────────

function drawHemiTrace(
    ctx: CanvasRenderingContext2D,
    trend: BiosignalTrend,
    w: number,
    totalDuration: number,
    slot: { top: number; bottom: number },
    color: SettingsColor,
    invert: boolean,
    interruptions: { start: number; duration: number }[],
) {
    const signal = trend.signal
    const epochCount = signal.length
    if (!epochCount) {
        return
    }
    const pxPerSecond = w / totalDuration
    const pxPerEpoch = trend.epochLength * pxPerSecond
    const epochX = (i: number) => i * pxPerEpoch + pxPerEpoch / 2
    const getVal = (i: number) => signal[i]
    const isGap  = (i: number) => { const v = getVal(i); return v === undefined || isNaN(v) }
    const clamp  = (y: number) => Math.min(Math.max(y, slot.top), slot.bottom)

    // Zero y: in mirrored mode this is at the slot boundary (top for R, bottom for L).
    // In normal/superimposed mode it is at the slot midpoint.
    const zeroY = invert
        ? slot.top                    // mirrored R: zero at top (= separator)
        : valueToY(0, slot, false)    // normal: zero at midpoint

    const blendAlpha = labelMode.value === 'superimposed'
        ? (color[3] ?? 1) * 0.75
        : color[3] ?? 1

    // ── Fill ──────────────────────────────────────────────────────────────────
    // Fill represents the area between the threshold and the trace for contiguous
    // runs where `value > threshold` — visual cue: "this is how much, and for how
    // long, the index exceeds the abnormality threshold." Below-threshold epochs
    // render only the trace line, no fill.
    //
    // The run boundaries interpolate the exact x where the line crosses the
    // threshold (linear interpolation between the below- and above-threshold
    // samples on either side), so the polygon's left and right edges hug the trace
    // instead of forming vertical "bar" walls at epoch midpoints. That produces
    // visible leakage past sharp peaks otherwise.
    //
    // Requires both `showThreshold` (need a reference line to fill against) and
    // `showFill` (user toggle in the settings drawer).
    if (showThreshold.value && showFill.value) {
        const threshY = valueToY(threshold.value, slot, invert)
        const fillAlpha = blendAlpha * 0.5
        const fillStyle = settingsColorToRgba([color[0], color[1], color[2], fillAlpha])
        const t = threshold.value
        const exceeds = (i: number) => !isGap(i) && getVal(i) > t
        // Interpolate the x where the line between sample[a] and sample[b] crosses
        // threshold. Returns epochX(a) when the two samples coincide in value, which
        // collapses the polygon edge to the sample's own x (harmless).
        const crossingX = (a: number, b: number) => {
            const va = getVal(a)
            const vb = getVal(b)
            const denom = vb - va
            const frac = denom !== 0 ? (t - va) / denom : 0
            return epochX(a) + frac * (epochX(b) - epochX(a))
        }
        let runFrom = -1
        for (let i = 0; i <= epochCount; i++) {
            const above = i < epochCount && exceeds(i)
            if (above && runFrom === -1) {
                runFrom = i
            } else if (!above && runFrom !== -1) {
                const runTo = i - 1
                // Left edge: interpolate crossing with previous sample if it's below
                // threshold; otherwise anchor at the first above-threshold sample's x.
                const hasPrev = runFrom > 0 && !isGap(runFrom - 1)
                const hasNext = runTo < epochCount - 1 && !isGap(runTo + 1)
                const leftX  = hasPrev ? crossingX(runFrom - 1, runFrom) : epochX(runFrom)
                const rightX = hasNext ? crossingX(runTo, runTo + 1)     : epochX(runTo)
                ctx.beginPath()
                ctx.moveTo(leftX, threshY)
                for (let j = runFrom; j <= runTo; j++) {
                    ctx.lineTo(epochX(j), clamp(valueToY(getVal(j), slot, invert)))
                }
                ctx.lineTo(rightX, threshY)
                ctx.closePath()
                ctx.fillStyle = fillStyle
                ctx.fill()
                runFrom = -1
            }
        }
    }

    // ── Trace line ────────────────────────────────────────────────────────────
    ctx.strokeStyle = settingsColorToRgba([color[0], color[1], color[2], blendAlpha])
    ctx.lineWidth = Math.max(1, Math.min(Math.ceil(pxPerEpoch), 2))
    let runFrom = -1
    for (let i = 0; i <= epochCount; i++) {
        const gap = i === epochCount || isGap(i)
        if (!gap && runFrom === -1) {
            runFrom = i
        } else if (gap && runFrom !== -1) {
            ctx.beginPath()
            ctx.moveTo(epochX(runFrom), clamp(valueToY(getVal(runFrom), slot, invert)))
            for (let j = runFrom + 1; j <= i - 1; j++) {
                ctx.lineTo(epochX(j), clamp(valueToY(getVal(j), slot, invert)))
            }
            ctx.stroke()
            runFrom = -1
        }
    }

    // ── Interruption overlay ──────────────────────────────────────────────────
    const gapColor = (SETTINGS as Record<string, unknown> & { navigator?: { interruptionColor?: SettingsColor } })
        .navigator?.interruptionColor
    if (gapColor && interruptions.length) {
        ctx.fillStyle = settingsColorToRgba(gapColor)
        for (const { start, duration } of interruptions) {
            const x  = Math.floor(start * pxPerSecond)
            const gw = Math.max(Math.ceil(duration * pxPerSecond), 1)
            ctx.fillRect(x, slot.top, gw, slot.bottom - slot.top)
        }
    }

    // ── Zero line ─────────────────────────────────────────────────────────────
    ctx.strokeStyle = settingsColorToRgba([color[0], color[1], color[2], 0.25])
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(0, zeroY)
    ctx.lineTo(w, zeroY)
    ctx.stroke()
    ctx.setLineDash([])

    // ── Threshold line ────────────────────────────────────────────────────────
    if (showThreshold.value) {
        const threshY = valueToY(threshold.value, slot, invert)
        ctx.strokeStyle = settingsColorToRgba([color[0], color[1], color[2], 0.65])
        ctx.lineWidth = 1
        ctx.setLineDash([2, 4])
        ctx.beginPath()
        ctx.moveTo(0, threshY)
        ctx.lineTo(w, threshY)
        ctx.stroke()
        ctx.setLineDash([])
    }
}

// ── Main draw ─────────────────────────────────────────────────────────────────

function drawTrends() {
    const canvas = trendCanvas.value
    if (!canvas) {
        return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
        return
    }
    const w = canvasWidth.value
    const h = canvasHeight.value
    ctx.clearRect(0, 0, w, h)

    const totalDuration = RESOURCE.totalDuration
    const interruptions = (RESOURCE as unknown as { getInterruptions?: () => { start: number; duration: number }[] })
        .getInterruptions?.() ?? []
    const isMirrored = mirrorMode.value && labelMode.value === 'separate'

    if (totalDuration && trends.value.length) {
        // Trends are named `ratio-<id>` matching `aeeg.derivations[].id` (e.g. 'left', 'right').
        // Anything that doesn't end in `-left` or `-right` is skipped — the renderer is
        // hemisphere-specific by design.
        const sideOf = (name: string): 'L' | 'R' | null =>
            name.endsWith('-left') ? 'L' : name.endsWith('-right') ? 'R' : null
        for (const trend of trends.value) {
            const side = sideOf(trend.name)
            if (!side) continue
            const slot = slotFor(side)
            const color = side === 'L' ? leftColor.value : rightColor.value
            const invert = side === 'R' && isMirrored
            drawHemiTrace(ctx, trend, w, totalDuration, slot, color, invert, interruptions)
        }
    }

    // Borders + separator drawn LAST so the trace, fill, interruption overlay, and
    // dashed reference lines never overdraw the bottom/top edges.
    const borderColor = (SETTINGS as Record<string, unknown> & { navigator?: { borderColor?: SettingsColor } })
        .navigator?.borderColor
    if (borderColor) {
        ctx.fillStyle = settingsColorToRgba(borderColor)
        ctx.fillRect(0, 0, w, 1)
        ctx.fillRect(0, h - 1, w, 1)
        ctx.fillRect(0, 0, 1, h)
        ctx.fillRect(w - 1, 0, 1, h)
    }
    if (labelMode.value === 'separate') {
        const sepY = Math.floor(h / 2)
        ctx.fillStyle = borderColor ? settingsColorToRgba(borderColor) : 'rgba(128,128,128,0.4)'
        ctx.fillRect(0, sepY, w, 1)
    }

    drawViewbox()
}

// ── Viewbox ───────────────────────────────────────────────────────────────────

const drawViewbox = () => {
    const canvas = viewboxCanvas.value
    if (!canvas) {
        return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
        return
    }
    const w = canvasWidth.value
    ctx.clearRect(0, 0, w, VIEWBOX_BITMAP_HEIGHT)
    const totalDuration = RESOURCE.totalDuration
    if (!totalDuration) {
        return
    }
    const vbColor = (SETTINGS as Record<string, unknown> & { navigator?: { viewBoxColor?: SettingsColor } })
        .navigator?.viewBoxColor
    if (!vbColor) {
        return
    }
    const pxPerSecond = w / totalDuration
    const viewStart = RESOURCE.displayViewStart || 0
    const viewLen = Math.min(props.visibleRange, totalDuration - viewStart)
    if (viewLen <= 0) {
        return
    }
    ctx.fillStyle = settingsColorToRgba(vbColor)
    ctx.fillRect(
        Math.round(viewStart * pxPerSecond),
        0,
        Math.max(Math.round(viewLen * pxPerSecond), 1),
        VIEWBOX_BITMAP_HEIGHT,
    )
}

// ── Double-click navigation ───────────────────────────────────────────────────

const handleDblClick = (event: MouseEvent) => {
    const canvas = trendCanvas.value
    if (!canvas || !RESOURCE.totalDuration) {
        return
    }
    const xPos = event.clientX - canvas.getBoundingClientRect().left
    emit('navigation', RESOURCE.totalDuration * xPos / canvas.width)
}

// ── Watchers / lifecycle ──────────────────────────────────────────────────────

watch(canvasHeight, () => drawTrends(), { flush: 'post' })
watch(canvasWidth, () => { drawTrends(); drawViewbox() }, { flush: 'post' })
watch(() => props.visibleRange, () => drawViewbox())
watch(labelMode, () => drawTrends())
watch(mirrorMode, () => drawTrends())

onMounted(() => {
    RESOURCE.onPropertyChange('displayViewStart', drawViewbox, ID)
    RESOURCE.onPropertyChange('interruptions', drawTrends, ID)
    drawViewbox()
})

onBeforeUnmount(() => {
    unsubscribeAction()
    RESOURCE.removeAllEventListeners(ID)
})
</script>

<style scoped>
[data-component="ratio-renderer"] {
    box-sizing: border-box;
    display: flex;
    height: 100%;
    padding-top: 0.5rem;
    position: relative;
    width: 100%;
}
.labels {
    display: flex;
    flex: 0 0 80px;
    flex-direction: column;
    justify-content: flex-end;
    padding: 0 0.5rem 0.25rem;
    position: relative;
}
    .side-label {
        align-items: center;
        display: flex;
        font-size: 0.75rem;
        gap: 0.25rem;
        position: absolute;
        right: 0.5rem;
    }
    .dot {
        border-radius: 50%;
        display: inline-block;
        flex: 0 0 0.5rem;
        height: 0.5rem;
        width: 0.5rem;
    }
.plot {
    flex: 1 1 auto;
    padding-right: 30px;
    position: relative;
}
    .plot > canvas {
        display: block;
    }
    .plot > canvas + canvas {
        left: 0;
        pointer-events: none;
        position: absolute;
        top: 0;
    }
    .scale {
        height: 100%;
        pointer-events: none;
        position: absolute;
        top: 0;
        width: 0;
    }
        /* Marker box's top-left sits exactly at the value's y so the tick line
           (its first child) always lands on the intended row regardless of label
           anchor. Only the LABEL's vertical position varies per anchor — keeping
           the tick anchored avoids the earlier bug where `translateY(-100%)`
           silently shifted the tick line itself up by ~13 px. */
        .scale-marker {
            position: absolute;
            right: 0;
            width: 0;
        }
            .scale-tick {
                background: var(--wa-color-text-quiet);
                display: block;
                height: 1px;
                opacity: 0.5;
                width: 6px;
            }
            .scale-text {
                color: var(--wa-color-text-quiet);
                font-size: 0.6rem;
                left: 0.5rem;
                position: absolute;
                top: 0;
                transform: translateY(-50%);
                white-space: nowrap;
            }
            /* Top label: centred on the tick. The wrapper's padding-top (0.5 rem)
               gives the upper half of the label room above the canvas. */
            .scale-marker.anchor-top .scale-text {
                transform: translateY(-50%);
            }
            /* Bottom label: shifted just above the tick so it isn't clipped by the
               parent's overflow, but sits a few pixels lower than fully-above so it
               still reads as paired with the tick. */
            .scale-marker.anchor-bottom .scale-text {
                transform: translateY(calc(-100% + 4px));
            }
</style>
