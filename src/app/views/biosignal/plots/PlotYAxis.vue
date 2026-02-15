<template>
    <div data-component="plot-yaxis" ref="labels">
        <div v-for="(chan, idx) of visibleChannels" :key="`y-label-${idx}`"
            class="label wa-brand"
            @click="labelClicked(chan, $event)"
            @contextmenu.prevent="labelClicked(chan, $event)"
        >
            <span :class="{ 'active': chan.isActive }">{{ chan.label }}</span>
        </div>
    </div>
</template>

<script lang="ts">
/**
 * Having separate components for the axes may be a bit superfluous, but it reduces
 * clutter in the Viewer component.
 */
import { defineComponent, PropType, Ref, ref } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import { useBiosignalContext } from "#config"
import type { BiosignalChannel } from "@epicurrents/core/types"

export default defineComponent({
    name: 'PlotYAxis',
    props: {
        offset: {
            type: Array as PropType<number[]>,
            required: true,
        },
        width: {
            type: Number,
            required: true,
        },
    },
    setup () {
        const store = useStore()
        const context = useBiosignalContext(store, 'PlotYAxis')
        // Visible channels in resource is a computed property and isn't automatically reactive. We need to save a
        // reactive reference to it.
        const visibleChannels = ref(context.RESOURCE.visibleChannels)
        const labels = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            visibleChannels,
            labels,
            // Context methods.
            ...context,
        }
    },
    computed: {
        componentHeight (): string {
            return `calc(100% - ${this.offsetTop} - ${this.offset[2]}px)`
        },
        componentWidth (): string {
            return `${this.width}px`
        },
        labelWidth (): string {
            return `calc(${this.width}px - ${this.offset[1]}px - ${this.offsetLeft})`
        },
        offsetLeft (): string {
            return this.offset[3] + 'px'
        },
        offsetTop (): string {
            return this.offset[0] + 'px'
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
        labelClicked (channel: BiosignalChannel | null, e: MouseEvent) {
            if (!channel) {
                return
            }
            if (e.button === 0) {
                this.$emit('toggle-channel', channel)
            } if (e.button === 2) {
                this.$emit('select-channel', channel)
            }
        },
        resizeElements (initial = false) {
            let i = 0
            for (const chan of this.RESOURCE.visibleChannels) {
                const label = this.labels.children[i] as HTMLDivElement
                if (label) {
                    const defaultOffset = ((i + 1)/(this.visibleChannels.length + 1))
                    const offset = chan?.offset?.baseline || defaultOffset
                    const borders = (this.SETTINGS.border.bottom?.width || 0)
                                    + (this.SETTINGS.border.top?.width || 0)
                    label.style.top = `calc(${(1 - offset)*100}% - ${12 - borders}px)`
                }
                i++
            }
            if (initial) {
                // Make labels visible after they have been positioned.
                this.labels.style.opacity = '1'
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
        // Listen to montage changes
        this.RESOURCE.onPropertyChange('activeMontage', () => {
            this.visibleChannels = this.RESOURCE.visibleChannels
            requestAnimationFrame(() =>
                this.resizeElements()
            )},
            this.ID
        )
        this.$nextTick(() => {
            // Resize elements after the component is mounted.
            this.resizeElements(true)
        })
    },
    beforeUnmount () {
        this.RESOURCE.removeAllEventListeners(this.ID)
        for (const chan of this.RESOURCE.visibleChannels) {
            chan.removeAllEventListeners(this.ID)
        }
    },
})
</script>

<style scoped>
[data-component="plot-yaxis"] {
    flex: 0 0 v-bind(componentWidth);
    position: relative;
    top: v-bind(offsetTop);
    height: v-bind(componentHeight);
    opacity: 0;
    transition: opacity ease 0.25s;
    width: v-bind(componentWidth);
}
    .label {
        position: absolute;
        left: v-bind(offsetLeft);
        width: v-bind(labelWidth);
        height: 24px;
        text-align: right;
        overflow: hidden;
        white-space: nowrap;
        z-index: 1;
    }
    .label span {
        display: inline-block;
        height: 24px;
        line-height: 24px;
        padding: 0 10px;
    }
    .label span.active {
        background-color: var(--epicv-background-active);
    }
</style>
