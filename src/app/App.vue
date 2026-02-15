<template>
    <!-- Invalid browser warning -->
    <div v-if="browserValid===false"
        ref="error"
        class="epicv-placeholder epicv-invalid-browser"
    >
        <span>
            <p><app-icon name="octagon-exclamation"></app-icon></p>
            <p><strong>{{ $t(`This browser is not supported.`) }}</strong></p>
            <p>
                {{ $t(`You should try again with Google Chrome or Microsoft Edge.`) }}<br />
                {{ $t(`See`) }}
                <a href="https://en.wikipedia.org/wiki/Chromium_(web_browser)#Browsers_based_on_Chromium"
                    target="_blank"
                >{{ $t(`Chromium-based browsers`) }}</a> {{ $t('for more information') }}.
            </p>
            <p>
                {{ $t(`Alternatively, you can use the application on your current browser,`) }}<br />
                {{ $t(`understanding that some features may not work as intended.`) }}<br />
                <a :href="overrideBrowserHref">{{ $t(`I understand and want to use my current browser`) }}</a>.
            </p>
        </span>
    </div>
    <!-- Loading screen -->
    <div v-if="browserValid"
        ref="placeholder"
        :class="[
            'epicv-placeholder',
            { 'epicv-hidden': !loading },
        ]"
    >
        <wa-spinner style="font-size:10vw;"></wa-spinner>
    </div>
    <!-- Main app -->
    <div v-if="browserValid"
        ref="app"
        :class="[
            'epicv-app',
            applicationTheme,
            `wa-${$store.state.APP.view.theme || $store.state.APP.view.defaultTheme}`,
            { 'epicv-hidden': loading },
        ]"
        @pointerleave="pointerLeftApp"
    >
        <component :is="SETTINGS.isMainComponent ? 'header' : 'div'"
            class="epicv-menubar"
        >
            <app-menubar
                v-on:add-connector="toggleDialog('connector', true, $event)"
                v-on:external-url="importExternalUrl($event)"
                v-on:import-dataset="importDatasetClick($event)"
                v-on:import-file="importFileClick($event)"
                v-on:import-folder="importFolderClick($event)"
                v-on:import-study="importStudyClick($event)"
                v-on:import-url="toggleDialog('url', true, $event)"
                v-on:redo-action="redoAction"
                v-on:set-view="setView"
                v-on:toggle-component="toggleComponent"
                v-on:toggle-dialog="toggleDialog"
                v-on:toggle-expand="toggleExpand"
                v-on:toggle-fullscreen="toggleFullscreen"
                v-on:undo-action="undoAction"
            ></app-menubar>
        </component>
        <split-panel-view
            class="epicv-view"
            data-component="app-view"
            :primary-open="displayNavigator"
            :primary-size-bounds="['160px', '33%']"
            primary-slot="start"
            :primary-start-size="240"
        >
            <!-- Dataset navigator -->
            <template v-slot:start>
                <dataset-navigator
                    class="epicv-navigator"
                    :visible="displayNavigator"
                    v-on:close="toggleNavigation"
                    v-on:create-dataset="toggleDialog('dataset', true)"
                ></dataset-navigator>
            </template>
            <!-- Main interface -->
            <template v-slot:end>
                <component v-if="$store.state.APP.view.name === 'default'"
                    :class="{
                        'epicv-interface': true,
                        'epicv-hidden': $store.state.APP.view.name !== 'default',
                    }"
                    :is="'default-interface'"
                    v-on:toggle-navigation="toggleNavigation"
                ></component>
                <component v-if="VIEWS.BiosignalInterface && $store.state.APP.view.name === 'biosignal'"
                    :class="{
                        'epicv-interface': true,
                    }"
                    :is="'biosignal-interface'"
                    v-on:toggle-navigation="toggleNavigation"
                ></component>
                <component v-if="VIEWS.MediaInterface && $store.state.APP.view.name === 'media'"
                    :class="{
                        'epicv-interface': true,
                    }"
                    :is="'media-interface'"
                ></component>
                <!-- Radiology interface must be loaded and kept hidden when not active. -->
                <component v-if="VIEWS.RadiologyInterface"
                    :class="{
                        'epicv-interface': true,
                        'epicv-hidden': $store.state.APP.view.name !== 'radiology',
                    }"
                    :is="'radiology-interface'"
                ></component>
            </template>
        </split-panel-view>
        <!-- Datasource connector dialog. -->
        <connector-dialog :class="applicationTheme"
            :title="$t('Open data source from URL')"
            :open="dialogs.connector.open"
            v-on:close="toggleDialog('connector', false)"
            v-on:connect="connectDatasource($event)"
            v-on:wa-after-hide="toggleDialog('connector', false)"
        ></connector-dialog>
        <!-- Create dataset dialog -->
        <dataset-dialog :class="applicationTheme"
            :title="$t('Create a new dataset')"
            :open="dialogs.dataset.open"
            v-on:close="toggleDialog('dataset', false)"
            v-on:create-dataset="createDataset"
            v-on:wa-after-hide="toggleDialog('dataset', false)"
        ></dataset-dialog>
        <!-- URL loader dialog. -->
        <url-loader-dialog :class="applicationTheme"
            :title="$t('Open resource from URL')"
            :open="dialogs.url.open"
            v-on:close="toggleDialog('url', false)"
            v-on:open-url="importStudyUrl($event)"
            v-on:wa-after-hide="toggleDialog('url', false)"
        />
        <!-- Overlay -->
        <pointer-events-overlay v-if="false"
            @click="$store.dispatch('overlay-clicked')"
        ></pointer-events-overlay>
        <app-instructions :class="applicationTheme"
            :open="dialogs.instructions.open"
            v-on:close="toggleDialog('instructions', false)"
            v-on:wa-after-hide="toggleDialog('instructions', false)"
        ></app-instructions>
        <settings-dialog :class="applicationTheme"
            :open="dialogs.settings.open"
            v-on:close="toggleDialog('settings', false)"
            v-on:suggest-reload="toggleDialog('reload', true)"
            v-on:wa-after-hide="toggleDialog('settings', false)"
        ></settings-dialog>
        <reload-dialog :class="applicationTheme"
            :content="$t('Some settings may require reloading the application to take effect.\nDo you want to reload now?')"
            :title="$t('Reload application')"
            :open="dialogs.reload.open"
            v-on:close="toggleDialog('reload', false)"
            v-on:wa-after-hide="toggleDialog('reload', false)"
        ></reload-dialog>
        <log-dialog :class="applicationTheme"
            :open="dialogs.log.open"
            v-on:close="toggleDialog('log', false)"
            v-on:wa-after-hide="toggleDialog('log', false)"
        ></log-dialog>
        <!-- Welcome dialog -->
        <welcome-dialog :open="!$store.state.INTERFACE.app.disclaimerAccepted"></welcome-dialog>
        <!-- Callouts are displayed over everything else -->
        <div class="epicv-callouts">
            <wa-callout v-for="(callout, idx) in callouts" :key="`callout-${idx}`"
                appearance="filled-outlined"
                :class="{ 'expired': callout.expired }"
                :variant="getCalloutVariant(callout.role)"
            >
                <app-icon slot="icon" :name="getCalloutIcon(callout.role)"></app-icon>
                {{ callout.message }}
            </wa-callout>
        </div>
        <!-- File inputs for opening a select file or folder dialog -->
        <input type="file" ref="open-file" style="visibility:hidden" multiple="true" @change="handleFileSelect" />
        <input type="file" ref="open-folder" style="visibility:hidden" webkitdirectory="true" directory="true" multiple="true" @change="handleFolderSelect" />
        <input type="file" ref="open-study" style="visibility:hidden" webkitdirectory="true" directory="true" multiple="true" @change="handleStudySelect" />
        <input type="file" ref="open-dataset" style="visibility:hidden" webkitdirectory="true" directory="true" multiple="true" @change="handleDatasetSelect" />
    </div>
