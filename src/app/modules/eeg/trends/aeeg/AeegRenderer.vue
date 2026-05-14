<template>
    <div data-component="aeeg-renderer">
        <div class="derivations" :class="`layout-${labelMode}`">
            <div v-for="(entry, i) in renderedTrends" :key="entry.name"
                class="derivation-label"
                :style="{ ...(labelStyles[i] || {}), color: entry.colorCss }"
            >
                {{ entry.label }}
            </div>
            <div v-if="!renderedTrends.length" class="derivation-empty">
                <div>{{ t('No trend') }}</div>
            </div>
        </div>
        <div class="plot">
            <canvas
                ref="trendCanvas"
                :height="canvasHeight"
                :width="canvasWidth"
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
            <div v-if="scaleMarkers.length"
                class="scale"
                :style="{ right: rightReservedWidth + 'px' }"
            >
                <div v-for="m in scaleMarkers" :key="m.key"
                    class="scale-marker"
                    :class="{ labelled: m.label }"
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
 * aEEG renderer — body of the trend strip when `selectedTrend === 'aeeg'`.
 *
 * Owns everything visual inside the strip apart from the cog / recompute controls (which live
 * in `EegTrend.vue`'s controls drawer). That means:
 *   - left-side label gutter with side-aware colors (sin / dex / mid)
 *   - main trend canvas (per-epoch min/max bands on the Hellström-Westas semi-log scale)
 *   - lightweight viewbox canvas (red view-position bar, 1 px bitmap stretched via CSS)
 *   - right-aligned amplitude scale ticks
 *
 * The chrome passes `controlsOpen` so the renderer can reserve the same right padding the
 * cog drawer occupies — keeping the canvas's right edge aligned with the navigator below.
 *
 * Trend list maintenance (which `BiosignalTrend`s to draw, when to repaint) is delegated to
 * the `useTrendController` composable.
 */
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { T } from '#i18n'
import { settingsColorToRgba } from '@epicurrents/core/util'
import { useTrendController } from '../useTrendController'
import type { BiosignalTrend, SettingsColor } from '@epicurrents/core/types'
import type { EegAmplitudeIntegratedTrend } from '@epicurrents/eeg-module'

const SCOPE = 'AeegRenderer'

const props = defineProps<{
    controlsOpen: boolean
    displayMode: 'separate' | 'superimposed' | null
    height: number
    visibleRange: number
    width: number
}>()

const t = (key: string, params: Record<string, unknown> = {}) => T(key, SCOPE, params)

/**
 * Amplitude scale ceiling (on the Hellström-Westas semi-log scale) used to size the y-axis of
 * the aEEG band. The standard scale runs 0 → ~30 (covers 0–100 µV linearly + log compression
 * above).
 */
const AEEG_DISPLAY_MAX = 30
/**
 * The viewbox is a solid vertical rectangle whose drawing only depends on the x-axis
 * (viewStart and visibleRange). Keeping its bitmap at a fixed 1 px tall lets the browser
 * scale it via CSS as the strip resizes, without re-binding the canvas `:height` attribute —
 * that would auto-clear the bitmap and require a redraw on every height tick.
 */
const VIEWBOX_BITMAP_HEIGHT = 1
/**
 * Amplitude scale markers, in physical units (µV). Each entry has a tick line drawn inside
 * the canvas at its right edge; only entries with a `label` get a numeric label in the right
 * padding area. Six points cover the clinically relevant range (10–500 µV).
 */
const SCALE_ENTRIES: { value: number, label: string | null }[] = [
    { value: 10, label: '10' },
    { value: 20, label: null },
    { value: 50, label: null },
    { value: 100, label: '100' },
    { value: 200, label: null },
    { value: 500, label: null },
]
/** Hellström-Westas semi-log compression in µV → display units. Mirrors `compressAmplitudeValue`
 *  in `core/src/util/signal.ts` so the scale markers line up with the rendered band. */
const compressMicrovolts = (v: number) => v <= 10 ? v : 10*(1 + Math.log10(v/10))
const FALLBACK_COLOR: SettingsColor = [0.55, 0.40, 0.85, 0.85]

type RenderedTrend = {
    name: string
    label: string
    color: SettingsColor
    colorCss: string
}

const trendCanvas = ref<HTMLCanvasElement | null>(null)
const viewboxCanvas = ref<HTMLCanvasElement | null>(null)

const controller = useTrendController(SCOPE, 'amplitude', () => drawTrends())
const { ID, RESOURCE, SETTINGS, trends } = controller

const labelGutterWidth = 80
const topPadding = 8
const rightReservedWidth = computed(() => props.controlsOpen ? 210 : 30)
const canvasHeight = computed(() => Math.max(0, props.height - topPadding))
const canvasWidth = computed(() =>
    Math.max(0, props.width - labelGutterWidth - rightReservedWidth.value))

const aeegSettings = computed(() => SETTINGS.aeeg)
const labelMode = computed<'separate' | 'superimposed'>(() =>
    props.displayMode ?? (aeegSettings.value?.displayMode || 'separate'))

const sideColorForTrend = (name: string): SettingsColor | null => {
    if (!name.startsWith('aeeg-')) {
        return null
    }
    const id = name.slice('aeeg-'.length)
    const palette = SETTINGS?.trace?.color
    if (!palette) {
        return null
    }
    if (id === 'left') {
        return palette.sin ?? null
    }
    if (id === 'right') {
        return palette.dex ?? null
    }
    if (id === 'central' || id === 'mid') {
        return palette.mid ?? null
    }
    return null
}

const renderedTrends = computed<RenderedTrend[]>(() => trends.value.map((t) => {
    const color = sideColorForTrend(t.name)
        ?? (t as EegAmplitudeIntegratedTrend).color
        ?? FALLBACK_COLOR
    return {
        name: t.name,
        label: t.label,
        color,
        colorCss: settingsColorToRgba(color),
    }
}))

/** Vertical slot ranges in canvas pixels — one per visible trend in `'separate'` mode, a
 *  single full-height slot in `'superimposed'` mode. */
const scaleSlots = computed<{ top: number, bottom: number }[]>(() => {
    const h = canvasHeight.value
    if (!trends.value.length || h <= 2) {
        return []
    }
    if (labelMode.value === 'superimposed') {
        return [{ top: 1, bottom: h - 1 }]
    }
    const usableHeight = h - 2
    const slotHeight = usableHeight/trends.value.length
    return trends.value.map((_t, i) => ({
        top: 1 + i*slotHeight,
        bottom: 1 + (i + 1)*slotHeight,
    }))
})

/** Per-label inline styles. In `'separate'` mode each label is absolutely positioned with
 *  its `bottom` anchored to the bottom of its trend slot (where value = 0 sits), so the
 *  label visually sits on the trend's zero-line. In `'superimposed'` mode labels flow
 *  inside the flex column and the inline styles are empty. */
const labelStyles = computed<Record<string, string>[]>(() => {
    if (labelMode.value === 'superimposed') {
        return renderedTrends.value.map(() => ({} as Record<string, string>))
    }
    return renderedTrends.value.map((_t, i) => {
        const slot = scaleSlots.value[i]
        if (!slot) {
            return {} as Record<string, string>
        }
        return {
            bottom: Math.max(0, canvasHeight.value - slot.bottom) + 'px',
        }
    })
})

/** Y-position (in canvas pixels) per `SCALE_ENTRIES` × slot combination. Uses the same
 *  semi-log compression as `drawAmplitudeBand` so ticks line up visually with the band. */
const scaleMarkers = computed<{ key: string, y: number, label: string | null }[]>(() => {
    const markers = [] as { key: string, y: number, label: string | null }[]
    for (let i = 0; i < scaleSlots.value.length; i++) {
        const slot = scaleSlots.value[i]
        const slotHeight = slot.bottom - slot.top
        for (const entry of SCALE_ENTRIES) {
            const compressed = Math.min(compressMicrovolts(entry.value), AEEG_DISPLAY_MAX)
            const y = slot.bottom - (compressed/AEEG_DISPLAY_MAX)*slotHeight
            markers.push({ key: `s${i}-${entry.value}`, y, label: entry.label })
        }
    }
    return markers
})

/** Compute a [top, bottom] vertical pixel range for a trend in `'separate'` mode. */
const slotForTrend = (index: number, count: number, height: number) => {
    const usableHeight = height - 2
    const slotHeight = usableHeight/count
    const top = 1 + index*slotHeight
    return { top, bottom: top + slotHeight }
}

/**
 * Draw a single amplitude (aEEG) trend.
 *
 * The trend's `signal` is interleaved `[min, max, min, max, …]` on the semi-log compressed
 * scale. The conventional aEEG rendering is **one vertical line per epoch** from min to max —
 * the line height encodes amplitude variability over that epoch.
 *
 * For recordings short enough that each epoch occupies several pixels (so the per-epoch lines
 * are visually separated rather than packed), we additionally connect adjacent tops and bottoms
 * with a filled envelope so the strip reads as a continuous band rather than a sparse barcode.
 * The threshold for "sparse" is `pxPerEpoch > 1.5`.
 *
 * In `'superimposed'` display mode the fill alpha is reduced so multiple homologous trends
 * (e.g. left + right hemisphere) blend visibly when stacked on the same slot.
 */
const drawAmplitudeBand = (
    ctx: CanvasRenderingContext2D,
    trend: BiosignalTrend,
    slot: { top: number, bottom: number },
    width: number,
    totalDuration: number,
    color: SettingsColor,
    displayMode: 'separate' | 'superimposed'
) => {
    const signal = trend.signal
    if (!signal.length) {
        return
    }
    const epochLength = trend.epochLength
    const pxPerSecond = width/totalDuration
    const pxPerEpoch = epochLength*pxPerSecond
    const epochCount = Math.floor(signal.length/2)
    if (!epochCount) {
        return
    }
    const slotHeight = slot.bottom - slot.top
    const valueToY = (value: number) => {
        const clamped = Math.min(Math.max(value, 0), AEEG_DISPLAY_MAX)
        return slot.bottom - (clamped/AEEG_DISPLAY_MAX)*slotHeight
    }
    const epochX = (i: number) => i*pxPerEpoch + pxPerEpoch/2
    const isSparse = pxPerEpoch > 1.5
    const baseAlpha = color[3] ?? 1
    const blendAlpha = displayMode === 'superimposed' ? 0.75 : baseAlpha
    if (isSparse) {
        ctx.beginPath()
        let started = false
        // Remember the first bar's lower-envelope y so the polygon can return to the canvas's
        // left edge along the bottom — without this the polygon would close diagonally from
        // the last bar's min straight back to (0, firstMaxY) and the left-edge fill would
        // look like a triangle wedge instead of a flat extension.
        let firstMinY = 0
        for (let i = 0; i < epochCount; i++) {
            const max = signal[i*2 + 1]
            if (max === undefined) {
                continue
            }
            const x = epochX(i)
            const y = valueToY(max)
            if (!started) {
                ctx.moveTo(0, y)
                ctx.lineTo(x, y)
                firstMinY = valueToY(signal[i*2] ?? 0)
                started = true
            } else {
                ctx.lineTo(x, y)
            }
        }
        for (let i = epochCount - 1; i >= 0; i--) {
            const min = signal[i*2]
            if (min === undefined) {
                continue
            }
            const x = epochX(i)
            const y = valueToY(min)
            ctx.lineTo(x, y)
        }
        ctx.lineTo(0, firstMinY)
        ctx.closePath()
        const fillColor: SettingsColor = [color[0], color[1], color[2], blendAlpha*0.4]
        ctx.fillStyle = settingsColorToRgba(fillColor)
        ctx.fill()
    }
    ctx.strokeStyle = settingsColorToRgba([color[0], color[1], color[2], blendAlpha])
    ctx.lineWidth = Math.max(1, Math.min(pxPerEpoch*0.8, 3))
    for (let i = 0; i < epochCount; i++) {
        const min = signal[i*2]
        const max = signal[i*2 + 1]
        if (min === undefined || max === undefined) {
            continue
        }
        const x = epochX(i)
        const yTop = valueToY(max)
        const yBottom = valueToY(min)
        if (Math.abs(yBottom - yTop) < 0.5) {
            ctx.fillStyle = settingsColorToRgba([color[0], color[1], color[2], blendAlpha])
            ctx.fillRect(x - 0.5, yTop - 0.5, 1, 1)
            continue
        }
        ctx.beginPath()
        ctx.moveTo(x, yTop)
        ctx.lineTo(x, yBottom)
        ctx.stroke()
    }
}

const drawTrends = () => {
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
    ctx.fillStyle = settingsColorToRgba(SETTINGS.navigator.borderColor)
    ctx.fillRect(0, 0, w, 1)
    ctx.fillRect(0, h - 1, w, 1)
    ctx.fillRect(0, 0, 1, h)
    ctx.fillRect(w - 1, 0, 1, h)
    const totalDuration = RESOURCE.totalDuration
    if (!totalDuration || !trends.value.length) {
        return
    }
    const mode = labelMode.value
    const trendList = trends.value
    for (let i = 0; i < trendList.length; i++) {
        const trend = trendList[i]
        const rendered = renderedTrends.value[i]
        if (!rendered) {
            continue
        }
        const slot = mode === 'superimposed'
            ? { top: 1, bottom: h - 1 }
            : slotForTrend(i, trendList.length, h)
        drawAmplitudeBand(ctx, trend, slot, w, totalDuration, rendered.color, mode)
    }
    // Zero-line separators between stacked trends — the bottom of slot i and top of slot i+1
    // share this y-coordinate, corresponding to value 0 for the trend above. Drawn last so
    // it sits on top of any band edge touching the boundary.
    if (mode !== 'superimposed' && trendList.length > 1) {
        ctx.fillStyle = settingsColorToRgba(SETTINGS.navigator.borderColor)
        const usableHeight = h - 2
        const slotHeight = usableHeight/trendList.length
        for (let i = 1; i < trendList.length; i++) {
            ctx.fillRect(0, Math.round(1 + i*slotHeight), w, 1)
        }
    }
}

/**
 * Draw the view-position marker (red bar) on its own canvas. The bitmap is intentionally only
 * `VIEWBOX_BITMAP_HEIGHT` (1 px) tall — the canvas is stretched to fit the strip vertically
 * via CSS, so height changes don't clear the bitmap and don't require a redraw. Only changes
 * to `viewStart`, `visibleRange`, `totalDuration`, or the canvas `:width` (which auto-clears
 * the bitmap) need to retrigger this method.
 */
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
    const h = VIEWBOX_BITMAP_HEIGHT
    ctx.clearRect(0, 0, w, h)
    const totalDuration = RESOURCE.totalDuration
    if (!totalDuration) {
        return
    }
    const pxPerSecond = w/totalDuration
    const viewStart = RESOURCE.viewStart || 0
    const viewLen = Math.min(props.visibleRange, totalDuration - viewStart)
    if (viewLen <= 0) {
        return
    }
    ctx.fillStyle = settingsColorToRgba(SETTINGS.navigator.viewBoxColor)
    ctx.fillRect(
        Math.round(viewStart*pxPerSecond),
        0,
        Math.max(Math.round(viewLen*pxPerSecond), 1),
        h
    )
}

