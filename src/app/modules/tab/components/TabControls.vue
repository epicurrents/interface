<template>
    <controls-bar
        :controlsLeft="controlsLeft"
        :controlsRight="controlsRight"
        :sidebarOpen="sidebarOpen"
        v-on:reload="reloadComponent($event)"
        v-on:selected="handleInput"
    >
    </controls-bar>
</template>

<script lang="ts">
/**
 * This component is responsible for displaying all the tools and other control elements
 * of the interface.
 */
import { defineComponent, reactive, ref } from "vue"
import { T } from "#i18n"
//import { useStore } from "vuex"
import { DropdownGroup, DropdownItem, ControlElement } from "#types/interface"
import ControlsBar from "#app/controls/ControlsBar.vue"
import { useTabDataContext } from '..'
import { useStore } from 'vuex'

const AVAILABLE_SCALES = {
    '50': 0.5,
    '60': 0.6,
    '70': 0.7,
    '80': 0.8,
    '90': 0.9,
    '100': 1,
    '110': 1.1,
    '120': 1.2,
    '130': 1.3,
    '140': 1.4,
    '150': 1.5,
    '160': 1.6,
    '170': 1.7,
    '180': 1.8,
    '190': 1.9,
    '200': 2,
}

export default defineComponent({
    name: 'TabControls',
    components: {
        ControlsBar,
    },
    props: {
        sidebarOpen: {
            type: Boolean,
            default: false,
        },
    },
    setup () {
        const controlsLeft = ref([] as ControlElement[])
        const controlsRight = ref([] as ControlElement[])
        const tabControls = reactive([
            //////////////////   SCALE CONTROLS   //////////////////
            {
                id: 'decrease_scale',
                enabled: false,
                iconName: 'minus',
                label: T('Decrease size', 'AppControls'),
                onclick: 'tab.decrease-scale',
                reloadOn: ['resource:scale'],
                type: 'button',
                version: 0,
            },
            {
                id: 'select_scale',
                enabled: false,
                groups: [] as DropdownGroup[],
                joinLeft: true,
                label: T('Scale', 'AppControls'),
                options: [] as DropdownItem[],
                reloadOn: ['resource:scale'],
                type: 'dropdown',
                suffix: '%',
                version: 0,
                width: '5.5rem',
            },
            {
                id: 'increase_scale',
                enabled: false,
                iconName: 'plus',
                joinLeft: true,
                label: T('Increase size', 'AppControls'),
                onclick: 'tab.increase-scale',
                reloadOn: ['resource:scale'],
                type: 'button',
                version: 0,
            },
        ] as ControlElement[])
        // Unsubscribe from store mutations
        const unsubscribe = ref(null as (() => void) | null)
        return {
            controlsLeft,
            controlsRight,
            tabControls,
            // Unsubscribers
            unsubscribe,
            // Scope properties.
            ...useTabDataContext(useStore()),
        }
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
        constructControls () {
            // Reset controls.
            this.controlsLeft.length = 0
            this.controlsRight.length = 0
            if (!this.RESOURCE || this.RESOURCE.modality !== 'tab') {
                return
            }
            const currentScale = Object.values(AVAILABLE_SCALES).findIndex(
                v => v.toFixed(1) === this.RESOURCE.scale.toFixed(1)
            )
            this.tabControls[0].enabled = this.RESOURCE.scale > 0.5 && currentScale > 0
            this.tabControls[0].version++
            this.tabControls[1].options = []
            for (const [key, value] of Object.entries(AVAILABLE_SCALES)) {
                this.tabControls[1].options.push({
                    id: `scale_${key}`,
                    active: this.RESOURCE.scale === value,
                    enabled: true,
                    label: key,
                    onclick: ['tab.set-scale', value],
                })
            }
            if (currentScale > -1) {
                this.tabControls[1].value = `scale_${Object.keys(AVAILABLE_SCALES)[currentScale]}`
            } else {
                this.tabControls[1].value = ''
                this.tabControls[1].placeholder = (this.RESOURCE.scale * 100).toFixed()
            }
            this.tabControls[1].enabled = Object.keys(AVAILABLE_SCALES).length > 0
            this.tabControls[1].version++
            this.tabControls[2].enabled = this.RESOURCE.scale < 2
                                          && currentScale < Object.keys(AVAILABLE_SCALES).length - 1
            this.tabControls[2].version++
            this.controlsLeft.push(...this.tabControls.filter(c => (!c.align || c.align === 'left')))
            this.controlsRight.push(...this.tabControls.filter(c => (c.align === 'right')))
        },
        handleInput (event: any) {
            if (event.onclick && event.onclick.length === 2) {
                this.$store.dispatch(event.onclick[0], event.onclick[1])
            }
        },
        reloadComponent (component: ControlElement) {
            component.version++
            this.constructControls()
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        //this.$store.dispatch(
        //  'add-component-styles',
        //  { component: this.$options.name, styles: this.$options.__scopeId }
        //)
    },
    mounted () {
        // Listen to resource changes
        this.$store.state.addEventListener('set-active-resource', (event) => {
            if ((event.detail.payload as { modality: string })?.modality === 'tab') {
                this.$nextTick(() => {
                    this.RESOURCE = useTabDataContext(this.$store, this.$options.name).RESOURCE
                    this.constructControls()
                })
            }
        }, this.ID)
        this.constructControls()
    },
    beforeUnmount () {
        // Unsubscribe from actions
        if (this.unsubscribe) {
            this.unsubscribe()
        }
        this.$store.state.removeAllEventListeners(this.ID)
    },
})
</script>

<style scoped>
</style>
