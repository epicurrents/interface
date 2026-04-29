<template>
    <div data-component="sidebar-label">
        <wa-select v-if="label.type === 'array'"
            :id="`${label.name}-dropdown`"
            :placeholder="$t(label.text)"
            v-property="'value'"
        >
            <wa-option v-for="(opt, idx) of (label.options || [])" :key="`${label.name}-option-${idx}`"
                :value="opt.value"
            >
                {{ $t(`${opt.label || opt.value}`) }}
            </wa-option>
        </wa-select>
    </div>
</template>

<script lang="ts">
/**
 * Sidebar label component.
 */
import { defineComponent, ref, PropType } from "vue"
import { T } from "#i18n"
import { CommonBiosignalSettings } from '@epicurrents/core/dist/types'

export default defineComponent({
    name: 'SidebarLabel',
    components: {
    },
    props: {
        label: {
            type: Object as PropType<Required<Required<CommonBiosignalSettings>['labels']>['availableLabels'][number]>,
            required: true,
        },
    },
    setup (props) {
        const value = ref(props.label.defaultValue || (props.label.type === 'array' ? [] : ''))
        // Store
        const unsubscribe = ref(null as (() => void) | null)
        return {
            value,
            // Store
            unsubscribe,
        }
    },
    computed: {
    },
    watch: {
        value (value) {
            this.$emit('value-changed', value)
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
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
        // Subscribe to store mutations
        this.unsubscribe = this.$store.subscribe((mutation) => {
            if (mutation.type === 'set-label-value') {
                if (mutation.payload.name === this.label.name) {
                    this.value = mutation.payload.value
                }
            }
        })
    },
    mounted () {
        this.$nextTick(() => {
            this.$emit('loaded')
        })
    },
    beforeUnmount () {
        this.unsubscribe?.()
    },
})
</script>

<style scoped>
[data-component="sidebar-label"] {
    width: 100%;
}
</style>
