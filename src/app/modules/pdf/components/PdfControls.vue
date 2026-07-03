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
import { useDocumentContext } from '../../doc'
import { useStore } from 'vuex'

// Child components
const CONTROLS = {
}

export default defineComponent({
    name: 'PdfControls',
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
        const context = useDocumentContext(useStore())
        const controlsLeft = ref([] as ControlElement[])
        const controlsRight = ref([] as ControlElement[])
        const pdfControls = reactive([
            //////////////////   PAGE CONTROLS   //////////////////
            {
                id: 'prev_page',
                enabled: false,
                iconName: 'chevron-left',
                label: T('Previous page', 'AppControls'),
                onclick: 'pdf.previous-page',
                reloadOn: ['resource:currentPage', 'resource:numPages'],
                type: 'button',
                version: 0,
            },
            {
                id: 'select_page',
                enabled: false,
                groups: [] as DropdownGroup[],
                joinLeft: true,
                label: T('Page', 'AppControls'),
                options: [] as DropdownItem[],
                reloadOn: ['resource:currentPage', 'resource:numPages'],
                suffix: `/ ${context.RESOURCE.numPages || 1}`,
                type: 'dropdown',
                version: 0,
            },
            {
                id: 'next_page',
                enabled: false,
                iconName: 'chevron-right',
                joinLeft: true,
                label: T('Next page', 'AppControls'),
                onclick: 'pdf.next-page',
                reloadOn: ['resource:currentPage', 'resource:numPages'],
                type: 'button',
                version: 0,
            },
        ] as ControlElement[])
        // Unsubscribe from store mutations
        const unsubscribe = ref(null as (() => void) | null)
        return {
            controlsLeft,
            controlsRight,
            pdfControls,
            // Unsubscribers
            unsubscribe,
            // Context properties.
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
        constructControls () {
            // Reset controls.
            this.controlsLeft.splice(0)
            this.controlsRight.splice(0)
            if (!this.RESOURCE || this.RESOURCE.modality !== 'pdf') {
                return
            }
            // Look a control up by id rather than array position, so the
            // descriptor array can be reordered (or grow) without breaking the
            // per-control build blocks.
            const control = (controlId: string) => this.pdfControls.find(c => c.id === controlId)!
            const prevPage = control('prev_page')
            const selectPage = control('select_page')
            const nextPage = control('next_page')
            const isPaginated = this.RESOURCE.numPages > 1
            // Backward button.
            prevPage.enabled = isPaginated && this.RESOURCE.currentPage > 1
            prevPage.version++
            // Page dropdown.
            selectPage.options = []
            for (let i=1;i<= this.RESOURCE.numPages; i++) {
                selectPage.options.push({
                    id: `page_num_${i}`,
                    active: this.RESOURCE.currentPage === i,
                    enabled: true,
                    label: `${i}`,
                    onclick: ['pdf.set-page-number', i],
                    value: i,
                })
            }
            selectPage.enabled = isPaginated
            selectPage.suffix = `/ ${this.RESOURCE.numPages || 1}`
            if (!isPaginated) {
                selectPage.placeholder = '1'
            } else {
                selectPage.value = `page_num_${this.RESOURCE.currentPage}`
            }
            let width = 3
            if (isPaginated) {
                width += 1.25 // Add half a rem for expand icon.
                width += Math.floor(Math.log(this.RESOURCE.numPages))*0.5 // Add room for digits.
            }
            selectPage.width = `${width}rem`
            selectPage.version++
            // Forward button.
            nextPage.enabled = isPaginated && this.RESOURCE.currentPage < this.RESOURCE.numPages
            nextPage.version++
            this.controlsLeft.push(...this.pdfControls.filter(c => (!c.align || c.align === 'left')))
            this.controlsRight.push(...this.pdfControls.filter(c => (c.align === 'right')))
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
        //    'add-component-styles',
        //    { component: this.$options.name, styles: this.$options.__scopeId }
        //)
    },
    mounted () {
        // Listen to resource changes
        this.$store.state.addEventListener('set-active-resource', (event) => {
            if ((event.detail.payload as { modality: string })?.modality === 'pdf') {
                this.$nextTick(() => {
                    this.RESOURCE = useDocumentContext(this.$store, this.$options.name).RESOURCE
                    this.constructControls()
                })
            }
        }, this.ID)
        this.RESOURCE.onPropertyChange(['currentPage', 'numPages'], () => {
            this.constructControls()
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
