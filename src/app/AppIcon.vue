<template>
    <wa-icon data-component="app-icon"
        :class="appearance ? `wa-${appearance}` : undefined"
        :name="iconName"
        :family="family"
        :label="label"
        :style="{
            transform: rotate ? `rotate(${rotate})` : undefined,
            opacity: empty ? '0' : '1',
        }"
        :variant="variant"
    ></wa-icon>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue"
import { useStore } from "vuex"
import { registerIconLibrary } from '@awesome.me/webawesome'

import { useActiveContext } from "#config"

/**
 * Dynamic icon loader that returns an icon appropriate for the available libraries.
 */
export default defineComponent({
    name: 'AppIcon',
    props: {
        /** Appearance style of the icon. */
        appearance: {
            type: String,
        },
        /** Display an empty space in place of the icon. */
        empty: {
            type: Boolean,
            default: false,
        },
        /** Icon family to use. */
        family: {
            type: String,
            default: 'classic',
        },
        /** Accessible label for the icon. */
        label: {
            type: String,
        },
        /** Name of the icon to display. */
        name: {
            type: String,
            required: true,
        },
        /** CSS transform rotation to apply to the icon (e.g., "90deg", "0.25turn"). */
        rotate: {
            type: String,
            default: null,
        },
        /** Variant of the icon to use. */
        variant: {
            type: String,
            default: 'regular',
        },
    },
    setup (props) {
        const store = useStore()
        const iconMap = {
            // This is just an example; the WA framework uses FontAwesome icons by default so this feature isn't
            // really used at the moment.
            fa: {
                //alert: new URL(`/vendor/fontawesome/svgs/regular/circle-exclamation.svg`, import.meta.url).toString(),
                //list: new URL(`/vendor/fontawesome/svgs/regular/list.svg`, import.meta.url).toString(),
            },
            default: {
                // Simply return whatever name was given.
                [props.name]: props.name,
            },
        }
        const iconName = ref(props.name)
        const libMap = {
            fa: {
                name: 'fa',
                resolver: (name: string) => {
                    return iconMap.fa[name as keyof typeof iconMap['fa']]
                },
                mutator: (svg: SVGElement) => svg.setAttribute('fill', 'currentColor')
            }
        }
        const lib = ref(store.state.INTERFACE.app.iconLib)
        return {
            iconMap,
            iconName,
            lib,
            libMap,
            ...useActiveContext(useStore()),
        }
    },
    watch: {
        lib () {
            this.useIcon()
        },
        name () {
            this.useIcon()
        },
    },
    methods: {
        useIcon () {
            const lib = this.libMap[this.lib as keyof typeof this.libMap]
            if (lib && lib.resolver(this.name)) {
                registerIconLibrary(this.lib, {
                    resolver: lib.resolver,
                    mutator: lib.mutator,
                })
                this.iconName = this.name
            } else {
                this.lib = 'default'
                // Map to the given icon name.
                this.iconMap['default'][this.name as keyof typeof this.iconMap['default']] = this.name
                this.iconName = this.iconMap.default[this.name as keyof typeof this.iconMap['default']]
                                || 'square-question'
            }
        }
    },
    beforeMount () {
        this.useIcon()
    }
})
</script>

<style scoped>
</style>
