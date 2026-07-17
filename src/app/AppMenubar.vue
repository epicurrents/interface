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
                size="s"
                variant="brand"
                with-caret
            >
                {{ menu.label }}
            </wa-button>
                <template v-for="(item, idy) in menu.items"
                    :key="`epicv-${$store.state.APP.id}-menubar-menu-${idx}-item-${idy}`"
                >
                    <h2 v-if="item.type === 'header' && item.visible !== false" class="menu-subtitle">{{ item.label }}</h2>
                    <wa-divider v-else-if="item.type === 'divider' && item.visible !== false"></wa-divider>
                    <wa-dropdown-item v-else-if="item.type !== 'header' && item.type !== 'divider' && item.visible !== false"
                        :class="{ 'menu-leaf': item.type !== 'menu' }"
                        :data-keep-open="item.keepOpen ? 'true' : undefined"
                        :disabled="item.enabled === false"
                        :type="item.checkbox ? 'checkbox' : ''"
                        @click="() => item.enabled ? item.onclick?.() : null"
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
                        <template v-for="(subItem, _idz) in item.items"
                            :key="`epicv-${$store.state.APP.id}-menubar-menu-${idx}-submenu-${idy}-item-${_idz}`"
                        >
                            <h2 v-if="subItem.type === 'header' && subItem.visible !== false"
                                slot="submenu"
                            >
                                {{ subItem.label }}
                            </h2>
                            <wa-divider v-else-if="subItem.type === 'divider' && subItem.visible !== false"
                                slot="submenu"
                            ></wa-divider>
                            <wa-dropdown-item v-else-if="subItem.type !== 'header' && subItem.type !== 'divider' && subItem.visible !== false"
                                :data-keep-open="subItem.keepOpen ? 'true' : undefined"
                                :disabled="subItem.enabled === false"
                                slot="submenu"
                                :type="subItem.checkbox ? 'checkbox' : ''"
                                @click="() => subItem.enabled ? subItem.onclick?.() : null"
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
                        </template>
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

