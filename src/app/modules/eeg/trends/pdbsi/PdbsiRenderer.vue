<template>
    <div data-component="pdbsi-renderer">
        <div class="label">
            <span class="dot" :style="{ background: colorCss }"></span>
            {{ t('pdBSI') }}
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
 * PdbsiRenderer — draws the pairwise derived Brain Symmetry Index (pdBSI)
 * as a single line on a fixed [0, 1] y-axis.
 *
 * Signal layout (from BiosignalTrend.signal):
 *   flat [v₀, v₁, v₂, …] — one scalar per epoch (no hemispheric split).
 *
 * pdBSI = 0 → perfect hemispheric symmetry (normal).
 * pdBSI = 1 → maximal asymmetry (pathological).
 *
 * Fill semantics
 * ──────────────
 * With showFill on, the area between 0 (baseline) and the trace is filled at low
 * opacity. A higher value means more asymmetry and thus more fill — the visual
 * weight increases toward the pathological end.
 *
 * Threshold crossing
 * ──────────────────
 * When showThreshold is on, a dashed threshold reference line is drawn at the
 * configured value. The threshold itself is editable from the trend settings drawer;
 * there is no dedicated right-axis tick because the value is already visible via the
 * in-plot dashed line.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useStore } from 'vuex'
import { T } from '#i18n'
import { settingsColorToRgba } from '@epicurrents/core/util'
import { useTrendController } from '../useTrendController'
import type { SettingsColor } from '@epicurrents/core/types'

const SCOPE = 'PdbsiRenderer'
const VIEWBOX_BITMAP_HEIGHT = 1
const LABEL_GUTTER_WIDTH = 80
const Y_MIN = 0
const Y_MAX = 1
// Must match `padding-top` on `[data-component="pdbsi-renderer"]` below — the canvas
// extends past the wrapper's content box by this amount otherwise, hiding the bottom
// border (and the last sample of the trace) under the container's overflow.
const TOP_PADDING = 8

const props = defineProps<{
    controlsOpen: boolean
    displayMode: 'separate' | 'superimposed' | null   // unused but required by the slot contract
    height: number
    visibleRange: number
    width: number
}>()

const emit = defineEmits<{ navigation: [position: number] }>()

const t = (key: string, params: Record<string, unknown> = {}) => T(key, SCOPE, params)

const trendCanvas = ref<HTMLCanvasElement | null>(null)
const viewboxCanvas = ref<HTMLCanvasElement | null>(null)

const store = useStore()
const controller = useTrendController(SCOPE, 'pdbsi', () => drawTrend())
const { ID, RESOURCE, SETTINGS, trends } = controller

const rightReservedWidth = computed(() => props.controlsOpen ? 210 : 30)
const canvasHeight = computed(() => Math.max(0, props.height - TOP_PADDING))
const canvasWidth = computed(() =>
    Math.max(0, props.width - LABEL_GUTTER_WIDTH - rightReservedWidth.value))

// ── Settings ──────────────────────────────────────────────────────────────────
// SETTINGS is a non-reactive proxy — Vue computeds wrapping reads from it never
// invalidate when the store changes (the values land in the INTERFACE singleton,
// not in reactive state). Mirror them into refs and refresh on the
// `set-settings-value` action; same pattern as `AeegRenderer.vue`.

type PdbsiSettings = { showFill?: boolean; showThreshold?: boolean; threshold?: number }
const readPdbsiSettings = (): PdbsiSettings =>
    (SETTINGS as Record<string, unknown> & { trends?: { pdbsi?: PdbsiSettings } }).trends?.pdbsi ?? {}

const initial = readPdbsiSettings()
const showFill      = ref<boolean>(initial.showFill      !== false)  // default on
const showThreshold = ref<boolean>(initial.showThreshold !== false)  // default on
const threshold     = ref<number>(initial.threshold ?? 0.52)         // ELECTRA-STROKE

const refreshSettings = () => {
    const s = readPdbsiSettings()
    showFill.value      = s.showFill !== false
    showThreshold.value = s.showThreshold !== false
    threshold.value     = s.threshold ?? 0.52
}

