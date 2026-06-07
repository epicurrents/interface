<template>
    <div data-component="cascade-annotations" ref="component">
        <!-- Cascade view shows annotations as compact markers only:
             - Spot events: vertical line on the row containing the event's time.
             - Span events: narrow horizontal bar at the top of each row the duration covers.
             Labels are deliberately omitted because they would have to repeat across every row
             the span touches and occlude the signal. The annotation's label / text is still
             exposed via the `title` attribute for hover lookup. -->
        <div v-for="bar of bars" :key="bar.key"
            class="annotation"
            :class="{ spot: bar.spot }"
            :style="bar.style"
            :title="bar.title"
        ></div>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType, Ref, ref } from 'vue'
import { settingsColorToRgba } from '@epicurrents/core/util'
import { useStore } from 'vuex'
import { useBiosignalContext } from '#config'
import type {
    BiosignalAnnotationEvent,
    BiosignalCascadeMontage,
    SettingsColor,
} from '@epicurrents/core/types'

type AnnotationBar = {
    key: string
    spot: boolean
    style: string
    title: string
}

/** Span events render as a thin bar at the top of each row band they cover. */
const SPAN_BAR_HEIGHT_PX = 4

export default defineComponent({
    name: 'CascadeAnnotations',
    props: {
        montage: {
            type: Object as PropType<BiosignalCascadeMontage>,
            required: true,
        },
        plotDimensions: {
            type: Array as PropType<number[]>,
            required: true,
        },
        pxPerSecond: {
            type: Number,
            required: true,
        },
    },
    setup () {
        const store = useStore()
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const bars = ref([] as AnnotationBar[])
        return {
            bars,
            component,
            ...useBiosignalContext(store, 'CascadeAnnotations'),
        }
    },
    watch: {
        plotDimensions () {
            this.updateAnnotations()
        },
        pxPerSecond () {
            this.updateAnnotations()
        },
    },
    methods: {
        resolveColor (event: BiosignalAnnotationEvent): SettingsColor {
            const classCfg = this.SETTINGS.annotations.classes[event.class as string]
            if (classCfg?.color) {
                return classCfg.color as SettingsColor
            }
            for (const [typeName, color] of Object.entries(this.SETTINGS.annotations.typeColors)) {
                if (event.type?.startsWith(typeName)) {
                    return color as SettingsColor
                }
            }
            return this.SETTINGS.annotations.color as SettingsColor
        },
        rowBandPixels (row: number, plotHeight: number) {
            // Use the channel's own NDC offset so spot lines and span bars sit on the actual
            // rendered trace, including the yPadding margin the renderer leaves at the top and
            // bottom of the plot. Without this the markers drift by ~½ channel-height vs. the
            // signal they describe.
            const chan = this.montage.channels[row]
            if (!chan?.offset) {
                return null
            }
            const top = (1 - chan.offset.top) * plotHeight
            const bottom = (1 - chan.offset.bottom) * plotHeight
            return { top, height: bottom - top }
        },
        updateAnnotations () {
            const cascade = this.montage
            const pageLength = cascade.pageLength
            const rowCount = cascade.rowCount
            const plotHeight = this.plotDimensions[1]
            if (!pageLength || !rowCount || !plotHeight || !this.pxPerSecond) {
                this.bars = []
                return
            }
            const viewStart = this.RESOURCE.viewStart
            const reach = pageLength * rowCount
            const viewEnd = viewStart + reach
            const next: AnnotationBar[] = []
            for (const event of this.RESOURCE.events as BiosignalAnnotationEvent[]) {
                const end = event.start + (event.duration || 0)
                if (end <= viewStart || event.start >= viewEnd) {
                    continue
                }
                // Clip the event range to the cascade's reach so a span starting before viewStart
                // (or extending past the bottom row) still surfaces on the rows it touches.
                const clippedStart = Math.max(event.start, viewStart)
                const clippedEnd = Math.min(end, viewEnd)
                const startRow = cascade.getRowAtTime(clippedStart)
                if (startRow < 0) {
                    continue
                }
                const color = settingsColorToRgba(this.resolveColor(event))
                const title = event.label + (event.text ? '\n' + event.text : '')
                // Spot events: vertical line spanning the full row band at the event's x.
                if (!event.duration) {
                    const range = cascade.getRowTimeRange(startRow)
                    const band = this.rowBandPixels(startRow, plotHeight)
                    if (!range || !band) {
                        continue
                    }
                    const xSec = clippedStart - range[0]
                    next.push({
                        key: `${event.id}-r${startRow}`,
                        spot: true,
                        style: [
                            `top: ${band.top}px`,
                            `height: ${band.height}px`,
                            `left: ${xSec * this.pxPerSecond}px`,
                            `--cascade-anno-color: ${color}`,
                        ].join(';'),
                        title,
                    })
                    continue
                }
                // Span events: thin bar at the top of each row band the duration covers.
                const endRow = cascade.getRowAtTime(Math.max(clippedStart, clippedEnd - 1e-6))
                const lastRow = endRow < 0 ? rowCount - 1 : endRow
                for (let row = startRow; row <= lastRow; row++) {
                    const range = cascade.getRowTimeRange(row)
                    const band = this.rowBandPixels(row, plotHeight)
                    if (!range || !band) {
                        continue
                    }
                    const segStart = Math.max(clippedStart, range[0])
                    const segEnd = Math.min(clippedEnd, range[1])
                    if (segEnd <= segStart) {
                        continue
                    }
                    next.push({
                        key: `${event.id}-r${row}`,
                        spot: false,
                        style: [
                            `top: ${band.top}px`,
                            `height: ${SPAN_BAR_HEIGHT_PX}px`,
                            `left: ${(segStart - range[0]) * this.pxPerSecond}px`,
                            `width: ${(segEnd - segStart) * this.pxPerSecond}px`,
                            `--cascade-anno-color: ${color}`,
                        ].join(';'),
                        title,
                    })
                }
            }
            this.bars = next
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId },
        )
    },
    mounted () {
        this.RESOURCE.onPropertyChange('events', this.updateAnnotations, this.ID)
        this.RESOURCE.onPropertyChange('viewStart', this.updateAnnotations, this.ID)
        this.RESOURCE.onPropertyChange('displayViewStart', this.updateAnnotations, this.ID)
        this.RESOURCE.onPropertyChange('activeMontage', this.updateAnnotations, this.ID)
        this.RESOURCE.onPropertyChange('timebase', this.updateAnnotations, this.ID)
        this.montage.onPropertyChange('pageLength', this.updateAnnotations, this.ID)
        requestAnimationFrame(() => {
            this.updateAnnotations()
        })
    },
    beforeUnmount () {
        this.RESOURCE.removeAllEventListeners(this.ID)
        this.montage.removeAllEventListeners(this.ID)
    },
})
</script>

<style scoped>
[data-component="cascade-annotations"] {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.annotation {
    position: absolute;
    background-color: var(--cascade-anno-color);
    pointer-events: auto;
}
.annotation.spot {
    width: 2px;
}
</style>
