<template>
    <div data-component="vertical-cursors" ref="component">
        <div v-for="(cursor, idx) of cursors" :key="`vertical-cursor-${idx}`"
            :ref="cursorRef"
            class="cursor"
            :style="cursor.style"
            @pointerdown.prevent="handleCursorPointerdown($event, idx)"
        >
            <div :style="cursorLineStyles"></div>
        </div>
        <div v-if="displayMainCursor"
            class="cursor"
            ref="mainCursor"
            @pointerdown.prevent="handleCursorPointerdown($event)"
        >
            <div :style="mainCursorStyles"></div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType, reactive, Ref, ref } from "vue"
import { T } from "#i18n"
import { BiosignalChannelMarker, BiosignalCursor } from "@epicurrents/core/types"
import { settingsColorToRgba } from "@epicurrents/core/util"
import { useStore } from "vuex"
import { useBiosignalContext } from "#config"
import type { OverlayPointerEventMeta, PointerEventOverlay } from "#app/overlays/PointerEventOverlay.vue"
import { Log } from "scoped-event-log"

const CURSOR_MARGIN = 6

export default defineComponent({
    name: 'VerticalCursors',
    props: {
        displayMainCursor: {
            type: Boolean,
            default: true,
        },
        overlay: {
            type: Object as PropType<PointerEventOverlay>,
            required: true,
        },
        viewRange: {
            type: Number,
            required: true,
        },
    },
    setup () {
        const store = useStore()
        const cursors = ref([]) as Ref<BiosignalCursor[]>
        const cursorsDraggable = ref(true)
        const dragging = ref(false)
        const mainCursorMoved = ref(false)
        const mainCursorPos = ref(0)
        const markers = reactive([] as BiosignalChannelMarker[][])
        // Template refs
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const cursorDivs = ref([]) as Ref<HTMLDivElement[]>
        const mainCursor = ref<HTMLDivElement>() as Ref<HTMLDivElement|null>
        // Pointer interaction handlers
        const pointerLeaveHandlers = ref([] as ((event: PointerEvent) => any)[])
        // Unsubscribe from store mutations
        const unsubscribe = ref(null as (() => void) | null)
        return {
            cursors,
            cursorsDraggable,
            dragging,
            mainCursorMoved,
            mainCursorPos,
            markers,
            // Template refs
            component,
            cursorDivs,
            mainCursor,
            // Handlers
            pointerLeaveHandlers,
            // Imported methods
            settingsColorToRgba,
            // Scope
            ...useBiosignalContext(store, 'VerticalCursors'),
            // Unsubscribers
            unsubscribe,
        }
    },
    watch: {
        viewRange () {
            this.updateCursors()
        },
    },
    computed: {
        cursorHorizontalPadding (): string {
            return `${CURSOR_MARGIN}px`
        },
        cursorLeftPosition (): string {
            return `-${this.cursorHorizontalPadding}`
        },
        cursorLineStyles (): string {
            const styles = [
                `width: ${this.SETTINGS.cursor.active.width}px`,
                `background-color: ${settingsColorToRgba(this.SETTINGS.cursor.active.color)}`,
            ]
            return styles.join(';')
        },
        cursorStyles (): string {
            return `width: ${2*CURSOR_MARGIN + this.SETTINGS.cursor.active.width}px;` +
                   `pointer-events: ${this.cursorsDraggable ? 'auto' : 'none'};`
        },
        mainCursorStyles (): string {
            const styles = [
                `width: ${this.SETTINGS.cursor.main.width}px`,
                `background-color: ${settingsColorToRgba(this.SETTINGS.cursor.main.color)}`,
            ]
            return styles.join(';')
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
        addPointerLeaveHandler (handler: (event?: PointerEvent) => void) {
            this.pointerLeaveHandlers.push(handler)
        },
        cursorRef (el: any) {
            if (el) {
                this.cursorDivs.push(el)
            }
        },
        disable () {
            if (this.mainCursor) {
                this.mainCursor.style.pointerEvents = 'none'
            }
            this.cursorsDraggable = false
        },
        enable () {
            if (this.mainCursor) {
                this.mainCursor.style.pointerEvents = 'auto'
            }
            this.cursorsDraggable = true
        },
        /**
         * Handle pointer down event on any of the cursors.
         */
        handleCursorPointerdown (event: PointerEvent, idx?: number) {
            if (idx !== undefined) {
                // One of the vertical cursors.
                const cursor = this.cursors[idx]
                const cursorDiv = this.cursorDivs[idx]
                const pointerMove = (left: number, _top: number, meta: OverlayPointerEventMeta) => {
                    cursor.setValue(((left - meta.initialX)/this.overlay.getOffsetWidth())*this.viewRange)
                    cursorDiv.style.left = `${100*cursor.position/this.viewRange}%`
                }
                this.overlay.trackPointer(event, { move: pointerMove })
            } else if (this.displayMainCursor && this.mainCursor) {
                // Main cursor.
                const pointerMove = (left: number, _top: number, _meta: OverlayPointerEventMeta) => {
                    const rangeFromEnd = this.RESOURCE.totalDuration - this.RESOURCE.viewStart
                    const leftPos = Math.min(
                        Math.max(left, 0),
                        this.overlay.getOffsetWidth()*(rangeFromEnd/this.viewRange)
                    )
                    if (leftPos <= CURSOR_MARGIN) {
                        // Treat cursor as returned to start position.
                        this.mainCursorMoved = false
                    } else {
                        this.mainCursorMoved = true
                    }
                    this.mainCursor!.style.left = `${leftPos - CURSOR_MARGIN}px`
                    this.mainCursorPos = leftPos*this.viewRange/this.overlay.getOffsetWidth() + this.RESOURCE.viewStart
                    this.$emit('main-cursor-position', this.mainCursorPos)
                }
                this.overlay.trackPointer(event, { move: pointerMove })
            }
        },
        /**
         * Handle pointer leave events by executing and removing the appropriate the handlers.
         */
        handlePointerLeave (event: PointerEvent) {
            // Run all appropriate pointerleave handlers
            while (this.pointerLeaveHandlers.length) {
                // Remove handlers from the list and execute them
                const evHandler = this.pointerLeaveHandlers.shift()
                // Check that element still exists
                if (evHandler) {
                    evHandler(event)
                }
            }
        },
        removePointerLeaveHandler (handler: (event?: PointerEvent) => void) {
            for (let i=0; i<this.pointerLeaveHandlers.length; i++) {
                if (this.pointerLeaveHandlers[i] === handler) {
                    this.pointerLeaveHandlers.splice(i, 1)
                }
            }
        },
        setCursorPos (pos: number, idx?: number) {
            if (idx === undefined || idx < 0) {
                if (!this.displayMainCursor) {
                    // No main cursor, do nothing.
                    Log.warn(`Cannot set cursor position, main cursor is disabled.`, this.$options.name!)
                    return
                }
                // Set main cursor position.
                this.mainCursorMoved = true
                this.mainCursorPos = pos
                this.$emit('main-cursor-position', this.mainCursorPos)
            } else if (this.RESOURCE.cursors.length > idx) {
                // Set vertical cursor position
                const cursor = this.RESOURCE.cursors[idx]
                cursor.setPosition(pos)
            }
            this.updateCursors()
        },
        updateCursors () {
            if (this.displayMainCursor && this.mainCursor) {
                if (
                    this.RESOURCE.viewStart + this.viewRange < this.mainCursorPos
                    || this.RESOURCE.viewStart > this.mainCursorPos
                ) {
                    // Cursor falls outside the current view range, reset it.
                    this.mainCursorPos = this.RESOURCE.viewStart
                    this.mainCursorMoved = false
                    this.$emit('main-cursor-position', this.mainCursorPos)
                } else if (!this.mainCursorMoved) {
                    // If the main cursor has not been moved, keep it at the start of the view range.
                    this.mainCursorPos = this.RESOURCE.viewStart
                    this.$emit('main-cursor-position', this.mainCursorPos)
                }
                const mainCursorLeft = (this.mainCursorPos - this.RESOURCE.viewStart)/this.viewRange
                this.mainCursor.style.left = `calc(${100*mainCursorLeft}% - ${CURSOR_MARGIN}px)`
            } else {
                this.mainCursorPos = 0
            }
            this.cursors.splice(0)
            let i = 0
            for (const cursor of this.RESOURCE.cursors) {
                if (cursor.position > this.viewRange) {
                    // Don't render cursor outside the viewport
                    continue
                }
                //const cursIdx = i
                const newCursor = {
                    id: cursor.id,
                    active: cursor.active,
                    label: cursor.label,
                    dragging: false,
                    position: cursor.position,
                    style: `left:calc(${100*cursor.position/this.viewRange}% - ${CURSOR_MARGIN}px);${this.cursorStyles};`,
                    value: cursor.value,
                    setPosition: (position: number) =>  {
                        cursor.position = position
                        newCursor.position = position
                        newCursor.style = `left:calc(${100*newCursor.position/this.viewRange}% - ${CURSOR_MARGIN}px);${this.cursorStyles}`
                        this.$emit('cursors-updated')
                    },
                    setValue: (value: number) => {
                        cursor.value = value
                        newCursor.value = value
                        // Check and update cursor order if needed
                        newCursor.setPosition(value)
                        this.RESOURCE.cursors.sort((a, b) => a.value - b.value)
                    },
                }
                this.cursors.push(newCursor)
                i++
            }
        }
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this.updateCursors()
        // Add property update handlers
        this.RESOURCE.onPropertyChange('displayViewStart', this.updateCursors, this.ID)
    },
    beforeUnmount () {
        // Remove property update handlers
        this.RESOURCE.removeAllEventListeners(this.ID)
    }
})
</script>

<style scoped>
[data-component="vertical-cursors"] {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
    .cursor {
        position: absolute;
        top: 0;
        left: v-bind(cursorLeftPosition);
        bottom: 0;
        padding: 0 v-bind(cursorHorizontalPadding);
        cursor: pointer;
        pointer-events: auto;
        touch-action: none;
        z-index: 1;
    }
        .cursor > div {
            height: 100%;
        }
</style>
