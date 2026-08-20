<template>
    <div data-component="settings-dropdown">
        <wa-select
            :disabled="isDisabled"
            :id="`${field}-dropdown`"
            :label="field.text"
            v-property="'selected'"
        >
            <wa-option v-for="(opt, idx) of fieldOptions" :key="`${field.text}-option-${idx}`"
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
import { useStore } from "vuex"
import { T } from "#i18n"
import { useAppContext } from "#config"
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
        return {
            selected,
            ...useAppContext(useStore(), 'SettingsDropdown'),
        }
    },
    computed: {
        /**
         * Resolve the schema's `options` property, which may be either a fixed list or a function
         * evaluated at render time (for option sets that depend on runtime state).
         */
        fieldOptions () {
            const options = this.field.options
            return typeof options === 'function' ? options() : options
        },
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
        settingChanged () {
            this.selected = this.getFieldValue(this.field.setting) as typeof this.selected
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
        this.addPropertyChangeHandler(this.field.setting, this.settingChanged)
    },
    mounted () {
        this.$nextTick(() => {
            this.$emit('loaded')
        })
    },
    beforeUnmount () {
        this.removePropertyChangeHandlers()
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
