<template>
    <Teleport :disabled="!target" :to="target ?? 'body'">
        <div v-if="target || inline" ref="content" :class="contentClass">
            <slot></slot>
        </div>
    </Teleport>
</template>

<script lang="ts">
/**
 * Shows its content in the document's detachable window while `open` is set.
 *
 * The content moves into the window by teleport, so it is not remounted. With `inline` it is shown in place while
 * the window is closed and moves back when the window closes; without it, it exists only while the window is open.
 * Opening this window closes any other detachable window on the page, whichever application owns it, and that
 * window's owner hears `close`. The window is a Picture-in-Picture window where the browser offers one, and
 * otherwise a non-modal window over the page.
 *
 * The component uses no store and only relative imports, so a host application can compile it from source.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import { defineComponent, nextTick, ref, shallowRef, type PropType } from 'vue'
import { getWindowHost, type WindowHandle } from './windowHost'

export default defineComponent({
    name: 'DetachedWindow',
    props: {
        /** Accessible name of the close button of an in-page window. */
        closeLabel: {
            type: String,
            default: 'Close',
        },
        /**
         * Classes standing in for the ancestors the content leaves behind, on an element that generates no box, so
         * they reach the content's descendant rules without giving the window their own element's layout.
         */
        contextClass: {
            type: [String, Array] as PropType<string | string[]>,
            default: '',
        },
        /** Accessible name of the in-page window's button that moves it into Picture-in-Picture. */
        detachLabel: {
            type: String,
            default: 'Open in a separate window',
        },
        /** Height of the content area in pixels, inside the window's padding. */
        height: {
            type: Number,
            default: 480,
        },
        /** Show the content in place while the window is closed. */
        inline: {
            type: Boolean,
            default: false,
        },
        /** Distance of an in-page window from the left edge of the viewport; null centres it. */
        left: {
            type: Number as PropType<number | null>,
            default: null,
        },
        /**
         * Names the window for remembering whether the user last showed it in the page or in Picture-in-Picture.
         * Without one the window follows the last choice made in any window.
         */
        name: {
            type: String,
            default: '',
        },
        /** Whether the window is open. */
        open: {
            type: Boolean,
            default: false,
        },
        /** Use a Picture-in-Picture window where the browser offers one. */
        pictureInPicture: {
            type: Boolean,
            default: true,
        },
        /**
         * Whether the window's size may change. A fixed window keeps its content at the given size; in
         * Picture-in-Picture, which the user can always resize, the content stays centred at that size.
         */
        resizable: {
            type: Boolean,
            default: false,
        },
        /** Accessible name of the Picture-in-Picture window's button that moves it back into the page. */
        returnLabel: {
            type: String,
            default: 'Return to the page',
        },
        /** The window's title. */
        title: {
            type: String,
            required: true,
        },
        /** Distance of an in-page window from the top edge of the viewport; null centres it. */
        top: {
            type: Number as PropType<number | null>,
            default: null,
        },
        /** Width of the content area in pixels, inside the window's padding. */
        width: {
            type: Number,
            default: 640,
        },
    },
    emits: ['close', 'update:height', 'update:left', 'update:top', 'update:width'],
    setup () {
        const content = shallowRef<HTMLDivElement | null>(null)
        /** The open window, once it has opened. */
        const handle = shallowRef<WindowHandle | null>(null)
        const host = getWindowHost()
        /** Incremented by every change of state, so an open that is overtaken while it waits can tell. */
        const stateNr = ref(0)
        /** The window body the content is teleported into, or null while it is in place. */
        const target = shallowRef<HTMLElement | null>(null)
        return {
            content,
            handle,
            host,
            stateNr,
            target,
        }
    },
    computed: {
        contentClass (): string[] {
            return this.target ? ['epicurrents-window-content'] : ['epicurrents-window-content', 'is-inline']
        },
        contextClasses (): string[] {
            const classes = Array.isArray(this.contextClass) ? this.contextClass : this.contextClass.split(' ')
            return classes.filter(Boolean)
        },
    },
    watch: {
        contextClasses (value: string[], previous: string[]) {
            this.handle?.body.classList.remove(...previous)
            this.handle?.body.classList.add(...value)
        },
        open (value: boolean) {
            if (value) {
                this.show()
            } else {
                this.hide()
            }
        },
        title (value: string) {
            this.handle?.setTitle(value)
        },
    },
    methods: {
        /** Close the window from this side, moving inline content back first. */
        async hide () {
            this.stateNr++
            const handle = this.handle
            if (!handle) {
                return
            }
            this.handle = null
            await this.moveContent(null)
            handle.close()
        },
        /**
         * Move the content into the window body, or back in place with null.
         * @param body - The window body, or null.
         */
        async moveContent (body: HTMLElement | null) {
            if (this.content) {
                this.host.prepareMove(this.content)
            }
            this.target = body
            await nextTick()
            if (this.content) {
                this.host.finishMove(this.content)
            }
        },
        /** The window closed from the other side: the user closed it, or another window replaced it. */
        async release () {
            this.stateNr++
            this.handle = null
            const moved = this.moveContent(null)
            this.$emit('close')
            await moved
        },
        /** Open the window and move the content into it. */
        async show () {
            const stateNr = ++this.stateNr
            const anchor = this.$el as Node
            let handle: WindowHandle
            try {
                handle = await this.host.open({
                    anchor,
                    closeLabel: this.closeLabel,
                    contextClass: this.contextClasses,
                    detachLabel: this.detachLabel,
                    height: this.height,
                    left: this.left,
                    name: this.name || undefined,
                    pictureInPicture: this.pictureInPicture,
                    resizable: this.resizable,
                    returnLabel: this.returnLabel,
                    title: this.title,
                    top: this.top,
                    width: this.width,
                    onClose: this.release,
                    onMoveTo: this.switched,
                    onMove: (left, top) => {
                        this.$emit('update:left', left)
                        this.$emit('update:top', top)
                    },
                    onResize: (width, height) => {
                        this.$emit('update:width', width)
                        this.$emit('update:height', height)
                    },
                })
            } catch (error) {
                if (stateNr === this.stateNr) {
                    this.$emit('close')
                }
                // An abort is a later request, from this window or another, taking the slot; anything else is a fault.
                if ((error as Error | null)?.name !== 'AbortError') {
                    throw error
                }
                return
            }
            if (stateNr !== this.stateNr) {
                handle.close()
                return
            }
            this.handle = handle
            await this.moveContent(handle.body)
        },
        /**
         * The user moved the window between the page and Picture-in-Picture: take the new window and move the content
         * straight into it, so it stays mounted.
         * @param handle - The new window.
         */
        async switched (handle: WindowHandle) {
            this.handle = handle
            await this.moveContent(handle.body)
        },
    },
    mounted () {
        this.host.installStyles(this.$el as Node)
        if (this.open) {
            this.show()
        }
    },
    beforeUnmount () {
        this.stateNr++
        this.handle?.close()
        this.handle = null
    },
})
</script>
