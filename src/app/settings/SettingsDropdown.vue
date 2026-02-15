<template>
    <div data-component="settings-dropdown">
        <wa-select
            :disabled="isDisabled"
            :id="`${field}-dropdown`"
            :label="field.text"
            v-property="'selected'"
        >
            <wa-option v-for="(opt, idx) of field.options" :key="`${field.text}-option-${idx}`"
                :value="opt.value"
            >
                <span v-if="opt.prefix" slot="start">{{ $t(opt.prefix) }}</span>
                {{ $t(`${opt.label || opt.value}`) }}
                <span v-if="opt.suffix" slot="end">{{ $t(opt.suffix) }}</span>
            </wa-option>
        </wa-select>
        <wa-tooltip v-if="isDisabled" :for="`${field}-dropdown`">{{ disabledTooltip }}</wa-tooltip>
        <app-icon v-if="field.requiresReload" class="reload inline" :id="`${field}-reload-icon`" name="undo"></app-icon>
        <wa-tooltip v-if="field.requiresReload"
            :for="`${field}-reload-icon`"
        >
            {{ field.reloadTooltip || $t('Application reload required for change to take effect.') }}
        </wa-tooltip>
    </div>
</template>

<script lang="ts">
/**
 * Calibrator for screen PPI.
 */
import { defineComponent, ref, PropType } from "vue"
import { T } from "#i18n"
import type { InterfaceSettingsCommon, InterfaceSettingsDropdown } from "#types/config"

export default defineComponent({
    name: 'SettingsDropdown',
    components: {
    },
    props: {
        default: {
            type: [String, Number],
            default: 0,
        },
        disabled: {
            type: Boolean,
            default: false,
        },
        disabledTooltip: {
            type: String,
            required: false,
        },
        field: {
            type: Object as PropType<InterfaceSettingsCommon & InterfaceSettingsDropdown>,
            required: true,
        },
    },
    setup (props) {
        const selected = ref(props.default)
        // Store
        const unsubscribe = ref(null as (() => void) | null)
        return {
            selected,
            // Store
            unsubscribe,
        }
    },
    computed: {
        isDisabled () {
            return this.disabled || this.disabledTooltip !== undefined || undefined
        },
        width () {
            return this.field.width || '100%'
        },
    },
    watch: {
        selected (value) {
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
            if (mutation.type === 'set-settings-value') {
                if (mutation.payload.field === this.field) {
                    this.selected = mutation.payload.value
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
        if (this.unsubscribe) {
            this.unsubscribe()
        }
    },
})
</script>

<style scoped>
[data-component="settings-dropdown"] {
    margin-bottom: 0.5rem;
    width: 100%;
}
[data-component="settings-dropdown"] wa-select {
    width: v-bind(width);
}
    [data-component="settings-dropdown"] wa-select::part(form-control-label) {
        font-size: 1rem;
        margin-bottom: 0.5rem;
        white-space: nowrap;
        overflow: visible;
    }
    span.disabled {
        color: var(--epicv-text-disabled);
    }
    wa-icon.reload {
        color: var(--epicv-warning);
        margin: auto 0 auto auto;
    }
</style>