const unsubscribeAction = store.subscribeAction({
    after: (action) => {
        if (
            action.type === 'set-settings-value'
            && typeof action.payload?.field === 'string'
            && action.payload.field.startsWith('eeg.trends.pdbsi.')
        ) {
            refreshSettings()
            drawTrend()
        }
    },
})

// ── Color ─────────────────────────────────────────────────────────────────────
// pdBSI has no hemispheric split; use the mid/central color from the palette.

const color = computed((): SettingsColor =>
    (SETTINGS as Record<string, unknown> & { trace?: { color?: { mid?: SettingsColor } } })
        .trace?.color?.mid ?? [0.20, 0.55, 0.35, 1.0]
)

const colorCss = computed(() => settingsColorToRgba(color.value))

// ── Scale markers ─────────────────────────────────────────────────────────────

// Threshold tick is intentionally not part of the axis scale — the threshold value
// is changed from the settings drawer and read off the dashed line drawn inside the
// plot. The `anchor` field positions each label without it spilling past the canvas:
// `top` aligns the label below the tick line, `bottom` aligns it above, `middle`
// centres it.
type ScaleAnchor = 'top' | 'middle' | 'bottom'
const scaleMarkers = computed<{ key: string; y: number; label: string; anchor: ScaleAnchor }[]>(() => {
    if (!canvasHeight.value) {
        return []
    }
    const h = canvasHeight.value
    const toY = (v: number) => h - 1 - v * (h - 2)
    return [
        { key: '1',    y: toY(1),   label: '1',   anchor: 'top'    },
        { key: '0.5',  y: toY(0.5), label: '0.5', anchor: 'middle' },
        { key: '0',    y: toY(0),   label: '0',   anchor: 'bottom' },
    ]
})

// ── Drawing ───────────────────────────────────────────────────────────────────

function valueToY(v: number, h: number): number {
    return h - 1 - (v - Y_MIN) / (Y_MAX - Y_MIN) * (h - 2)
}

