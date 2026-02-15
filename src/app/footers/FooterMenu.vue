<template>
    <div data-component="footer-menu"
        :class="[
            { 'open': menuOpen }
        ]"
        @click="toggleMenu"
    >
        {{ selected !== INDEX_NOT_ASSIGNED ? options[selected] : label }}
        <div class="options">
            <div v-for="(opt, idx) in options" :key="`menu-${label}-option-${idx}`"
                @click="selectOption(idx)"
            >
                {{ opt }}
            </div>
            <div @click="selectOption(INDEX_NOT_ASSIGNED)">-</div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, PropType } from "vue"
import AppFooter from "#app/footers/AppFooter.vue"
import { T } from "#i18n"
import { INDEX_NOT_ASSIGNED } from "@epicurrents/core/util"
import { useStore } from "vuex"

export default defineComponent({
    name: 'FooterMenu',
    props: {
        /** Default text shown if no item is selected. */
        label: {
            type: String,
            default: '',
        },
        options: {
            type: Object as PropType<String[]>,
            default: [],
        },
        selected: {
            type: Number,
            default: INDEX_NOT_ASSIGNED,
        },
    },
    components: {
        AppFooter, // This is loaded synchronously
    },
    setup () {
        const store = useStore()
        const menuOpen = ref(false)
        // Subscribe to store actions
        const unsubscribeActions = store.subscribeAction((action) => {
            if (action.type === 'pointer-left-app' || action.type === 'overlay-clicked') {
                // Close the menu when pointer leaves the app area or the overlay is clicked
                menuOpen.value = false
            }
        })
        return {
            menuOpen,
            unsubscribeActions,
            INDEX_NOT_ASSIGNED,
        }
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
        handlePointerLeave (_event: PointerEvent) {
            this.menuOpen = false
        },
        selectOption (value: number) {
            this.$emit('option-selected', value)
        },
        toggleMenu () {
            this.menuOpen = !this.menuOpen
            if (this.menuOpen) {
                this.$store.commit('show-overlay')
            } else {
                this.$store.commit('hide-overlay')
            }
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

    },
    beforeUnmount () {
        this.unsubscribeActions()
    },
})
</script>

<style scoped>
[data-component="footer-menu"] {
    flex: 150px 0 0;
    position: relative;
    height: 24px;
    padding: 0 10px;
    overflow-y: hidden;
    cursor: pointer;
    z-index: 8;
}
    .options {
        position: absolute;
        left: 0;
        bottom: 24px;
        width: 100%;
        padding: 0 10px;
        background-color: var(--epicv-background);
        border-top: solid 1px var(--epicv-border);
        border-left: solid 1px var(--epicv-border);
        border-right: solid 1px var(--epicv-border);
    }
        .options > div {
            height: 24px;
            line-height: 24px;
        }
.open {
    overflow-y: visible;
}
</style>
