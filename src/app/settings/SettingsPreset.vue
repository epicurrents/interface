<template>
    <div data-component="settings-preset" ref="component">
        <wa-button
            appearance="filled-outlined"
            :disabled="isDisabled"
            :id="`${field.text}-preset`"
            variant="brand"
            @click="$emit('select-preset')"
        >{{ $t('Apply') }}</wa-button>
        <wa-tooltip v-if="isDisabled" :for="`${field.text}-preset`">{{ disabledTooltip }}</wa-tooltip>
        <span
            :class="{
                'title': true,
                'disabled': isDisabled,
            }"
        >{{ field.text }}</span>
    </div>
</template>

<script lang="ts">
/**
 * Calibrator for screen PPI.
 */
import { PropType, Ref, defineComponent, ref } from "vue"
import { T } from "#i18n"
import type { InterfaceSettingsCommon, InterfaceSettingsPreset } from "#types/config"

export default defineComponent({
    name: 'SettingsPreset',
    components: {
    },
    props: {
        disabled: {
            type: Boolean,
            default: false,
        },
        disabledTooltip: {
            type: String,
            required: false,
        },
        field: {
            type: Object as PropType<InterfaceSettingsCommon & InterfaceSettingsPreset>,
            required: true,
        }
    },
    setup () {
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            component,
        }
    },
    computed: {
        isDisabled () {
            return this.disabled || this.disabledTooltip !== undefined || undefined
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
    },
    mounted () {
        requestAnimationFrame(() => {
            if (this.field.width) {
                // Adjust the input part width.
                const label = this.component.querySelector('.title') as HTMLElement
                if (label?.style) {
                    label.style.marginInlineStart = `max(0.5em, calc(${this.field.width} - 73px))`
                }
            }
        })
        this.$nextTick(() => {
            this.$emit('loaded')
        })
    },
})
</script>

<style scoped>
[data-component="settings-preset"] {
    display: flex;
    margin-bottom: 0.5rem;
}
    .title {
        height: 2.5em;
        line-height: 2.5em;
        margin-inline-start: 0.75em;
    }
    span.disabled {
        color: var(--epicv-text-disabled);
    }
</style>
