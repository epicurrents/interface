<template>
    <wa-split-panel
        class="split-panel-view"
        :disabled="isPrimaryFixed"
        :orientation="orientation"
        :position-in-pixels="primarySize"
        :primary="primarySlot"
        ref="panel"
        @wa-reposition.stop="handleDividerMove"
    >
        <div slot="start" ref="start">
            <slot name="start"></slot>
        </div>
        <div slot="end" ref="end">
            <slot name="end"></slot>
        </div>
    </wa-split-panel>
</template>

<script lang="ts">
import { defineComponent, PropType, Ref, ref } from 'vue'
import { T } from '#i18n'
//import { Log } from 'scoped-event-log'

// Child components
import type { default as WaSplitPanel } from '@awesome.me/webawesome/dist/components/split-panel/split-panel.js'

export default defineComponent({
    name: 'SplitPanelView',
    props: {
        height: {
            type: String,
            default: '100%',
        },
        orientation: {
            type: String as PropType<'vertical'>,
            required: false,
        },
        primaryOpen: {
            type: Boolean,
            default: true,
        },
        primarySlot: {
            type: String as PropType<'start' | 'end'>,
            default: 'start',
        },
        primaryStartSize: {
            type: Number,
            required: true,
        },
        primarySizeBounds: {
            type: Array as PropType<string[]>,
            default: ['0%', '100%'],
        },
        secondaryOpen: {
            type: Boolean,
            default: true,
        },
        secondarySizeBounds: {
            type: Array as PropType<string[]>,
            default: ['0%', '100%'],
        },
        width: {
            type: String,
            default: '100%',
        },
    },
    components: {
    },
    setup (props) {
        const primarySize = ref(props.primaryStartSize)
        const end = ref<HTMLElement>() as Ref<HTMLElement>
        const panel = ref<WaSplitPanel>() as Ref<WaSplitPanel>
        const start = ref<HTMLElement>() as Ref<HTMLElement>
        return {
            primarySize,
            end,
            panel,
            start,
        }
    },
    watch: {
        primaryOpen () {
            this.$nextTick(() => {
                this.handleDividerMove()
            })
        },
        primaryStartSize (value: number) {
            // Mirror prop → internal ref so wa-split-panel re-renders its position when the
            // parent drives the divider programmatically (e.g. EegViewer expanding the bottom
            // slot when the trend strip is toggled on). Echo filtering is handled in the parent
            // (`handleNavigatorResize` in `useBiosignalLayout.ts`) rather than here: when
            // wa-split-panel fires `wa-reposition` it dispatches the event SYNCHRONOUSLY inside
            // its `handlePositionChange` watcher, before the LitElement render() runs — meaning
            // `this.end.offsetHeight` in `handleDividerMove` can return the pre-render layout
            // value. If we filtered against that stale value, a programmatic toggle on/off
            // sequence would poison `lastEmittedSize` to the pre-toggle slot size and the next
            // legitimate update would be rejected as an echo. Trusting the parent filter (which
            // only blocks 1-pixel deltas against the live `navigatorHeight`) avoids the trap.
            this.primarySize = value
        },
        secondaryOpen () {
            this.$nextTick(() => {
                this.handleDividerMove()
            })
        },
    },
    computed: {
        /** Primary slot has equal min and max — the divider would be a visual no-op, so hide
         *  it entirely and pass `disabled` through to wa-split-panel. */
        isPrimaryFixed (): boolean {
            return this.primarySizeBounds[0] === this.primarySizeBounds[1]
        },
        dividerCursor (): string  {
            if (!this.primaryOpen || !this.secondaryOpen || this.isPrimaryFixed) {
                return 'default'
            }
            return this.orientation === 'vertical' ? 'row-resize' : 'col-resize'
        },
        dividerOpacity (): string  {
            if (!this.primaryOpen || !this.secondaryOpen || this.isPrimaryFixed) {
                return '0'
            }
            return '1'
        },
        dividerUserSelect (): string  {
            if (!this.primaryOpen || !this.secondaryOpen || this.isPrimaryFixed) {
                return 'none'
            }
            return 'auto'
        },
        primaryMaxSize (): string  {
            if (!this.primaryOpen) {
                return '0px'
            }
            return this.primarySizeBounds[1]
        },
        primaryMinSize (): string  {
            if (!this.primaryOpen) {
                return '0px'
            }
            return this.primarySizeBounds[0]
        },
        secondaryMaxSize (): string  {
            if (!this.secondaryOpen) {
                return '0px'
            }
            return this.secondarySizeBounds[1]
        },
        secondaryMinSize (): string  {
            if (!this.secondaryOpen) {
                return '0px'
            }
            return this.secondarySizeBounds[0]
        },
        slotHeight (): string  {
            return this.orientation !== 'vertical' ? '100%' : ''
        },
        slotWidth (): string  {
            return this.orientation === 'vertical' ? '100%' : ''
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
        Log (event: any) {
            console.log(event)
        },
        handleDividerMove () {
            if (!this.start && !this.end) {
                // Components have not loaded yet.
                return
            }
            // wa-split-panel emits `wa-reposition` SYNCHRONOUSLY inside `handlePositionChange`,
            // before LitElement's render() applies the new grid-template style. Reading
            // `offsetHeight`/`offsetWidth` at that moment returns the previous frame's layout,
            // which leads to the 2-pixel oscillation during drag. Reading the wa-split-panel's
            // own `positionInPixels` is live but unclamped — it stores the user's drag target
            // even when the CSS `clamp(var(--min), …, var(--max))` keeps the displayed slot at
            // a bounded value, so propagating it would let `navigatorHeight` grow past the
            // configured maximum.
            //
            // The cleanest fix is to wait one animation frame: by then LitElement has rendered,
            // CSS layout has applied the clamp, and `offsetHeight` reflects the actual
            // displayed slot size. The 1-frame lag is below perceptible threshold for resize
            // feedback.
            requestAnimationFrame(() => {
                if (!this.start || !this.end) {
                    return
                }
                const dimensions = {
                    start: this.orientation === 'vertical' ? this.start.offsetHeight : this.start.offsetWidth,
                    end: this.orientation === 'vertical' ? this.end.offsetHeight : this.end.offsetWidth,
                }
                this.$emit('resize', dimensions)
            })
        },
    },
    beforeMount () {
        // Add component styles to shadow root.
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        requestAnimationFrame(() => {
            // Report initial dimensions.
            this.handleDividerMove()
        })
    },
    beforeUnmount () {
    },
})
</script>

<style scoped>
.split-panel-view {
    height: v-bind(height);
    overflow: hidden;
    position: relative;
    width: v-bind(width);
    --divider-width: 0px;
    --max: v-bind(primaryMaxSize);
    --min: v-bind(primaryMinSize);
}
    .split-panel-view::part(divider) {
        /* Simply setting display to none also hides the end panel for some reason. */
        cursor: v-bind(dividerCursor);
        opacity: v-bind(dividerOpacity);
        user-select: v-bind(dividerUserSelect);
    }
    .split-panel-view > *:not(.divider) {
        height: v-bind(slotHeight);
        overflow: hidden;
        width: v-bind(slotWidth);
    }
</style>