</template>

<script lang="ts">
/**
 * The main app component to add to the container div.
 */
import Log from "scoped-event-log"
import { defineComponent, ref, Ref, reactive } from "vue"
import { T } from "#i18n"
import { MixedFileSystemItem, MixedMediaDataset } from "@epicurrents/core"
import { AssetEvents } from "@epicurrents/core/dist/events"
import { AssociatedFileType, DatasourceConnector } from "@epicurrents/core/types"
import { useStore } from 'vuex'
import { useAppContext } from '#config'

type StudyContext = {
    protocol: string
    types: AssociatedFileType[]
    excludeAll?: boolean
}

// Child components
import AppIcon from '#app/AppIcon.vue'
import AppInstructions from '#app/AppInstructions.vue'
import AppMenubar from '#app/AppMenubar.vue'
import ConnectorDialog from '#app/overlays/ConnectorDialog.vue'
import DatasetDialog from "#app/overlays/DatasetDialog.vue"
import DatasetNavigator from '#app/navigator/DatasetNavigator.vue'
import LogDialog from '#/app/log/LogDialog.vue'
import PointerEventsOverlay from '#app/overlays/PointerEventOverlay.vue'
import ReloadDialog from '#app/overlays/ReloadDialog.vue'
import SettingsDialog from '#app/settings/SettingsDialog.vue'
import SplitPanelView from '#app/views/SplitPanelView.vue'
import UrlLoaderDialog from '#app/overlays/UrlLoaderDialog.vue'
import WelcomeDialog from "#app/overlays/WelcomeDialog.vue"
import { loadAsyncComponent } from '#util'
import DefaultInterface from './views/default/DefaultInterface.vue'

