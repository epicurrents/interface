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
import { useStore } from "vuex"
import { T } from "#i18n"
import { useAppContext } from "#config"
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
        return {
            color,
            component,
            ...useAppContext(useStore(), 'SettingsColorpicker'),
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
        settingChanged () {
            const value = this.getFieldValue(this.field.setting)
            if (Array.isArray(value) && value.length === 4) {
                this.color = settingsColorToRgba(value as SettingsColor)
                return
            }
            if (typeof value !== 'string') {
                return
            }
            const parsed = value.replace(/\s+/i, '')
            if (parsed.startsWith('#')) {
                // Normalise to an alpha-carrying form; the picker only accepts 4- and 8-digit hex.
                if (parsed.length === 9 || parsed.length === 5) {
                    this.color = parsed
                } else if (parsed.length === 7) {
                    this.color = parsed + 'ff'
                } else if (parsed.length === 4) {
                    this.color = parsed + 'f'
                }
            } else if (parsed.startsWith('rgba(')) {
                this.color = parsed
            }
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
        this.removePropertyChangeHandlers()
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
