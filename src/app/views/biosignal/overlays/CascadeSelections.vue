<template>
    <div data-component="cascade-selections" ref="component">
        <div v-for="seg of segments" :key="seg.key"
            :class="['selection-segment', { active: seg.isActive }]"
            :style="seg.style"
            @click.stop="handleSegmentClick(seg.selectionIdx)"
            @contextmenu.prevent=""
        ></div>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType, Ref, ref } from 'vue'
import { settingsColorToRgba } from '@epicurrents/core/util'
import type { BiosignalCascadeMontage } from '@epicurrents/core/types'
import type { PlotSelection } from '#app/views/biosignal/types'
import { useStore } from 'vuex'
import { useBiosignalContext } from '#config'

type Segment = {
    key: string
    selectionIdx: number
    style: string
    isActive: boolean
}

export default defineComponent({
    name: 'CascadeSelections',
    props: {
        /** Index of the currently-active selection (drag source), or -1 when none is active. */
        activeSelectionIdx: {
            type: Number,
            default: -1,
        },
        montage: {
            type: Object as PropType<BiosignalCascadeMontage>,
            required: true,
        },
        plotDimensions: {
            type: Array as PropType<number[]>,
            required: true,
        },
        plotSelections: {
            type: Array as PropType<PlotSelection[]>,
            required: true,
        },
        pxPerSecond: {
            type: Number,
            required: true,
        },
    },
    emits: ['selection-click'],
    setup () {
        const store = useStore()
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const segments = ref([] as Segment[])
        return {
            component,
            segments,
            ...useBiosignalContext(store, 'CascadeSelections'),
        }
    },
    watch: {
        activeSelectionIdx () {
            this.updateSegments()
        },
        plotDimensions () {
            this.updateSegments()
        },
        plotSelections: {
            deep: true,
            handler () {
                this.updateSegments()
            },
        },
        pxPerSecond () {
            this.updateSegments()
        },
    },
    methods: {
        handleSegmentClick (idx: number) {
            this.$emit('selection-click', idx)
        },
        updateSegments () {
            const cascade = this.montage
            const pageLength = cascade.pageLength
            const rowCount = cascade.rowCount
            const plotHeight = this.plotDimensions[1]
            if (!pageLength || !rowCount || !plotHeight || !this.pxPerSecond) {
                this.segments = []
                return
            }
            const bgColor = settingsColorToRgba(this.SETTINGS.trace.selections.color)
            const next: Segment[] = []
            for (let i = 0; i < this.plotSelections.length; i++) {
                const sel = this.plotSelections[i]
                const [s, e] = [sel.range[0], sel.range[1]].sort((a, b) => a - b)
                if (e <= s) {
                    continue
                }
                const isActive = i === this.activeSelectionIdx
                // The selection may span any number of rows. Split into per-row segments so a
                // drag from row 1 to row 4 lights up rows 1, 2, 3, 4 — each segment clipped to
                // its row's time window. Out-of-view portions clip to nothing and are skipped.
                const startRow = Math.max(cascade.getRowAtTime(s), 0)
                const endRowRaw = cascade.getRowAtTime(Math.max(s, e - 1e-6))
                const endRow = endRowRaw < 0 ? rowCount - 1 : endRowRaw
                for (let row = startRow; row <= endRow; row++) {
                    const range = cascade.getRowTimeRange(row)
                    if (!range) {
                        continue
                    }
                    const segStart = Math.max(s, range[0])
                    const segEnd = Math.min(e, range[1])
                    if (segEnd <= segStart) {
                        continue
                    }
                    // Take the y band from the channel's own offset so the segment lines up with
                    // the rendered trace including yPadding (channels don't fill the plot edge to
                    // edge; equidistant offsets reserve a half-channel margin top and bottom). The
                    // earlier `row * (plotHeight / rowCount)` math ignored that padding and shifted
                    // every band by ~½ channel-height.
                    const band = this.rowBandPixels(row, plotHeight)
                    if (!band) {
                        continue
                    }
                    next.push({
                        key: `sel-${i}-r${row}`,
                        selectionIdx: i,
                        isActive,
                        style: [
                            `top: ${band.top}px`,
                            `height: ${band.height}px`,
                            `left: ${(segStart - range[0]) * this.pxPerSecond}px`,
                            `width: ${(segEnd - segStart) * this.pxPerSecond}px`,
                            `background-color: ${bgColor}`,
                        ].join(';'),
                    })
                }
            }
            this.segments = next
        },
        /**
         * Pixel band for the channel on row `row`, derived from its NDC offset. `offset.top` and
         * `offset.bottom` are fractions from the plot's bottom (1 = top, 0 = bottom); convert to
         * a CSS top-from-container-top position and a height. Falls back to null when the channel
         * has no offset yet (initial layout race).
         */
        rowBandPixels (row: number, plotHeight: number) {
            const chan = this.montage.channels[row]
            if (!chan?.offset) {
                return null
            }
            const top = (1 - chan.offset.top) * plotHeight
            const bottom = (1 - chan.offset.bottom) * plotHeight
            return { top, height: bottom - top }
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId },
        )
    },
    mounted () {
        // Row geometry depends on the recording's viewStart (cascade slices anchor at it), the
        // active montage (cascade switch in / out), and the cascade's own pageLength. Subscribe
        // to all three so segments stay aligned with the rows they sit on.
        this.RESOURCE.onPropertyChange('viewStart', this.updateSegments, this.ID)
        this.RESOURCE.onPropertyChange('displayViewStart', this.updateSegments, this.ID)
        this.RESOURCE.onPropertyChange('timebase', this.updateSegments, this.ID)
        this.RESOURCE.onPropertyChange('activeMontage', this.updateSegments, this.ID)
        this.montage.onPropertyChange('pageLength', this.updateSegments, this.ID)
        requestAnimationFrame(() => {
            this.updateSegments()
        })
    },
    beforeUnmount () {
        this.RESOURCE.removeAllEventListeners(this.ID)
        this.montage.removeAllEventListeners(this.ID)
    },
})
</script>

<style scoped>
[data-component="cascade-selections"] {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.selection-segment {
    position: absolute;
    pointer-events: auto;
    cursor: pointer;
}
</style>
