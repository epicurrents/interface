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
            //////////////////      AUDIO        //////////////////
            {
                id: 'audio-rewind',
                align: 'right',
                iconName: 'backward-fast',
                joinRight: true,
                label: T('Rewind audio', 'AccControls'),
                onclick: ['acc.audio-rewind', null],
                type: 'button',
                version: 0,
            },
            {
                id: 'audio-play',
                align: 'right',
                iconName: 'play',
                joinLeft: true,
                label: T('Play / pause audio', 'AccControls'),
                onclick: ['acc.audio-toggle', null],
                reloadOn: ['resource:isAudioPlaying'],
                type: 'on-off',
                value: false,
                version: 0,
            },
            //////////////////      VIDEO        //////////////////
            {
                id: 'video',
                align: 'right',
                iconName: 'video',
                label: T('Toggle video', 'AccControls'),
                onclick: ['acc.video-toggle', null],
                reloadOn: ['action:acc.video-toggle'],
                type: 'on-off',
                value: false,
                version: 0,
            },
            //////////////      EXAMINE / ANNOTATE      //////////////
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
            // Look a control up by id rather than array position, so the
            // descriptor array can be reordered (or grow) without breaking the
            // per-control build blocks.
            const control = (controlId: string) => this.accControls.find(c => c.id === controlId)!
            const wants = (controlId: string) => id === undefined || id === controlId
            if (wants('active-montage')) {
                // Construct montage dropdown. ACC montages are typically a single
                // setup-scoped group plus the "Raw signals" fall-through; the
                // EEG core-montage split (avg/lon/rec/trv) doesn't apply here.
                const c = control('active-montage')
                c.groups = []
                const availableMontages = this.RESOURCE.montages
                let currentGroup = null as DropdownGroup | null
                for (const montage of availableMontages as BiosignalMontage[]) {
                    const setupName = montage.setup?.name || 'unknown:unknown'
                    const setupLabel = montage.setup?.label || setupName.split(':')[1]
                    if (currentGroup?.id !== setupName) {
                        if (currentGroup) {
                            c.groups!.push(currentGroup)
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
                    c.groups.push(currentGroup)
                }
                // Raw signals fall-through.
                c.options = [{
                    id: 'raw-signals',
                    enabled: true,
                    label: this.$t('Raw signals'),
                    onclick: ['acc.set-active-montage', null],
                    value: null,
                }]
                c.value = this.RESOURCE.activeMontage?.name || 'raw-signals'
                c.version++
            }
            if (wants('sensitivity')) {
                // Construct sensitivity dropdown.
                const c = control('sensitivity')
                const sensitivity = this.SETTINGS.sensitivity[this.SETTINGS.sensitivityUnit]
                const scale = sensitivity.scale || 1
                const availableSensitivities = sensitivity.availableValues
                c.options = []
                for (let i=0; i<availableSensitivities.length; i++) {
                    const sens = availableSensitivities[i]
                    c.options.push({
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
                    c.options.push({
                        id: `sensitivity-custom`,
                        enabled: false,
                        label: this.$t('*' + resourceSensitivity.toFixed()),
                        onclick: ['', null],
                    })
                }
                if (availableSensitivities.includes(resourceSensitivity)) {
                    c.value = `sensitivity-${resourceSensitivity}`
                } else {
                    c.value = `sensitivity-custom`
                }
                c.version++
            }
            if (wants('timebase')) {
                // Construct timebase.
                const c = control('timebase')
                c.groups = []
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
                    c.groups.push(tbGroup)
                }
                // ACC has no epoch-mode override on the timebase — the dropdown is always active.
                c.enabled = true
                c.value = `timebase-${this.RESOURCE.timebaseUnit}-${this.RESOURCE.timebase}`
                c.version++
            }
            if (wants('lowpass-filter')) {
                // Construct lowpass filter dropdown.
                const c = control('lowpass-filter')
                c.options = []
                const availableLow = this.SETTINGS.filters.lowpass.availableValues
                for (const filter of availableLow) {
                    c.options.push({
                        id: `lowpass-${filter}`,
                        enabled: true,
                        label: filter ? T(filter.toString(), 'LocaleNumbers') : '-',
                        onclick: ['acc.set-lowpass-filter', filter],
                        suffix: filter ? this.$t('Hz') : undefined,
                        value: filter,
                    })
                }
                c.value = `lowpass-${this.RESOURCE.filters.lowpass}`
                c.version++
            }
            if (wants('highpass-filter')) {
                // Construct highpass filter dropdown.
                const c = control('highpass-filter')
                c.options = []
                const availableHigh = this.SETTINGS.filters.highpass.availableValues
                for (const filter of availableHigh) {
                    c.options.push({
                        id: `highpass-${filter}`,
                        enabled: true,
                        label: filter ? T(filter.toString(), 'LocaleNumbers') : '-',
                        onclick: ['acc.set-highpass-filter', filter],
                        suffix: filter ? this.$t('Hz') : undefined,
                        value: filter,
                    })
                }
                c.value = `highpass-${this.RESOURCE.filters.highpass}`
                c.version++
            }
            if (wants('audio-play')) {
                // Audio play / pause toggle; the icon reflects the recording's playback state.
                const c = control('audio-play')
                const playing = this.RESOURCE.isAudioPlaying
                c.value = playing
                c.iconName = playing ? 'pause' : 'play'
                c.version++
            }
            if (wants('video')) {
                // Video toggle. Only meaningful when the recording carries
                // attached video, so it is disabled otherwise — the empty panel
                // never opens. The on/off state mirrors the interface module's
                // videoVisible flag (the same pattern as inspect / annotations).
                const c = control('video')
                const hasVideo = (this.RESOURCE.videos?.length ?? 0) > 0
                const visible = hasVideo && this.$interface.store.modules.get('acc')!.videoVisible
                c.enabled = hasVideo
                c.value = visible
                c.onclick = ['acc.video-toggle', !visible]
                c.version++
            }
            if (wants('inspect')) {
                const c = control('inspect')
                const isActive = this.$interface.store.modules.get('acc')!.cursorToolActive === 'inspect'
                // Inspect tool toggle.
                c.value = isActive
                c.onclick = [
                    'acc.set-cursor-tool',
                    isActive ? null : 'inspect',
                ]
                c.version++
            }
            if (wants('annotations')) {
                const c = control('annotations')
                const isActive = this.$interface.store.modules.get('acc')!.openSidebar === 'annotations'
                // Annotation sidebar toggle.
                c.value = isActive
                c.onclick = [
                    'acc.set-open-sidebar',
                    isActive ? null : 'annotations',
                ]
                c.version++
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
