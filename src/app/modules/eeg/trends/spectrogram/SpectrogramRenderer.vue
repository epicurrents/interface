<template>
    <div data-component="spectrogram-renderer">
        <div class="labels" :class="`layout-${labelMode}`">
            <div
                v-for="(entry, i) in labelEntries"
                :key="entry.name"
                class="trend-label"
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
                    top: (TOP_PADDING + 1) + 'px',
                    width: canvasWidth + 'px',
                    height: Math.max(0, canvasHeight - 2) + 'px',
                }"
                :width="canvasWidth"
            ></canvas>
            <svg
                class="overlay"
                :style="{ top: TOP_PADDING + 'px' }"
                :width="canvasWidth"
                :height="canvasHeight"
            >
                <rect
                    v-for="r in gapRects"
                    :key="r.key"
                    :x="r.x"
                    :y="r.y"
                    :width="r.w"
                    :height="r.h"
                    :fill="gapFill"
                />
                <line
                    v-for="y in separatorYs"
                    :key="y"
                    x1="0"
                    :x2="canvasWidth"
                    :y1="y"
                    :y2="y"
                    :stroke="separatorStroke"
                    stroke-width="1"
                    shape-rendering="crispEdges"
                />
            </svg>
        </div>
    </div>
</template>

<script setup lang="ts">
/**
 * SpectrogramRenderer — draws per-hemisphere power spectrograms as time-frequency
 * heatmaps using the hot colormap (black → red → yellow → white = increasing power).
 *
 * Signal layout (from BiosignalTrend.signal):
 *   flat [p₀_t0, p₁_t0, …, p(N-1)_t0, p₀_t1, …] where N = trend.frequencyBins.
 *   epoch i, bin k → signal[i * N + k].
 *
 * Each trend corresponds to one hemisphere (L or R). Up to two trends are shown
 * stacked vertically, matching the aEEG / ratio strip layout.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useStore } from 'vuex'
import { settingsColorToRgba } from '@epicurrents/core/util'
import { useTrendController } from '../useTrendController'
import { useTrendCanvas } from '../useTrendCanvas'
import type { SettingsColor } from '@epicurrents/core/types'

const SCOPE = 'SpectrogramRenderer'
const VIEWBOX_BITMAP_HEIGHT = 1
const LABEL_GUTTER_WIDTH = 80
const TOP_PADDING = 8

const props = defineProps<{
    controlsOpen: boolean
    displayMode: 'separate' | 'superimposed' | null
    height: number
    visibleRange: number
    width: number
}>()

const emit = defineEmits<{ navigation: [position: number] }>()

const trendCanvas  = ref<HTMLCanvasElement | null>(null)
const viewboxCanvas = ref<HTMLCanvasElement | null>(null)

const store = useStore()
const controller = useTrendController(SCOPE, 'spectrogram', () => drawTrends())
const { ID, RESOURCE, SETTINGS, trends } = controller
const trendBacking = useTrendCanvas()

type SpectrogramCfg = { displayMode?: string; mode?: string }
const spectrogramCfg = () =>
    (SETTINGS as Record<string, unknown> & { trends?: { spectrogram?: SpectrogramCfg } })
        .trends?.spectrogram ?? {}

/** `'power'` (brightness encodes power) or `'proportion'` (column height encodes relative share). */
const spectrogramMode = ref<'power' | 'proportion'>(
    (spectrogramCfg().mode as 'power' | 'proportion') ?? 'proportion'
)

