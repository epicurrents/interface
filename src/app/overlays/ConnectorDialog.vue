<template>
    <wa-dialog ref="dialog"
        class="epicv-dialog"
        data-component="connector-dialog"
        :label="$t(title)"
        :style="`--width:40rem;`"
        @click.stop=""
    >
        <div class="url-row">
            <wa-input
                class="name"
                autofocus
                :label="$t(`Name (required)`)"
                minlength="1"
                :value="name"
                @input="inputName($event.target.value)"
            ></wa-input>
            <wa-input
                class="url"
                :disabled="connector !== null"
                :label="$t(`URL (required)`)"
                minlength="1"
                :placeholder="$t(requireHttps ? `data.source.url` : `https://data.source.url`)"
                :value="url"
                @input="inputUrl($event.target.value)"
            >
                <span v-if="requireHttps" slot="start">{{ 'https://' }}</span>
            </wa-input>
        </div>
        <wa-divider></wa-divider>
        <wa-details :summary="$t(`Authentication`)" ref="auth">
            <div class="hint">
                <div class="hint-icon">
                    <app-icon
                        :class="[
                            'inline',
                            allowAuth ? 'available' : 'unavailable',
                        ]"
                        :name="allowAuth ? 'circle-info' : 'triangle-exclamation'"
                    ></app-icon>
                </div>
                <div class="hint-text">
                    <div v-for="(hint, idx) of (Array.isArray(authHint) ? authHint : [authHint])"
                        :key="`auth-hint-${idx}`"
                    >
                        {{ hint }}
                    </div>
                </div>
            </div>
            <template v-if="allowAuth">
                <wa-input
                    :placeholder="$t(`Username`)"
                    :value="username"
                    @input="username=$event.target.value"
                ></wa-input>
                <wa-input
                    password-toggle
                    :placeholder="$t(`Password`)"
                    type="password"
                    :value="password"
                    @input="password=$event.target.value"
                ></wa-input>
            </template>
        </wa-details>
        <wa-divider></wa-divider>
        <div class="controls">
            <wa-select
                :value="type"
                @input="changeType($event.target.value)"
            >
                <wa-option value="filesystem">{{ $t(`Filesystem`) }}</wa-option>
                <wa-option value="database">{{ $t(`Database`) }}</wa-option>
            </wa-select>
            <wa-switch
                :checked="deepIndex"
                :disabled="type === 'database'"
                :title="$t(`Index the contents of all contained folders.`)"
                @input="changeIndex($event.target.checked)"
            >{{ $t(`Index`) }}</wa-switch>
            <wa-select
                :value="mode"
                :disabled="type === 'database'"
                @input="changeMode($event.target.value)"
            >
                <wa-option value="r">
                    {{ $t(`Read`) }}
                </wa-option>
                <wa-option value="w">
                    {{ $t(`Write`) }}
                </wa-option>
                <wa-option value="rw">
                    {{ $t(`Read+write`) }}
                </wa-option>
            </wa-select>
            <wa-button v-if="!connector || isAuthenticating"
                appearance="filled-outlined"
                :disabled="!name.length || !url.length || isAuthenticating"
                variant="success"
                @click="addConnector"
            >
                <app-icon v-if="!isAuthenticating" name="link"></app-icon>
                <wa-spinner v-else></wa-spinner>
                {{ $t(`Connect`) }}
            </wa-button>
            <wa-button v-else
                appearance="filled-outlined"
                class="abort"
                variant="danger"
                @click="removeConnector"
            >
                <app-icon name="trash"></app-icon>
                {{ $t(`Remove`) }}
            </wa-button>
            <wa-button
                appearance="filled-outlined"
                data-dialog="close"
                :disabled="!davContents"
                @click="$emit('connect', connector)"
            >{{ $t(`Done`) }}</wa-button>
        </div>
        <div class="dav-tree">
            <h5 v-if="type === 'filesystem'">{{ $t(`DAV directory contents`) }}</h5>
            <h5 v-else-if="type === 'database'">{{ $t(`Database contents`) }}</h5>
            <wa-breadcrumb :key="subPath" :class="{ 'with-content': davContents !== null }">
                <wa-breadcrumb-item v-if="type === 'filesystem' && !davContents">
                    {{ $t(`No contents loaded yet.`) }}
                </wa-breadcrumb-item>
                <wa-breadcrumb-item v-else-if="type === 'database' && dbContents !== null">
                    {{ dbContents + $t(` items in database.`) }}
                </wa-breadcrumb-item>
                <template v-else>
                    <wa-breadcrumb-item v-for="(dir, index) in subPathLocation" :key="index"
                        @click="selectFolder(index ? dir.path : '/')"
                    >
                        {{ index ? dir.name : $t(`Root`) }}
                    </wa-breadcrumb-item>
                    <wa-breadcrumb-item v-if="canWrite">
                        <app-icon-button
                            id="create-webdav-folder"
                            name="folder-plus"
                            @click="createFolder"
                        >
                        </app-icon-button>
                        <wa-tooltip v-if="!createFolderInput"
                            for="create-webdav-folder"
                        >
                            {{ $t(`Create new folder`) }}
                        </wa-tooltip>
                        <wa-input v-else
                            id="create-folder-input"
                            :placeholder="$t(`New folder name`)"
                            size="small"
                            @focusout="createFolderInput = false"
                            @keydown.esc.stop.prevent="null"
                            @keyup.stop="handleFolderNameKeyup"
                        ></wa-input>
                    </wa-breadcrumb-item>
                </template>
            </wa-breadcrumb>
            <wa-tree ref="tree" class="tree-with-icons"></wa-tree>
        </div>
        <wa-callout v-if="error"
            closable
            open
            variant="danger"
            @wa-hide="error = ''"
        >
            <app-icon name="exclamation-circle" slot="icon"></app-icon>
            {{ error }}
        </wa-callout>
    </wa-dialog>
