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
                @dblclick="handleDblClick"
            ></canvas>
            <svg
                class="guidelines"
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
                    v-if="showGuidelines"
                    v-for="seg in guidelineSegments"
                    :key="seg.key"
                    :x1="seg.x1"
                    :x2="seg.x2"
                    :y1="seg.y"
                    :y2="seg.y"
                    :stroke="guidelineStroke"
                    stroke-width="1"
                    shape-rendering="crispEdges"
                />
            </svg>
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
import { useStore } from 'vuex'
import { T } from '#i18n'
import { settingsColorToRgba } from '@epicurrents/core/util'
import { useTrendController } from '../useTrendController'
import type { BiosignalTrend, SettingsColor } from '@epicurrents/core/types'


const SCOPE = 'AeegRenderer'

const props = defineProps<{
    controlsOpen: boolean
    displayMode: 'separate' | 'superimposed' | null
    height: number
    visibleRange: number
    width: number
}>()

const emit = defineEmits<{ navigation: [position: number] }>()

const t = (key: string, params: Record<string, unknown> = {}) => T(key, SCOPE, params)

/**
 * Amplitude scale ceiling in µV, and its compressed display-unit equivalent.
 * `compressMicrovolts(200) = 10 * (1 + log10(20)) ≈ 23.01`.
 */
const AEEG_CEILING_UV = 200
const AEEG_DISPLAY_MAX = 10 * (1 + Math.log10(AEEG_CEILING_UV / 10))
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
 * padding area.
 */
const SCALE_ENTRIES: { value: number, label: string | null }[] = [
    { value: 5,   label: '5'   },
    { value: 10,  label: '10'  },
    { value: 20,  label: null  },
    { value: 50,  label: null  },
    { value: 100, label: '100' },
    { value: 200, label: null  },
]
/** When true, a faint horizontal guideline is drawn at each scale tick. */
const showGuidelines = true
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

const store = useStore()
const controller = useTrendController(SCOPE, 'amplitude', () => drawTrends())
const { ID, RESOURCE, SETTINGS, trends } = controller

// Local reactive mirror of SETTINGS.trends.aeeg.displayMode. SETTINGS is a non-reactive proxy
// so Vue computed can't track mutations; sync via a store action subscription instead.
const settingsDisplayMode = ref<'separate' | 'superimposed'>(
    SETTINGS.trends?.aeeg?.displayMode || 'separate'
)
const unsubscribeAction = store.subscribeAction({
    after: (action) => {
        if (action.type === 'set-settings-value'
            && action.payload?.field === 'eeg.trends.aeeg.displayMode') {
            settingsDisplayMode.value = SETTINGS.trends?.aeeg?.displayMode || 'separate'
        }
    },
})

const labelGutterWidth = 80
const topPadding = 8
const rightReservedWidth = computed(() => props.controlsOpen ? 210 : 30)
const canvasHeight = computed(() => Math.max(0, props.height - topPadding))
const canvasWidth = computed(() =>
    Math.max(0, props.width - labelGutterWidth - rightReservedWidth.value))

const labelMode = computed<'separate' | 'superimposed'>(() =>
    props.displayMode ?? settingsDisplayMode.value)