const VIEWS = {
    DefaultInterface,
} as { [key: string]: ReturnType<typeof loadAsyncComponent> }
if (window.__EPICURRENTS__.SETUP.activeViews?.includes('biosignal')) {
    VIEWS.BiosignalInterface = loadAsyncComponent(() => import('#app/views/biosignal/BiosignalInterface.vue'))
}
if (window.__EPICURRENTS__.SETUP.activeViews?.includes('media')) {
    VIEWS.MediaInterface = loadAsyncComponent(() => import('#app/views/media/MediaInterface.vue'))
}
if (window.__EPICURRENTS__.SETUP.activeViews?.includes('radiology')) {
    VIEWS.RadiologyInterface = loadAsyncComponent(() => import('#app/views/radiology/RadiologyInterface.vue'))
}

export default defineComponent({
    name: 'App',
    components: {
        AppIcon,
        AppInstructions,
        AppMenubar,
        ConnectorDialog,
        DatasetDialog,
        DatasetNavigator,
        LogDialog,
        PointerEventsOverlay,
        ReloadDialog,
        SettingsDialog,
        SplitPanelView,
        UrlLoaderDialog,
        WelcomeDialog,
        ...VIEWS,
    },
    setup () {
        const overrideBrowser = window.location.href.match(/[&?]override(&|$)/) !== null
        const browserValid = ref(overrideBrowser || window.chrome !== undefined)
        const callouts = ref([] as {
            expired: boolean
            message: string
            remove: boolean
            role: 'confirm' | 'error' | 'warning'
        }[])
        const dialogs = reactive({
            connector: {
                open: false,
            },
            dataset: {
                open: false,
            },
            instructions: {
                open: false,
            },
            log: {
                open: false,
            },
            reload: {
                open: false,
            },
            settings: {
                open: false,
            },
            url: {
                name: '',
                open: false,
            },
        })
        const fileContext = { protocol: '', types: []} as StudyContext
        const hotkeyEvents = reactive({} as Record<string, boolean>)
        const loading = ref(true)
        const overrideBrowserHref = overrideBrowser ? ''
                                    : window.location.href.includes('?')
                                      ? window.location.href + '&override'
                                      : window.location.href + '?override'
        const styles = ref([] as string[])
        // DOM
        const app = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const error = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const placeholder = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            browserValid,
            callouts,
            dialogs,
            fileContext,
            hotkeyEvents,
            loading,
            overrideBrowserHref,
            styles,
            // DOM
            app,
            error,
            placeholder,
            // Allow testing views.
            VIEWS,
            // Context properties.
            ...useAppContext(useStore()),
        }
    },
    computed: {
        applicationTheme (): string {
            return `epicv-${this.$store.state.APP.view.theme || this.$store.state.APP.view.defaultTheme}-theme`
        },
        displayNavigator (): boolean {
            return this.$store.state.APP.uiComponentVisible.navigator && !this.$store.state.INTERFACE.app.isExpanded
        },
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
        addCallout (message: string, role: 'confirm' | 'error' | 'warning') {
            const newCallout = {
                expired: false,
                message,
                remove: false,
                role,
            }
            this.callouts.push(newCallout)
            window.setTimeout(() => {
                newCallout.expired = true
                this.callouts = this.callouts.filter(c => !c.remove)
            }, 5000) // Fade out callout after 5 seconds.
            window.setTimeout(() => {
                newCallout.remove = true
                this.callouts = this.callouts.filter(c => !c.remove)
            }, 10000) // Remove callout after 10 seconds.
        },
        /**
         * Add new styles to the shadow root.
         * @param identifiers - The scope identifiers of the styles to add.
         */
        addStyles (...identifiers: string[]) {
            for (const id of identifiers) {
                for (const styleList of document.styleSheets) {
                    for (let i=0; i<styleList.cssRules.length; i++) {
                        // Remove backslashes added to cssRules to escape CSS reserved characters for matching,
                        // but add the original text to style list.
                        const definitions = styleList.cssRules.item(i)?.cssText?.replaceAll('\\', '')
                        const classDef = new RegExp(`[\.\[]${id}\]?`)
                        if (
                            definitions
                            && definitions.match(classDef)
                            // Add style in development mode if the CSS text has changed.
                            && (
                                !window.__EPICURRENTS__.SETUP.isProduction
                                && !this.styles.includes(styleList.cssRules.item(i)?.cssText!)
                            )
                        ) {
                            this.styles.push(styleList.cssRules.item(i)?.cssText!)
                        }
                    }
                }
            }
            // Select the shadow root style element and inject app styles
            const styleTag = document.querySelector(
                `#epicurrents${this.$store.state.APP.containerId}`
            )?.shadowRoot?.querySelector('style')
            if (styleTag) {
                styleTag.innerHTML = this.styles.join('\n')
            }
        },
        cancelHotkeyEvents () {
            for (const key in this.hotkeyEvents) {
                this.hotkeyEvents[key as keyof typeof this.hotkeyEvents] = false
            }
        },
        connectDatasource (connector: DatasourceConnector) {
            if (!connector) {
                return
            }
            this.$store.dispatch('display-callout', {
                role: 'confirm',
                message: this.$t(`Connector '${connector.name}' configuration saved.`)
            })
        },
        createDataset (
            event: {
                name: string,
                connectors?: { input: DatasourceConnector, output: DatasourceConnector }
            }
        ) {
            const newSet = new MixedMediaDataset(event.name, event.connectors)
            this.$store.dispatch('add-dataset', newSet)
            this.toggleDialog('dataset', false)
        },
        displayViewer () {
            if (!this.browserValid) {
                return
            }
            this.placeholder.style.display = 'none'
            this.app.style.display = 'block'
        },
        getCalloutIcon (variant: 'confirm' | 'error' | 'warning'): string {
            switch (variant) {
                case 'confirm': {
                    return 'check-circle'
                }
                case 'error': {
                    return 'exclamation-octagon'
                }
                case 'warning': {
                    return 'exclamation-triangle'
                }
                default: {
                    return 'info-circle'
                }
            }
        },
        getCalloutVariant (variant: 'confirm' | 'error' | 'warning'): string {
            switch (variant) {
                case 'confirm': {
                    return 'success'
                }
                case 'error': {
                    return 'danger'
                }
                case 'warning': {
                    return 'warning'
                }
                default: {
                    return 'brand'
                }
            }
        },
        /**
         * Handle study folder selection.
         */
        async handleDatasetSelect (event: any) {
            if (!event.target?.files) {
                return
            }
            const folder = new MixedFileSystemItem(
                event.target.files[0].webkitRelativePath.split('/')[0],
                '',
                'directory'
            )
            const fileList = event.target.files as FileList
            for (const file of fileList) {
                folder.files.push(new MixedFileSystemItem(
                    file.name,
                    `/`,
                    'file',
                    file
                ))
            }
            await this.importDataset(folder)
            this.resetContext()
        },
        /**
         * Handle file selection.
         */
        async handleFileSelect (event: any) {
            const selected = (event.target as any).files as FileList
            if (selected.length) {
                this.importFile(selected[0], this.fileContext.protocol, this.fileContext.types)
            }
            this.resetContext()
        },
        /**
         * Handle file folder selection.
         */
        async handleFolderSelect (event: any) {
            const fileList = (event.target as any).files as FileList
            const acceptExts = this.fileContext.types.map(t => {
                return Object.values(t.accept).flat()
            }).flat()
            const acceptFiles = Array.from(fileList).filter(f => {
                return acceptExts.some(ext => f.name.endsWith(ext))
            })
            const totalFiles = acceptFiles.length
            let loadedFiles = 0
            this.$store.dispatch('load-dataset-progress', {
                context: 'filesystem',
                loaded: loadedFiles,
                total: totalFiles,
            })
            for (const file of acceptFiles) {
                await this.importFile(file, this.fileContext.protocol, this.fileContext.types)
                loadedFiles++
                this.$store.dispatch('load-dataset-progress', {
                    context: 'filesystem',
                    loaded: loadedFiles,
                    total: totalFiles,
                })
            }
            this.resetContext()
        },
        /**
         * Handle keyup events with the viewer visible.
         */
        handleKeydown (event: KeyboardEvent) {
            if (event.key === 'Escape') {
                this.cancelHotkeyEvents()
            } else if ((this.SETTINGS.hotkeyAltOrOpt && event.altKey) || !event.altKey) {
                for (const key in this.hotkeyEvents) {
                    if (Object.keys(this.SETTINGS.hotkeys).includes(key)) {
                        const hotkey = this.SETTINGS.hotkeys[key]
                        if (!hotkey) {
                            continue
                        }
                        if (hotkey.control && !event.ctrlKey) {
                            continue
                        }
                        if (hotkey.shift && !event.shiftKey) {
                            continue
                        }
                        if (
                            hotkey.key !== event.key &&
                            // We also have to check event.code here, because alt changes the value in event.key.
                            // There is a slight possibility that a single physical key would map to a different actions
                            // via event.key and event.code (on a non-QWERTY keyboard), and maybe there's a better way
                            // to handle this.
                            (!event.altKey || hotkey.code !== event.code)
                        ) {
                            continue
                        }
                        this.hotkeyEvents[key as keyof typeof this.hotkeyEvents] = true
                        if (event.altKey) {
                            event.preventDefault()
                        }
                    }
                }
            }
        },
        /**
         * Handle keyup events with the viewer visible.
         */
        async handleKeyup (event: KeyboardEvent) {
            if (event.key === 'Escape') {
                // These are handled on key down.
            }
        },
        /**
         * Handle study folder selection.
         */
        async handleStudySelect (event: any) {
            if (!event.target?.files) {
                return
            }
            const folder = new MixedFileSystemItem(
                event.target.files[0].webkitRelativePath.split('/')[0],
                '',
                'directory'
            )
            const fileList = event.target.files as FileList
            for (const file of fileList) {
                folder.files.push(new MixedFileSystemItem(
                    file.name,
                    `/`,
                    'file',
                    file
                ))
            }
            await this.importStudy(folder)
        },
        importDataset (folder: MixedFileSystemItem, context?: string) {
            this.$store.dispatch(
                'load-dataset-folder',
                { loader: this.fileContext.protocol, folder: folder, name: folder.name, context: context }
            )
            this.resetContext()
        },
        /**
         * Trigger a click on the open file folder input to display the folder picker.
         */
        importDatasetClick (context: StudyContext) {
            this.fileContext = context
            ;(this.$refs['open-dataset'] as HTMLInputElement).dispatchEvent(
                new MouseEvent('click')
            )
        },
        importExternalUrl (url: string) {
            window.open(url, "_blank")
        },
        /**
         * Display an open file dialog and handle the selection.
         */
        async importFile (file: File, loader: string, _types: AssociatedFileType[]) {
            const fileUrl = URL.createObjectURL(file)
            try {
                const study = await this.$store.dispatch(
                    'load-study-url',
                    {
                        loader: loader,
                        name: file.name,
                        url: fileUrl,
                    }
                )
                // Revoke the object URL in certain cases when it is no longer needed.
                study.addEventListener([
                    AssetEvents.DESTROY
                ], () => {
                    Log.debug('Data processing complete, releasing object URL.', 'App')
                    URL.revokeObjectURL(fileUrl)
                })
                return study
            } catch (e) {
                console.error(e)
                this.resetContext()
            }
        },
        /**
         * Trigger a click on the open file input to display the file picker.
         */
        async importFileClick (context: StudyContext) {
            // Use FilePicker API if available.
            if (typeof window.showOpenFilePicker === 'function') {
                try {
                    const [fileHandle] = await window.showOpenFilePicker({
                        types: context.types,
                        excludeAcceptAllOption: context.excludeAll,
                    })
                    this.importFile(await fileHandle.getFile(), context.protocol, context.types)
                    this.resetContext()
                    return
                } catch (e: any) {
                    // Don't report AbortError from cancellation.
                    if (e.toString().startsWith('AbortError:')) {
                        this.resetContext()
                        return
                    } else {
                        Log.error(`Opening file with file picker failed, defaulting to file input (${e.toString()}).`, 'App', e)
                    }
                }
            }
            this.fileContext = context
            // If file picker is not available or fails, use vanilla file input.
            ;(this.$refs['open-file'] as HTMLInputElement).dispatchEvent(
                new MouseEvent('click')
            )
        },
        /**
         * Trigger a click on the open folder input to display the folder picker.
         */
        importFolderClick (context: StudyContext) {
            this.fileContext = context
            ;(this.$refs['open-folder'] as HTMLInputElement).dispatchEvent(
                new MouseEvent('click')
            )
        },
        importStudy (folder: MixedFileSystemItem, context?: string) {
            this.$store.dispatch(
                'load-study-folder',
                { loader: this.fileContext.protocol, folder: folder, name: folder.name, context: context }
            )
            this.resetContext()
        },
        /**
         * Trigger a click on the open study folder input to display the folder picker.
         */
        importStudyClick (context: StudyContext) {
            this.fileContext = context
            ;(this.$refs['open-study'] as HTMLInputElement).dispatchEvent(
                new MouseEvent('click')
            )
        },
        importStudyUrl (data: any) {
            // Extract the file name part of the URL.
            const fileName = data.url.split('/').pop()
            this.$store.dispatch(
                'load-study-url',
                {
                    loader: this.dialogs.url.name,
                    name: fileName,
                    url: data.url,
                }
            )
            this.dialogs.url.open = false
        },
        /**
         * Trigger when pointer leaves the app area
         */
        pointerLeftApp () {
            this.$store.dispatch('pointer-left-app')
        },
        resetContext () {
            this.fileContext = { protocol: '', types: [] }
        },
        redoAction () {
            this.$store.dispatch('redo-action')
        },
        setView (view: 'biosignal' | 'radiology') {
            this.$store.dispatch('set-view', view)
        },
        toggleComponent (value: string) {
            this.$store.dispatch('toggle-ui-component', value)
        },
        toggleExpand (value?: boolean) {
            if (value === undefined) {
                this.$store.dispatch('toggle-expand-viewer')
            }
        },
        toggleFullscreen (value?: boolean) {
            if (value === undefined) {
                this.$store.dispatch('toggle-fullscreen')
            }
        },
        toggleDialog (dialog: string, state?: boolean, data?: any) {
            if (!Object.hasOwn(this.dialogs, dialog)) {
                return
            }
            const key = dialog as keyof typeof this.dialogs
            if (key === 'url') {
                this.dialogs.url.name = data?.protocol || ''
            }
            if (state === undefined) {
                state = !this.dialogs[key].open
            }
            this.dialogs[key].open = state
        },
        toggleNavigation () {
            this.$store.dispatch('toggle-ui-component', 'navigator')
        },
        undoAction () {
            this.$store.dispatch('undo-action')
        },
    },
    beforeMount () {
        // Listen to some action broadcasts.
        this.$store.subscribeAction((action) => {
            if (action.type === 'display-callout') {
                this.addCallout(action.payload.message, action.payload.role)
            }
        })
        // Listen to style update requests.
        this.$store.subscribe((mutation) => {
            Log.debug(
                `Store commit event ${mutation.type + (mutation.payload?.component ? ' (' + mutation.payload.component + ')' : '')}.`,
                this.$options.name!
            )
            if (this.$store.state.APP.shadowRoot && mutation.type === 'add-styles') {
                if (Array.isArray(mutation.payload.styles)) {
                    this.addStyles(...mutation.payload.styles)
                } else {
                    this.addStyles(mutation.payload.styles)
                }
            } else if (mutation.type === 'display-viewer') {
                Log.debug(`Displaying main viewer.`, this.$options.name!)
            } else {
                Log.debug(`Store commit event ${mutation.type}.`, this.$options.name!)
            }
        })
    },
    mounted () {
        // Add event listeners
        window.addEventListener('keydown', this.handleKeydown, false)
        window.addEventListener('keyup', this.handleKeyup, false)
        // Cancel all hotkey events if user leaves the tab.
        window.addEventListener('blur', this.cancelHotkeyEvents, false)
        // Bind methods to page elements.
        this.$store.subscribeAction((action) => {
            if (action.type === 'toggle-dialog') {
                if (!Object.hasOwn(this.dialogs, action.payload.name)) {
                    return
                }
                const value = action.payload.value
                              ?? !this.dialogs[action.payload.name as keyof typeof this.dialogs].open
                this.toggleDialog(action.payload.name, value)
            }
        })
        this.$nextTick(() => {
            // These styles must be added after the styles in this component have been rendered.
            this.$store.dispatch('add-component-styles', { component: 'App', styles: ['epicv-'] })
            this.$store.dispatch('add-component-styles', { component: 'App', styles: [''] })
            if (this.browserValid) {
                this.loading = false
            }
        })
    },
})
</script>