const unsubscribeAction = store.subscribeAction({
    after: (action) => {
        if (action.type === 'eeg.set-spectrogram-display-mode' ||
            action.type === 'eeg.set-spectrogram-mode'         ||
            action.type === 'set-settings-value') {
            const prevMode        = spectrogramMode.value
            const prevDisplayMode = settingsDisplayMode.value
            spectrogramMode.value     = (spectrogramCfg().mode as 'power' | 'proportion') ?? 'proportion'
            settingsDisplayMode.value = spectrogramCfg().displayMode as 'separate' | 'superimposed' || 'separate'
            // Only do a full invalidating redraw when a VISUAL setting changes.
            // epochLength changes don't affect the current rendering; they require a
            // manual recompute and must not trigger an O(n) full redraw on every keystroke.
            if (spectrogramMode.value !== prevMode || settingsDisplayMode.value !== prevDisplayMode) {
                invalidate()
            }
            drawTrends()
        }
    },
})

const rightReservedWidth = computed(() => props.controlsOpen ? 210 : 30)
const canvasHeight = computed(() => Math.max(0, props.height - TOP_PADDING))
const canvasWidth  = computed(() =>
    Math.max(0, props.width - LABEL_GUTTER_WIDTH - rightReservedWidth.value))

// ── SVG overlay (gaps + separator) ───────────────────────────────────────────
// These are drawn in an SVG on top of the backing-canvas blit so they are always
// at native 1 px width — unaffected by the backing canvas scaling during resize.

const interruptions = ref<{ start: number, duration: number }[]>([])

const pxPerSecond = computed(() =>
    canvasWidth.value / (RESOURCE.totalDuration || 1)
)

const gapRects = computed(() => {
    const rects: { key: string, x: number, y: number, w: number, h: number }[] = []
    const pps   = pxPerSecond.value
    const count = trends.value.length
    for (const { start, duration } of interruptions.value) {
        const x = Math.floor(start * pps)
        const w = Math.max(Math.ceil(duration * pps), 1)
        for (let ti = 0; ti < count; ti++) {
            const slot = slotFor(ti, count)
            rects.push({ key: `${start}-${ti}`, x, y: slot.top, w, h: slot.bottom - slot.top })
        }
    }
    return rects
})

const separatorYs = computed(() => {
    const count = trends.value.length
    if (labelMode.value !== 'separate' || count <= 1) {
        return [] as number[]
    }
    return Array.from({ length: count - 1 }, (_, i) => slotFor(i, count).bottom)
})

const gapFill = computed(() => {
    const c = (SETTINGS as Record<string, unknown> & { navigator?: { interruptionColor?: SettingsColor } })
        .navigator?.interruptionColor
    return c ? settingsColorToRgba(c) : 'rgba(180,180,180,1)'
})

const separatorStroke = computed(() => {
    const c = (SETTINGS as Record<string, unknown> & { navigator?: { borderColor?: SettingsColor } })
        .navigator?.borderColor
    return c ? settingsColorToRgba(c) : 'rgba(0,0,0,0.3)'
})

const settingsDisplayMode = ref<'separate' | 'superimposed'>('separate')
const labelMode = computed<'separate' | 'superimposed'>(() =>
    props.displayMode ?? settingsDisplayMode.value)

// ── Colors ────────────────────────────────────────────────────────────────────

const leftColor = computed((): SettingsColor =>
    (SETTINGS as Record<string, unknown> & { trace?: { color?: { sin?: SettingsColor } } })
        .trace?.color?.sin ?? [0.70, 0.20, 0.20, 1.0]
)
const rightColor = computed((): SettingsColor =>
    (SETTINGS as Record<string, unknown> & { trace?: { color?: { dex?: SettingsColor } } })
        .trace?.color?.dex ?? [0.10, 0.30, 0.80, 1.0]
)

const labelEntries = computed(() =>
    trends.value.map((tr, i) => ({
        name:     tr.name,
        label:    tr.label,
        colorCss: settingsColorToRgba(i === 0 ? leftColor.value : rightColor.value),
    }))
)

const labelStyles = computed(() => {
    const h = canvasHeight.value
    const n = trends.value.length || 1
    if (labelMode.value === 'separate') {
        const slotH = Math.floor(h / n)
        return trends.value.map((_, i) => ({
            position: 'absolute' as const,
            bottom: (n - 1 - i) * slotH + 2 + 'px',
        }))
    }
    return trends.value.map(() => ({ position: 'absolute' as const, bottom: '2px' }))
})

