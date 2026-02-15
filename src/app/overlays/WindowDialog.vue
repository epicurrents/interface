<template>
    <wa-dialog data-component="window-dialog"
        :label="title"
        light-dismiss
        ref="wrapper"
        @wa-hide="handleHide"
    >
        <overlay-component ref="overlay"
            :style="{
                inset: '0',
                pointerEvents: 'none',
                position: 'fixed',
                zIndex: 1000,
            }"
        />
        <slot></slot>
    </wa-dialog>
</template>

<script lang="ts">
/**
 * Signal analysis window.
 */
import { defineComponent, ref, Ref } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import {
    default as OverlayComponent,
    type OverlayPointerEventMeta,
    type PointerEventOverlay,
} from '#app/overlays/PointerEventOverlay.vue'
import type { WaHideEvent } from '@awesome.me/webawesome'

export default defineComponent({
    name: 'WindowDialog',
    props: {
        height: {
            type: Number,
            default: 600,
        },
        left: {
            type: Number,
            default: 0,
        },
        preventLightDismiss: {
            type: Boolean,
            default: false,
        },
        title: {
            type: String,
            required: true,
        },
        top: {
            type: Number,
            default: 0,
        },
        width: {
            type: Number,
            default: 700,
        },
    },
    components: {
        OverlayComponent,
    },
    setup () {
        // Shorthands for scoped constants
        const store = useStore()
        const ID = 'WindowDialog' + store.state.APP.runningId++
        const dialog = ref<HTMLDialogElement>() as Ref<HTMLDialogElement>
        const header = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const overlay = ref<PointerEventOverlay>() as Ref<PointerEventOverlay>
        const wrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            ID,
            dialog,
            header,
            overlay,
            wrapper,
        }
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
        handleHide (event: WaHideEvent) {
            // Handle the event here.
            const source = event.detail?.source
            // The event may originate from the icon inside the close button.
            const parent = source?.parentElement
            if (
                (source && (source.nodeName === 'WA-BUTTON' && source.className.includes('close'))) ||
                (parent && (parent.nodeName === 'WA-BUTTON' && parent.className.includes('close')))
            ) {
                // Only emit close event if the dialog was closed by clicking the close button.
                this.$emit('close')
                event.stopPropagation()
                return
            }
            // If light dismissal is allowed, emit close event when clicking outside the dialog.
            if (event.detail?.source.nodeName === 'DIALOG' && event.detail.source.className.includes('dialog')) {
                // If light dismiss is allowed, emit close event when clicking outside the dialog.
                if (!this.preventLightDismiss) {
                    // Prevent light dismissal.
                    this.$emit('close')
                } else {
                    event.preventDefault()
                }
                event.stopPropagation()
                return
            }
        },
        handlePointerdown (event: PointerEvent) {
            const startLeft = event.clientX - this.dialog.offsetLeft
            const startTop = event.clientY - this.dialog.offsetTop
            const pointerMove = (left: number, top: number, _meta: OverlayPointerEventMeta) => {
                // Don't move the dialog out of sight.
                const newLeft = Math.min(
                    Math.max(left - startLeft, -this.width + 100),
                    this.overlay.getOffsetWidth() - 50
                )
                const newTop = Math.min(
                    Math.max(top - startTop, 0),
                    this.overlay.getOffsetHeight() - 50
                )
                this.dialog.style.marginLeft = `${newLeft}px`
                this.dialog.style.marginTop = `${newTop}px`
            }
            const moveEnd = (left: number, top: number, _meta: OverlayPointerEventMeta) => {
                // Save window position but display the whole dialog.
                const newLeft = Math.min(
                    Math.max(left - startLeft, 0),
                    this.overlay.getOffsetWidth() - this.width
                )
                const newTop = Math.min(
                    Math.max(top - startTop, 0),
                    this.overlay.getOffsetHeight() - this.height
                )
                this.$emit('update:left', newLeft)
                this.$emit('update:top', newTop)
            }
            this.overlay.trackPointer(event, { move: pointerMove, up: moveEnd }, this.dialog)
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
        requestAnimationFrame(() => {
            const dialog = this.wrapper.shadowRoot?.querySelector('.dialog')
            if (dialog) {
                this.dialog = dialog as HTMLDialogElement
                this.dialog.style.marginTop = `${this.top}px`
                this.dialog.style.marginLeft = `${this.left}px`
                this.dialog.style.width = `${this.width}px`
                this.dialog.style.height = `${this.height}px`
            }
            const header = this.wrapper.shadowRoot?.querySelector('.title')
            if (header) {
                this.header = header as HTMLDivElement
                this.header.addEventListener('pointerdown', this.handlePointerdown)
            }
        })
    },
    beforeUnmount () {
        if (this.header) {
            this.header.removeEventListener('pointerdown', this.handlePointerdown)
        }
    },
})
</script>

<style scoped>
[data-component="window-dialog"]::part(header) {
    padding: 0;
}
[data-component="window-dialog"]::part(title) {
    padding: 1rem;
}
[data-component="window-dialog"]::part(header-actions) {
    padding: 0.5rem;
}
[data-component="window-dialog"]::part(body) {
    overflow: hidden;
    padding: 0 15px 15px;
}
[data-component="window-dialog"]::part(panel) {
    display: inline-block;
    position: absolute;
}
</style>