<style>
/*************

General styles

*************/
.epicv-app * {
    box-sizing: border-box;
    /* Don't allow selecting text by default */
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    font-family: sans-serif;
    /* Set scrollbar width for Firefox */
    scrollbar-width: none;
    /* Mode-independent variables. */
    --epicv-button-focused: inset 0 0 0.5em var(--epicv-border-active);
    --epicv-font-monospace: 'Courier New', Courier, monospace;
    --epicv-font-sans: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}
.epicv-app *:before, .epicv-app *:after {
    box-sizing: inherit;
}
/* Hide scrollbars */
.epicv-app *::-webkit-scrollbar {
    width: 0;
    height: 0;
}
/* HTML5 display-role reset for older browsers */
.epicv-app article, .epicv-app aside, .epicv-app details,
.epicv-app figcaption, .epicv-app figure, .epicv-app footer,
.epicv-app header, .epicv-app hgroup, .epicv-app menu,
.epicv-app nav, .epicv-app section {
    display: block;
}
/* List styles */
.epicv-app ol, .epicv-app ul {
    list-style: none;
}
.epicv-app blockquote, .epicv-app q {
    quotes: none;
}
.epicv-app blockquote:before, .epicv-app blockquote:after,
.epicv-app q:before, .epicv-app q:after {
    content: '';
    content: none;
}
.epicv-app table {
    border-collapse: collapse;
    border-spacing: 0;
}
/* Shoelace styles */
.epicv-app sl-spinner.inline, .epicv-app wa-icon.inline {
    position: relative;
    top: 0.125em;
}
/* Transition on theme change */
.epicv-theme-change {
    -ms-transition: background-color 1.0s ease, border-color 1.0s ease;
    -moz-transition: background-color 1.0s ease, border-color 1.0s ease;
    -webkit-transition: background-color 1.0s ease, border-color 1.0s ease;
    transition: background-color 1.0s ease, border-color 1.0s ease;
}
.epicv-dark-theme, .epicv-dark-theme * {
    --epicv-background: #080808;
    --epicv-background-active: #001828;
    --epicv-background-focus: #002436;
    --epicv-background-highlight: #181818;
    --epicv-background-hover: #001018;
    --epicv-background-emphasize: #303030;
    --epicv-background-modal: #131313;
    --epicv-background-dialog: rgba(8, 8, 8, 0.7);
    --epicv-border: #C0C0C0;
    --epicv-border-active: #3060F0;
    --epicv-border-faint: #606060;
    --epicv-border-highlight: #F0F0F0;
    --epicv-error: #cc0000;
    --epicv-fade-bottom: linear-gradient(to top, rgba(31,31,31,1), rgba(31,31,31,0));
    --epicv-fade-top: linear-gradient(to bottom, rgba(31,31,31,1), rgba(31,31,31,0));
    --epicv-icon-active: #3060F0;
    --epicv-link: #306090;
    --epicv-text-main: #E0E0E0;
    --epicv-text-highlight: #F0F0F0;
    --epicv-text-minor: #C0C0C0;
    --epicv-text-faint: #808080;
    --epicv-warning: #bb6020;
}
.epicv-light-theme, .epicv-light-theme * {
    --epicv-background: #FFFFFF;
    --epicv-background-active: var(--wa-color-fill-normal);
    --epicv-background-disabled: #e0e0e0;
    --epicv-background-focus: var(--wa-color-fill-quiet);
    --epicv-background-hover: var(--wa-color-fill-normal);
    --epicv-background-highlight: #F0F0F0;
    --epicv-background-hover: #eef7ff;
    --epicv-background-emphasize: #E0E0E0;
    --epicv-background-modal: #fcfcfc;
    --epicv-background-dialog: rgba(255, 255, 255, 0.7);
    --epicv-border: #C0C0C0;
    --epicv-border-active: var(--wa-color-border-loud);
    --epicv-border-faint: #E0E0E0;
    --epicv-border-focus: var(--wa-color-fill-loud);
    --epicv-border-highlight: #A0A0A0;
    --epicv-button-abort-background: #E0402010;
    --epicv-button-abort-border: #E04020;
    --epicv-button-background-hover: var(--wa-color-fill-quiet);
    --epicv-button-border-hover: var(--wa-color-border-loud);
    --epicv-button-confirm-background: #2040E010;
    --epicv-button-confirm-border: var(--wa-color-fill-loud);
    --epicv-error: #cc0000;
    --epicv-fade-bottom: linear-gradient(to top, rgba(223,223,223,1), rgba(223,223,223,0));
    --epicv-fade-top: linear-gradient(to bottom, rgba(223,223,223,1), rgba(223,223,223,0));
    --epicv-icon-default: var(--wa-color-on-normal);
    --epicv-icon-active: var(--wa-color-on-quiet);
    --epicv-link: var(--wa-color-on-quiet);
    --epicv-text-disabled: #808080;
    --epicv-text-emphasis: var(--wa-color-on-normal);
    --epicv-text-faint: #909090;
    --epicv-text-focus: var(--wa-color-on-quiet);
    --epicv-text-highlight: #101010;
    --epicv-text-main: #202020;
    --epicv-text-minor: #606060;
    --epicv-warning: #bb6020;
    /* WebAwesome modifications. */
    --wa-form-control-padding-inline: 0.75em;
}
/* These classes are meant to override any pre-existing styles. */
.epicv-inactive {
    opacity: 0.67 !important;
}
.epicv-disabled {
    opacity: 0.5 !important;
    cursor: default !important;
}
.epicv-hidden {
    display: none !important;
}
.epicv-link-alike {
    color: var(--epicv-link) !important;
    /* Disabled link cursor might be default, so don't override this. */
    cursor: pointer;
}
/* Non-wrapping text */
.epicv-oneliner {
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
}
/* A spinning element */
.epicv-spinner {
    -webkit-animation: spin 4s linear infinite;
    -moz-animation: spin 4s linear infinite;
    animation: spin 4s linear infinite;
}
@-moz-keyframes spin {
    100% { transform: rotate(360deg); }
}
@-webkit-keyframes spin {
    100% { transform: rotate(360deg); }
}
@keyframes spin {
    100% {
        -webkit-transform: rotate(360deg);
        transform: rotate(360deg);
    }
}

