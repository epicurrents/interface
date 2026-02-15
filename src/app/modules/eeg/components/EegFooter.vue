<template>
    <default-footer>
        <div v-if="RESOURCE.dependenciesMissing.length"
            class="dependencies"
        >
            {{ $t('Loading module dependencies, please wait ({ready}/{total} done)...', { ready, total }) }}
        </div>
    </default-footer>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue"
import { T } from "#i18n"
import { useEegContext } from '..'
import { useStore } from 'vuex'
import DefaultFooter from '#app/footers/DefaultFooter.vue'

export default defineComponent({
    name: 'EegFooter',
    components: {
        DefaultFooter,
    },
    setup () {
        const store = useStore()
        const ready = ref(0)
        const total = ref(0)
        return {
            ready,
            total,
            ...useEegContext(store),
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
        updateDependencies () {
            this.ready = this.RESOURCE.dependenciesReady.length
            this.total = this.RESOURCE.dependenciesMissing.length + this.RESOURCE.dependenciesReady.length
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        //this.$store.dispatch('add-component-styles', { component: this.$options.name, styles: this.$options.__scopeId })
    },
    mounted () {
        this.RESOURCE.onPropertyChange('dependenciesReady', this.updateDependencies, this.$options.name!)
        this.updateDependencies()
    },
    beforeUnmount () {
        this.RESOURCE.removeAllEventListeners(this.$options.name!)
    },
})
</script>

<style scoped>
.dependencies {
    border-left: 1px solid var(--epicv-border);
    padding: 0.5rem;
    font-size: 0.8rem;
    color: var(--epicv-text-secondary);
}
</style>
