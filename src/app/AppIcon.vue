<template>
    <wa-icon data-component="app-icon"
        :class="appearance ? `wa-${appearance}` : undefined"
        :label="label"
        library="epicurrents"
        :name="name"
        :style="{
            transform: rotate ? `rotate(${rotate})` : undefined,
            opacity: empty ? '0' : '1',
        }"
        :variant="variant"
    ></wa-icon>
</template>

<script lang="ts">
import { defineComponent } from "vue"

/**
 * Icon component backed by Material Design Icons, served via the WebAwesome icon slot.
 * Accepts both FA kebab-case names (translated automatically) and Material snake_case names.
 * The `variant` prop maps to the Material icon style: "solid" → filled, all others → outlined.
 */
export default defineComponent({
    name: 'AppIcon',
    props: {
        /** Appearance style of the icon (maps to wa-${appearance} CSS class). */
        appearance: {
            type: String,
        },
        /** Display an empty space in place of the icon. */
        empty: {
            type: Boolean,
            default: false,
        },
        /** Accessible label for the icon. */
        label: {
            type: String,
        },
        /** Name of the icon to display. Accepts both FA kebab-case and Material snake_case names. */
        name: {
            type: String,
            required: true,
        },
        /** CSS transform rotation to apply to the icon (e.g., "90deg", "0.25turn"). */
        rotate: {
            type: String,
            default: null,
        },
        /** Icon style variant. "solid" maps to the Material filled set; all others use outlined. */
        variant: {
            type: String,
            default: 'regular',
        },
    },
})
</script>

<style scoped>
[data-component="app-icon"] {
    font-size: 1.2em;
}
</style>
