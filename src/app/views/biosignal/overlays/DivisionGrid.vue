<template>
    <div data-component="division-grid" ref="component">
        <svg ref="grid" :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`">
            <line v-for="(yPos, idx) of isoelLines" :key="`grid-isoel-${idx}`"
                x1="0" :x2="width" :y1="yPos" :y2="yPos"
                :stroke="settingsColorToRgba(SETTINGS.isoelLine.color)"
                :stroke-width="SETTINGS.isoelLine.width"
                fill="none"
            />
            <line v-for="(xPos, idx) of verticalLines" :key="`grid-major-${idx}`"
                :x1="xPos" :x2="xPos" y1="0" :y2="height"
                :stroke="settingsColorToRgba(SETTINGS.grid.major.color)"
                :stroke-width="SETTINGS.grid.major.width"
                fill="none"
            />
            <line v-for="(yPos, idx) of horizontalLines" :key="`grid-major-${idx}`"
                x1="0" :x2="width" :y1="yPos" :y2="yPos"
                :stroke="settingsColorToRgba(SETTINGS.grid.minor.color)"
                :stroke-width="SETTINGS.grid.minor.width"
                fill="none"
            />
            <rect v-for="(intersection, idx) of intersections" :key="`grid-intersection-${idx}`"
                :x="intersection.x"
                :y="intersection.y"
                :width="SETTINGS.grid.intersections.width"
                :height="SETTINGS.grid.intersections.width"
                :stroke="settingsColorToRgba(SETTINGS.grid.intersections.color)"
                :fill="settingsColorToRgba(SETTINGS.grid.intersections.color)"
            />
        </svg>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType, Ref, ref } from "vue"
import { T } from "#i18n"
import { settingsColorToRgba } from "@epicurrents/core/util"
import { useStore } from "vuex"
import { useBiosignalContext } from "#config"

export default defineComponent({
    name: 'DivisionGrid',
    props: {
        horizontalDivs: {
            type: Number,
            default: 0,
        },
        verticalDivs: {
            type: Number,
            default: 0,
        },
        viewerSize: {
            type: Array as PropType<number[]>,
            required: true,
        },
    },
    setup () {
        const store = useStore()
        const height = ref(0)
        const horizontalLines = ref([] as number[])
        const intersections = ref([] as { x: number, y: number }[])
        const isoelLines = ref([] as number[])
        const verticalLines = ref([] as number[])
        const width = ref(0)
        // DOM
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        // Unsubscribe from store mutations
        const unsubscribe = ref(null as (() => void) | null)
        return {
            height,
            horizontalLines,
            intersections,
            isoelLines,
            verticalLines,
            width,
            // DOM
            component,
            // Imported methods
            settingsColorToRgba,
            // Unsubscribers
            unsubscribe,
            ...useBiosignalContext(store, 'TimescaleGrid')
        }
    },
    watch: {
        pxPerSecond () {
            this.drawGrid()
        },
        viewerSize () {
            this.resize()
        }
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
        drawGrid () {
            if (!this.horizontalDivs || !this.verticalDivs) {
                return
            }
            this.isoelLines.splice(0)
            if (this.SETTINGS.isoelLine.show) {
                for (const chan of this.RESOURCE.visibleChannels) {
                    this.isoelLines.push((1 - chan.offset.baseline)*this.height)
                }
            }
            // Build grid intersections and lines.
            this.horizontalLines.splice(0)
            this.intersections.splice(0)
            this.verticalLines.splice(0)
            const isoelLine = this.height/2
            const divHeight = this.height/this.verticalDivs
            const divWidth = this.width/this.horizontalDivs
            for (let i=1; i<this.horizontalDivs; i++) {
                for (let j=0; j<this.verticalDivs/2; j++) {
                    if (this.SETTINGS.grid.intersections.show) {
                        if (!j) {
                            // Draw markers at midline only if isoelectric line is not shown.
                            if (!this.SETTINGS.isoelLine.show) {
                                this.intersections.push({
                                    x: i * divWidth,
                                    y: isoelLine
                                })
                            }
                            continue
                        }
                        const intersections = [
                            {
                                x: i * divWidth,
                                y: isoelLine + j*divHeight
                            },
                            {
                                x: i * divWidth,
                                y: isoelLine - j*divHeight
                            }
                        ]
                        this.intersections.push(...intersections)
                    }
                    if (this.SETTINGS.grid.minor.show) {
                        this.horizontalLines.push(isoelLine + j*divHeight)
                        this.horizontalLines.push(isoelLine - j*divHeight)
                    }
                }
                if (this.SETTINGS.grid.major.show) {
                    this.verticalLines.push(i * divWidth)
                }
            }
        },
        resize () {
            this.width = this.component.offsetWidth
            this.height = this.component.offsetHeight
            this.drawGrid()
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
        // Listen to setting changes.
        this.unsubscribe = this.$store.subscribe((mutation) => {
            if (
                mutation.type === 'set-settings-value'
                && (
                    mutation.payload.field === 'app.screenPPI'
                    || mutation.payload.field.includes('.isoelLine.')
                    || mutation.payload.field.includes('.majorGrid.')
                    || mutation.payload.field.includes('.minorGrid.')
                )
            ) {
                this.drawGrid()
            }
        })
        /*
        this.$store.state.addEventListener(
            [
                'app.screenPPI',
                /.+?\.isoelLine\..+/,
                /.+?\.majorGrid\..+/,
                /.+?\.minorGrid\..+/,
            ],
            () => {
                this.drawGrid()
            },
            this.ID
        )
        */
        // Listen to recording property changes.
        this.RESOURCE.onPropertyChange('activeMontage', () => {
            if (this.SETTINGS.isoelLine.show) {
                this.drawGrid()
            }
        }, this.ID)
        requestAnimationFrame(() => {
            this.resize()
        })
    },
    beforeUnmount () {
        this.RESOURCE.removeAllEventListeners(this.ID)
        if (this.unsubscribe) {
            this.unsubscribe()
        }
    }
})
</script>

<style scoped>
[data-component="division-grid"] {
    position: absolute;
    inset: 0;
}
</style>