</template>

<script lang="ts">
/**
 * This component provides a dialog for creating connections to web-based data resources.
 */
import { defineComponent, ref, Ref } from "vue"
import { T } from "#i18n"
//import { useStore } from "vuex"
import { Log } from "scoped-event-log"
import type {
    DatabaseConnector,
    DatasourceConnector,
    FileSystemConnector,
    FileSystemItem,
    TaskResponse,
} from "@epicurrents/core/dist/types"
import type { default as WaDetails } from "@awesome.me/webawesome/dist/components/details/details.js"
import type { default as WaDialog } from '@awesome.me/webawesome/dist/components/dialog/dialog.js'
import type { default as WaTree } from '@awesome.me/webawesome/dist/components/tree/tree.js'

export default defineComponent({
    name: 'ConnectorDialog',
    components: {
    },
    props: {
        title: {
            type: String,
            required: true,
        },
    },
    setup () {
        //const store = useStore()
        const connector = ref(null as DatasourceConnector | null)
        const createFolderInput = ref(false)
        const davContents = ref(null as FileSystemItem | null)
        const dbContents = ref(null as number | null)
        const deepIndex = ref(true)
        const error = ref('')
        const expandedItem = ref('')
        const isAuthenticating = ref(false)
        const manualUrl = ref('')
        const mode = ref('r' as 'r' | 'rw' | 'w')
        const name = ref('')
        const password = ref('')
        const subPath = ref('')
        const treeItemSelectors = [] as ((path: string) => void)[]
        const type = ref('filesystem' as 'filesystem' | 'database')
        const url = ref('')
        const username = ref('')
        // DOM
        const auth = ref<WaDetails>() as Ref<WaDetails>
        const dialog = ref<WaDialog>() as Ref<WaDialog>
        const tree = ref<WaTree>() as Ref<WaTree>
        return {
            connector,
            createFolderInput,
            davContents,
            dbContents,
            deepIndex,
            error,
            expandedItem,
            isAuthenticating,
            manualUrl,
            mode,
            name,
            password,
            subPath,
            treeItemSelectors,
            type,
            url,
            username,
            // DOM
            auth,
            dialog,
            tree,
        }
    },
    computed: {
        allowAuth () {
            if (
                !window.__EPICURRENTS__.SETUP.allowInsecureAuth &&
                (window.location.protocol !== 'https:' || !this.url.startsWith('https://'))
            ) {
                // Only allow sending usernames and passwords over secure connections.
                return false
            }
            return true
        },
        authHint () {
            if (this.allowAuth) {
                return this.$t(`If the server requires basic authentication, add your credentials here.`)
            }
            if (!window.__EPICURRENTS__.SETUP.allowInsecureAuth && window.location.protocol !== 'https:') {
                return this.$t(`Basic authentication is only available if the app is served over HTTPS.`)
            }
            if (!this.url.length) {
                return this.$t(`Please enter a URL...`)
            }
            return ''
        },
        canRead () {
            return this.mode.includes('r')
        },
        canWrite () {
            return this.mode.includes('w')
        },
        /** Returns the current connector if it is a database connector, null otherwise. */
        dbConnector (): DatabaseConnector | null {
            if (!this.connector || this.connector.type !== 'database') {
                return null
            }
            return this.connector as DatabaseConnector
        },
        /** Returns the current connector if it is a filesystem connector, null otherwise. */
        fsConnector (): FileSystemConnector | null {
            if (!this.connector || this.connector.type !== 'filesystem') {
                return null
            }
            return this.connector as FileSystemConnector
        },
        requireHttps () {
            return !window.__EPICURRENTS__.SETUP.allowInsecureAuth
        },
        subPathLocation () {
            const parts = this.subPath.split('/')
            const loc = [] as { path: string, name: string }[]
            for (const [index, part] of parts.entries()) {
                if (this.subPath === '/' && index) {
                    // Don't add empty element to root path.
                    break
                }
                loc.push({ path: parts.slice(0, index + 1).join('/'), name: part })
            }
            return loc
        },
    },
    watch: {
        modeRead () {
            this.constructDirTree()
        },
        modeWrite () {
            this.constructDirTree()
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
        async addConnector () {
            if (!this.url.length) {
                return
            }
            if (this.$store.state.APP.connectors.has(this.name)) {
                Log.warn(`A connector with the name '${this.name}' already exists.`, this.$options.name!)
                this.error = this.$t(`A connector with the name '${this.name}' already exists.`)
                return
            }
            if (this.url.endsWith('/')) {
                this.url = this.url.slice(0, -1) // Remove trailing slash
            }
            this.$store.dispatch(
                'add-connector',
                {
                    name: this.name,
                    type: this.type,
                    url: this.requireHttps ? `https://${this.url}` : this.url,
                    username: this.username,
                    password: this.password,
                    mode: this.mode,
                }
            )
            // https://dav.epicurrents.io
            this.isAuthenticating = true
            this.connector = this.$store.state.APP.connectors.get(this.name) || null
            // Initiate a possible filesystem connector.
            if (this.fsConnector) {
                const auth = await this.fsConnector.authenticate()
                if (auth.success) {
                    Log.debug(
                        `Connector '${this.name}' created and authenticated successfully.`,
                        this.$options.name!
                    )
                    this.auth.hide()
                    this.error = ''
                    this.openFolder('/')
                } else if (auth.response?.status === 401) {
                    Log.error(
                        `Listing root contents of the WebDAV server failed for connector '${this.name}'.`,
                        this.$options.name!
                    )
                    this.error = [
                        this.$t(`Authenticating with the WebDAV server failed.`),
                        this.$t(`You may not have access to this folder.`),
                        this.$t(`Check your credentials or try typing in a sub-folder on the address line.`)
                    ].join(' ')
                    this.removeConnector()
                } else if (auth.error?.message === 'Failed to fetch') {
                    Log.error(
                        `Failed to connect to the WebDAV server for connector '${this.name}'.`,
                        this.$options.name!
                    )
                    this.error = [
                        this.$t(`Failed to connect to the WebDAV server.`),
                        this.$t(`Check your connection and that the address is correct.`)
                    ].join(' ')
                    this.removeConnector()
                } else {
                    Log.error(
                        `Failed to connect to the WebDAV server for connector '${this.name}'.`,
                        this.$options.name!
                    )
                    this.error = this.$t(`Failed to connect to the WebDAV server.`)
                    this.removeConnector()
                }
            } else if (this.dbConnector) {
                const auth = await this.dbConnector.authenticate()
                if (auth.success) {
                    Log.debug(
                        `Connector '${this.name}' created and authenticated successfully.`,
                        this.$options.name!
                    )
                    if ((auth as TaskResponse & { itemCount: number | undefined }).itemCount !== undefined) {
                        this.dbContents = (auth as TaskResponse & { itemCount: number }).itemCount
                    }
                    this.auth.hide()
                    this.error = ''
                } else {
                    Log.error(
                        `Authenticating with the database server failed for connector '${this.name}'.`,
                        this.$options.name!
                    )
                    this.error = this.$t(`Authenticating with the database server failed.`)
                    this.removeConnector()
                }
            } else {
                Log.error(`Failed to create connector '${this.name}'.`, this.$options.name!)
                this.error = this.$t(`Failed to create connector.`)
            }
            this.isAuthenticating = false
        },
        changeIndex (value: boolean) {
            this.deepIndex = value
            this.openFolder(this.subPath || '/')
        },
        changeMode (value: 'r' | 'rw' | 'w') {
            this.mode = value
            this.save()
            this.constructDirTree()
        },
        changeType (value: 'filesystem' | 'database') {
            this.type = value
            this.clearState()
        },
        clearDirTree () {
            this.tree.replaceChildren()
            this.treeItemSelectors.length = 0
        },
        clearState () {
            this.connector = null
            this.davContents = null
            this.clearDirTree()
            this.subPath = ''
            this.expandedItem = ''
        },
        constructDirTree () {
            if (!this.davContents || !this.tree) {
                return
            }
            this.clearDirTree() // Clear previous contents
            if (!this.davContents.directories.length && !this.davContents.files.length) {
                this.tree.innerHTML = `<wa-tree-item label="${this.$t('No contents found')}"></wa-tree-item>`
                return
            }
            const attachChildren = (items: FileSystemItem[], parent: HTMLElement) => {
                for (const item of items) {
                    const treeItem = document.createElement('wa-tree-item')
                    treeItem.setAttribute('label', item.name)
                    treeItem.setAttribute('value', item.path)
                    if (item.path === this.subPath) {
                        if (item.type === 'file' && (!this.canRead || !this.deepIndex)) {
                            // Select parent dir if a file has been chosen and mode is switched to write-only or deep
                            // indexing is disabled.
                            this.subPath = this.subPath.split('/').slice(0, -1).join('/')
                        }
                        treeItem.setAttribute('selected', 'true')
                    }
                    if (item.type === 'directory' && this.expandedItem.startsWith(item.path)) {
                        treeItem.setAttribute('expanded', 'true')
                    }
                    const icon = document.createElement('app-icon')
                    if (item.type === 'directory') {
                        icon.setAttribute('name', 'folder')
                        treeItem.addEventListener('wa-expand', (event) => {
                            this.expandedItem = item.path
                            event.stopPropagation()
                        })
                        treeItem.addEventListener('wa-collapse', (event) => {
                            // Select the parent folder as expanded when a folder is collapsed.
                            this.expandedItem = item.path.split('/').slice(0, -1).join('/')
                            event.stopPropagation()
                        })
                        treeItem.appendChild(icon)
                        attachChildren(item.directories, treeItem)
                        attachChildren(item.files, treeItem)
                    } else {
                        icon.setAttribute('name', 'file')
                        if (!this.canRead || !this.deepIndex) {
                            treeItem.setAttribute('disabled', 'true')
                        }
                        treeItem.appendChild(icon)
                    }
                    const label = document.createElement('span')
                    label.textContent = item.name
                    treeItem.appendChild(label)
                    parent.appendChild(treeItem)
                    const itemSelector = (path: string) => {
                        if (path === item.path) {
                            treeItem.selected = true
                        } else {
                            treeItem.selected = false
                        }
                    }
                    this.treeItemSelectors.push(itemSelector)
                }
            }
            attachChildren(this.davContents.directories, this.tree)
            attachChildren(this.davContents.files, this.tree)
        },
        createFolder () {
            this.createFolderInput = true
            this.$nextTick(() => {
                const input = document.getElementById('create-folder-input') as HTMLInputElement
                if (input) {
                    input.focus()
                }
            })
        },
        focusInput (event: Event) {
            if (event.target !== this.dialog) {
                // Ignore propagated events from child components.
                return
            }
            const input = this.dialog.querySelector('wa-input')
            if (input) {
                // Shoelace's own autofocus attribute does not work here.
                // We need to wait for the components to draw before focusing the input.
                requestAnimationFrame(() => input.focus())
            }
        },
        handleFolderNameKeyup (event: KeyboardEvent) {
            if (event.key === 'Enter') {
                this.submitNewFolder((event.target as HTMLInputElement).value)
            } else if (event.key === 'Escape') {
                this.createFolderInput = false
            }
        },
        inputName (value: string) {
            this.name = value
            const connector = this.$store.state.APP.connectors.get(this.name) as FileSystemConnector | undefined
            if (connector?.type === 'filesystem') {
                this.connector = connector
                this.mode = connector.mode
                this.subPath = connector.path
                this.expandedItem = this.subPath
                if (this.requireHttps) {
                    // Protocol is added automatically.
                    this.url = connector.source.replace(/^https:\/\//, '')
                } else {
                    this.url = connector.source
                }
                this.openFolder(this.deepIndex ? '/' : this.subPath || '/')
            } else {
                this.clearState()
                if (this.manualUrl) {
                    this.url = this.manualUrl
                }
            }
        },
        inputUrl (value: string) {
            this.url = value
            this.manualUrl = value
        },
        openFolder (folder: string) {
            if (!this.fsConnector) {
                return
            }
            this.fsConnector.listContents(folder, this.deepIndex).then(contents => {
                if (contents) {
                    this.error = ''
                    this.davContents = contents
                    this.constructDirTree()
                } else {
                    Log.error(
                        `Listing root contents of the WebDAV server failed for connector '${this.name}'.`,
                        this.$options.name!
                    )
                    this.error = [
                        this.$t(`Listing root contents of the WebDAV server failed.`),
                        this.$t(`You may not have access to this folder.`),
                        this.$t(`Try typing in a sub-folder on the address line.`)
                    ].join(' ')
                }
            }).catch(e => {
                Log.error(
                    `Listing root contents of the WebDAV server failed for connector '${this.name}'.`,
                    this.$options.name!,
                    e
                )
                const error = [this.$t(`Listing root contents of the WebDAV server failed.`)]
                if (this.deepIndex) {
                    error.push(this.$t(`Your data source may not support deep indexing.`))
                    error.push(this.$t(`Try switching deep search off.`))
                }
                this.error = error.join(' ')
            })
        },
        removeConnector () {
            this.$store.dispatch('remove-connector', this.name)
            this.clearState()
        },
        selectFolder (path: string) {
            if (!this.davContents) {
                return
            }
            this.subPath = path
            // Update the directory tree to reflect the new sub-path.
            this.treeItemSelectors.forEach(selector => selector(path))
            // If deep index is disabled, load new folder contents.
            if (!this.deepIndex) {
                this.openFolder(path)
            }
            this.save()
        },
        save () {
            if (!this.fsConnector || !this.davContents) {
                return
            }
            this.fsConnector.path = this.subPath
            this.fsConnector.mode = this.mode
        },
        async submitNewFolder (name: string) {
            if (!this.fsConnector || !this.davContents) {
                this.error = this.$t(`Cannot create a folder, not connected to a WebDAV server.`)
                return
            }
            if (!this.canWrite) {
                this.error = this.$t(`Cannot create a folder, write access is disabled.`)
                return
            }
            if (name.includes('/') || name.includes('\\')) {
                this.error = this.$t(`Folder name cannot contain slashes or backslashes; create nested folders separately.`)
                return
            }
            const path = this.subPath.endsWith('/') ? this.subPath + name : this.subPath + '/' + name
            const success = await this.fsConnector.createDirectory(path)
            if (success) {
                this.createFolderInput = false
                this.openFolder(this.subPath || '/')
            } else {
                this.error = this.$t(`Failed to create folder.`)
            }
            this.error = ''
        }
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this.dialog.addEventListener('wa-after-show', this.focusInput)
        // Handle folder selection in the tree.
        this.tree.addEventListener('wa-selection-change', () => {
            const selectedRoot = this.tree.selectedItems?.[0].getAttribute('value')
            if (selectedRoot) {
                this.selectFolder(selectedRoot)
            }
        })
    },
    beforeUnmount () {
        this.dialog.removeEventListener('wa-after-show', this.focusInput)
    },
})
</script>

<style scoped>
.url-row {
    display: flex;
    align-items: stretch;
}
    .url-row wa-input {
        margin-right: 0.5rem;
    }
    .url-row .actions {
        flex: 0 1 auto;
    }
    .url-row wa-input.name::part(base) {
        width: 10.5rem;
    }
    .url-row .url {
        flex: 1;
    }
[data-component="connector-dialog"] wa-details::part(content) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
        [data-component="connector-dialog"] wa-details div wa-icon {
            margin-inline-end: 0.25em;
        }
        .hint {
            display: flex;
            flex-direction: row;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        .hint-icon {
            flex: 0 0 2.5rem;
            height: 1.5rem;
            line-height: 1.5rem;
            text-align: center;
        }
            .hint-icon wa-icon.available {
                color: var(--epicv-icon-default);
            }
            .hint-icon wa-icon.unavailable {
                color: var(--epicv-warning);
            }
        .hint-text {
            flex: 1 1 auto;
        }
        .hint-text div {
            height: 1.5rem;
            line-height: 1.5rem;
        }
        [data-component="connector-dialog"] wa-input.url::part(start) {
            color: var(--epicv-text-faint);
            padding-right: 0.25rem;
            position: relative;
            top: 1px;
        }
        [data-component="connector-dialog"] wa-input.url::part(input) {
            padding-left: 0;
        }
        .controls {
            display: flex;
        }
        .controls wa-select {
            max-width: 9rem;
        }
        .controls wa-switch {
            margin: 0 1rem 0 0.5rem;
        }
        .controls wa-radio-group {
            margin: 0 auto 0 1rem;
        }
        .controls wa-button {
            margin-left: 0.5rem;
        }
            .controls wa-button:first-of-type {
                margin-left: auto;
            }
        [data-component="connector-dialog"] h5 {
            margin: 1rem 0;
        }
        .dav-tree {
            display: flex;
            flex-direction: column;
            padding-bottom: 1rem;
        }
            .dav-tree h4 {
                color: var(--wa-color-primary-800);
            }
            .dav-tree wa-breadcrumb {
                display: block;
                height: 2rem;
            }
                .dav-tree wa-breadcrumb.with-content {
                    margin-bottom: 0.25rem;
                }
                .dav-tree wa-breadcrumb::part(base) {
                    height: 2rem;
                    line-height: 2rem;
                }
                .dav-tree wa-breadcrumb app-icon-button {
                    position: relative;
                    left: -0.25rem;
                    color: var(--wa-color-primary-700);
                    margin-top: 0.125rem;
                }
            .dav-tree wa-tree {
                --indent-guide-width: 1px;
            }
            .tree-hint {
                color: var(--epicv-text-faint);
                font-style: italic;
                margin-bottom: 0.5rem;
            }
</style>