// The subset of a study importer / exporter context the file menu reads. Kept structural so both
// the importer and exporter maps (which differ only in their `mode` union) satisfy it.
type MenuEntryContext = {
    modalities: string[],
    label: string,
    mode: string,
    loader: { studyImporter?: { fileTypes?: unknown, onlyAcceptedTypes?: unknown } | null },
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
        // Build the file-open menu from the registered importers and exporters. One section per
        // modality, ordered alphabetically by the module's full name; the header and the
        // modality→name mapping come from the interface module's `moduleName` (matched on its
        // `code`), never a hard-coded list. Within a section the file/folder/URL modes of one format
        // share an id stem (`eeg/edf-file|folder|url`) and collapse into one submenu, labelled by the
        // shared prefix of their own labels — so the menu never re-declares a reader's extensions or
        // labels, and a newly registered module or reader appears here without editing this component.
        const moduleFullName = (code: string): string => {
            for (const mod of store.state.INTERFACE.modules.values()) {
                const moduleName = (mod as { moduleName?: { code?: string, full?: string } }).moduleName
                if (moduleName?.code === code && moduleName.full) {
                    return moduleName.full
                }
            }
            return code
        }
        // Longest shared prefix of a group's labels, trimmed of a trailing partial word — turns
        // "Open EDF file" / "…files from folder" / "…from URL" into the submenu label "Open EDF".
        const sharedLabel = (labels: string[]): string => {
            let prefix = labels[0] || ''
            for (const label of labels) {
                let i = 0
                while (i < prefix.length && prefix[i] === label[i]) {
                    i++
                }
                prefix = prefix.slice(0, i)
            }
            return (prefix.replace(/\s*\S*$/, '') || prefix).trim()
        }
        type MenuEntry = { key: string, context: MenuEntryContext, direction: 'import' | 'export' }
        // Terse label for a mode inside a format submenu, whose own label already names the format:
        // "From file" / "From folder" / "From URL" (or "To …" for an exporter).
        const modeLabel = (direction: 'import' | 'export', mode: string): string =>
            `${direction === 'export' ? 'To' : 'From'} ${mode === 'url' ? 'URL' : mode}`
        const buildItem = (entry: MenuEntry, label: string) => ({
            id: entry.key,
            enabled: true,
            closeParent: true,
            label,
            onclick: () => emit(
                `${entry.direction}-${entry.context.mode}`,
                {
                    protocol: entry.key,
                    types: entry.context.loader.studyImporter?.fileTypes || [],
                    excludeAll: entry.context.loader.studyImporter?.onlyAcceptedTypes,
                }
            ),
        })
        const sections = new Map<string, { full: string, groups: Map<string, MenuEntry[]> }>()
        const collect = (contexts: Iterable<[string, MenuEntryContext]>, direction: 'import' | 'export') => {
            for (const [key, context] of contexts) {
                for (const modality of context.modalities) {
                    let section = sections.get(modality)
                    if (!section) {
                        section = { full: moduleFullName(modality), groups: new Map() }
                        sections.set(modality, section)
                    }
                    // The id stem is the id without its trailing `-<mode>` segment: the modes of one
                    // format collapse to the same stem; other readers and exporters keep their own.
                    const stem = key.endsWith(`-${context.mode}`) ? key.slice(0, -(context.mode.length + 1)) : key
                    const group = section.groups.get(stem)
                    if (group) {
                        group.push({ key, context, direction })
                    } else {
                        section.groups.set(stem, [{ key, context, direction }])
                    }
                }
            }
        }
        collect(APP.studyImporters, 'import')
        collect(APP.studyExporters, 'export')
        for (const section of Array.from(sections.values()).sort((a, b) => a.full.localeCompare(b.full))) {
            const entries = [] as { direction: 'import' | 'export', item: any }[]
            for (const group of section.groups.values()) {
                // A group is built from importers or exporters, never both, so its direction is shared.
                const direction = group[0].direction
                let item: any
                if (group.length === 1) {
                    // A lone mode (or an exporter) has no submenu to carry context: keep its full label.
                    item = buildItem(group[0], T(group[0].context.label, 'AppMenubar'))
                } else {
                    // Collapse the format's modes into a submenu labelled by their shared prefix; the
                    // items inside can be terse because the submenu label already names the format.
                    const label = sharedLabel(group.map(entry => T(entry.context.label, 'AppMenubar')))
                    const items = group.map(entry =>
                        buildItem(entry, T(modeLabel(entry.direction, entry.context.mode), 'AppMenubar'))
                    )
                    item = { type: 'menu', label, items }
                }
                entries.push({ direction, item })
            }
            // Importers first, exporters last; alphabetical within each.
            entries.sort((a, b) =>
                a.direction !== b.direction
                    ? (a.direction === 'export' ? 1 : -1)
                    : (a.item.label || '').localeCompare(b.item.label || '')
            )
            fileMenu.items.push({ label: T(section.full, 'AppMenubar'), type: 'header' })
            fileMenu.items.push(...entries.map(entry => entry.item))
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
                    // ── Biosignal — visible only when the biosignal view is active. ──────────
                    // Header + items are toggled via `visible`; reloadOn flips them on `set-view`.
                    {
                        type: 'header',
                        label: T('Biosignal', 'AppMenubar'),
                        visible: APP.view.name === 'biosignal',
                        reloadOn: [
                            ['set-view'],
                            (item: MenuItem) => {
                                item.visible = APP.view.name === 'biosignal'
                            }
                        ],
                    },
                    {
                        // Trends submenu. Top child toggles the strip's visibility; the rest is a
                        // radio-style picker for the trend TYPE displayed inside it. Only `aeeg`
                        // is implemented today; new types are added by appending entries below
                        // and dispatching `eeg.set-selected-trend` with their id. The submenu
                        // itself follows the standard reloadOn pattern to hide outside the
                        // biosignal view.
                        id: 'trends',
                        type: 'menu',
                        enabled: true,
                        label: T('Trends', 'AppMenubar'),
                        visible: APP.view.name === 'biosignal',
                        reloadOn: [
                            ['set-view'],
                            (item: MenuItem) => {
                                item.visible = APP.view.name === 'biosignal'
                            }
                        ],
                        items: [
                            {
                                icon: ['', 'check'],
                                id: 'trend-strip',
                                enabled: true,
                                keepOpen: true,
                                label: T('Display trend', 'AppMenubar'),
                                onclick: () => store.dispatch('eeg.toggle-trend-visible'),
                                // `AppStore.addModule` forwards the runtime's `trendVisible` onto
                                // `INTERFACE.modules.get('eeg')` as a live getter, so this read
                                // always reflects the current state.
                                selected: (store.state.INTERFACE as { modules: Map<string, { trendVisible?: boolean }> }).modules.get('eeg')?.trendVisible === true,
                                reloadOn: [
                                    ['eeg.set-trend-visible', 'eeg.toggle-trend-visible', 'set-active-resource'],
                                    (item: MenuItem) => {
                                        item.selected = (store.state.INTERFACE as { modules: Map<string, { trendVisible?: boolean }> }).modules.get('eeg')?.trendVisible === true
                                    }
                                ],
                            },
                            {
                                type: 'header',
                                label: T('Trends', 'AppMenubar'),
                            },
                            {
                                icon: ['', 'check'],
                                id: 'trend-aeeg',
                                enabled: true,
                                keepOpen: true,
                                label: T('aEEG', 'AppMenubar'),
                                onclick: () => store.dispatch('eeg.set-selected-trend', 'aeeg'),
                                selected: (store.state.INTERFACE as { modules: Map<string, { selectedTrend?: string }> }).modules.get('eeg')?.selectedTrend === 'aeeg',
                                reloadOn: [
                                    ['eeg.set-selected-trend'],
                                    (item: MenuItem) => {
                                        item.selected = (store.state.INTERFACE as { modules: Map<string, { selectedTrend?: string }> }).modules.get('eeg')?.selectedTrend === 'aeeg'
                                    }
                                ],
                            },
                            {
                                icon: ['', 'check'],
                                id: 'trend-ratio',
                                enabled: true,
                                keepOpen: true,
                                label: T('TAR / DAR / DTABR', 'AppMenubar'),
                                onclick: () => store.dispatch('eeg.set-selected-trend', 'ratio'),
                                selected: (store.state.INTERFACE as { modules: Map<string, { selectedTrend?: string }> }).modules.get('eeg')?.selectedTrend === 'ratio',
                                reloadOn: [
                                    ['eeg.set-selected-trend'],
                                    (item: MenuItem) => {
                                        item.selected = (store.state.INTERFACE as { modules: Map<string, { selectedTrend?: string }> }).modules.get('eeg')?.selectedTrend === 'ratio'
                                    }
                                ],
                            },
                            {
                                icon: ['', 'check'],
                                id: 'trend-pdbsi',
                                enabled: true,
                                keepOpen: true,
                                label: T('pdBSI', 'AppMenubar'),
                                onclick: () => store.dispatch('eeg.set-selected-trend', 'pdbsi'),
                                selected: (store.state.INTERFACE as { modules: Map<string, { selectedTrend?: string }> }).modules.get('eeg')?.selectedTrend === 'pdbsi',
                                reloadOn: [
                                    ['eeg.set-selected-trend'],
                                    (item: MenuItem) => {
                                        item.selected = (store.state.INTERFACE as { modules: Map<string, { selectedTrend?: string }> }).modules.get('eeg')?.selectedTrend === 'pdbsi'
                                    }
                                ],
                            },
                            {
                                icon: ['', 'check'],
                                id: 'trend-spectrogram',
                                enabled: true,
                                keepOpen: true,
                                label: T('Spectrogram', 'AppMenubar'),
                                onclick: () => store.dispatch('eeg.set-selected-trend', 'spectrogram'),
                                selected: (store.state.INTERFACE as { modules: Map<string, { selectedTrend?: string }> }).modules.get('eeg')?.selectedTrend === 'spectrogram',
                                reloadOn: [
                                    ['eeg.set-selected-trend'],
                                    (item: MenuItem) => {
                                        item.selected = (store.state.INTERFACE as { modules: Map<string, { selectedTrend?: string }> }).modules.get('eeg')?.selectedTrend === 'spectrogram'
                                    }
                                ],
                            },
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
        console.log(store.state)
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
                // Update display menu item properties if visible elements change. Skip items
                // whose id isn't a key in `componentVisible` (e.g. `trend-strip` manages its
                // own `selected` state via the item's `reloadOn` callback against
                // `INTERFACE.modules.get('eeg').trendVisible`) — otherwise this watcher would
                // overwrite their `item.selected` with `undefined` whenever any other component
                // visibility toggles.
                for (const menu of this.menubarItems) {
                    if (menu.id !== 'display') {
                        continue
                    }
                    for (const item of menu.items as MenuItem[]) {
                        if (!(item.id in value)) {
                            continue
                        }
                        // This requires a tiny timeout to work, $nextTick won't do!
                        window.setTimeout((() =>
                            item.selected = value[item.id]
                        ), 1)
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
        /**
         * Fire every menu item's `reloadOn` callback whose trigger list contains `triggerType`.
         * Recurses into `item.items` so sub-menu items (e.g. the Trends → aEEG selection radio
         * entry) react to broadcast actions/mutations even though only top-level items live
         * directly under `visibleMenus`.
         */
        _dispatchReload (triggerType: string) {
            const visit = (item: MenuItem) => {
                if (item.reloadOn && item.reloadOn[0].includes(triggerType)) {
                    item.reloadOn[1](item)
                }
                if (item.items?.length) {
                    for (const sub of item.items as MenuItem[]) {
                        visit(sub)
                    }
                }
            }
            for (const menu of this.visibleMenus) {
                for (const item of menu.items) {
                    visit(item as MenuItem)
                }
            }
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
        // Two-phase subscription: the menu-close handling runs BEFORE the action handler (its
        // outcome is independent of state mutations), while the `reloadOn` dispatch runs AFTER
        // so that callbacks reading the toggled state (e.g. `INTERFACE.modules.get('eeg').trendVisible`
        // for the trend-strip tick) see the new value. Vuex's default `subscribeAction(handler)`
        // fires `before`, which made the tick lag one click behind the actual state.
        this.unsubscribeActions = this.$store.subscribeAction({
            before: (action) => {
                if (action.type === 'pointer-left-app' || action.type === 'overlay-clicked') {
                    // Close all open menus when pointer leaves the app area or the overlay is clicked
                    for (const menu of this.menubarItems) {
                        if (menu.open) {
                            menu.open = false
                        }
                    }
                    this.options.open = false
                }
            },
            after: (action) => {
                // Let menu items react to action types — some modules (e.g. EEG) toggle their
                // runtime state via broadcast actions rather than mutations. Firing `after` the
                // action handler ensures the reloadOn callback reads the post-toggle state.
                this._dispatchReload(action.type)
            },
        })
        // Subscribe to store mutations
        this.unsubscribeMutations = this.$store.subscribe((mutation) => {
            if (mutation.type === 'set-fullscreen' || mutation.type === 'toggle-expand-viewer') {
            } else {
                this._dispatchReload(mutation.type)
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
    [data-component="app-menubar"] :deep(h2) {
            height: 1.25rem;
            line-height: 1rem;
        }
        /* Headers slotted into a wa-dropdown-item's submenu don't get the styling that
           wa-dropdown applies to headers in its own #menu slot (its shadow CSS has
           `#menu ::slotted(h1..h6) { ... }`, but wa-dropdown-item has no equivalent rule).
           Replicate that ruleset here so submenu section headers look identical to the
           top-level Display-menu headers ("Biosignal", "Components", etc.). */
        [data-component="app-menubar"] :deep(wa-dropdown-item > h2) {
            display: block !important;
            margin: 0.25em 0 !important;
            padding: 0.25em 0.75em !important;
            color: var(--wa-color-text-quiet);
            font-family: var(--wa-font-family-body) !important;
            font-weight: var(--wa-font-weight-semibold) !important;
            font-size: var(--wa-font-size-smaller) !important;
        }
        [data-component="app-menubar"] wa-dropdown-item {
            height: 1.75rem;
            line-height: 1.75rem;
            font-size: 0.8rem;
            padding: 0 0.7rem;
        }
            /* Caret-less items (exporters, single-mode readers) and section subtitles get extra
               right padding so their label ends clearly left of a sibling submenu's caret. */
            [data-component="app-menubar"] wa-dropdown-item.menu-leaf {
                padding-right: 2rem;
            }
            [data-component="app-menubar"] :deep(h2.menu-subtitle) {
                padding-right: 2rem;
            }
            [data-component="app-menubar"] wa-dropdown-item::part(submenu) {
                /* Reset font size to preserve styles in submenus. */
                font-size: 1rem;
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
