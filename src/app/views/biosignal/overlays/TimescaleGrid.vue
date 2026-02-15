<template>
    <div data-component="timescale-grid" ref="component">
        <svg ref="grid"
            :height="height"
            preserve-aspect-ratio="none"
            :width="width"
            :viewBox="`0 0 ${width} ${height}`"
        >
            <line v-for="(yPos, idx) of isoelLines" :key="`grid-isoel-${idx}`"
                x1="0" :x2="width" :y1="yPos" :y2="yPos"
                :stroke="settingsColorToRgba(SETTINGS.isoelLine.color)"
                :stroke-width="SETTINGS.isoelLine.width"
                fill="none"
            />
            <line v-for="(xPos, idx) of majorLines" :key="`grid-major-${idx}`"
                :x1="xPos" :x2="xPos" y1="0" :y2="height"
                :stroke="settingsColorToRgba(SETTINGS.grid.major.color)"
                :stroke-width="SETTINGS.grid.major.width"
                fill="none"
            />
            <line v-for="(xPos, idx) of minorLines" :key="`grid-minor-${idx}`"
                :x1="xPos" :x2="xPos" y1="0" :y2="height"
                :stroke="settingsColorToRgba(SETTINGS.grid.minor.color)"
                :stroke-width="SETTINGS.grid.minor.width"
                fill="none"
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
    name: 'TimescaleGrid',
    props: {
        pxPerSecond: {
            type: Number,
            default: 0,
        },
        viewerSize: {
            type: Array as PropType<number[]>,
            required: true,
        },
    },
    setup (props) {
        const store = useStore()
        const height = ref(props.viewerSize[1])
        const isoelLines = ref([] as number[])
        const majorLines = ref([] as number[])
        const minorLines = ref([] as number[])
        const width = ref(props.viewerSize[0])
        // DOM
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        // Unsubscribe from store mutations
        const unsubscribe = ref(null as (() => void) | null)
        return {
            height,
            isoelLines,
            majorLines,
            minorLines,
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
        viewerSize (value: number[]) {
            if (value[1] === this.height && value[0] <= this.width) {
                return
            }
            this.resize()
        }
    },
    computed: {
        widthPx (): string {
            return this.width + 'px'
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
            if (!this.pxPerSecond) {
                return
            }
            this.isoelLines.splice(0)
            if (this.SETTINGS.isoelLine.show) {
                for (const chan of this.RESOURCE.visibleChannels) {
                    this.isoelLines.push((1 - chan.offset.baseline)*this.height)
                }
            }
            // Build major gridlines
            this.majorLines.splice(0)
            if (this.SETTINGS.grid.major.show) {
                for (let i=this.pxPerSecond; i<this.width; i+=this.pxPerSecond) {
                    this.majorLines.push(i)
                }
            }
            this.minorLines.splice(0)
            if (this.SETTINGS.grid.minor.show) {
                for (let i=this.pxPerSecond/5; i<this.width; i+=this.pxPerSecond/5) {
                    if (i%this.pxPerSecond > 1) {
                        this.minorLines.push(i)
                    }
                }
            }
        },
        resize () {
            this.width = this.viewerSize[0]
            this.height = this.viewerSize[1]
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
                    || mutation.payload.field.includes('.grid.')
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
        // We need to allow the split panel component in viewer to draw.
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
[data-component="timescale-grid"] {
    position: absolute;
    bottom: 0;
    left: 0;
    top: 0;
    width: v-bind(widthPx);
}
</style>
