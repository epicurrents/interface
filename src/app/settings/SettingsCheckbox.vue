<template>
    <div data-component="settings-checkbox" ref="component">
        <wa-switch
            :disabled="isDisabled"
            :id="`${field}-switch`"
            v-property="'checked'"
        >{{ field.text }}</wa-switch>
        <wa-tooltip v-if="isDisabled" :for="`${field}-switch`">{{ disabledTooltip }}</wa-tooltip>
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
import { PropType, Ref, defineComponent, ref } from "vue"
import { T } from "#i18n"
import type { InterfaceSettingsCommon, InterfaceSettingsInput } from "#types/config"

export default defineComponent({
    name: 'SettingsCheckbox',
    components: {
    },
    props: {
        default: {
            type: Boolean,
            default: false,
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
            type: Object as PropType<InterfaceSettingsCommon & InterfaceSettingsInput>,
            default: '',
        },
    },
    setup (props) {
        const checked = ref(props.default)
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        // Store
        const unsubscribe = ref(null as (() => void) | null)
        return {
            checked,
            component,
            // Store
            unsubscribe,
        }
    },
    computed: {
        isDisabled () {
            return this.disabled || this.disabledTooltip !== undefined || undefined
        },
    },
    watch: {
        checked (value: boolean) {
            const valToMap = this.field.valueMap?.filter(v => v[1] === value)[0]
            this.$emit('value-changed', valToMap !== undefined ? valToMap[0] : value)
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
                // Adjust height.
                if (this.field.height) {
                    this.component.style.height = this.field.height
                    this.component.style.lineHeight = this.field.height
                }
                // Adjust the input part width.
                const label = this.component.querySelector(`wa-switch`)
                                            ?.shadowRoot?.querySelector('.label') as HTMLElement
                if (label?.style) {
                    label.style.marginInlineStart = `max(0.5em, calc(${this.field.width} - 3.25em))`
                }
            }
        })
        // Subscribe to store mutations
        this.unsubscribe = this.$store.subscribe((mutation) => {
            if (mutation.type === 'set-settings-value') {
                if (mutation.payload.field === this.field) {
                    const mappedVal = this.field.valueMap?.filter(v => v[0] === mutation.payload.value)[0]
                    this.checked = mappedVal !== undefined ? mappedVal[1]
                                                           : mutation.payload.value
                }
            }
        })
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
[data-component="settings-checkbox"] {
    align-items: center;
    display: flex;
    height: 2.5em;
    line-height: 2.5em;
    margin-bottom: 0.5rem;
}
    [data-component="settings-checkbox"] wa-switch {
        overflow: visible;
        padding-top: 0;
        --height: 1.75em;
        --thumb-size: 1.25em;
    }
    .title {
        margin-inline-start: 0.75em;
    }
    span.disabled {
        color: var(--epicv-text-disabled);
    }
    wa-icon.reload {
        color: var(--epicv-warning);
        margin: auto 0 auto auto;
    }
</style>
