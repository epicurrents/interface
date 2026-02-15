<template>
    <div data-component="app-menubar">
        <wa-dropdown v-for="(menu, idx) in visibleMenus"
            :key="`epicv-${$store.state.APP.id}-menubar-menu-${idx}-${menu.iteration}`"
            :open="menu.open"
            :stayOpenOnSelect="menu.stayOpen"
            @wa-select="handleItemSelect"
        >
            <wa-button slot="trigger"
                appearance="epicv"
                class="button"
                size="small"
                variant="brand"
                with-caret
            >
                {{ menu.label }}
            </wa-button>
                <template v-for="(item, idy) in menu.items"
                    :key="`epicv-${$store.state.APP.id}-menubar-menu-${idx}-item-${idy}`"
                >
                    <h2 v-if="item.type === 'header'">{{ item.label }}</h2>
                    <wa-divider v-else-if="item.type === 'divider'"></wa-divider>
                    <wa-dropdown-item v-else
                        :data-keep-open="item.keepOpen ? 'true' : undefined"
                        :disabled="item.enabled === false"
                        :type="item.checkbox ? 'checkbox' : ''"
                        @click="() => item.enabled ? item.onclick() : null"
                        @wa-select="handleItemSelect"
                    >
                        <app-icon v-if="item.icon"
                            :empty="!getItemProperty(item, 'icon')"
                            :name="getItemProperty(item, 'icon')"
                            slot="icon"
                        ></app-icon>
                        {{ getItemProperty(item, 'label') }}
                        <span v-if="item.type === 'menu' && !item.suffix" class="gap">&nbsp;</span>
                        <app-icon v-if="item.suffix"
                            class="suffix"
                            :name="getItemProperty(item, 'suffix')"
                        ></app-icon>
                        <wa-dropdown-item v-for="(subItem, _idz) in item.items"
                            :key="`epicv-${$store.state.APP.id}-menubar-menu-${idx}-submenu-${idy}-item-${_idz}`"
                            :data-keep-open="subItem.keepOpen ? 'true' : undefined"
                            :disabled="subItem.enabled === false"
                            slot="submenu"
                            :type="subItem.checkbox ? 'checkbox' : ''"
                            @click="() => subItem.enabled ? subItem.onclick() : null"
                        >
                            <app-icon v-if="subItem.icon"
                                :empty="!getItemProperty(subItem, 'icon')"
                                :name="getItemProperty(subItem, 'icon')"
                                slot="icon"
                            ></app-icon>
                            {{ getItemProperty(subItem, 'label') }}
                            <app-icon v-if="subItem.suffix"
                                class="suffix"
                                :name="getItemProperty(subItem, 'suffix')"
                            ></app-icon>
                        </wa-dropdown-item>
                    </wa-dropdown-item>
                </template>
        </wa-dropdown>
        <div class="separator"></div>
        <wa-dropdown
            class="options"
            placement="bottom-end"
            hoist
        >
            <wa-button
                appearance="epicv"
                class="button"
                slot="trigger"
                variant="brand"
            >
                <app-icon name="ellipsis" :label="$t('Options')"></app-icon>
            </wa-button>
            <template v-for="(item, _idx) in optionsMenu.items"
                :key="`epicv-${$store.state.APP.id}-menubar-options-${_idx}`"
            >
                <h2 v-if="item.type === 'header'">{{ item.label }}</h2>
                <wa-dropdown-item v-else
                    :type="item.checkbox ? 'checkbox' : ''"
                    @click="item.onclick"
                >
                    <app-icon v-if="item.icon"
                        :name="Array.isArray(item.icon) ? item.icon[item.selected ? 1 : 0] : item.icon"
                        slot="icon"
                    ></app-icon>
                    {{ Array.isArray(item.label) ? item.label[item.selected ? 1 : 0] : item.label }}
                    <app-icon v-if="item.suffix"
                        class="suffix"
                        :name="Array.isArray(item.suffix) ? item.suffix[item.selected ? 1 : 0] : item.suffix"
                    ></app-icon>
                </wa-dropdown-item>
            </template>
        </wa-dropdown>
    </div>