/***********************

WebAwesome style overrides

***********************/

.epicv-app wa-button[appearance="epicv"]::part(base),
.epicv-app wa-select::part(combobox),
.epicv-app wa-select::part(listbox) {
    background-color: var(--epicv-background);
    color: var(--epicv-text-main);
}
.epicv-app wa-button wa-spinner {
    position: relative;
    top: 0.1em;
}
.epicv-app wa-button[appearance="epicv"]:hover::part(base) {
    background-color: var(--epicv-button-background-hover);
    border-color: var(--epicv-button-border-hover);
}
.epicv-app wa-button[appearance="epicv"].abort::part(base) {
    background-color: var(--epicv-button-abort-background);
    border-color: var(--epicv-button-abort-border);
}
    .epicv-app wa-button[appearance="epicv"].abort:hover::part(base) {
        color: var(--epicv-button-abort-border);
    }
.epicv-app wa-button[appearance="epicv"].confirm::part(base) {
    background-color: var(--epicv-button-confirm-background);
    border-color: var(--epicv-button-confirm-border);
}
    .epicv-app wa-button[appearance="epicv"].confirm:hover::part(base) {
        color: var(--epicv-button-confirm-border);
    }
.epicv-app wa-callout {
    padding: 0;
}
    .epicv-app wa-callout wa-icon {
        margin-inline-end: 0;
        margin-inline-start: 0.75rem;
    }
    .epicv-app wa-callout::part(message) {
        padding: 0.5rem;
    }
    .epicv-app wa-callout p {
        margin: 0.5rem;
    }
