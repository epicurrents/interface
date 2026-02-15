<template>
    <div data-component="position-cursor" ref="component"
        @pointerdown="handleCursorPointerdown"
        @pointerleave="handleCursorPointerleave"
    >
        <div ref="cursor"
            class="cursor"
            :style="cursorStyles"
        ></div>
    </div>
</template>

<script lang="ts">
import { defineComponent, Ref, ref } from "vue"
import { T } from "#i18n"
import { settingsColorToRgba } from "@epicurrents/core/util"
import { useStore } from "vuex"
import { useBiosignalContext } from "#config"

export default defineComponent({
    name: 'PositionCursor',
    props: {
        viewRange: {
            type: Number,
            required: true,
        },
    },
    setup () {
        const store = useStore()
        const isCursorMoved = ref(false)
        const isDragging = ref(false)
        const pointerleaveHandler = null as (() => void) | null
        // DOM
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const cursor = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        // Unsubscribe from store mutations
        const unsubscribe = ref(null as (() => void) | null)
        return {
            isCursorMoved,
            isDragging,
            pointerleaveHandler,
            // DOM
            component,
            cursor,
            // Imported methods
            settingsColorToRgba,
            // Unsubscribers
            unsubscribe,
            ...useBiosignalContext(store, 'PositionCursor')
        }
    },
    computed: {
        cursorStyles (): Record<string, string> {
            return {

            }
        },
        cursorWidth (): string {
            return this.SETTINGS.cursor.active.width + 'px'
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
        handleCursorPointerdown (event: PointerEvent) {
            if (this.isDragging) {
                return
            }
            this.isDragging = true
            this.$emit('cursor-drag-start')
            // Prevent same click from also triggering a channel drag event
            event.stopPropagation()
            const viewport = this.component.parentElement!
            const divLeft = viewport.getBoundingClientRect().left
            // Save initial cursor position (minus cursor padding width).
            const cursorStart = -5
            //const video = this.$refs['video'] as HTMLVideoElement | null
            const handlePointermove = (ev: PointerEvent) => {
                const dif = ev.clientX - divLeft
                const rangeFromEnd = this.RESOURCE.totalDuration - this.RESOURCE.viewStart
                const leftPos = Math.min(
                    Math.max(dif, 1),
                    viewport.offsetWidth*(rangeFromEnd/this.viewRange)
                )
                const cursorPos = this.RESOURCE.viewStart
                                 + this.viewRange*((leftPos - 1)/viewport.offsetWidth)
                this.cursor.style.left = (cursorStart + leftPos - 1) + 'px'
                // Flag cursor as moved if it doesn't end up at the start position
                if (leftPos > 1) {
                    this.isCursorMoved = true
                } else {
                    this.isCursorMoved = false
                }
                this.$emit('cursor-drag', cursorPos)
            }
            const handlePointerup = () => {
                this.component.removeEventListener('pointermove', handlePointermove)
                this.component.removeEventListener('pointerup', handlePointerup)
                this.pointerleaveHandler = null
                this.$emit('cursor-drag-end')
                this.isDragging = false
            }
            this.component.addEventListener('pointermove', handlePointermove)
            this.component.addEventListener('pointerup', handlePointerup)
            // Add pointerUp handler to pointerLeaveHandlers so it will executed when the cursor leaves the overlay
            this.pointerleaveHandler = handlePointerup

            // Prevent default pointer events.
            event.preventDefault()
        },
        handleCursorPointerleave (event: PointerEvent) {
            if (!this.isDragging) {
                return
            }
            this.isDragging = false
            // Prevent default pointer events.
            event.preventDefault()
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
                && mutation.payload.field.includes('.cursor.active.')
            ) {
            }
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
[data-component="position-cursor"] {
    cursor: pointer;
    left: 0;
    position: absolute;
    top: 0;
    width: 1rem;
}
.cursor {
    width: v-bind(cursorWidth);
    margin: 0 5px;
    pointer-events: none;
    position: absolute;
}
</style>
