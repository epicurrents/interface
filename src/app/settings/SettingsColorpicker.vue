<template>
    <div data-component="settings-colorpicker" ref="component">
        <wa-color-picker
            :disabled="isDisabled"
            format="rgb"
            :id="`${field}-color`"
            opacity
            v-property="'color'"
        ></wa-color-picker>
        <span
            :class="{
                'title': true,
                'disabled': isDisabled,
            }"
        >{{ field.text }}</span>
        <wa-tooltip v-if="isDisabled" :for="`${field}-color`">{{ disabledTooltip }}</wa-tooltip>
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
import { defineComponent, ref, PropType, Ref } from "vue"
import { T } from "#i18n"
import { rgbaToSettingsColor, settingsColorToRgba } from "@epicurrents/core/util"
import type { SettingsColor } from "@epicurrents/core/types"
import type { InterfaceSettingsCommon, InterfaceSettingsInput } from "#types/config"

export default defineComponent({
    name: 'SettingsColorpicker',
    components: {
    },
    props: {
        default: {
            type: Array as unknown as PropType<SettingsColor>,
            default: [0, 0, 0, 0],
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
        const initialColor = [...props.default] as SettingsColor
        for (let i=0; i<3-initialColor.length; i++) {
            // Add possible missing color components.
            initialColor.push(0)
        }
        if (initialColor.length < 4) {
            // Add possible missing alpha component.
            initialColor.push(1)
        }
        const color = ref(settingsColorToRgba(initialColor))
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        // Store
        const unsubscribe = ref(null as (() => void) | null)
        return {
            color,
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
        color (value: string) {
            this.$emit('value-changed', rgbaToSettingsColor(value))
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
        // Watch field changes
        // Subscribe to store mutations
        this.unsubscribe = this.$store.subscribe((mutation) => {
            if (mutation.type === 'set-settings-value') {
                if (mutation.payload.field === this.field) {
                    if (Array.isArray(mutation.payload.value) && mutation.payload.value.length === 4) {
                        this.color = settingsColorToRgba(mutation.payload.value as SettingsColor)
                    } else if (typeof mutation.payload.value === 'string') {
                        const value = mutation.payload.value.replace(/\s+/i, '')
                        if (value.startsWith('#')) {
                            if (value.length === 9 || value.length === 5) {
                                this.color = value
                            } else if (value.length === 7) {
                                this.color = value + 'ff'
                            } else if (value.length === 4) {
                                this.color = value + 'f'
                            }
                        } else if (value.startsWith('rgba(')) {
                            this.color = value
                        }
                    }
                    // This is required for the color picker to reflect the new value;
                    // setting a key to update the component is not enough.
                    this.$forceUpdate()
                }
            }
        })
    },
    mounted () {
        requestAnimationFrame(() => {
            if (this.field.width) {
                // Adjust the input part width.
                const label = this.component.querySelector('.title') as HTMLElement
                if (label?.style) {
                    label.style.marginInlineStart = `max(0.5em, calc(${this.field.width} - 43px))`
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
[data-component="settings-colorpicker"] {
    display: flex;
    margin-bottom: 0.5rem;
}
    .title {
        height: 2.5em;
        line-height: 2.75em;
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