.epicv-app wa-dialog {
    position: absolute;
}
.epicv-app wa-dialog::part(header) {
    padding: 1rem;
}
.epicv-app wa-dialog::part(body) {
    color: var(--epicv-text-main);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0 1rem;
}
.epicv-app wa-dialog::part(footer) {
    padding: 1rem;
}
    .epicv-app wa-dialog wa-icon.info {
        margin-left: 0.25rem;
        color: var(--epicv-icon-active);
        cursor: pointer;
    }
    .epicv-app wa-dialog wa-tab::part(base) {
        padding: 0.5rem 1rem;
    }
    .epicv-app wa-dialog wa-tab-group,
    .epicv-app wa-dialog wa-tab-group::part(body) {
        flex: 1;
        /* Remove dialog top and bottom margins and header height. */
        max-height: calc(100vh - var(--wa-space-2xl) - 77px);
        overflow: hidden;
    }
    .epicv-app wa-dialog wa-tab-group::part(base) {
        max-height: calc(100vh - var(--wa-space-2xl) - 77px);
        overflow: hidden;
    }
    .epicv-app wa-dialog wa-tab-panel::part(base) {
        display: flex;
        flex-direction: column;
        /* Remove dialog top and bottom margins, header height, and panel top and bottom paddings. */
        max-height: calc(100vh - var(--wa-space-2xl) - 77px - 2rem);
        overflow: hidden;
        padding: 1rem 0;
    }
