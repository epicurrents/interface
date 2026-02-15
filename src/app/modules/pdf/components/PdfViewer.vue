<template>
    <div data-component="pdf-viewer"
        ref="component"
        @pointerleave="handlePointerLeave($event, 'component')"
    >
        <div class="container">
            <div ref="overlay" class="overlay"></div>
            <canvas></canvas>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType, reactive, Ref, ref, toRaw } from 'vue'
import { T } from '#i18n'
import { useStore } from 'vuex'
import { PointerEventHandler } from '#types/interface'
import { useDocumentContext } from '#app/modules/doc'
import { HotkeyProperties } from '#types/config'

type PointerLeaveElement = 'component'

export default defineComponent({
    name: 'DocViewer',
    props: {
        viewerSize: {
            type: Array as PropType<number[]>,
            required: true,
        },
    },
    components: {
    },
    setup () {
        const store = useStore()
        const context = useDocumentContext(store)
        // PDFjs uses private properties which do not play well with Proxies, so we need the underlying raw object
        // of the active document.
        context.RESOURCE = toRaw(context.RESOURCE)
        const hotkeyEvents = reactive({
            nextPageRight: false,
            nextPageDown: false,
            prevPageLeft: false,
            prevPageUp: false,
        })
        const hotkeys = {
            nextPageRight: {
                code: 'ArrowRight',
                key: 'ArrowRight',
                control: false,
                shift: false,
            },
            nextPageDown: {
                code: 'ArrowDown',
                key: 'ArrowDown',
                control: false,
                shift: false,
            },
            prevPageLeft: {
                code: 'ArrowLeft',
                key: 'ArrowLeft',
                control: false,
                shift: false,
            },
            prevPageUp: {
                code: 'ArrowUp',
                key: 'ArrowUp',
                control: false,
                shift: false,
            },
        } as Record<string, HotkeyProperties>
        const page = null as any
        const pdfScale = 1
        const rendering = false
        // Template refs
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const overlay = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        // Pointer interaction handlers
        const pointerLeaveHandlers = ref({
            component: [],
            overlay: [],
        }) as Ref<{[element in PointerLeaveElement]: PointerEventHandler[] }>
        // Listen to some store state changes
        const unsubscribe = store.subscribe((mutation) => {
            if (mutation.type === 'set-page-number') {
                context.RESOURCE.currentPage = mutation.payload.value
            }
        })
        return {
            hotkeyEvents,
            hotkeys,
            page,
            pdfScale,
            rendering,
            // Template refs
            component,
            overlay,
            // Handlers
            pointerLeaveHandlers,
            // Unsubscribers
            unsubscribe,
            // Context properties.
            ...context,
        }
    },
    watch: {
        viewerSize () {
            this.resizeElements()
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
        Log (event: any) {
            console.log(event)
        },
        addPointerLeaveHandler (element: PointerLeaveElement, handler: (event?: PointerEvent) => void) {
            this.pointerLeaveHandlers[element].push({
                el: this[element], // I'm really surprised that TS is okay with this...
                handler: handler,
            })
        },
        cancelHotkeyEvents () {
            for (const key in this.hotkeyEvents) {
                this.hotkeyEvents[key as keyof typeof this.hotkeyEvents] = false
            }
        },
        /**
         * Handle keyup events with the viewer visible.
         */
        handleKeydown (event: KeyboardEvent) {
            if (event.key === 'Escape') {
                this.cancelHotkeyEvents()
                this.hideAllOverlayElements()
            } else if ((this.$store.state.INTERFACE.app.hotkeyAltOrOpt && event.altKey) || !event.altKey) {
                for (const key in this.hotkeyEvents) {
                    if (Object.keys(this.hotkeys).includes(key)) {
                        const hotkey = this.hotkeys[key as keyof typeof this.hotkeys]
                        if (!hotkey) {
                            continue
                        }
                        if (hotkey.control && !event.ctrlKey) {
                            continue
                        }
                        if (hotkey.shift && !event.shiftKey) {
                            continue
                        }
                        if (
                            hotkey.key !== event.key &&
                            // We also have to check event.code here, because alt changes the value in event.key.
                            // There is a slight possibility that a single physical key would map to a different actions
                            // via event.key and event.code (on a non-QWERTY keyboard), and maybe there's a better way
                            // to handle this.
                            (!event.altKey || hotkey.code !== event.code)
                        ) {
                            continue
                        }
                        this.hotkeyEvents[key as keyof typeof this.hotkeyEvents] = true
                        if (event.altKey) {
                            event.preventDefault()
                        }
                    }
                }
            }
        },
        /**
         * Handle keyup events with the viewer visible.
         */
        async handleKeyup (event: KeyboardEvent) {
            if (event.key === 'Escape') {
                // These are handled on key down.
            } else {
                // Check if any of the hotkeys are pressed.
                for (const key in this.hotkeyEvents) {
                    if (Object.keys(this.hotkeys).includes(key)) {
                        const hotkey = this.hotkeys[key as keyof typeof this.hotkeys]
                        if (!hotkey) {
                            continue
                        }
                        if (hotkey.key === event.key && hotkey.code === event.code) {
                            // Handle the hotkey action.
                            if (
                                (key === 'nextPageRight' && this.hotkeyEvents.nextPageRight)
                                || (key === 'nextPageDown' && this.hotkeyEvents.nextPageDown)
                            ) {
                                this.RESOURCE.nextPage()
                            } else if (
                                (key === 'prevPageLeft' && this.hotkeyEvents.prevPageLeft)
                                || (key === 'prevPageUp' && this.hotkeyEvents.prevPageUp)
                            ) {
                                this.RESOURCE.prevPage()
                            }
                            this.hotkeyEvents[key as keyof typeof this.hotkeyEvents] = false
                        }
                    }
                }
            }
        },
        /**
         * Handle pointer leave events by executing and removing the appropriate the handlers.
         */
        handlePointerLeave (event: PointerEvent, component: PointerLeaveElement) {
            // Run all appropriate pointerleave handlers
            while (this.pointerLeaveHandlers[component]?.length) {
                // Remove handlers from the list and execute them
                const evHandler = this.pointerLeaveHandlers[component].shift()
                // Check that element still exists
                if (evHandler && evHandler.el) {
                    evHandler.handler(event)
                }
            }
            if (component === 'component') {
                // Additionally hide all overlays if pointer leaves the component
                this.hideAllOverlayElements()
            }
        },
        hideAllOverlayElements () {
        },
        pageChanged () {
            this.RESOURCE.getPage().then((page: any) => {
                this.page = page
                this.renderDocument(true)
            })
        },
        removePointerLeaveHandler (element: PointerLeaveElement, handler: (event?: PointerEvent) => void) {
            for (let i=0; i<this.pointerLeaveHandlers[element].length; i++) {
                if (this.pointerLeaveHandlers[element][i].handler === handler) {
                    this.pointerLeaveHandlers[element].splice(i, 1)
                }
            }
        },
        async renderDocument (force = false) {
            if (this.rendering || !this.page) {
                return
            }
            this.overlay.innerHTML = ''
            const defViewport = this.page.getViewport({ scale: 1 })
            // Prepare canvas using PDF page dimensions
            const canvas = this.component.querySelector('canvas') as HTMLCanvasElement
            const scaleH = this.viewerSize[1]/defViewport.height
            const scaleW = this.viewerSize[0]/defViewport.width
            const useScale = Math.min(scaleH, scaleW)
            if (!force && useScale === this.pdfScale) {
                return
            }
            this.rendering = true
            this.pdfScale = useScale
            const context = canvas.getContext('2d')
            const scaledViewport = this.page.getViewport({ scale: useScale })
            canvas.width = scaledViewport.width
            canvas.height = scaledViewport.height
            // Render PDF page into canvas context
            const renderContext = {
                canvasContext: context,
                viewport: scaledViewport,
            }
            await this.page.render(renderContext)
            if (this.overlay.style.display !== 'block') {
                this.overlay.style.display = 'block'
            }
            this.overlay.style.width = `${canvas.width}px`
            this.overlay.style.height = `${canvas.height}px`
            this.overlay.style.pointerEvents = 'none'
            const textRendered = await this.renderOverlay(
                                    'text',
                                    scaledViewport
                                )
            if (textRendered) {
                this.overlay.style.pointerEvents = ''
            }
            this.rendering = false
        },
        async renderOverlay (_type: string, _viewport: any): Promise<boolean> {
            /* TODO: Implement text rendering in PDF module.
            if (type === 'text') {
                if (!this.page || !viewport) {
                    return false
                }
                const content = await this.page.getTextContent()
                await pdfjs.renderTextLayer({
                    textContentSource: content,
                    container: this.overlay,
                    viewport: viewport,
                    textDivs: []
                }).promise
                return true
            }
            */
            return false
        },
        resizeElements () {
            this.renderDocument()
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
        // Add event listeners to window.
        window.addEventListener('keydown', this.handleKeydown, false)
        window.addEventListener('keyup', this.handleKeyup, false)
        // Listen to property updates
        this.RESOURCE.onPropertyChange('currentPage', this.pageChanged, this.ID)
        this.RESOURCE.onPropertyChange('isActive', () => {
            if (!this.RESOURCE.isActive) {
                // Remove all event listeners before the resource becomes null.
                this.RESOURCE.removeAllEventListeners(this.ID)
            }
        }, this.ID, 'before')
        this.RESOURCE.getPage().then((page: any) => {
            if (page) {
                this.page = page
                this.renderDocument(true)
            }
        })
        this.unsubscribe = this.$store.subscribe((mutation) => {
            if (mutation.type === 'pdf.set-page-number') {
                this.RESOURCE.currentPage = mutation.payload.value
            }
        })
    },
    beforeUnmount () {
        this.RESOURCE?.removeAllEventListeners(this.ID)
        // Remove event listeners from window.
        window.removeEventListener('keydown', this.handleKeydown, false)
        window.removeEventListener('keyup', this.handleKeyup, false)
        // Unsubscribe from store
        this.unsubscribe?.()
    },
})
</script>

<style scoped>
[data-component="pdf-viewer"] {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
}
    .container {
        position: relative;
        max-width: 100%;
        max-height: 100%;
    }
    .container .overlay {
        position: absolute;
        top: 0;
        left: 0;
        display: none;
        color: rgba(0, 0, 0, 0);
    }
        .container .overlay span {
            position: absolute;
            user-select: text;
        }
    .container canvas {
        display: block;
        margin: 0;
    }
</style>
