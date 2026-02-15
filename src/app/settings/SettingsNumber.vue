<template>
    <div data-component="settings-number"
        :class="[
            { 'off': field.zeroMeansOff && value === 0 },
        ]"
        ref="component"
    >
        <wa-input
            :disabled="isDisabled"
            :id="`${field}-number`"
            :max="field.max"
            :min="field.min"
            :step="field.step"
            type="number"
            v-property="'value'"
            @input="valueEntered($event.target.value)"
        ></wa-input>
        <wa-tooltip v-if="isDisabled" :for="`${field}-number`">{{ disabledTooltip }}</wa-tooltip>
        <span
            :class="{
                'title': true,
                'disabled': isDisabled,
            }"
        >{{ field.text }}</span>
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
            type: Number,
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
            type: Object as PropType<InterfaceSettingsCommon & InterfaceSettingsInput>,
            required: true,
        },
    },
    setup (props) {
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const prevValue = props.default
        const value = ref(props.default)
        // Store
        const unsubscribe = ref(null as (() => void) | null)
        // Styles
        /** The width of one number in CSS em units. */
        const NUM_SIZE = 0.6
        const maxNegativeLen = props.field.min && props.field.min < 0
                             ? Math.floor(Math.log10(-props.field.min) + 0.75)*NUM_SIZE // Add extra for the minus sign.
                             : 0 // This should be less than or equal to the positive length in any case.
        const maxPositiveLen = Math.floor(Math.log10(props.field.max || 0))*NUM_SIZE
        // If decimals are allowed, add a half space for the delimiter and a full space for one decimal.
        const decimalLen = (props.field.step || 1)%1 !== 0 ? 1.5*NUM_SIZE : 0
        // Base width of 3 em and an additional min/max value dependent addition.
        const inputWidth = 3.5 + Math.max(maxNegativeLen, maxPositiveLen) + decimalLen + 'em'
        return {
            component,
            prevValue,
            value,
            // Store
            unsubscribe,
            // Styles
            inputWidth,
        }
    },
    computed: {
        isDisabled () {
            return this.disabled || this.disabledTooltip !== undefined || undefined
        },
    },
    watch: {
        value (value: number) {
            if (isNaN(value)) {
                // Process the empty input.
                this.valueEntered('', true)
            }
            this.$emit('value-changed', this.value)
            this.prevValue = value
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
        valueEntered (value: string, processEmpty = false) {
            if (!value.length && !processEmpty) {
                // Allow clearing the input field before entering a new value.
                return
            }
            let numValue = parseFloat(value)
            const isValid = this.field.min && this.field.min < 0
                          // Only allow integers by default (expect decimal step size if decimals are allowed).
                          ? (this.field.step || 1)%1 !== 0 ? value.match(/^-?\d*\.?\d*$/) : value.match(/^-?\d*$/)
                          : (this.field.step || 1)%1 !== 0 ? value.match(/^\d*\.?\d*$/) : value.match(/^\d*$/)
            // Prevent entering invalid values.
            if (!isValid || isNaN(numValue)) {
                if (!value.length
                    && this.field.zeroMeansOff || (
                        this.field.min !== undefined && this.field.min < 0
                        && this.field.max !== undefined && this.field.max > 0
                )) {
                    // Change empty value to zero if that is allowed.
                    numValue = 0
                } else {
                    // Reset to previous value if empty value is not allowed.
                    numValue = this.prevValue
                }
            }
            // Make sure the value is within the min/max range.
            if (this.field.min !== undefined && numValue < this.field.min) {
                this.value = this.field.min
            } else if (this.field.max !== undefined && numValue > this.field.max) {
                this.value = this.field.max
            } else {
                this.value = numValue
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
        requestAnimationFrame(() => {
            if (this.field.width) {
                // Adjust the input part width.
                const label = this.component.querySelector('.title') as HTMLElement
                if (label?.style) {
                    // Add 2px to account for wa-input border.
                    label.style.marginInlineStart = `max(0.5em, calc(${this.field.width} - ${this.inputWidth}))`
                }
            }
        })
        // Subscribe to store mutations
        this.unsubscribe = this.$store.subscribe((mutation) => {
            if (mutation.type === 'set-settings-value') {
                if (mutation.payload.field === this.field) {
                    this.value = mutation.payload.value
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
[data-component="settings-number"] {
    display: flex;
    margin-bottom: 0.5rem;
}
    [data-component="settings-number"] wa-input {
        width: v-bind(inputWidth);
    }
    [data-component="settings-number"].off wa-input::part(base) {
        background-color: var(--epicv-background-disabled);
    }
    .title {
        height: 2.5em;
        line-height: 2.5em;
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