.epicv-app wa-icon.inline {
    /* Align inline icons a bit better with the adjacent text. */
    position: relative;
    top: -0.05em;
}
.epicv-app wa-scroller::part(content) {
    padding-right: 0.25rem;
}
.epicv-app wa-select::part(expand-icon) {
    margin-inline-start: 0.5em;
}
    .epicv-app wa-select wa-option {
        overflow: clip !important;
        white-space: nowrap !important;
    }
.epicv-app wa-switch {
    padding: 0.55em 0 0 0.15em;
    --height: 1.5em;
    --thumb-size: 1em;
}

/*******************

App component styles

*******************/

.epicv-placeholder {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    text-align: center;
}
.epicv-invalid-browser {
    font-size: min(2vw, 4vh);
    line-height: min(3vw, 6vh);
}
    .epicv-placeholder a, .epicv-invalid-browser a {
        color: #306090 !important;
        text-decoration: none;
    }
    .epicv-invalid-browser wa-icon {
        font-size: 5vw;
        color: darkred;
    }
/* Main styles */
.epicv-app {
    display: grid;
    grid-template-columns: [left-edge] 100% [right-edge];
    grid-template-rows: [top-edge] calc(1.5rem + 1px) [v-divider] auto [bottom-edge];
    width: 100%;
    height: 100%;
    font-size: 16px;
    background-color: var(--epicv-background);
    color: var(--epicv-text-main);
    /* Line height is important for embedded viewers! */
    line-height: 1em;
    position: relative;
    font-family: var(--epicv-font-sans);
    overflow: hidden;
}
    .epicv-overlay {
        inset: 0;
        pointer-events: none;
        position: absolute;
        z-index: 5;
    }
    .epicv-menubar {
        position: relative;
        grid-column-start: left-edge;
        grid-column-end: right-edge;
        grid-row-start: top-edge;
        grid-row-end: v-divider;
    }
    .epicv-view {
        position: relative;
        grid-column-start: left-edge;
        grid-column-end: right-edge;
        grid-row-start: v-divider;
        grid-row-end: bottom-edge;
        overflow: hidden;
    }
        .epicv-navigator {
            overflow-y: hidden;
        }
        .epicv-interface {
            position: relative;
            overflow: hidden;
        }
    .epicv-callouts {
        display: flex;
        flex-direction: column;
        align-items: start;
        position: absolute;
        bottom: 2rem;
        right: 1rem;
        z-index: 9999;
    }
        .epicv-callouts wa-callout::part(base) {
            margin: 0 0 0.5rem auto;
            max-width: 50vw;
            transition: opacity 2s ease, margin-bottom 0.5s ease 2s;
        }
            .epicv-callouts wa-callout.expired::part(base) {
                opacity: 0;
                margin-bottom: 0;
            }
        .epicv-callouts wa-callout::part(message) {
            height: 3rem;
            padding: 0 1rem;
            line-height: 3rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            /* Alerts should always disappear in order (from top to bottom), so this may never be needed. */
            transition: height 0.5s ease 2s;
        }
            .epicv-callouts wa-callout.expired::part(message) {
                height: 0;
            }
    /* Hide the file input */
    .epicv-app input[type=file] {
        display: none;
    }
</style>