watch(canvasHeight, () => drawTrends(), { flush: 'post' })
watch(canvasWidth, () => {
    drawTrends()
    drawViewbox()
}, { flush: 'post' })
watch(() => props.visibleRange, () => drawViewbox())
watch(() => props.displayMode, () => drawTrends())

onMounted(() => {
    RESOURCE.onPropertyChange('viewStart', drawViewbox, ID)
    RESOURCE.onPropertyChange('displayViewStart', drawViewbox, ID)
    drawViewbox()
})

onBeforeUnmount(() => {
    // Trend-list and per-trend listeners are torn down by useTrendController; only the
    // viewbox-related subscriptions are owned here.
    RESOURCE.removeAllEventListeners(ID)
})
</script>

<style scoped>
[data-component="aeeg-renderer"] {
    box-sizing: border-box;
    display: flex;
    height: 100%;
    padding-top: 0.5rem;
    position: relative;
    width: 100%;
}
    .derivations {
        align-items: flex-end;
        display: flex;
        flex: 0 0 80px;
        flex-direction: column;
        font-size: 0.75rem;
        height: 100%;
        justify-content: flex-end;
        overflow: hidden;
        padding: 0.25rem 0.5rem;
    }
        .derivations.layout-separate {
            position: relative;
        }
            .layout-separate > .derivation-label {
                position: absolute;
                right: 0.5rem;
            }
        .derivations.layout-superimposed {
            align-items: flex-end;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
        }
        .derivation-label {
            font-weight: bold;
            line-height: 1.1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .derivation-empty {
            font-style: italic;
            opacity: 0.5;
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
            position: absolute;
            top: 0;
        }
        .plot > .scale {
            height: 100%;
            pointer-events: none;
            position: absolute;
            top: 0;
            width: 0;
        }
            .scale-marker {
                position: absolute;
                right: 0;
                width: 0;
            }
                .scale-tick {
                    background: var(--epicv-text-main, currentColor);
                    height: 1px;
                    opacity: 0.45;
                    position: absolute;
                    right: 0;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 4px;
                }
                .scale-marker.labelled > .scale-tick {
                    opacity: 0.7;
                    width: 6px;
                }
                .scale-text {
                    font-size: 0.6rem;
                    left: 3px;
                    line-height: 1;
                    opacity: 0.7;
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    white-space: nowrap;
                }
</style>
