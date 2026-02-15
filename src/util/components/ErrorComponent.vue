<template>
    ERROR
</template>

<script lang="ts">
/**
 * An error component to tell that module component loading has failed.
 */
import { defineComponent } from "vue"
import { T } from "#i18n"

export default defineComponent({
    name: 'ErrorComponent',
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