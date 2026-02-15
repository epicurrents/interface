<template>
    <wa-dialog ref="dialog"
        class="epicv-dialog"
        data-component="dataset-dialog"
        :label="title"
        :style="`--width:40rem;`"
        @click.stop=""
    >
        <wa-input
            v-property="'name'"
        ></wa-input>
        <wa-select
            clearable
            :placeholder="$t('Select an input connector')"
            @change="selectOption('in', $event.target.value)"
            @wa-after-hide.stop=""
            @wa-hide.stop=""
        >
            <wa-option v-for="(connector, index) in $store.state.APP.connectors.values()"
                :disabled="!connector.mode.includes('r')"
                :key="`dataset-connector-in-${index}`"
                :value="connector.id"
                size="small"
            >
                <span>{{ connector.name }}</span>
                <small v-if="!connector.mode.includes('r')" class="epicv-text-faint">
                    [{{ $t('No read permission') }}]
                </small>
            </wa-option>
        </wa-select>
        <wa-select
            clearable
            :placeholder="$t('Select an output connector')"
            @change="selectOption('out', $event.target.value)"
            @wa-after-hide.stop=""
            @wa-hide.stop=""
        >
            <wa-option v-for="(connector, index) in $store.state.APP.connectors.values()"
                :disabled="!connector.mode.includes('w')"
                :key="`dataset-connector-out-${index}`"
                :value="connector.id"
                size="small"
            >
                <span>{{ connector.name }}</span>
                <small v-if="!connector.mode.includes('w')" class="epicv-text-faint">
                    &nbsp; [{{ $t('No write permission') }}]
                </small>
            </wa-option>
        </wa-select>
        <wa-button
            appearance="filled-outlined"
            slot="footer"
            variant="danger"
            @click="closeDialog"
        >{{ $t('Cancel') }}</wa-button>
        <wa-button
            appearance="filled-outlined"
            slot="footer"
            variant="brand"
            @click="createDataset"
        >{{ $t('Create') }}</wa-button>
    </wa-dialog>
</template>

<script lang="ts">
import { defineComponent, ref, Ref } from "vue"
import { T } from "#i18n"
import type { DatasourceConnector } from "@epicurrents/core/dist/types"
//import { useStore } from "vuex"

export default defineComponent({
    name: 'DatasetDialog',
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
        const connectors = {
            input: null as DatasourceConnector | null,
            output: null as DatasourceConnector | null,
        }
        const name = ref('')
        // DOM
        const dialog = ref<HTMLDivElement>() as Ref<any>
        return {
            connectors,
            name,
            dialog,
        }
    },
    watch: {
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
        closeDialog () {
            this.$emit('close')
        },
        createDataset () {
            this.$emit('create-dataset', { name: this.name, connectors: this.connectors || undefined })
            this.connectors.input = null
            this.connectors.output = null
            this.name = ''
        },
        selectOption (mode: 'in' | 'out', value: string) {
            if (mode === 'in') {
                if (value) {
                    // Select doesn't support white spaces in value so we need to match by entity ID.
                    this.connectors.input = Array.from(
                                                this.$store.state.APP.connectors.values()
                                            ).filter(connector => connector.id === value)[0] || null
                } else {
                    this.connectors.input = null
                }
            } else {
                // Handle 'out' mode
                if (value) {
                    this.connectors.output = Array.from(
                        this.$store.state.APP.connectors.values()
                    ).filter(connector => connector.id === value)[0] || null
                } else {
                    this.connectors.output = null
                }
            }
        },
        updateName () {
            if (!this.name.trim().length) {
                this.name = this.$t('Dataset {n}', { n: this.$store.state.APP.datasets.length + 1 })
            }
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
        this.dialog.addEventListener('wa-hide', this.closeDialog)
        this.dialog.addEventListener('wa-show', this.updateName)
    },
    beforeUnmount () {
        this.dialog.removeEventListener('wa-hide', this.closeDialog)
        this.dialog.removeEventListener('wa-show', this.updateName)
    },
})
</script>

<style scoped>
[data-component="dataset-dialog"]::part(body) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-bottom: 1rem;
    padding-top: 0.25rem;
}
[data-component="dataset-dialog"] wa-option::part(label) {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
[data-component="dataset-dialog"]  small.epicv-text-faint {
    color: var(--epicv-error);
}
</style>
