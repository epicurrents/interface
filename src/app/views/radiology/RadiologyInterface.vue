<template>
    <div data-component="radiology-interface"
        :id="`epicurrents-radiology-interface-${$store.state.APP.id}`"
        ref="wrapper"
    >
        <div id="react-portal"></div>
        <div id="root"></div>
        <!-- Load OHIF scripts the first time the view is activated. -->
        <component v-if="$store.state.APP.view.name === 'radiology'"
            as="script"
            is="script"
            rel="preload"
            :src="`${ohifUrl}app-config.js`"
        ></component>
        <component v-if="$store.state.APP.view.name === 'radiology'"
            as="script"
            is="script"
            rel="preload"
            type="module"
            :src="`${ohifUrl}init-service-worker.js`"
        ></component>
        <component v-if="$store.state.APP.view.name === 'radiology'"
            defer="defer"
            is="script"
            :src="`${ohifUrl}app.bundle.c61e990727612c91bbf8.js`"
        ></component>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, Ref } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"


export default defineComponent({
    name: "RadiologyInterface",
    components: {
    },
    props: {
    },
    setup () {
        const rso = null as ResizeObserver | null
        const viewerHeight = ref(0)
        const viewerWidth = ref(0)
        //const store = useStore()
        const SETTINGS = useStore().state.SETTINGS.app
        const wrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            rso,
            viewerHeight,
            viewerWidth,
            SETTINGS,
            wrapper,
        }
    },
    computed: {
        ohifUrl () {
            return (window as unknown as { PUBLIC_URL: string }).PUBLIC_URL || '/ohif/'
        },
        viewerStyles () {
            return {
                width: `${this.viewerWidth}px`,
                height: `${this.viewerHeight}px`,
            }
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
        //footerUpdate (update: [any, any]) {
            //this.footer?.update(update)
        //},
        resizeViewer () {
            const viewer = this.wrapper.querySelector('#root > div > div:nth-child(2)') as HTMLDivElement
            if (viewer) {
                // Override OHIF viewer's default viewer component height to accommodate the menubar.
                viewer.setAttribute('style', 'height: calc(-77px + 100vh);')
                return true
            }
            return false
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
        console.time('scriptToView')
    },
    mounted () {
        this.rso = new ResizeObserver(this.resizeViewer)
        this.rso.observe(this.wrapper)
        // Resize the viewer when viewer data changes.
        document.querySelector('body')?.addEventListener(
            'event::cornerstoneViewportService:viewportDataChanged',
            this.resizeViewer
        )
        //this.rso.observe(this.wrapper)
        this.$store.dispatch('display-viewer')
    },
    beforeUnmount () {
        // Remove all listeners and observers.
        this.rso?.unobserve(this.wrapper)
        document.querySelector('body')?.removeEventListener(
            'event::cornerstoneViewportService:viewportDataChanged',
            this.resizeViewer
        )
    },
})
</script>

<style scoped>
[data-component="radiology-interface"] {
    width: 100%;
    height: 100%;
}
[data-component="radiology-interface"] > #root {
    width: 100%;
}
</style>
