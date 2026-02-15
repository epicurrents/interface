<template>
    <div data-component="dataset-selector">
        <dropdown-control
            :label="$t('Active dataset')"
            :groups="groups"
            :joinLeft="true"
            :joinRight="true"
            :options="options"
            :placeholder="$t('No dataset selected')"
            :value="selected"
            v-on:selected="datasetSelected"
        ></dropdown-control>
    </div>
</template>

<script lang="ts">
/**
 * A small footer below the viewer for information display.
 */
import { defineComponent, reactive, Ref, ref } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import { DropdownItem, DropdownGroup } from "#types/interface"

import DropdownControl from '#app/controls/DropdownControl.vue'

export default defineComponent({
    name: 'DatasetSelector',
    components: {
        DropdownControl,
    },
    setup () {
        const ID = 'AppSelector-' + useStore().state.APP.runningId++
        const enabled = ref(true)
        // Add option to create new dataset
        const options = reactive([
            {
                icon: 'rectangle-history-circle-plus',
                id: 'create-dataset',
                label: T('New dataset'),
                onclick: ['create-dataset', null],
            }
        ] as DropdownItem[])
        // Add groups
        const groups = reactive([
            {
                id: 'datasets',
                label: T('Available datasets'),
                items: [] as DropdownItem[],
            },
        ] as DropdownGroup[])
        const selected = ref('')
        // DOM
        const active = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const selector = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        // Unsubscribe from store mutations
        const unsubscribe = ref(null as (() => void) | null)
        return {
            ID,
            enabled,
            groups,
            options,
            selected,
            // DOM
            active,
            selector,
            // Unsubscribers
            unsubscribe,
        }
    },
    inject: {
        $interface: { from: '$interface' },
    },
    computed: {
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
        buildResourceOptions () {
            this.groups[0].items.splice(0)
            for (const dataset of this.$store.state.APP.datasets) {
                this.groups[0].items.push({
                    id: `dataset-${dataset.id}`,
                    active: dataset.isActive,
                    enabled: true,
                    label: this.$t(dataset.name, this.$options.name),
                    onclick: ['set-active-dataset', dataset],
                })
            }
            if (!this.$store.state.APP.datasets.length) {
                this.groups[0].items.push({
                    id: `no-datasets-available`,
                    active: false,
                    enabled: false,
                    label: this.$t('No datasets available'),
                    onclick: ['void', null],
                })
            }
        },
        checkSelectedOption () {
            for (const grp of this.groups) {
                for (const item of grp.items) {
                    if (item.active) {
                        this.selected = item.id
                        return
                    }
                }
            }
            this.selected = ''
        },
        /**
         * Handle dataset selection.
         */
        datasetSelected (option: { id: string, onclick: [string, any] }) {
            if (!this.enabled) {
                this.selected = ''
                return
            }
            if (option.id === 'create-dataset') {
                this.$emit('create-dataset')
                this.selected = 'create-dataset'
                this.$nextTick(() => {
                    // Clear the create dataset selection.
                    this.selected = ''
                })
                //this.$epicv.createDataset(`Dataset ${this.$store.state.APP.datasets.length + 1}`)
            } else {
                this.$store.dispatch(option.onclick[0], option.onclick[1])
            }
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this.unsubscribe = this.$store.subscribe((mutation) => {
            if (mutation.type === 'add-dataset') {
                if (!this.$store.state.APP.activeDataset) {
                    this.$store.dispatch('set-active-dataset', mutation.payload)
                } else {
                    this.$nextTick(() => {
                        this.buildResourceOptions()
                        this.checkSelectedOption()
                    })
                }
            } else if (mutation.type === 'set-active-dataset') {
                this.$nextTick(() => {
                    this.buildResourceOptions()
                    this.checkSelectedOption()
                })
            }
        })
        this.buildResourceOptions()
        // Load initial option
        this.checkSelectedOption()
        this.$store.state.addEventListener('add-dataset', (payload) => {
            if (!this.$store.state.APP.activeDataset) {
                this.$store.dispatch('set-active-dataset', payload)
            } else {
                this.$nextTick(() => {
                    this.buildResourceOptions()
                    this.checkSelectedOption()
                })
            }
        }, this.$options.name!)
        this.$store.state.addEventListener([
            'add-connector',
            'add-resource',
            'remove-connector',
            'remove-resource',
            'set-active-dataset',
            'set-active-resource',
        ], () => {
            this.$nextTick(() => {
                this.buildResourceOptions()
                this.checkSelectedOption()
            })
        }, this.$options.name!)
    },
    beforeUnmount () {
        // Unsubscribe from actions
        if (this.unsubscribe) {
            this.unsubscribe()
        }
    }
})
</script>

<style scoped>
[data-component="dataset-selector"] {
    position: relative;
    width: 100%;
    flex-basis: calc(2.25rem + 1px);
    max-height: calc(2.25rem + 1px);
    background-color: var(--epicv-background);
    border-right: solid 1px var(--epicv-border);
    border-bottom: solid 1px var(--epicv-border);
    overflow: visible;
}
/*
    .options-visible
    {
        height: auto;
    }
    .disabled {
        opacity: 0.3;
    }
    .disabled > div {
        cursor: auto !important;
    }
.active-option {
    height: 44px;
    padding: 4px 8px 0 8px;
    cursor: pointer;
}
.options {
    border-left: 1px solid var(--epicv-border-faint);
    border-right: 1px solid var(--epicv-border-faint);
    padding-bottom: 8px;
}
    .active-option .option-title {
        font-size: 0.75rem;
        color: var(--epicv-text-minor);
    }
    .active-option .option-value {
        height: 25px;
        line-height: 25px;
    }
    .option-group {
        border-top: 1px solid var(--epicv-border-faint);
        height: 1.75rem;
        line-height: 1.75rem;
        padding: 0 8px;
        background-color: var(--epicv-background-emphasize);
    }
    .option {
        height: 2rem;
        line-height: 2rem;
        padding: 0 8px;
        cursor: pointer;
    }
        .option:hover {
            background-color: var(--epicv-background-highlight);
        }
        .option-disabled {
            cursor: default !important;
            font-style: italic;
        }
*/
</style>