function drawTrend() {
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

    const borderColor = (SETTINGS as Record<string, unknown> & { navigator?: { borderColor?: SettingsColor } })
        .navigator?.borderColor

    const totalDuration = RESOURCE.totalDuration
    const trend = trends.value[0]
    const epochCount = trend?.signal.length ?? 0
    if (!totalDuration || !trend || !epochCount) {
        // Even without data, still paint the borders so the empty strip frames the
        // expected plot area.
        if (borderColor) {
            ctx.fillStyle = settingsColorToRgba(borderColor)
            ctx.fillRect(0, 0, w, 1)
            ctx.fillRect(0, h - 1, w, 1)
            ctx.fillRect(0, 0, 1, h)
            ctx.fillRect(w - 1, 0, 1, h)
        }
        return
    }

    const signal     = trend.signal
    const pxPerSecond = w / totalDuration
    const pxPerEpoch  = trend.epochLength * pxPerSecond
    const epochX      = (i: number) => i * pxPerEpoch + pxPerEpoch / 2
    const getVal      = (i: number) => signal[i]
    const isGap       = (i: number) => { const v = getVal(i); return v === undefined || isNaN(v) }
    const clamp       = (y: number) => Math.min(Math.max(y, 1), h - 1)

    const col    = color.value
    const alpha  = col[3] ?? 1
    const interruptions = (RESOURCE as unknown as { getInterruptions?: () => { start: number; duration: number }[] })
        .getInterruptions?.() ?? []

    // ── Fill ──────────────────────────────────────────────────────────────────
    // Fill represents the area between the threshold and the trace for contiguous
    // runs where `value > threshold` — visual cue: "this is how much the index
    // exceeds the abnormality threshold over time." Below-threshold epochs render
    // only the trace line. Run boundaries linearly interpolate the threshold
    // crossing so the polygon hugs the trace instead of forming vertical "bar"
    // walls at epoch midpoints (which leak past sharp peaks). Requires both
    // `showThreshold` (need a reference line) and `showFill` (user toggle).
    if (showFill.value && showThreshold.value) {
        const threshY = valueToY(threshold.value, h)
        const fillStyle = settingsColorToRgba([col[0], col[1], col[2], alpha * 0.5])
        const t = threshold.value
        const exceeds = (i: number) => !isGap(i) && getVal(i) > t
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
                const hasPrev = runFrom > 0 && !isGap(runFrom - 1)
                const hasNext = runTo < epochCount - 1 && !isGap(runTo + 1)
                const leftX  = hasPrev ? crossingX(runFrom - 1, runFrom) : epochX(runFrom)
                const rightX = hasNext ? crossingX(runTo, runTo + 1)     : epochX(runTo)
                ctx.beginPath()
                ctx.moveTo(leftX, threshY)
                for (let j = runFrom; j <= runTo; j++) {
                    ctx.lineTo(epochX(j), clamp(valueToY(getVal(j), h)))
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
    ctx.strokeStyle = settingsColorToRgba([col[0], col[1], col[2], alpha])
    ctx.lineWidth = Math.max(1, Math.min(Math.ceil(pxPerEpoch), 2))
    let runFrom = -1
    for (let i = 0; i <= epochCount; i++) {
        const gap = i === epochCount || isGap(i)
        if (!gap && runFrom === -1) {
            runFrom = i
        } else if (gap && runFrom !== -1) {
            ctx.beginPath()
            ctx.moveTo(epochX(runFrom), clamp(valueToY(getVal(runFrom), h)))
            for (let j = runFrom + 1; j <= i - 1; j++) {
                ctx.lineTo(epochX(j), clamp(valueToY(getVal(j), h)))
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
            ctx.fillRect(x, 1, gw, h - 2)
        }
    }

    // ── Threshold line ────────────────────────────────────────────────────────
    if (showThreshold.value) {
        const threshY = valueToY(threshold.value, h)
        ctx.strokeStyle = settingsColorToRgba([col[0], col[1], col[2], 0.65])
        ctx.lineWidth = 1
        ctx.setLineDash([2, 4])
        ctx.beginPath()
        ctx.moveTo(0, threshY)
        ctx.lineTo(w, threshY)
        ctx.stroke()
        ctx.setLineDash([])
    }

    // Borders drawn LAST so the trace/fill/threshold line never overdraw the edges.
    if (borderColor) {
        ctx.fillStyle = settingsColorToRgba(borderColor)
        ctx.fillRect(0, 0, w, 1)
        ctx.fillRect(0, h - 1, w, 1)
        ctx.fillRect(0, 0, 1, h)
        ctx.fillRect(w - 1, 0, 1, h)
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

watch(canvasHeight, () => drawTrend(), { flush: 'post' })
watch(canvasWidth, () => { drawTrend(); drawViewbox() }, { flush: 'post' })
watch(() => props.visibleRange, () => drawViewbox())

onMounted(() => {
    RESOURCE.onPropertyChange('displayViewStart', drawViewbox, ID)
    RESOURCE.onPropertyChange('interruptions', drawTrend, ID)
    drawViewbox()
})

onBeforeUnmount(() => {
    unsubscribeAction()
    RESOURCE.removeAllEventListeners(ID)
})
</script>

<style scoped>
[data-component="pdbsi-renderer"] {
    box-sizing: border-box;
    display: flex;
    height: 100%;
    padding-top: 0.5rem;
    position: relative;
    width: 100%;
}
.label {
    align-items: flex-end;
    display: flex;
    flex: 0 0 80px;
    font-size: 0.75rem;
    gap: 0.25rem;
    padding: 0 0.5rem 0.25rem;
}
    .dot {
        border-radius: 50%;
        display: inline-block;
        flex: 0 0 0.5rem;
        height: 0.5rem;
        margin-bottom: 0.15rem;
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
        /* See `RatioRenderer.vue` for the rationale behind the anchor scheme —
           tick stays at y, label vertical position varies per anchor. */
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
            .scale-marker.anchor-top .scale-text {
                transform: translateY(-50%);
            }
            .scale-marker.anchor-bottom .scale-text {
                transform: translateY(calc(-100% + 4px));
            }
</style>
