<template>
    <div data-component="plot-xaxis" ref="labels">
    </div>
</template>

<script lang="ts">
/**
 * Having separate components for the axes may be a bit superfluous, but it reduces
 * clutter in the Viewer component.
 */
import { defineComponent, PropType, Ref, ref } from "vue"
import { T } from "#i18n"

export default defineComponent({
    name: 'EegPlotXAxis',
    props: {
        cmPerSec: {
            type: Number,
            default: 0,
        },
        dimensions: {
            type: Array as PropType<number[]>,
            required: true,
        },
        secPerPage: {
            type: Number,
            default: 0,
        },
        viewStart: {
            type: Number,
            default: 0,
        },
    },
    setup () {
        const labels = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            labels,
        }
    },
    watch: {
        cmPerSec () {
            this.printLabels()
        },
        dimensions () {
            this.printLabels()
        },
        secPerPage () {
            this.printLabels()
        },
        viewStart () {
            this.printLabels()
        },
    },
    computed: {
        /** Horizontal pixel resolution of one second of signal data. */
        pxPerSecond (): number {
            if (this.cmPerSec) {
                return Math.floor((this.$store.state.INTERFACE.app.screenPPI/2.54)*this.cmPerSec)
            } else {
                return Math.floor((this.dimensions[0])/this.secPerPage)
            }
        },
        /** Current view range in seconds. */
        viewRange (): number {
            return this.dimensions[0]/this.pxPerSecond
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
        /**
         * This has to be called on each resize, so that labels get added or removed as
         * necessary when the view width changes.
         */
        printLabels () {
            this.labels.style.top = `${this.dimensions[1]}px`
            this.labels.style.width = `${this.dimensions[0]}px`
            this.labels.innerHTML = ''
            for (let i=1; i<this.viewRange; i++) {
                let point = Math.floor(this.viewStart) + i
                let hrs: number = Math.floor(point/60/60)
                let mins: number = Math.floor((point - hrs*60*60)/60)
                let secs: number = point - hrs*60*60 - mins*60
                let timestamp = ''
                if (hrs) {
                    timestamp = hrs.toString() + ':'
                }
                if (mins) {
                    if (hrs) {
                        timestamp += mins.toString().padStart(2, '0') + ':'
                    } else {
                        timestamp += mins + ':'
                    }
                } else {
                    if (hrs) {
                        timestamp += '00:'
                    } else {
                        timestamp = '0:'
                    }
                }
                if (secs) {
                    timestamp += secs.toString().padStart(2, '0')
                } else {
                    timestamp += '00'
                }
                const label = document.createElement('div')
                label.innerText = timestamp
                label.title = timestamp
                label.style.left = `calc(${(i*(100/this.viewRange))}% - 50px)`
                this.labels.appendChild(label)
            }
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
        // Print initial labels
        this.printLabels()
    },
})
</script>

<style scoped>
[data-component="plot-xaxis"] {
    position: absolute;
    left: 80px;
    z-index: 1;
    height: 25px;
    overflow: hidden;
}
    [data-component="plot-xaxis"] div {
        position: absolute;
        width: 100px;
        height: 25px;
        line-height: 25px;
        text-align: center;
        overflow: hidden;
        white-space: nowrap;
    }
</style>
