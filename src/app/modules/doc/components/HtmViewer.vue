<template>
    <div data-component="htm-viewer"
        ref="component"
        :style="{ fontSize: `${RESOURCE.scale}rem` }"
        @pointerleave="handlePointerLeave($event, 'component')"
    >
        <div ref="container" class="container" v-html="document"></div>
        <div ref="overlay" class="overlay"></div>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType, Ref, ref } from "vue"
import { T } from "#i18n"
import DOMPurify from "dompurify"
import { useStore } from "vuex"
import { PointerEventHandler } from "#types/interface"
import { useDocumentContext } from '..'

type PointerleaveElement = 'component'

export default defineComponent({
    name: 'HtmViewer',
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
        const context = useDocumentContext(store, 'HtmViewer')
        // Save a pointer the the active document. Otherwise it will be inaccessible before we have a
        // chance to clean up (unmount is triggered by the active resource changing).
        const document = ref('')
        const page = null as any
        // Template refs
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const container = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const overlay = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        // Pointer interaction handlers
        const pointerLeaveHandlers = ref({
            component: [],
            overlay: [],
        }) as Ref<{[element in PointerleaveElement]: PointerEventHandler[] }>
        // Unsubscribe from store mutations
        const unsubscribe = store.subscribe((mutation) => {
            if (mutation.type === 'htm.set-scale') {
                context.RESOURCE.scale = mutation.payload.value
            }
        })
        return {
            document,
            page,
            // Template refs
            component,
            container,
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
        addPointerLeaveHandler (element: PointerleaveElement, handler: (event?: PointerEvent) => void) {
            this.pointerLeaveHandlers[element].push({
                el: this[element], // I'm really surprised that TS is okay with this...
                handler: handler,
            })
        },
        /**
         * Handle pointer leave events by executing and removing the appropriate the handlers.
         */
        handlePointerLeave (event: PointerEvent, component: PointerleaveElement) {
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
        },
        removePointerLeaveHandler (element: PointerleaveElement, handler: (event?: PointerEvent) => void) {
            for (let i=0; i<this.pointerLeaveHandlers[element].length; i++) {
                if (this.pointerLeaveHandlers[element][i].handler === handler) {
                    this.pointerLeaveHandlers[element].splice(i, 1)
                }
            }
        },
        resizeElements () {
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
        // Listen to property updates
        this.RESOURCE.onPropertyChange('currentPage', this.pageChanged, this.ID)
        this.RESOURCE.onPropertyChange('isActive', () => {
            if (!this.RESOURCE.isActive) {
                // Remove all event listeners before the resource becomes null.
                this.RESOURCE.removeAllEventListeners(this.ID)
            }
        }, this.ID, 'before')
        // Load the resource
        this.RESOURCE.content.then((doc: string) => {
            // Add scope ID to all basic DOM elements.
            this.document = DOMPurify.sanitize(doc).replaceAll(/<([a-zA-Z0-9]+)/g, `<$1 ${this.$options.__scopeId}`)
            // Set the first page to load, if this document ws loaded for the first time
            if (!this.RESOURCE.numPages) {
                this.RESOURCE.numPages = 1
            }
        })
    },
    beforeUnmount () {
        this.RESOURCE?.removeAllEventListeners(this.ID)
        // Unsubscribe from store
        this.unsubscribe?.()
    },
})
</script>

<style scoped>
[data-component="htm-viewer"] {
    position: relative;
    width: 100%;
    height: 100%;
    font-size: 1.5rem;
    overflow: auto;
}
    .margin-top {
        height: 0;
        margin-bottom: 1em;
    }
    .margin-bottom {
        height: 0;
        margin-top: 1em;
    }
    [data-component="htm-viewer"] canvas {
        display: block;
        margin: 0;
    }
.container {
    position: absolute;
    inset: 0;
    padding: 0 1rem;
    line-height: 2rem;
}
.overlay {
    position: absolute;
    top: 0;
    left: 0;
    display: none;
    color: rgba(0, 0, 0, 0);
}
    .overlay span {
        position: absolute;
        user-select: text;
    }
/** Revert some app-wide changes. */
[data-component="htm-viewer"], [data-component="htm-viewer"] * {
    list-style: initial;
    list-style-type: initial;
}
[data-component="htm-viewer"] ul, [data-component="htm-viewer"] ol {
    padding-left: 1em;
}
[data-component="htm-viewer"] li {
    margin: 0.3em 0;
}
/** General element styles. */
.container code {
    background-color: var(--epicv-background-highlight);
    border-radius: 0.25rem;
    font-family: var(--epicv-font-monospace);
    font-weight: 700;
    padding: 0.25rem;
}
.container h1 {
    color: #004285;
    font-size: 2em;
    font-weight: 700;
    font-variant: small-caps;
}
.container h2 {
    color: #004285;
    font-size: 1.5em;
    font-weight: 700;
    font-variant: small-caps;
}
.container h3 {
    color: #004285;
    font-size: 1.25em;
    font-weight: 700;
}
.container h4 {
    color: #004285;
    font-size: 1.2em;
    font-weight: 700;
}
.container h5 {
    color: #004285;
    font-size: 1.15em;
    font-weight: 700;
}
.container h6 {
    color: #004285;
    font-size: 1.1em;
    font-weight: 700;
}
.container a {
    color: var(--epicv-link);
    text-decoration: none;
}
.container p {
    margin: 1rem 0;
}
.container blockquote {
    border-left: solid 0.25rem #66aaff;
    margin-left: 0;
    padding-left: 1rem;
}
</style>