const sideColorForTrend = (name: string): SettingsColor | null => {
    if (!name.startsWith('aeeg-')) {
        return null
    }
    const id = name.slice('aeeg-'.length)
    // Check interface derivation-color overrides first — these apply to any id.
    const override = (SETTINGS?.trends?.aeeg as { derivationColors?: { [k: string]: SettingsColor } } | undefined)
        ?.derivationColors?.[id]
    if (override) {
        return override
    }
    // Fall back to the standard hemispheric trace-color palette.
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

/** Reactive mirror of RESOURCE.interruptions — updated via onPropertyChange so the SVG overlay
 *  re-renders when interruptions arrive after signal caching completes. */
const interruptions = ref<{ start: number, duration: number }[]>([])

const pxPerSecond = computed(() =>
    canvasWidth.value / (RESOURCE.totalDuration || 1)
)

/** Gap rectangles for the SVG overlay — one rect per interruption × slot. */
const gapRects = computed(() => {
    const rects: { key: string, x: number, y: number, w: number, h: number }[] = []
    const pps = pxPerSecond.value
    for (const { start, duration } of interruptions.value) {
        const x = Math.floor(start * pps)
        const w = Math.max(Math.ceil(duration * pps), 1)
        for (let i = 0; i < scaleSlots.value.length; i++) {
            const slot = scaleSlots.value[i]
            rects.push({ key: `${start}-${i}`, x, y: slot.top, w, h: slot.bottom - slot.top })
        }
    }
    return rects
})

/** Guideline segments split at gap boundaries so they don't traverse gap areas. */
const guidelineSegments = computed(() => {
    const segs: { key: string, x1: number, x2: number, y: number }[] = []
    const w = canvasWidth.value
    const pps = pxPerSecond.value
    const gaps = interruptions.value
        .map(({ start, duration }) => [Math.floor(start * pps), Math.ceil((start + duration) * pps)] as [number, number])
        .sort((a, b) => a[0] - b[0])
    for (const m of scaleMarkers.value) {
        let cursor = 1
        for (const [gx1, gx2] of gaps) {
            if (cursor < gx1) {
                segs.push({ key: `${m.key}-${cursor}`, x1: cursor, x2: gx1, y: m.y })
            }
            cursor = Math.max(cursor, gx2)
        }
        if (cursor < w - 1) {
            segs.push({ key: `${m.key}-end`, x1: cursor, x2: w - 1, y: m.y })
        }
    }
    return segs
})

/** Fill colour for gap overlay rectangles, read from navigator settings. */
const gapFill = computed(() => {
    const c = SETTINGS.navigator?.interruptionColor as SettingsColor | undefined
    return c ? settingsColorToRgba(c) : 'rgba(180,180,180,1)'
})

/** Stroke colour for guidelines: black at 25 % opacity. */
const guidelineStroke = 'rgba(0,0,0,0.25)'

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
    displayMode: 'separate' | 'superimposed',
    bandInterruptions: { start: number, duration: number }[]
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
    const isGapEpoch = (i: number) => {
        const v = signal[i*2 + 1]
        return v === undefined || isNaN(v)
    }
    const isSparse = pxPerEpoch > 1.5
    // Local alias so the gap-for-epoch lookup uses the parameter name.
    const bandGaps = bandInterruptions
    const baseAlpha = color[3] ?? 1
    const blendAlpha = displayMode === 'superimposed' ? 0.75 : baseAlpha

    // ── Fill envelope ────────────────────────────────────────────────────────
    // Split into contiguous non-gap runs, draw a separate closed polygon for each.
    // A single shared path can't handle mid-path gaps — resetting `moveTo` inside an
    // open path just extends it, so the backward (lower-envelope) loop would add stray
    // lines through every gap. Per-run polygons avoid that entirely.
    if (isSparse) {
        // Find the interruption (in recording-time seconds) that covers a given
        // gap epoch. Used to extend fill polygon edges flush to the exact gap boundary
        // so there is no empty sliver between the fill and the gray overlay.
        const gapForEpoch = (epochIdx: number) => {
            const t = epochIdx * epochLength
            return bandGaps.find(
                ({ start, duration }) => start <= t + epochLength && start + duration > t
            ) ?? null
        }

        const fillStyle = settingsColorToRgba([color[0], color[1], color[2], blendAlpha*0.4])
        let runFrom = -1
        for (let i = 0; i <= epochCount; i++) {
            const gap = i === epochCount || isGapEpoch(i)
            if (!gap && runFrom === -1) {
                runFrom = i
            } else if (gap && runFrom !== -1) {
                const runTo = i - 1
                // Default: extend to epoch half-width edges.
                // Override with the exact gap boundary when abutting an interruption
                // to eliminate the empty sliver between the fill and the gray overlay.
                let firstX = epochX(runFrom) - pxPerEpoch/2
                let lastX  = epochX(runTo)   + pxPerEpoch/2
                if (runFrom > 0 && isGapEpoch(runFrom - 1)) {
                    const adj = gapForEpoch(runFrom - 1)
                    if (adj) {
                        firstX = Math.ceil((adj.start + adj.duration) * pxPerSecond)
                    }
                }
                if (i < epochCount && isGapEpoch(i)) {
                    const adj = gapForEpoch(i)
                    if (adj) {
                        lastX = Math.floor(adj.start * pxPerSecond)
                    }
                }
                ctx.beginPath()
                // Upper envelope left → right
                ctx.moveTo(firstX, valueToY(signal[runFrom*2 + 1]))
                for (let j = runFrom; j <= runTo; j++) {
                    ctx.lineTo(epochX(j), valueToY(signal[j*2 + 1]))
                }
                ctx.lineTo(lastX, valueToY(signal[runTo*2 + 1]))
                // Lower envelope right → left
                ctx.lineTo(lastX, valueToY(signal[runTo*2]))
                for (let j = runTo; j >= runFrom; j--) {
                    ctx.lineTo(epochX(j), valueToY(signal[j*2]))
                }
                ctx.lineTo(firstX, valueToY(signal[runFrom*2]))
                ctx.closePath()
                ctx.fillStyle = fillStyle
                ctx.fill()
                runFrom = -1
            }
        }
    }

    // ── Per-epoch bars ───────────────────────────────────────────────────────
    // Bar width: ceil(pxPerEpoch) when epochs are dense so adjacent bars touch with
    // no anti-aliasing gaps; capped at 3 px once epochs are sparse enough that
    // visible gaps between bars are intentional.
    ctx.strokeStyle = settingsColorToRgba([color[0], color[1], color[2], blendAlpha])
    ctx.lineWidth = Math.max(1, Math.min(Math.ceil(pxPerEpoch), 3))
    for (let i = 0; i < epochCount; i++) {
        if (isGapEpoch(i)) {
            continue
        }
        const min = signal[i*2]
        const max = signal[i*2 + 1]
        const x = epochX(i)
        const yTop = valueToY(max)
        const yBottom = valueToY(min ?? 0)
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
        drawAmplitudeBand(ctx, trend, slot, w, totalDuration, rendered.color, mode, interruptions.value)
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
 * to `displayViewStart`, `visibleRange`, `totalDuration`, or the canvas `:width` (which
 * auto-clears the bitmap) need to retrigger this method.
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
    const viewStart = RESOURCE.displayViewStart || 0
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
watch(labelMode, () => drawTrends())

const handleDblClick = (event: MouseEvent) => {
    const canvas = trendCanvas.value
    if (!canvas || !RESOURCE.totalDuration) {
        return
    }
    const xPos = event.clientX - canvas.getBoundingClientRect().left
    emit('navigation', RESOURCE.totalDuration * xPos / canvas.width)
}

const refreshInterruptions = () => {
    interruptions.value = (RESOURCE as unknown as { getInterruptions?: () => { start: number, duration: number }[] })
        .getInterruptions?.() ?? []
}

onMounted(() => {
    RESOURCE.onPropertyChange('displayViewStart', drawViewbox, ID)
    // Sync the reactive interruptions ref and redraw when interruptions arrive.
    RESOURCE.onPropertyChange('interruptions', () => {
        refreshInterruptions()
        drawTrends()
    }, ID)
    refreshInterruptions()
    drawViewbox()
})

onBeforeUnmount(() => {
    unsubscribeAction()
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
        .plot > canvas + canvas,
        .plot > canvas + svg.guidelines,
        .plot > svg.guidelines + canvas {
            left: 0;
            pointer-events: none;
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
