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
import { BiosignalMontage } from "@epicurrents/core/types"
import { DropdownGroup, DropdownItem, ControlElement } from "#types/interface"
import ControlsBar from "#app/controls/ControlsBar.vue"
import { useAccContext } from '..'
import { useStore } from 'vuex'

// Child components
const CONTROLS = {
}

export default defineComponent({
    name: 'AccControls',
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
        const context = useAccContext(useStore())
        const accControls = reactive([
            //////////////////      MONTAGE      //////////////////
            {
                id: 'active-montage',
                groups: [] as DropdownGroup[],
                label: T('Montage', 'AccControls'),
                options: [] as DropdownItem[],
                reloadOn: ['resource:activeMontage', 'resource:montages'],
                type: 'dropdown',
                version: 0,
                width: '11rem',
            },
            ////////////////      SENSITIVITY    //////////////////
            {
                id: 'sensitivity',
                groups: [] as DropdownGroup[],
                joinLeft: true,
                label: T('Sensitivity', 'AccControls'),
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
                label: T('Timebase', 'AccControls'),
                navButtons: true,
                options: [] as DropdownItem[],
                reloadOn: ['resource:timebase'],
                type: 'dropdown',
                version: 0,
                width: '7rem',
            },
            //////////////////      FILTERS      //////////////////
            {
                id: 'lowpass-filter',
                groups: [] as DropdownGroup[],
                joinLeft: true,
                label: T('Low', 'AccControls'),
                navButtons: true,
                options: [] as DropdownItem[],
                reloadOn: ['resource:filters'],
                type: 'dropdown',
                version: 0,
                width: '6.5rem',
            },
            {
                id: 'highpass-filter',
                groups: [] as DropdownGroup[],
                joinLeft: true,
                label: T('High', 'AccControls'),
                navButtons: true,
                options: [] as DropdownItem[],
                reloadOn: ['resource:filters'],
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
                label: T('Inspect signal segments', 'AccControls'),
                onclick: ['acc.set-cursor-tool', 'inspect'],
                reloadOn: ['action:acc.set-cursor-tool'],
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
                label: T('Toggle annotation tools', 'AccControls'),
                onclick: ['acc.set-open-sidebar', 'annotations'],
                reloadOn: ['action:acc.set-open-sidebar'],
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
            accControls,
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
            if (!this.RESOURCE || this.RESOURCE.modality !== 'acc') {
                return
            }
            if (id === undefined || id === this.accControls[0].id) {
                // Construct montage dropdown. ACC montages are typically a single
                // setup-scoped group plus the "Raw signals" fall-through; the
                // EEG core-montage split (avg/lon/rec/trv) doesn't apply here.
                this.accControls[0].groups = []
                const availableMontages = this.RESOURCE.montages
                let currentGroup = null as DropdownGroup | null
                for (const montage of availableMontages as BiosignalMontage[]) {
                    const setupName = montage.setup?.name || 'unknown:unknown'
                    const setupLabel = montage.setup?.label || setupName.split(':')[1]
                    if (currentGroup?.id !== setupName) {
                        if (currentGroup) {
                            this.accControls[0].groups!.push(currentGroup)
                        }
                        currentGroup = {
                            id: setupName,
                            label: this.$t(setupLabel, {}, true),
                            items: [] as DropdownItem[],
                        }
                    }
                    currentGroup!.items.push({
                        id: montage.name,
                        enabled: true,
                        label: this.$t(montage.label),
                        onclick: ['acc.set-active-montage', montage.name],
                    })
                }
                if (currentGroup) {
                    this.accControls[0].groups.push(currentGroup)
                }
                // Raw signals fall-through.
                this.accControls[0].options = [{
                    id: 'raw-signals',
                    enabled: true,
                    label: this.$t('Raw signals'),
                    onclick: ['acc.set-active-montage', null],
                    value: null,
                }]
                this.accControls[0].value = this.RESOURCE.activeMontage?.name || 'raw-signals'
                this.accControls[0].version++
            }
            if (id === undefined || id === this.accControls[1].id) {
                // Construct sensitivity dropdown.
                const sensitivity = this.SETTINGS.sensitivity[this.SETTINGS.sensitivityUnit]
                const scale = sensitivity.scale || 1
                const availableSensitivities = sensitivity.availableValues
                this.accControls[1].options = []
                for (let i=0; i<availableSensitivities.length; i++) {
                    const sens = availableSensitivities[i]
                    this.accControls[1].options.push({
                        id: `sensitivity-${sens}`,
                        enabled: true,
                        label: `${sens}`,
                        onclick: ['acc.set-sensitivity', sens*scale],
                        suffix: this.$t('m/s²/cm'),
                        value: sens*scale,
                    })
                }
                const resourceSensitivity = Math.round(this.RESOURCE.sensitivity/scale)
                if (!availableSensitivities.includes(resourceSensitivity)) {
                    // Add a "custom" sensitivity option
                    this.accControls[1].options.push({
                        id: `sensitivity-custom`,
                        enabled: false,
                        label: this.$t('*' + resourceSensitivity.toFixed()),
                        onclick: ['', null],
                    })
                }
                if (availableSensitivities.includes(resourceSensitivity)) {
                    this.accControls[1].value = `sensitivity-${resourceSensitivity}`
                } else {
                    this.accControls[1].value = `sensitivity-custom`
                }
                this.accControls[1].version++
            }
            if (id === undefined || id === this.accControls[2].id) {
                // Construct timebase.
                this.accControls[2].groups = []
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
                            onclick: ['acc.set-timebase', [tbName, tb]],
                            suffix: this.$t(timebase.unit),
                            value: tb,
                        })
                    }
                    this.accControls[2].groups.push(tbGroup)
                }
                // ACC has no epoch-mode override on the timebase — the dropdown is always active.
                this.accControls[2].enabled = true
                this.accControls[2].value = `timebase-${this.RESOURCE.timebaseUnit}-${this.RESOURCE.timebase}`
                this.accControls[2].version++
            }
            if (id === undefined || id === this.accControls[3].id) {
                // Construct lowpass filter dropdown.
                this.accControls[3].options = []
                const availableLow = this.SETTINGS.filters.lowpass.availableValues
                for (const filter of availableLow) {
                    this.accControls[3].options.push({
                        id: `lowpass-${filter}`,
                        enabled: true,
                        label: filter ? T(filter.toString(), 'LocaleNumbers') : '-',
                        onclick: ['acc.set-lowpass-filter', filter],
                        suffix: filter ? this.$t('Hz') : undefined,
                        value: filter,
                    })
                }
                this.accControls[3].value = `lowpass-${this.RESOURCE.filters.lowpass}`
                this.accControls[3].version++
            }
            if (id === undefined || id === this.accControls[4].id) {
                // Construct highpass filter dropdown.
                this.accControls[4].options = []
                const availableHigh = this.SETTINGS.filters.highpass.availableValues
                for (const filter of availableHigh) {
                    this.accControls[4].options.push({
                        id: `highpass-${filter}`,
                        enabled: true,
                        label: filter ? T(filter.toString(), 'LocaleNumbers') : '-',
                        onclick: ['acc.set-highpass-filter', filter],
                        suffix: filter ? this.$t('Hz') : undefined,
                        value: filter,
                    })
                }
                this.accControls[4].value = `highpass-${this.RESOURCE.filters.highpass}`
                this.accControls[4].version++
            }
            if (id === undefined || id === this.accControls[5].id) {
                const isActive = this.$interface.store.modules.get('acc')!.cursorToolActive === 'inspect'
                // Inspect tool toggle.
                this.accControls[5].value = isActive
                this.accControls[5].onclick = [
                    'acc.set-cursor-tool',
                    isActive ? null : 'inspect',
                ]
                this.accControls[5].version++
            }
            if (id === undefined || id === this.accControls[6].id) {
                const isActive = this.$interface.store.modules.get('acc')!.openSidebar === 'annotations'
                // Annotation sidebar toggle.
                this.accControls[6].value = isActive
                this.accControls[6].onclick = [
                    'acc.set-open-sidebar',
                    isActive ? null : 'annotations',
                ]
                this.accControls[6].version++
            }
            if (id === undefined) {
                this.controlsLeft.push(...this.accControls.filter(c => (!c.align || c.align === 'left')))
                this.controlsRight.push(...this.accControls.filter(c => (c.align === 'right')))
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
            if ((event.detail.payload as { modality: string })?.modality === 'acc') {
                this.$nextTick(() => {
                    this.RESOURCE = useAccContext(this.$store, this.$options.name).RESOURCE
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
