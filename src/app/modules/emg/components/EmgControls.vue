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
import { useEmgContext } from '..'
import { useStore } from 'vuex'

// Child components
const CONTROLS = {
}

export default defineComponent({
    name: 'EmgControls',
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
        const context = useEmgContext(useStore())
        const emgControls = reactive([
            ////////////////      SENSITIVITY    //////////////////
            {
                id: 'sensitivity',
                groups: [] as DropdownGroup[],
                joinLeft: true,
                label: T('Sensitivity', 'EmgControls'),
                navButtons: true,
                options: [] as DropdownItem[],
                reloadOn: ['resource:sensitivity'],
                type: 'dropdown',
                version: 0,
                width: '8rem',
            },
            //////////////////      TIMEBASE     //////////////////
            {
                id: 'timebase',
                groups: [] as DropdownGroup[],
                joinLeft: true,
                label: T('Timebase', 'EmgControls'),
                navButtons: true,
                options: [] as DropdownItem[],
                reloadOn: ['resource:timebase', 'settings:emg.epochMode.'],
                type: 'dropdown',
                version: 0,
                width: '7rem',
            },
            // Inspect tool toggle.
            {
                id: 'inspect',
                align: 'right',
                iconName: 'search',
                joinRight: true,
                label: T('Inspect EMG segments', 'EmgControls'),
                onclick: ['emg.set-cursor-tool', 'inspect'],
                reloadOn: ['action:emg.set-cursor-tool'],
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
                label: T('Toggle annotation tools', 'EmgControls'),
                onclick: ['emg.set-open-sidebar', 'annotations'],
                reloadOn: ['action:emg.set-open-sidebar'],
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
            emgControls,
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
            if (!this.RESOURCE || this.RESOURCE.modality !== 'emg') {
                return
            }
            if (id === undefined || id === this.emgControls[0].id) {
                // Construct sensitivity dropdown.
                const sensitivity = this.SETTINGS.sensitivity[this.SETTINGS.sensitivityUnit]
                const scale = sensitivity.scale || 1
                const availableSensitivities = sensitivity.availableValues
                this.emgControls[0].options = []
                for (let i=0; i<availableSensitivities.length; i++) {
                    const sens = availableSensitivities[i]
                    this.emgControls[0].options.push({
                        id: `sensitivity-${sens}`,
                        enabled: true,
                        label: `${sens < 1000 ? sens : (sens/1000).toFixed(1)}`,
                        onclick: ['emg.set-sensitivity', sens*scale],
                        suffix: this.$t(sens < 1000 ? `µV/cm` : `mV/cm`),
                        value: sens*scale,
                    })
                }
                const resourceSensitivity = Math.round(this.RESOURCE.sensitivity/scale)
                if (!availableSensitivities.includes(resourceSensitivity)) {
                    // Add a "custom" sensitivity option
                    this.emgControls[0].options.push({
                        id: `sensitivity-custom`,
                        enabled: false,
                        label: this.$t('*' + resourceSensitivity.toFixed()),
                        onclick: ['', null],
                    })
                }
                if (availableSensitivities.includes(resourceSensitivity)) {
                    this.emgControls[0].value = `sensitivity-${resourceSensitivity}`
                } else {
                    this.emgControls[0].value = `sensitivity-custom`
                }
                this.emgControls[0].version++
            }
            if (id === undefined || id === this.emgControls[1].id) {
                // Construct timebase.
                this.emgControls[1].groups = []
                const timebaseTypes = Object.entries(this.SETTINGS.timebase)
                timebaseTypes.sort((a, b) => a[0].localeCompare(b[0]))
                for (const [tbName, timebase] of timebaseTypes) {
                    const tbGroup = {
                        id: `timebase-${tbName}`,
                        label: '', // The dropdown is too narrow for a label.
                        items: [] as DropdownItem[],
                    } as DropdownGroup
                    const availableTimebases = timebase.availableValues
                    for (const tb of availableTimebases) {
                        tbGroup.items.push({
                            id: `timebase-${tbName}-${tb}`,
                            enabled: true,
                            label: T(tb.toString(), 'LocaleNumbers'),
                            onclick: ['emg.set-timebase', [tbName, tb]],
                            suffix: this.$t(timebase.unit),
                            value: tb,
                        })
                    }
                    this.emgControls[1].groups.push(tbGroup)
                }
                if (this.SETTINGS.epochMode.enabled && this.SETTINGS.epochMode.epochLength) {
                    this.emgControls[1].enabled = false
                    this.emgControls[1].placeholder = `${this.SETTINGS.epochMode.epochLength}`
                    this.emgControls[1].value = ''
                } else {
                    this.emgControls[1].enabled = true
                    this.emgControls[1].value = `timebase-${this.RESOURCE.timebaseUnit}-${this.RESOURCE.timebase}`
                }
                this.emgControls[1].version++
            }
            if (id === undefined || id === this.emgControls[2].id) {
                const isActive = this.$interface.store.modules.get('emg')!.cursorToolActive === 'inspect'
                // Inspect tool toggle.
                this.emgControls[2].value = isActive
                this.emgControls[2].onclick = [
                    'emg.set-cursor-tool',
                    isActive ? null : 'inspect',
                ]
                this.emgControls[2].version++
            }
            if (id === undefined || id === this.emgControls[3].id) {
                const isActive = this.$interface.store.modules.get('emg')!.openSidebar === 'annotations'
                // Inspect tool toggle.
                this.emgControls[3].value = isActive
                this.emgControls[3].onclick = [
                    'emg.set-open-sidebar',
                    isActive ? null : 'annotations',
                ]
                this.emgControls[3].version++
            }
            if (id === undefined) {
                this.controlsLeft.push(...this.emgControls.filter(c => (!c.align || c.align === 'left')))
                this.controlsRight.push(...this.emgControls.filter(c => (c.align === 'right')))
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
            if ((event.detail.payload as { modality: string })?.modality === 'emg') {
                this.$nextTick(() => {
                    this.RESOURCE = useEmgContext(this.$store, this.$options.name).RESOURCE
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
