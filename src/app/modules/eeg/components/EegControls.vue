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
import { BiosignalMontage } from "@epicurrents/core/types"
import { DropdownGroup, DropdownItem, ControlElement } from "#types/interface"
import ControlsBar from "#app/controls/ControlsBar.vue"
import { useEegContext } from ".."
import { useStore } from "vuex"

// Child components
const CONTROLS = {
}

export default defineComponent({
    name: 'EegControls',
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
        const store = useStore()
        const context = useEegContext(store, 'EegControls')
        const controlsLeft = ref([] as ControlElement[])
        const controlsRight = ref([] as ControlElement[])
        const eegControls = reactive([
            //////////////////      MONTAGE      //////////////////
            {
                id: 'active-montage',
                groups: [] as DropdownGroup[],
                label: T('Montage', 'EegControls'),
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
                label: T('Sensitivity', 'EegControls'),
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
                label: T('Timebase', 'EegControls'),
                navButtons: true,
                options: [] as DropdownItem[],
                reloadOn: ['resource:timebase', 'settings:eeg.epochMode.'],
                type: 'dropdown',
                version: 0,
                width: '6.5rem',
            },
            //////////////////      FILTERS      //////////////////
            {
                id: 'lowpass-filter',
                groups: [] as DropdownGroup[],
                joinLeft: true,
                label: T('Low', 'EegControls'),
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
                label: T('High'),
                navButtons: true,
                options: [] as DropdownItem[],
                reloadOn: ['resource:filters'],
                type: 'dropdown',
                version: 0,
                width: '6.5rem',
            },
            {
                id: 'notch-filter',
                groups: [] as DropdownGroup[],
                iconName: context.SETTINGS.notchDefaultFrequency ? 'arrow-down-to-arc' : undefined,
                joinLeft: true,
                label: T('Notch', 'EegControls'),
                options: [] as DropdownItem[],
                reloadOn: ['resource:filters'],
                type: context.SETTINGS.notchDefaultFrequency ? 'on-off' : 'dropdown',
                version: 0,
                width: '4.5rem',
            },
            // Inspect tool toggle.
            {
                id: 'inspect',
                align: 'right',
                iconName: 'magnifying-glass-waveform',
                joinRight: true,
                label: T('Inspect EEG segments', 'EegControls'),
                onclick: ['eeg.set-cursor-tool', 'inspect'],
                reloadOn: ['action:eeg.set-cursor-tool'],
                type: 'on-off',
                value: false,
                version: 0,
            },
            // Report window toggle.
            {
                id: 'report',
                align: 'right',
                iconName: 'file-lines',
                joinLeft: true,
                joinRight: true,
                label: T('Open report window', 'EegControls'),
                onclick: ['eeg.set-report-open', true],
                reloadOn: ['action:eeg.set-report-open'],
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
                label: T('Toggle annotation tools', 'EegControls'),
                onclick: ['eeg.set-open-sidebar', 'annotations'],
                reloadOn: ['action:eeg.set-open-sidebar'],
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
            eegControls,
            ...context,
            // Unsubscribers
            unsubscribe,
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
            if (!this.RESOURCE || this.RESOURCE.modality !== 'eeg') {
                return
            }
            if (id === undefined || id === this.eegControls[0].id) {
                // Construct montages.
                this.eegControls[0].groups = []
                const availableMontages = this.RESOURCE.montages
                const montageGroup = {
                    id: '',
                    label: '',
                    items: [] as DropdownItem[],
                } as DropdownGroup
                let currentGroup = null as DropdownGroup | null
                const startNewGroup = (montage: BiosignalMontage, force = false) => {
                    const setupName = montage.setup?.name || 'unknown:unknown'
                    const setupLabel = montage.setup?.label || setupName.split(':')[1]
                    if (currentGroup) {
                        const completeGroup = {...currentGroup}
                        this.eegControls[0].groups!.push(completeGroup)
                    }
                    // Check if we have already loaded some montages into this group.
                    currentGroup = this.eegControls[0].groups!.find(grp => grp.id === setupName) || null
                    if (!currentGroup || force) {
                        currentGroup = {...montageGroup}
                        currentGroup.id = setupName
                        // If this is a forced group change, it would have the same label, so don't display any.
                        currentGroup.label = force ? '' : this.$t(setupLabel, {}, true)
                        currentGroup.items = []
                    }
                }
                let coreAdded = false
                for (const montage of availableMontages as BiosignalMontage[]) {
                    const setupName = montage.setup?.name || 'unknown:unknown'
                    if (currentGroup?.id !== setupName) {
                        startNewGroup(montage)
                    }
                    if (!coreAdded && ![/:avg$/, /:lon$/, /:rec$/, /:trv$/].some(r => montage.name.match(r))) {
                        // We have added all the core montages, add a separator before the rest.
                        startNewGroup(montage, true)
                        coreAdded = true
                    }
                    currentGroup!.items.push({
                        id: montage.name,
                        enabled: true,
                        label: this.$t(montage.label),
                        onclick: ['eeg.set-active-montage', montage.name],
                    })
                }
                if (currentGroup) {
                    this.eegControls[0].groups.push(currentGroup)
                }
                // Keep raw signals always on the bottom of the list as a separate option
                this.eegControls[0].options = []
                this.eegControls[0].options.push({
                    id: 'raw-signals',
                    enabled: true,
                    label: this.$t('Raw signals'),
                    onclick: ['eeg.set-active-montage', null],
                    value: null,
                })
                this.eegControls[0].value = this.RESOURCE.activeMontage?.name || 'raw-signals'
                this.eegControls[0].version++
            }
            if (id === undefined || id === this.eegControls[1].id) {
                // Construct sensitivity dropdown.
                const sensitivity = this.SETTINGS.sensitivity[this.SETTINGS.sensitivityUnit]
                const scale = sensitivity.scale || 1
                const availableSensitivities = sensitivity.availableValues
                this.eegControls[1].options = []
                for (let i=0; i<availableSensitivities.length; i++) {
                    const sens = availableSensitivities[i]
                    this.eegControls[1].options.push({
                        id: `sensitivity-${sens}`,
                        enabled: true,
                        label: `${sens}`,
                        onclick: ['eeg.set-sensitivity', sens*scale],
                        suffix: this.$t(`µV/cm`),
                        value: sens*scale,
                    })
                }
                const resourceSensitivity = Math.round(this.RESOURCE.sensitivity/scale)
                if (!availableSensitivities.includes(resourceSensitivity)) {
                    // Add a "custom" sensitivity option
                    this.eegControls[1].options.push({
                        id: `sensitivity-custom`,
                        enabled: false,
                        label: this.$t('*' + resourceSensitivity.toFixed()),
                        onclick: ['', null],
                    })
                }
                if (availableSensitivities.includes(resourceSensitivity)) {
                    this.eegControls[1].value = `sensitivity-${resourceSensitivity}`
                } else {
                    this.eegControls[1].value = `sensitivity-custom`
                }
                this.eegControls[1].version++
            }
            if (id === undefined || id === this.eegControls[2].id) {
                // Construct timebase.
                this.eegControls[2].groups = []
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
                            onclick: ['eeg.set-timebase', [tbName, tb]],
                            suffix: this.$t(timebase.unit),
                            value: tb,
                        })
                    }
                    this.eegControls[2].groups.push(tbGroup)
                }
                if (this.SETTINGS.epochMode.enabled && this.SETTINGS.epochMode.epochLength) {
                    this.eegControls[2].enabled = false
                    this.eegControls[2].placeholder = `${this.SETTINGS.epochMode.epochLength}`
                    this.eegControls[2].value = ''
                } else {
                    this.eegControls[2].enabled = true
                    this.eegControls[2].value = `timebase-${this.RESOURCE.timebaseUnit}-${this.RESOURCE.timebase}`
                }
                this.eegControls[2].version++
            }
            if (id === undefined || id === this.eegControls[3].id) {
                // Construct filters
                this.eegControls[3].options = []
                // TODO: Ability to modify these?
                const availableLowFilters = this.SETTINGS.filters.highpass.availableValues
                for (const filter of availableLowFilters) {
                    this.eegControls[3].options.push({
                        id: `low-filter-${filter}`,
                        enabled: true,
                        label: filter ? T(filter.toString(), 'LocaleNumbers') : '-',
                        onclick: ['eeg.set-highpass-filter', filter],
                        suffix: filter ? this.$t('Hz') : undefined,
                        value: filter,
                    })
                }
                this.eegControls[3].value = `low-filter-${this.RESOURCE.filters.highpass}`
                this.eegControls[3].version++
            }
            if (id === undefined || id === this.eegControls[4].id) {
                this.eegControls[4].options = []
                const availableHighFilters = this.SETTINGS.filters.lowpass.availableValues
                for (const filter of availableHighFilters) {
                    this.eegControls[4].options.push({
                        id: `high-filter-${filter}`,
                        enabled: true,
                        label: filter ? T(filter.toString(), 'LocaleNumbers') : '-',
                        onclick: ['eeg.set-lowpass-filter', filter],
                        suffix: filter ? this.$t('Hz') : undefined,
                        value: filter,
                    })
                }
                this.eegControls[4].value = `high-filter-${this.RESOURCE.filters.lowpass}`
                this.eegControls[4].version++
            }
            if (id === undefined || id === this.eegControls[5].id) {
                this.eegControls[5].options = []
                if (this.eegControls[5].type === 'dropdown') {
                    const availableNotchFilters = this.SETTINGS.filters.notch.availableValues
                    for (const filter of availableNotchFilters) {
                        this.eegControls[5].options.push({
                            id: `notch-filter-${filter}`,
                            enabled: true,
                            label: filter ? T(filter.toString(), 'LocaleNumbers') : '-',
                            onclick: ['eeg.set-notch-filter', filter],
                            suffix: filter ? this.$t('Hz') : undefined,
                            value: filter,
                        })
                    }
                    this.eegControls[5].value = `notch-filter-${this.RESOURCE.filters.notch}`
                } else {
                    // This is a toggle control.
                    const isActive = this.RESOURCE.filters.notch === this.SETTINGS.notchDefaultFrequency
                    this.eegControls[5].onclick = [
                        'eeg.set-notch-filter',
                        isActive ? 0 : this.SETTINGS.notchDefaultFrequency,
                    ]
                    this.eegControls[5].value = isActive
                }
                this.eegControls[5].version++
            }
            if (id === undefined || id === this.eegControls[6].id) {
                const isActive = this.$interface.store.modules.get('eeg')!.cursorToolActive === 'inspect'
                // Inspect tool toggle.
                this.eegControls[6].value = isActive
                this.eegControls[6].onclick = [
                    'eeg.set-cursor-tool',
                    isActive ? null : 'inspect',
                ]
                this.eegControls[6].version++
            }
            if (id === undefined || id === this.eegControls[7].id) {
                const isActive = this.$interface.store.modules.get('eeg')!.isReportOpen
                // Report window toggle.
                this.eegControls[7].value = isActive
                this.eegControls[7].onclick = [
                    'eeg.set-report-open',
                    !isActive,
                ]
                this.eegControls[7].label = isActive ? this.$t('Close report window') : this.$t('Open report window')
                this.eegControls[7].version++
            }
            if (id === undefined || id === this.eegControls[8].id) {
                const isActive = this.$interface.store.modules.get('eeg')!.openSidebar === 'annotations'
                // Annotations sidebar toggle.
                this.eegControls[8].value = isActive
                this.eegControls[8].onclick = [
                    'eeg.set-open-sidebar',
                    isActive ? null : 'annotations',
                ]
                this.eegControls[8].version++
            }
            // Finally, push controls to their places.
            if (id === undefined) {
                this.controlsLeft.push(...this.eegControls.filter(c => (!c.align || c.align === 'left')))
                this.controlsRight.push(...this.eegControls.filter(c => (c.align === 'right')))
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
        this.unsubscribe = this.$store.subscribe((_mutation) => {})
        this.$store.state.addEventListener('set-active-resource', (event) => {
            if ((event.detail.payload as { modality: string })?.modality === 'eeg') {
                this.$nextTick(() => {
                    this.RESOURCE = useEegContext(this.$store, this.$options.name).RESOURCE
                    this.constructControls()
                })
            }
        }, this.ID)
        // Wait for web components to be ready before constructing the controls.
        requestAnimationFrame(() => {
            this.constructControls()
        })
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
