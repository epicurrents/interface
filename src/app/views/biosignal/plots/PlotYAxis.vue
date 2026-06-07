<template>
    <div data-component="plot-yaxis" ref="labels">
        <div v-for="(chan, idx) of visibleChannels" :key="`y-label-${idx}`"
            class="label wa-brand"
            @click="labelClicked(chan, $event)"
            @contextmenu.prevent="labelClicked(chan, $event)"
        >
            <span :class="{ 'active': chan.isActive }">{{ rowLabels[idx] ?? chan.label }}</span>
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
import { padTime, secondsToTimeString } from "@epicurrents/core/util"
import { useStore } from "vuex"
import { useBiosignalContext } from "#config"
import type { BiosignalCascadeMontage, BiosignalChannel } from "@epicurrents/core/types"

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
        const visibleChannels = ref(context.RESOURCE.visibleChannels.filter(c => !c.isOriginal))
        // Per-row label override. Populated only when the active montage is a cascade — every row
        // points at the same source channel, so the channel's own label repeats N times and a
        // recording-time tag per row is the only useful identifier. Recomputed on viewStart change
        // by `updateRowLabels` below.
        const rowLabels = ref([] as (string | null)[])
        const labels = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            visibleChannels,
            rowLabels,
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
        formatTime (seconds: number): string {
            const parts = secondsToTimeString(Math.floor(seconds), true) as number[]
            const [, hours, mins, secs] = parts
            if (hours) {
                return `${hours}:${padTime(mins)}:${padTime(secs)}`
            }
            return `${padTime(mins)}:${padTime(secs)}`
        },
        labelClicked (channel: BiosignalChannel | null, e: MouseEvent) {
            if (!channel) {
                return
            }
            // Cascade rows all point at the same source channel — toggling that channel off or
            // opening its properties menu would either nuke the whole stack or duplicate a single
            // channel's actions across N rows. Neither is useful, so swallow label clicks while
            // a cascade is active and let the parent suppress the menu.
            if (this.RESOURCE.activeMontage?.isCascade) {
                return
            }
            if (e.button === 0) {
                this.$emit('toggle-channel', channel)
            } if (e.button === 2) {
                this.$emit('select-channel', channel)
            }
        },
        updateRowLabels () {
            const active = this.RESOURCE.activeMontage
            if (!active?.isCascade) {
                this.rowLabels = []
                return
            }
            const cascade = active as BiosignalCascadeMontage
            const next: (string | null)[] = []
            for (let i = 0; i < this.visibleChannels.length; i++) {
                const range = cascade.getRowTimeRange(i)
                next.push(range ? this.formatTime(range[0]) : null)
            }
            this.rowLabels = next
        },
        resizeElements (initial = false) {
            let i = 0
            for (const chan of this.RESOURCE.visibleChannels.filter(c => !c.isOriginal)) {
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
            this.visibleChannels = this.RESOURCE.visibleChannels.filter(c => !c.isOriginal)
            this.updateRowLabels()
            requestAnimationFrame(() =>
                this.resizeElements()
            )},
            this.ID
        )
        // Cascade row labels show recording time — refresh on every viewStart change so the
        // labels track the displayed slice as the user scrolls. `pageLength` also affects the
        // per-row range; `timebase` propagates the cascade's routed pageLength.
        this.RESOURCE.onPropertyChange('viewStart', this.updateRowLabels, this.ID)
        this.RESOURCE.onPropertyChange('displayViewStart', this.updateRowLabels, this.ID)
        this.RESOURCE.onPropertyChange('timebase', this.updateRowLabels, this.ID)
        this.updateRowLabels()
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