// ── Frequency-colour mapping ──────────────────────────────────────────────────
// Hue encodes frequency position (bin 0 = DC = red, bin N = maxFreq = blue),
// brightness encodes normalised power (0 = black, 1 = full colour).
// This matches the conventional EEG spectrogram palette: low-freq activity
// appears as red, high-freq activity as blue, silence as black.

/**
 * @param binFrac  - Frequency fraction 0…1 (0 = DC, 1 = maxFreq).
 * @param brightness - Normalised power 0…1 (HSV value channel).
 */
function freqRgba (binFrac: number, brightness: number): [number, number, number] {
    // Hue: 0° (red) at low freq → 240° (blue) at high freq.
    const h = binFrac * 240
    const v = brightness
    const x = v * (1 - Math.abs((h / 60) % 2 - 1))
    let r = 0, g = 0, b = 0
    if      (h < 60)  { r = v; g = x; b = 0 }
    else if (h < 120) { r = x; g = v; b = 0 }
    else if (h < 180) { r = 0; g = v; b = x }
    else              { r = 0; g = x; b = v }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function slotFor (index: number, count: number): { top: number; bottom: number } {
    const h = canvasHeight.value
    if (labelMode.value === 'superimposed' || count <= 1) {
        return { top: 1, bottom: h - 1 }
    }
    const slotH = Math.floor((h - 2) / count)
    const top    = 1 + index * slotH
    const bottom = index === count - 1 ? h - 1 : top + slotH
    return { top, bottom }
}

// ── Incremental draw state ────────────────────────────────────────────────────
// Plain (non-reactive) variables — mutated on the hot drawing path.
// drawnEpochCounts tracks how many epochs per trend have been rendered so far.
// Only new epochs are drawn on each `trend-epoch` event; no historical re-scan.
const _drawnEpochCounts = new Map<string, number>()
let   _cachedMaxPow     = 1e-10  // grows monotonically; used by power mode
let   _needsFullRedraw  = true   // cleared after the first full-canvas setup

/** Force a full canvas clear + border redraw on the next drawTrends call. */
function invalidate () {
    trendBacking.cancelScheduledRedraw()
    _drawnEpochCounts.clear()
    _cachedMaxPow    = 1e-10
    _needsFullRedraw = true
}

function drawTrends () {
    if (!trendCanvas.value) return
    const w = canvasWidth.value
    const h = canvasHeight.value

    if (_needsFullRedraw) {
        // Reset backing canvas to the current display size (clears content).
        trendBacking.reset(w, h)
    }
    const ctx = trendBacking.getContext()
    if (!ctx) return

    if (_needsFullRedraw) {
        ctx.clearRect(0, 0, w, h)
        const bc = (SETTINGS as Record<string, unknown> & { navigator?: { borderColor?: SettingsColor } })
            .navigator?.borderColor
        if (bc) {
            ctx.fillStyle = settingsColorToRgba(bc)
            ctx.fillRect(0, 0, w, 1);  ctx.fillRect(0, h - 1, w, 1)
            ctx.fillRect(0, 0, 1, h);  ctx.fillRect(w - 1, 0, 1, h)
        }
        _needsFullRedraw = false
    }

    const totalDuration = RESOURCE.totalDuration
    if (!totalDuration || !trends.value.length) return

    const trendList = trends.value
    const pps       = pxPerSecond.value
    const mode        = spectrogramMode.value

    for (let ti = 0; ti < trendList.length; ti++) {
        const trend  = trendList[ti]
        const signal = trend.signal
        const bins   = trend.frequencyBins
        if (!bins || !signal.length) continue

        const slot       = slotFor(ti, trendList.length)
        const slotH      = slot.bottom - slot.top
        const epochCount = Math.floor(signal.length / bins)
        if (!epochCount) continue

        const pxPerEpoch = trend.epochLength * pps
        const colPixels  = Math.max(1, Math.ceil(pxPerEpoch))

        // ── Incremental start: only process epochs we haven't drawn yet ───────
        const startEi = _drawnEpochCounts.get(trend.name) ?? 0

        // Power mode: update the cached max from new epochs only (O(new × bins)).
        if (mode === 'power') {
            for (let ei = startEi; ei < epochCount; ei++) {
                for (let k = 0; k < bins; k++) {
                    const v = signal[ei * bins + k]
                    if (v && v > _cachedMaxPow) _cachedMaxPow = v
                }
            }
        }
        const logMax = Math.log10(_cachedMaxPow + 1)

        for (let ei = startEi; ei < epochCount; ei++) {
            const xLeft = Math.round(ei * pxPerEpoch)
            if (xLeft >= w) break

            if (mode === 'power') {
                // Skip gap epochs — their signal slots are all undefined/zero.
                // Drawing them produces solid black which the interruption overlay
                // would then have to overwrite on every pass.
                let hasData = false
                const base = ei * bins
                for (let k = 0; k < bins; k++) {
                    if (signal[base + k]) { hasData = true; break }
                }
                if (!hasData) continue

                const rowPixels = Math.max(1, Math.ceil(slotH / bins))
                const imgH      = rowPixels * bins
                const imgData   = ctx.createImageData(colPixels, imgH)
                const data      = imgData.data
                for (let k = 0; k < bins; k++) {
                    const power      = signal[base + k] || 0
                    const brightness = logMax > 0 ? Math.log10(power + 1) / logMax : 0
                    const binFrac    = bins > 1 ? k / (bins - 1) : 0
                    const [r, g, b]  = freqRgba(binFrac, brightness)
                    const yPx = (bins - 1 - k) * rowPixels
                    for (let dy = 0; dy < rowPixels; dy++) {
                        for (let dx = 0; dx < colPixels; dx++) {
                            const idx = ((yPx + dy) * colPixels + dx) * 4
                            data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255
                        }
                    }
                }
                ctx.putImageData(imgData, xLeft, slot.top)
            } else {
                // ── Proportion mode ───────────────────────────────────────────
                let total = 0
                for (let k = 0; k < bins; k++) {
                    const v = signal[ei * bins + k]
                    if (v && isFinite(v)) total += v * (k + 1)
                }
                if (!isFinite(total) || total <= 0) continue

                let yBottom = slot.bottom
                for (let k = 0; k < bins; k++) {
                    if (yBottom <= slot.top) break
                    const v    = signal[ei * bins + k]
                    const prop = (v && isFinite(v) ? v * (k + 1) : 0) / total
                    const rawH = k === bins - 1
                        ? (yBottom - slot.top)
                        : Math.max(1, Math.round(prop * slotH))
                    const drawT = Math.max(slot.top, yBottom - rawH)
                    const segH  = yBottom - drawT
                    if (segH > 0) {
                        const [r, g, b] = freqRgba(bins > 1 ? k / (bins - 1) : 0, 1.0)
                        ctx.fillStyle = `rgb(${r},${g},${b})`
                        ctx.fillRect(xLeft, drawT, colPixels, segH)
                    }
                    yBottom = drawT
                }
            }
        }

        _drawnEpochCounts.set(trend.name, epochCount)
    }

    // Copy backing canvas to the visible display canvas.
    // Gaps and separator are handled by the SVG overlay — no canvas drawing needed.
    trendBacking.blit(trendCanvas.value)
    drawViewbox()
}

// ── Viewbox ───────────────────────────────────────────────────────────────────

const drawViewbox = () => {
    const canvas = viewboxCanvas.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvasWidth.value
    ctx.clearRect(0, 0, w, VIEWBOX_BITMAP_HEIGHT)
    const totalDuration = RESOURCE.totalDuration
    if (!totalDuration) return
    const vbColor = (SETTINGS as Record<string, unknown> & { navigator?: { viewBoxColor?: SettingsColor } })
        .navigator?.viewBoxColor
    if (!vbColor) return
    const pxPerSecond = w / totalDuration
    const viewStart   = RESOURCE.displayViewStart || 0
    const viewLen     = Math.min(props.visibleRange, totalDuration - viewStart)
    if (viewLen <= 0) return
    ctx.fillStyle = settingsColorToRgba(vbColor)
    ctx.fillRect(
        Math.round(viewStart * pxPerSecond), 0,
        Math.max(Math.round(viewLen * pxPerSecond), 1), VIEWBOX_BITMAP_HEIGHT,
    )
}

// ── Double-click navigation ───────────────────────────────────────────────────

const handleDblClick = (event: MouseEvent) => {
    const canvas = trendCanvas.value
    if (!canvas || !RESOURCE.totalDuration) return
    const xPos = event.clientX - canvas.getBoundingClientRect().left
    emit('navigation', RESOURCE.totalDuration * xPos / canvas.width)
}

// ── Watchers / lifecycle ──────────────────────────────────────────────────────

// On resize: instantly blit the scaled backing canvas so the strip stays responsive,
// then schedule a debounced quality-redraw so content is crisp after the drag settles.
// This makes resize O(1) instead of O(epochs).
const scheduleQualityRedraw = () => {
    trendBacking.scheduleRedraw(() => { invalidate(); drawTrends() })
}
watch(canvasHeight, (h) => {
    trendBacking.resizeAndPreserve(canvasWidth.value, h)
    trendBacking.blit(trendCanvas.value)
    scheduleQualityRedraw()
}, { flush: 'post' })
watch(canvasWidth, (w) => {
    trendBacking.resizeAndPreserve(w, canvasHeight.value)
    trendBacking.blit(trendCanvas.value)
    drawViewbox()
    scheduleQualityRedraw()
}, { flush: 'post' })
watch(spectrogramMode, () => { invalidate(); drawTrends() })
watch(labelMode,       () => { invalidate(); drawTrends() })
watch(() => props.visibleRange, () => drawViewbox())

const refreshInterruptions = () => {
    interruptions.value = (RESOURCE as unknown as { getInterruptions?: () => { start: number, duration: number }[] })
        .getInterruptions?.() ?? []
}

onMounted(() => {
    RESOURCE.onPropertyChange('displayViewStart', drawViewbox, ID)
    // Keep the reactive interruptions ref in sync so the SVG overlay updates.
    RESOURCE.onPropertyChange('interruptions', refreshInterruptions, ID)
    refreshInterruptions()
    // Trends list change (removeAllTrends + rebuild, possibly with different epoch length):
    // subscribe in 'before' phase so invalidate() always runs BEFORE useTrendController's
    // refreshTrends fires drawTrends(). An async watch() would have a race condition here.
    //
    // Crucially, only invalidate when trends are REMOVED (map becomes empty) — not when
    // new trends are added one by one. Unconditional invalidation fires on every addTrend
    // call, clearing drawnEpochCounts mid-computation and desynchronising Left vs Right.
    RESOURCE.onPropertyChange('trends', () => {
        if (Object.keys(RESOURCE.trends).length === 0) invalidate()
    }, ID, 'before')
    drawViewbox()
})

onBeforeUnmount(() => {
    unsubscribeAction()
    RESOURCE.removeAllEventListeners(ID)
})
</script>

<style scoped>
[data-component="spectrogram-renderer"] {
    box-sizing: border-box;
    display: flex;
    height: 100%;
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
    .trend-label {
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
    padding-top: 0.5rem;
    position: relative;
}
    .plot > canvas {
        display: block;
    }
    .plot > canvas + canvas,
    .plot > svg.overlay {
        left: 0;
        pointer-events: none;
        position: absolute;
        top: 0;
    }
</style>
