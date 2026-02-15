<template>
    <div data-component="default-interface"
        :id="`epicurrents-default-interface-${$store.state.APP.id}`"
        ref="interface"
    >
        <controls-bar v-if="$store.state.APP.uiComponentVisible.controls && !$store.state.INTERFACE.app.isExpanded"
            class="controls"
            ref="controls"
            v-on:toggle-navigation="$emit('toggle-navigation')"
        ></controls-bar>
        <default-footer v-if="$store.state.APP.uiComponentVisible.footer && !$store.state.INTERFACE.app.isExpanded"
            class="footer"
            ref="footer"
        ></default-footer>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, Ref } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"

// Child components
import ControlsBar from '#app/controls/ControlsBar.vue'
import DefaultFooter from '#app/footers/DefaultFooter.vue'

export default defineComponent({
    name: "DefaultInterface",
    components: {
        ControlsBar,
        DefaultFooter,
    },
    props: {
    },
    setup () {
        //const store = useStore()
        const SETTINGS = useStore().state.SETTINGS.app
        // Subscribe to store mutations
        const unsubscribe = null as null | (() => void)
        // DOM
        const controls = ref<typeof ControlsBar>() as Ref<typeof ControlsBar>
        const footer = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            SETTINGS,
            unsubscribe,
            controls,
            footer,
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
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
    },
    beforeUnmount () {
        if (this.unsubscribe) {
            this.unsubscribe()
        }
    },
})
</script>

<style scoped>
[data-component="default-interface"] {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 100%;
    height: 100%;
    background-color: var(--epicv-background);
}
.footer {
    position: relative;
    flex-basis: calc(1.5rem + 1px);
}
.controls {
    position: relative;
    flex-basis: calc(2.25rem + 1px);
    max-height: calc(2.25rem + 1px);
}
</style>
