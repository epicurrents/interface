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
import { useNcsContext } from '..'
import { useStore } from 'vuex'

// Child components
const CONTROLS = {
}

export default defineComponent({
    name: 'NcsControls',
    components: {
        ControlsBar,
        ...CONTROLS,
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
        const context = useNcsContext(useStore())
        const ncsControls = reactive([
            ////////////////      SENSITIVITY    //////////////////
            {
                id: 'sensitivity',
                groups: [] as DropdownGroup[],
                joinLeft: true,
                label: T('Sensitivity', 'NcsControls'),
                navButtons: true,
                options: [] as DropdownItem[],
                reloadOn: ['resource:sensitivity'],
                type: 'dropdown',
                version: 0,
                width: '7.5rem',
            },
            //////////////////      TIMEBASE     //////////////////
            {
                id: 'timebase',
                groups: [] as DropdownGroup[],
                joinLeft: true,
                label: T('Timebase', 'NcsControls'),
                navButtons: true,
                options: [] as DropdownItem[],
                reloadOn: ['resource:timebase', 'settings:ncs.epochMode.'],
                type: 'dropdown',
                version: 0,
                width: '6.5rem',
            },
            // Inspect tool toggle.
            {
                id: 'inspect',
                align: 'right',
                iconName: 'search',
                joinRight: true,
                label: T('Inspect NCS segments', 'NcsControls'),
                onclick: ['ncs.set-cursor-tool', 'inspect'],
                reloadOn: ['action:ncs.set-cursor-tool'],
                type: 'on-off',
                value: false,
                version: 0,
            },
            // Sidebar toggle.
            {
                id: 'annotations',
                align: 'right',
                iconName: 'message-middle',
                joinLeft: true,
                joinRight: true,
                label: T('Toggle annotation tools', 'NcsControls'),
                onclick: ['ncs.set-open-sidebar', 'annotations'],
                reloadOn: ['action:ncs.set-open-sidebar'],
                type: 'on-off',
                value: false,
                version: 0,
            },
        ] as ControlElement[])
        // Unsubscribe from store mutations
        const unsubscribe = ref(null as (() => void) | null)
        return {
            controlsLeft,
            controlsRight,
            ncsControls,
            // Unsubscribers
            unsubscribe,
            // Scope properties.
            ...context,
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
        constructControls (id?: string) {
            // Reset controls
            if (id === undefined) {
                this.controlsLeft.splice(0)
                this.controlsRight.splice(0)
            }
            if (!this.RESOURCE || this.RESOURCE.modality !== 'ncs') {
                return
            }
            if (id === undefined || id === this.ncsControls[0].id) {
                // Construct sensitivity dropdown.
                const sensitivity = this.SETTINGS.sensitivity[this.SETTINGS.sensitivityUnit]
                const scale = sensitivity.scale || 1
                const availableSensitivities = sensitivity.availableValues
                this.ncsControls[0].options = []
                for (let i=0; i<availableSensitivities.length; i++) {
                    const sens = availableSensitivities[i]
                    this.ncsControls[0].options.push({
                        id: `sensitivity-${sens}`,
                        enabled: true,
                        label: `${sens < 1000 ? sens : (sens/1000).toFixed(1)}`,
                        onclick: ['ncs.set-sensitivity', sens*scale],
                        suffix: this.$t(sens < 1000 ? `µV/cm` : `mV/cm`),
                        value: sens*scale,
                    })
                }
                const resourceSensitivity = Math.round(this.RESOURCE.sensitivity/scale)
                if (!availableSensitivities.includes(resourceSensitivity)) {
                    // Add a "custom" sensitivity option
                    this.ncsControls[0].options.push({
                        id: `sensitivity-custom`,
                        enabled: false,
                        label: this.$t('*' + resourceSensitivity.toFixed()),
                        onclick: ['', null],
                    })
                }
                if (availableSensitivities.includes(resourceSensitivity)) {
                    this.ncsControls[0].value = `sensitivity-${resourceSensitivity}`
                } else {
                    this.ncsControls[0].value = `sensitivity-custom`
                }
                this.ncsControls[0].version++
            }
            if (id === undefined || id === this.ncsControls[1].id) {
                // Construct timebase.
                this.ncsControls[1].groups = []
                if (Object.hasOwn(this.SETTINGS.timebase, this.SETTINGS.timebaseUnit)) {
                    const tbGroup = {
                        id: `timebase-${this.SETTINGS.timebaseUnit}`,
                        label: '', // The dropdown is too narrow for a label.
                        items: [] as DropdownItem[],
                    } as DropdownGroup
                    const availableTimebases = this.SETTINGS.timebase[this.SETTINGS.timebaseUnit].availableValues
                    for (const tb of availableTimebases) {
                        tbGroup.items.push({
                            id: `timebase-${this.SETTINGS.timebaseUnit}-${tb}`,
                            enabled: true,
                            label: T(tb.toString(), 'LocaleNumbers'),
                            onclick: ['ncs.set-timebase', [this.SETTINGS.timebaseUnit, tb]],
                            suffix: this.$t(this.SETTINGS.timebase[this.SETTINGS.timebaseUnit].unit),
                            value: tb,
                        })
                    }
                    this.ncsControls[1].groups.push(tbGroup)
                }
                this.ncsControls[1].enabled = true
                this.ncsControls[1].value = `timebase-${this.RESOURCE.timebaseUnit}-${this.RESOURCE.timebase}`
                this.ncsControls[1].version++
            }
            if (id === undefined || id === this.ncsControls[2].id) {
                const isActive = this.$interface.store.modules.get('ncs')!.cursorToolActive === 'inspect'
                // Inspect tool toggle.
                this.ncsControls[2].value = isActive
                this.ncsControls[2].onclick = [
                    'ncs.set-cursor-tool',
                    isActive ? null : 'inspect',
                ]
                this.ncsControls[2].version++
            }
            if (id === undefined || id === this.ncsControls[3].id) {
                const isActive = this.$interface.store.modules.get('ncs')!.openSidebar === 'annotations'
                // Inspect tool toggle.
                this.ncsControls[3].value = isActive
                this.ncsControls[3].onclick = [
                    'ncs.set-open-sidebar',
                    isActive ? null : 'annotations',
                ]
                this.ncsControls[3].version++
            }
            if (id === undefined) {
                this.controlsLeft.push(...this.ncsControls.filter(c => (!c.align || c.align === 'left')))
                this.controlsRight.push(...this.ncsControls.filter(c => (c.align === 'right')))
            }
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
            if ((event.detail.payload as { modality: string })?.modality === 'ncs') {
                this.$nextTick(() => {
                    this.RESOURCE = useNcsContext(this.$store, this.$options.name).RESOURCE
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
