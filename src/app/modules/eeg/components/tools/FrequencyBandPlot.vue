<template>
    <div data-component="frequency-band-plot" ref="component">
        <div class="header">{{ header }}</div>
        <wa-input
            class="max"
            size="small"
            type="number"
            :value="maxX"
            @change="$emit('set-max-x', parseFloat($event.target.value))"
        >
            <span slot="suffix">Hz</span>
        </wa-input>
        <svg ref="plot"
            class="plot"
            :height="plotHeight"
            :viewBox="`0 0 ${plotWidth} ${plotHeight}`"
            :width="plotWidth"
            @pointermove="handlePointermove"
            @pointerleave="handlePointerLeave"
        >
            <g v-for="(line, idx) in frequencyBandLines" :key="`band-line-${idx}`">
                <line :x1="line.x" y1="0" :x2="line.x" :y2="plotHeight"
                    shape-rendering="crispEdges"
                    :stroke="settingsColorToRgba(
                        SETTINGS.tools.guideLine.color
                    )"
                    :stroke-width="SETTINGS.tools.guideLine.width"
                />
            </g>
            <g v-for="(band, idx) of SETTINGS.frequencyBands" :key="`band-symbol-${idx}`">
                <text v-if="band.symbol"
                    :x="frequencyBandLines[idx-1] ? frequencyBandLines[idx-1].x + 5 : 5" y="15"
                    :fill="settingsColorToRgba(
                        SETTINGS.tools.guideLineSymbol.color
                    )"
                >{{ band.symbol }}</text>
            </g>
            <g v-for="(line, idx) in lines" :key="`plot-signal-${idx}`">
                <polyline
                    :fill="line.fillColor"
                    :stroke="line.color"
                    :stroke-width="line.width"
                    :points="plotLines[idx] || ''"
                />
            </g>
            <g v-if="cursorPos">
                <line :x1="cursorPos" y1="0" :x2="cursorPos" :y2="plotHeight"
                    shape-rendering="crispEdges"
                    :stroke="settingsColorToRgba(
                        SETTINGS.tools.cursorLine.color
                    )"
                    :stroke-width="SETTINGS.tools.cursorLine.width"
                />
            </g>
        </svg>
        <div class="hzvalue" :style="`left:${hzValuePos}px`">{{ cursorValue }} <span v-if="cursorValue">Hz</span></div>
    </div>
</template>

<script lang="ts">
/**
 * Tool for signal power spectrum calculation.
 */
import { defineComponent, PropType, ref, Ref } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import { settingsColorToRgba } from "@epicurrents/core/util"
import { useEegContext } from "../.."

type LineProperties = {
    color: string
    fillColor: string
    line?: string
    points: number[][]
    width: number
}

export default defineComponent({
    name: 'PowerSpectrumTool',
    props: {
        header: {
            type: String,
            required: true,
        },
        height: {
            type: Number,
            required: true,
        },
        lines: {
            type: Array as PropType<LineProperties[]>,
            required: true,
        },
        maxX: {
            type: Number,
            required: true,
        },
        maxY: {
            type: Number,
            required: true,
        },
        width: {
            type: Number,
            required: true,
        },
    },
    setup () {
        const cursorPos = ref(0)
        const cursorValue = ref('')
        const frequencies = ref([] as number[])
        const frequencyBandLines = ref([] as { value: number, x: number }[])
        const plotLines = ref([] as string[])
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const error = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const placeholder = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const series = ref<HTMLOrSVGImageElement>() as Ref<HTMLOrSVGImageElement>
        const plot = ref<HTMLOrSVGImageElement>() as Ref<HTMLOrSVGImageElement>
        return {
            cursorPos,
            cursorValue,
            frequencies,
            frequencyBandLines,
            plotLines,
            // DOM elements
            component,
            error,
            placeholder,
            series,
            plot,
            // Imported methods
            settingsColorToRgba,
            // Settings
            ...useEegContext(useStore())
        }
    },
    computed: {
        hzValuePos (): number {
            if (this.cursorPos < this.width - 70) {
                return this.cursorPos + 5
            } else {
                return this.cursorPos - 65
            }
        },
        plotHeight (): number {
            return this.height - 25 - 3
        },
        plotWidth (): number {
            return this.width - 2
        },
    },
    methods: {
        /**
         * Override the default I18n translate method.
         * Returns a component-specific translation (default) or a
         * general translation (fallback) for the given key string.
         */
        $t: function (key: string, params = {}, capitalized = false) {
            return T(key, this.$options.name, params, capitalized)
        },
        drawPlot () {
            // Add guildelines
            this.frequencyBandLines.splice(0)
            for (const band of this.SETTINGS.frequencyBands) {
                // Add guideline if it is within visible plot range
                if (this.maxX > band.upperLimit) {
                    this.frequencyBandLines.push({
                        value: band.upperLimit,
                        x: (band.upperLimit/this.maxX)*this.plotWidth,
                    })
                }
            }
            this.plotLines.splice(0)
            for (const line of this.lines) {
                let points = [] as string[]
                for (const [x, y] of line.points) {
                    const xPos = x < 0
                                 ? -1
                                 : x > 1
                                   ? this.plotWidth + 1
                                   : x*this.plotWidth
                    const yPos = y < 0
                                 ? -1
                                 : y > 1
                                   ? this.plotHeight + 1
                                   : y*this.plotHeight
                    points.push(`${xPos},${yPos}`)
                }
                this.plotLines.push(points.join(', '))
            }
        },
        handlePointerLeave () {
            this.cursorPos = 0
            this.cursorValue = ''
        },
        handlePointermove (event: PointerEvent) {
            const contLeft = this.plot.getBoundingClientRect().left
            this.cursorPos = Math.max(event.clientX - contLeft, 0)
            this.cursorValue = (this.maxX*this.cursorPos/this.width).toFixed(2)
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this.component.style.height = `${this.height}px`
        this.drawPlot()
    },
})
</script>

<style scoped>
[data-component="frequency-band-plot"] {
    position: relative;
    width: 100%;
    overflow: hidden;
}
.header {
    position: absolute;
    height: 25px;
    line-height: 25px;
    font-variant: small-caps;
}
.max {
    position: absolute;
    top: -2px;
    right: 5px;
    width: 70px;
    font-variant: small-caps;
}
    .max::part(base) {
        padding: 0;
        margin: 0;
        border: none;
        outline: none;
        box-shadow: none;
    }
    .max::part(input) {
        padding: 0;
        text-align: right;
    }
    .max span[slot="suffix"] {
        margin-inline-end: 0;
    }
.plot {
    position: absolute;
    top: 25px;
    border: solid 1px var(--epicv-border-faint);
}
.hzvalue {
    position: absolute;
    top: 35px;
    background-color: var(--epicv-background);
}
</style>