</template>

<script lang="ts">
/**
 * Menubar for displaying tradition dropdown menus.
 */
import { defineComponent, reactive } from "vue"
import { useStore } from "vuex"
import { T } from "#i18n"
// Import this synchronously
import { MenuItem, MenubarItem } from "#types/interface"
import { EpiCStore } from "#store"
import { applicationViews } from '#config'

type FileContext = {
    modalities: string[],
    header: string,
    headerDone: boolean,
    groups: { fileExtensions: string[], items: any[], label: string, type: string }[],
}

export default defineComponent({
    name: 'AppMenubar',
    setup (_props, { emit }) {
        const store = useStore() as EpiCStore
        const APP = store.state.APP
        //////////////////      FILE      //////////////////
        const fileMenu = {
            id: 'file',
            enabled: true,
            items: [] as any[],
            iteration: 0,
            label: T('File', 'AppMenubar'),
            open: false,
        }
        const importerNames = Array.from(APP.studyImporters.keys())
        const fileContexts = []
        if (importerNames.some(k => k.includes('doc/'))) {
            const docCtx = {
                modalities: ['htm', 'pdf'],
                header: 'Document',
                headerDone: false,
                groups: [],
            } as FileContext
            if (importerNames.some(k => k.includes('doc/htm-') || k.includes('/pdf-'))) {
                docCtx.groups.push({
                    fileExtensions: ['.md', '.markdown'],
                    items: [] as any[],
                    label: T('Open markdown document', 'AppMenubar'),
                    type: 'menu',
                })
            }
            if (importerNames.some(k => k.includes('doc/pdf-'))) {
                docCtx.groups.push({
                    fileExtensions: ['.pdf'],
                    items: [] as any[],
                    label: T('Open PDF document', 'AppMenubar'),
                    type: 'menu',
                })
            }
            fileContexts.push(docCtx)
        }
        if (importerNames.some(k => k.includes('eeg/'))) {
            const eegCtx = {
                modalities: ['eeg'],
                header: 'EEG',
                headerDone: false,
                groups: [],
            } as FileContext
            if (importerNames.some(k => k.includes('eeg/edf-'))) {
                eegCtx.groups.push({
                    fileExtensions: ['.edf'],
                    items: [] as any[],
                    label: T('Open EEG from EDF', 'AppMenubar'),
                    type: 'menu',
                })
            }
            if (importerNames.some(k => k.includes('eeg/dcm-'))) {
                eegCtx.groups.push({
                    fileExtensions: ['.dcm'],
                    items: [] as any[],
                    label: T('Open EEG from DICOM', 'AppMenubar'),
                    type: 'menu',
                })
            }
            fileContexts.push(eegCtx)
        }
        if (importerNames.some(k => k.includes('emg/'))) {
            const emgCtx = {
                modalities: ['emg'],
                header: 'EMG',
                headerDone: false,
                groups: [],
            } as FileContext
            if (importerNames.some(k => k.includes('emg/wav-'))) {
                emgCtx.groups.push({
                    fileExtensions: ['.wav'],
                    items: [] as any[],
                    label: T('Open EMG from WAV', 'AppMenubar'),
                    type: 'menu',
                })
            }
            fileContexts.push(emgCtx)
        }
        if (importerNames.some(k => k.includes('ncs/'))) {
            const ncsCtx = {
                modalities: ['ncs'],
                header: 'NCS',
                headerDone: false,
                groups: [],
            } as FileContext
            fileContexts.push(ncsCtx)
        }
        // Go through available study contexts.
        for (const fileCtx of fileContexts) {
            // Add file importers to the file menu.
            for (const [key, context] of APP.studyImporters) {
                // Extract all accepted file extensions by this loader.
                const loaderExtensions = [] as string[]
                for (const fTypes of (context.loader.studyImporter?.fileTypes || [])) {
                    for (const aExts of Object.values(fTypes.accept)) {
                        for (const ext of aExts) {
                            if (!loaderExtensions.includes(ext)) {
                                loaderExtensions.push(ext)
                            }
                        }
                    }
                }
                if (context.modalities.some(m => fileCtx.modalities.includes(m))) {
                    if (!fileCtx.headerDone) {
                        fileMenu.items.push({
                            label: T(fileCtx.header, 'AppMenubar'),
                            type: 'header',
                        })
                        fileCtx.headerDone = true
                    }
                    const ctxGroups = fileCtx.groups.filter(g => g.fileExtensions.some(e => loaderExtensions.includes(e)))
                    for (const ctxG of ctxGroups) {
                        // Add loader to each matching loader group.
                        ctxG.items.push({
                            id: key,
                            enabled: true,
                            closeParent: true,
                            label: T(context.label, 'AppMenubar'),
                            onclick: () => emit(
                                `import-${context.mode}`,
                                {
                                    protocol: key,
                                    types: context.loader.studyImporter?.fileTypes || [],
                                    excludeAll: context.loader.studyImporter?.onlyAcceptedTypes,
                                }
                            ),
                        })
                    }
                    /*
                    {
                        label: T('Datasets', 'AppMenubar'),
                        type: 'header'
                    },
                    {
                        id: 'open-dataset',
                        enabled: true,
                        closeParent: true,
                        label: T('Open folder as a dataset', 'AppMenubar'),
                        onclick: () => emit('open-dataset'),
                    },
                    */
                }
            }
            // Add possible file exporters to context groups.
            for (const [key, context] of APP.studyExporters) {
                // Extract all accepted file extensions by this exporter.
                const exporterExtensions = [] as string[]
                for (const fTypes of (context.loader.studyImporter?.fileTypes || [])) {
                    for (const aExts of Object.values(fTypes.accept)) {
                        for (const ext of aExts) {
                            if (!exporterExtensions.includes(ext)) {
                                exporterExtensions.push(ext)
                            }
                        }
                    }
                }
                if (context.modalities.some(m => fileCtx.modalities.includes(m))) {
                    const ctxGroups = fileCtx.groups.filter(g => g.fileExtensions.some(e => exporterExtensions.includes(e)))
                    for (const ctxG of ctxGroups) {
                        // Add exporter to each matching loader group.
                        ctxG.items.push({
                            id: key,
                            enabled: true,
                            closeParent: true,
                            label: T(context.label, 'AppMenubar'),
                            onclick: () => emit(
                                `export-${context.mode}`,
                                {
                                    protocol: key,
                                    types: context.loader.studyImporter?.fileTypes || [],
                                    excludeAll: context.loader.studyImporter?.onlyAcceptedTypes,
                                }
                            ),
                        })
                    }
                }
            }
            fileMenu.items.push(...fileCtx.groups)
        }
        // Connector.
        fileMenu.items.push({
            type: 'divider',
        })
        fileMenu.items.push({
            label: T('Connectors', 'AppMenubar'),
            type: 'header',
        })
        fileMenu.items.push({
            id: 'add-connector',
            enabled: true,
            closeParent: true,
            label: T('Add a connector', 'AppMenubar'),
            onclick: () => emit(`add-connector`),
        })
        const menubarItems = [
            fileMenu,
            ////////////////      EDIT      /////////////////
            {
                id: 'edit',
                enabled: true,
                items: [
                    {
                        icon: 'undo',
                        id: 'undo',
                        enabled: APP.hasUndoableAction,
                        label: T('Undo', 'AppMenubar'),
                        onclick: () => emit('undo-action'),
                        reloadOn: [
                            'set-undoable-action',
                            (item: MenuItem) => {
                                item.enabled = APP.hasUndoableAction
                            }
                        ],
                    },
                    {
                        icon: 'redo',
                        id: 'redo',
                        enabled: APP.hasRedoableAction,
                        label: T('Redo', 'AppMenubar'),
                        onclick: () => emit('redo-action'),
                        reloadOn: [
                            'set-redoable-action',
                            (item: MenuItem) => {
                                item.enabled = APP.hasRedoableAction
                            }
                        ],
                    },
                ] as MenuItem[],
                iteration: 0,
                label: T('Edit', 'AppMenubar'),
                open: false,
                stayOpen: true,
            },
            ////////////////      DISPLAY      /////////////////
            {
                id: 'display',
                enabled: true,
                items: [
                    {
                        type: 'header',
                        label: T('View', 'AppMenubar'),
                    },
                    ...applicationViews.entries()
                                        // Only display views that are available for use.
                                       .filter(([key, _context]) => APP.view.name === key)
                                       .map(([key, context]) => {
                        return {
                            icon: ['', 'check'],
                            id: key,
                            enabled: false,
                            label: T(context.label, 'AppMenubar'),
                            selected: APP.view.name === key,
                            reloadOn: [
                                ['set-active-resource', 'set-view'],
                                (item: MenuItem) => {
                                    const viewName = applicationViews.entries()
                                                                     .find(([k, _]) => k === APP.view.name)?.[1].label
                                    item.label = T(viewName || 'Default', 'AppMenubar')
                                }
                            ],
                        } as Partial<MenuItem>
                    }),
                    {
                        type: 'header',
                        label: T('Components', 'AppMenubar'),
                    },
                    {
                        icon: ['', 'check'],
                        id: 'controls',
                        enabled: APP.view.components.controls !== false,
                        keepOpen: true,
                        label: T('Controls', 'AppMenubar'),
                        onclick: () => emit('toggle-component', 'controls'),
                        selected: APP.uiComponentVisible.controls
                                  && APP.view.components.controls,
                        reloadOn: [
                            ['set-view', 'set-ui-component-visible'],
                            (item: MenuItem) => {
                                item.enabled = APP.view.components.controls !== false
                                item.selected = APP.uiComponentVisible.controls
                                                && APP.view.components.controls !== false
                            }
                        ],
                    },
                    {
                        icon: ['', 'check'],
                        id: 'navigator',
                        enabled: APP.view.components.navigator !== false,
                        keepOpen: true,
                        label: T('Navigator', 'AppMenubar'),
                        onclick: () => emit('toggle-component', 'navigator'),
                        selected: APP.uiComponentVisible.navigator
                                  && APP.view.components.navigator !== false,
                        reloadOn: [
                            ['set-view', 'set-ui-component-visible'],
                            (item: MenuItem) => {
                                item.enabled = APP.view.components.navigator !== false
                                item.selected = APP.uiComponentVisible.navigator
                                                && APP.view.components.navigator !== false
                            }
                        ],
                    },
                    {
                        icon: ['', 'check'],
                        id: 'footer',
                        enabled: APP.view.components.footer!== false,
                        keepOpen: true,
                        label: T('Footer', 'AppMenubar'),
                        onclick: () => emit('toggle-component', 'footer'),
                        selected: APP.uiComponentVisible.footer
                                  && APP.view.components.footer!== false,
                        reloadOn: [
                            ['set-view', 'set-ui-component-visible'],
                            (item: MenuItem) => {
                                item.enabled = APP.view.components.footer!== false
                                item.selected = APP.uiComponentVisible.footer
                                                && APP.view.components.footer!== false
                            }
                        ],
                    },
                ] as Partial<MenuItem>[],
                iteration: 0,
                label: T('Display', 'AppMenubar'),
                open: false,
                stayOpen: true,
            },
            ////////////////      SETTINGS      ////////////////
            {
                id: 'settings',
                enabled: true,
                items: [
                    {
                        enabled: true,
                        icon: 'gear',
                        id: 'user-preferences',
                        label: 'User preferences',
                        onclick: () => emit('toggle-dialog', 'settings'),
                    },
                ] as MenuItem[],
                iteration: 0,
                label: T('Settings', 'AppMenubar'),
                open: false,
            },
            ////////////////      HELP      /////////////////
            {
                id: 'help',
                enabled: true,
                items: [
                    {
                        enabled: true,
                        icon: 'info-circle',
                        id: 'instructions',
                        label: 'Instructions',
                        onclick: () => emit('toggle-dialog', 'instructions'),
                    },
                    {
                        enabled: true,
                        icon: 'book',
                        id: 'manual',
                        label: 'Online manual',
                        onclick: () => emit('external-url', 'https://epicurrents.readthedocs.io/en/latest/'),
                        suffix: 'arrow-up-right-from-square',
                    },
                ] as MenuItem[],
                iteration: 0,
                label: T('Help', 'AppMenubar'),
                open: false,
            },
        ] as MenubarItem[]
            ////////////////      DOT MENU      /////////////////
        const options = reactive({
            anchor: 'right',
            enabled: true,
            icon: 'ellipsis-horizontal',
            id: 'options',
            items: [
                {
                    icon: ['expand', 'compress'],
                    id: 'expand',
                    label: [T('Expand viewer', 'AppMenubar'), T('Collapse viewer', 'AppMenubar')],
                    onclick: () => emit('toggle-expand'),
                    selected: false,
                },
                {
                    icon: ['arrows-maximize', 'arrows-minimize'],
                    id: 'fullscreen',
                    label: [T('Enter fullscreen', 'AppMenubar'), T('Exit fullscreen', 'AppMenubar')],
                    onclick: () => emit('toggle-fullscreen'),
                    selected: false,
                },
            ] as MenuItem[],
            iteration: 0,
            label: '',
            open: false,
            visible: true,
        } as MenubarItem)
        const visibleMenus = reactive([] as MenubarItem[])
        let unsubscribeActions = null as null | (() => void)
        let unsubscribeMutations = null as null | (() => void)
        return {
            menubarItems,
            // Menubar options have a dedicated property
            options,
            visibleMenus,
            // Trigger an update in menubar
            // Ubsubscribe from store action
            unsubscribeActions,
            unsubscribeMutations,
        }
    },
    watch: {
        componentVisible: {
            deep: true,
            handler (value) {
                // Update display menu item properties if visible elements change
                for (const menu of this.menubarItems) {
                    if (menu.id === 'display') {
                        for (const item of menu.items as MenuItem[]) {
                            // This requires a tiny timeout to work, $nextTick won't do!
                            window.setTimeout((() =>
                                item.selected = value[item.id]
                            ), 1)
                        }
                    }
                }
            }
        },
    },
    computed: {
        optionsMenu (): MenubarItem {
            // Don't overwrite original properties
            const menu = {...this.options}
            // Update possible label (in case locale has changed)
            if (menu.label) {
                menu.label = this.$t(menu.label)
            }
            if (this.options.items) {
                menu.items = []
                for (const rawItem of this.options.items as MenuItem[]) {
                    const item = {...rawItem}
                    if (item.id === 'expand') {
                        //console.log('expand', this.$store.state.INTERFACE.app.isExpanded)
                        item.selected = this.$store.state.INTERFACE.app.isExpanded
                    } else if (item.id === 'fullscreen') {
                        item.selected = this.$store.state.APP.isFullscreen
                    }
                    if (item.label) {
                        item.label = Array.isArray(item.label)
                                     ? this.$t(item.label[item.selected ? 1 : 0])
                                     : this.$t(item.label)
                    }
                    menu.items.push(item)
                }
            }
            return menu
        },
    },
    methods: {
        /**
         * Override the default I18n translate method.
         * Returns a component-specific translation (default) or a
         * general translation (fallback) for the given key string.
         */
        $t (key: string, params = {}) {
            return T(key, this.$options.name, params)
        },
        getItemProperty (item: MenuItem, property: 'icon' | 'label' | 'suffix') {
            const prop = item[property]
            return Array.isArray(prop)
                   ? prop[item.selected ? 1 : 0]
                   : prop
        },
        handleItemSelect (event: CustomEvent) {
            const selectedItem = event.detail.item as HTMLElement
            // Check if the selected item has a 'keepOpen' property.
            if (selectedItem.dataset.keepOpen) {
                event.preventDefault()
                // Don't propagate to possible parent dropdowns.
                event.stopPropagation()
            }
        },
        updateVisibleMenus () {
            for (const rawMenu of this.menubarItems.filter(menu => {
                    return menu.visible === undefined || menu.visible
                })
            ) {
                // Don't overwrite original properties
                const menu = {...rawMenu}
                // Update labels (in case locale has changed)
                if (menu.label) {
                    menu.label = this.$t(menu.label)
                }
                if (rawMenu.items) {
                    menu.items = []
                    for (const rawItem of rawMenu.items as MenuItem[]) {
                        const item = {...rawItem}
                        if (item.label) {
                            item.label = Array.isArray(item.label)
                                         ? this.$t(item.label[item.selected ? 1 : 0])
                                         : this.$t(item.label)
                        }
                        menu.items.push(item)
                    }
                }
                this.visibleMenus.push(menu)
            }
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
        this.updateVisibleMenus()
    },
    mounted () {
        // Subscribe to store actions
        this.unsubscribeActions = this.$store.subscribeAction((action) => {
            if (action.type === 'pointer-left-app' || action.type === 'overlay-clicked') {
                // Close all open menus when pointer leaves the app area or the overlay is clicked
                for (const menu of this.menubarItems) {
                    if (menu.open) {
                        menu.open = false
                    }
                }
                this.options.open = false
            }
        })
        // Subscribe to store mutations
        this.unsubscribeMutations = this.$store.subscribe((mutation) => {
            if (mutation.type === 'set-fullscreen' || mutation.type === 'toggle-expand-viewer') {
            } else {
                for (const menu of this.visibleMenus) {
                    for (const item of menu.items) {
                        if (item.reloadOn && item.reloadOn[0].includes(mutation.type)) {
                            item.reloadOn[1](item)
                        }
                    }
                }
            }
        })
    },
    beforeUnmount () {
        if (this.unsubscribeActions) {
            this.unsubscribeActions()
        }
        if (this.unsubscribeMutations) {
            this.unsubscribeMutations()
        }
    },
})
</script>

<style scoped>
[data-component="app-menubar"] {
    display: flex;
    height: 100%;
    font-size: 0.75rem !important;
    border-bottom: solid 1px var(--epicv-border) !important;
}
    .button, .button::part(base), .button::part(label), .button::part(prefix), .button::part(suffix), .button::part(caret) {
        height: 1.5rem;
        min-height: 1.5rem;
        line-height: 1.5rem;
        font-size: 0.75rem;
    }
    .button::part(base) {
        border: none;
        border-radius: 0;
        border-width: 0;
        box-shadow: none;
        outline: none;
        padding: 0 0.5rem;
        position: relative;
        /* Avoid covering the menubar border */
        top: -1px;
    }
    .button::part(base):focus-visible {
        /* Focused menu button highlight. */
        box-shadow: var(--epicv-button-focused);
    }
    .button::part(label) {
        padding: 0;
    }
    .button::part(caret) {
        margin-inline-start: 0.5em;
    }
    [data-component="app-menubar"] h2 {
            height: 1.25rem;
            line-height: 1rem;
            font-size: 0.8rem;
            margin: 0;
        }
        [data-component="app-menubar"] wa-dropdown-item {
            height: 1.75rem;
            line-height: 1.75rem;
            font-size: 0.8rem;
            padding: 0 0.7rem;
        }
        [data-component="app-menubar"] wa-dropdown-item::part(checked-icon) {
            width: 1.25rem;
        }
        [data-component="app-menubar"] wa-icon.end {
            margin-inline-start: 1.5em;
        }
        .gap {
            /* A hacky way to put a gap between the label and submenu chevron ONLY if there is a submenu. */
            display: inline-block;
            width: 0.5rem;
        }
    .separator {
        flex-grow: 1;
    }
    .options {
        position: relative;
    }
    .options::part(panel) {
        width: 100%;
    }
    .options::part(base) {
        width: 100%;
    }
    .options::part(checked-icon) {
        width: 1em;
    }
        .options .menu {
            right: 0;
        }
        .options .button::part(label) {
            padding: 0;
        }
</style>
