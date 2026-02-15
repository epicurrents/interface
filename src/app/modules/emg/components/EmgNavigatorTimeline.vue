<template>
    <div data-component="emg-navigator-timeline" ref="timeline">
    </div>
</template>

<script lang="ts">
/**
 * A simple timeline to print below the navigator component.
 */
import { defineComponent, Ref, ref } from "vue"
import { T } from "#i18n"

export default defineComponent({
    name: 'EmgNavigatorTimeline',
    props: {
        duration: {
            type: Number,
            required: true,
        },
        startTime: {
            type: Number,
            default: 0,
        },
        stepSize: {
            type: Number,
            required: true,
        },
        width: {
            type: Number,
            required: true,
        },
    },
    setup () {
        const timeline = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            timeline,
        }
    },
    watch: {
        width () {
            this.printLabels()
        },
    },
    computed: {
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
            const timelineWidth = this.width
            this.timeline.style.width = `${timelineWidth}px`
            this.timeline.innerHTML = ''
            // Zero step size means not possible to fit labels in a meaningful way.
            if (!this.stepSize) {
                return
            }
            const startPos = (this.stepSize - this.startTime%this.stepSize)
            for (let i=startPos; i<this.duration; i+=this.stepSize) {
                const timeStamp = `${this.startTime + i}s`
                const label = document.createElement('div')
                label.innerText = timeStamp
                label.title = timeStamp
                // Do not extend the label more than one fourth of the label width beyond the navigator area.
                const extendPx = 50/4
                const leftPos = Math.min(
                    i/this.duration,
                    (timelineWidth - extendPx)/timelineWidth
                )
                // Position text to the left or right if the tick is at the edge of the label.
                const exactPos = timelineWidth*(i/this.duration)
                if (leftPos*timelineWidth + extendPx < exactPos) {
                    label.style.right = `0`
                    label.style.textAlign = 'right'
                } else if (exactPos < extendPx) {
                    label.style.left = `0`
                    label.style.textAlign = 'left'
                } else {
                    label.style.left = `calc(${(leftPos*100)}% - 25px)`
                }
                // Add data property to label to target scoped styles.
                label.setAttribute(this.$options.__scopeId, '')
                this.timeline.appendChild(label)
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
[data-component="emg-navigator-timeline"] {
    position: absolute;
    bottom: 0;
    z-index: 1;
    height: 20px;
    font-size: 0.8rem;
    overflow: visible;
}
    [data-component="emg-navigator-timeline"] div {
        position: absolute;
        width: 50px;
        height: 20px;
        line-height: 20px;
        text-align: center;
        overflow: hidden;
        white-space: nowrap;
        opacity: 0.8;
    }
</style>
