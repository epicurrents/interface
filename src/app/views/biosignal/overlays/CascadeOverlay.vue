<template>
    <div data-component="cascade-overlay" ref="component">
        <!-- Translucent band(s) showing where the user's regular (non-cascade) view sits inside
             the cascade's stacked rows. Spans `mainViewLength` seconds starting at `viewStart`; if
             that exceeds one row, the band wraps across the affected rows. -->
        <div v-for="band of indicatorBands" :key="`cascade-indicator-${band.rowIndex}`"
            class="indicator"
            :style="band.style"
        ></div>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType, Ref, ref } from 'vue'
import { useStore } from 'vuex'
import { useBiosignalContext } from '#config'
import type { BiosignalCascadeMontage } from '@epicurrents/core/types'

type IndicatorBand = {
    rowIndex: number
    style: string
}

export default defineComponent({
    name: 'CascadeOverlay',
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
        const indicatorBands = ref([] as IndicatorBand[])
        return {
            component,
            indicatorBands,
            ...useBiosignalContext(store, 'CascadeOverlay'),
        }
    },
    watch: {
        plotDimensions () {
            this.updateOverlay()
        },
        pxPerSecond () {
            this.updateOverlay()
        },
    },
    methods: {
        rowBandPixels (row: number, plotHeight: number) {
            // Channel offsets carry the actual rendered y-band including the yPadding margin the
            // renderer leaves at the top and bottom of the plot. Reading from `chan.offset.top` /
            // `bottom` keeps the indicator aligned with the underlying trace rather than the naive
            // `row * (plotHeight / rowCount)` band.
            const chan = this.montage.channels[row]
            if (!chan?.offset) {
                return null
            }
            const top = (1 - chan.offset.top) * plotHeight
            const bottom = (1 - chan.offset.bottom) * plotHeight
            return { top, height: bottom - top }
        },
        updateOverlay () {
            const cascade = this.montage
            const pageLength = cascade.pageLength
            const rowCount = cascade.rowCount
            const plotHeight = this.plotDimensions[1]
            if (!pageLength || !rowCount || !plotHeight) {
                this.indicatorBands = []
                return
            }
            const viewStart = this.RESOURCE.viewStart
            // Main-view indicator — span [viewStart, viewStart + mainViewLength] across the rows
            // that hold it. Fall back to the EEG settings default page length when the recording
            // hasn't picked up a sec/page timebase yet (`mainViewLength` returns null there).
            const mainLen = this.RESOURCE.mainViewLength ?? this.SETTINGS.pageLength
            const bands: IndicatorBand[] = []
            if (mainLen > 0 && this.pxPerSecond > 0) {
                let remaining = mainLen
                let cursor = viewStart
                while (remaining > 0) {
                    const rowIdx = cascade.getRowAtTime(cursor)
                    if (rowIdx < 0) {
                        break
                    }
                    const range = cascade.getRowTimeRange(rowIdx)
                    const band = this.rowBandPixels(rowIdx, plotHeight)
                    if (!range || !band) {
                        break
                    }
                    const leftSec = cursor - range[0]
                    const widthSec = Math.min(remaining, range[1] - cursor)
                    bands.push({
                        rowIndex: rowIdx,
                        style: [
                            `top: ${band.top}px`,
                            `height: ${band.height}px`,
                            `left: ${leftSec * this.pxPerSecond}px`,
                            `width: ${widthSec * this.pxPerSecond}px`,
                        ].join(';'),
                    })
                    cursor += widthSec
                    remaining -= widthSec
                }
            }
            this.indicatorBands = bands
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId },
        )
    },
    mounted () {
        // viewStart (scroll), the active montage (switch into / out of cascade), and the cascade's
        // own pageLength all change row geometry — re-render on each.
        this.RESOURCE.onPropertyChange('viewStart', this.updateOverlay, this.ID)
        this.RESOURCE.onPropertyChange('displayViewStart', this.updateOverlay, this.ID)
        this.RESOURCE.onPropertyChange('activeMontage', this.updateOverlay, this.ID)
        this.RESOURCE.onPropertyChange('timebase', this.updateOverlay, this.ID)
        this.montage.onPropertyChange('pageLength', this.updateOverlay, this.ID)
        requestAnimationFrame(() => {
            this.updateOverlay()
        })
    },
    beforeUnmount () {
        this.RESOURCE.removeAllEventListeners(this.ID)
        this.montage.removeAllEventListeners(this.ID)
    },
})
</script>

<style scoped>
[data-component="cascade-overlay"] {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.indicator {
    position: absolute;
    background-color: rgba(64, 144, 220, 0.15);
    border-left: 1px solid rgba(64, 144, 220, 0.55);
    border-right: 1px solid rgba(64, 144, 220, 0.55);
}
</style>
