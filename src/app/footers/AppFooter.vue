<template>
    <component data-component="app-footer"
        :class="{
            'border-right': borderRight,
            'border-top': borderTop,
        }"
        :is="SETTINGS.isMainComponent ? 'footer' : 'div'"
    >
        <slot></slot>
    </component>
</template>

<script lang="ts">
import { defineComponent } from "vue"
import { useStore } from 'vuex'
import { useActiveContext } from '#config'
/**
 * A small footer below the viewer for information display.
 * This is an auxiliary component to help with styling the footer.
 */
export default defineComponent({
    name: 'AppFooter',
    props: {
        borderRight: {
            type: Boolean,
            default: false,
        },
        borderTop: {
            type: Boolean,
            default: true,
        },
    },
    setup () {
        const store = useStore()
        return {
            ...useActiveContext(store),
        }
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch('add-component-styles', { component: this.$options.name, styles: this.$options.__scopeId })
    }
})
</script>

<style scoped>
[data-component="app-footer"] {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    font-size: 0.8rem;
}
.border-right {
    border-right: 1px solid var(--epicv-border);
}
.border-top {
    border-top: 1px solid var(--epicv-border);
}
</style>
