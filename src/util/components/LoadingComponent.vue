<template>
    LOADING
</template>

<script lang="ts">
/**
 * A loading component as a placeholder while module component is being loaded.
 */
import { defineComponent } from "vue"
import { T } from "#i18n"

export default defineComponent({
    name: 'LoadingComponent',
    props: {
        height: {
            type: String,
            required: false,
        },
        rows: {
            type: Number,
            required: false,
        },
        spinner: {
            type: Boolean,
            default: false,
        },
        width: {
            type: String,
            required: false,
        },
    },
    setup () {
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
})
</script>
