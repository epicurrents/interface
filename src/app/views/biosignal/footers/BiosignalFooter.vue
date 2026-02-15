<template>
    <app-footer data-component="biosignal-footer">
        <div v-if="modules" class="modules">
            <wa-spinner class="inline"></wa-spinner>
            {{ $t('Loading module dependencies, please wait:') }}
            <span v-for="(module, idx) of Object.values(modules)" :key="`biosig-footer-module-${idx}`">
                {{ module.label }} {{ module.ready }}/{{ module.total }}
                <span v-if="idx">&nbsp;|&nbsp;</span>
            </span>
        </div>
    </app-footer>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue"
import { T } from "#i18n"
import { useStore } from 'vuex'
import { useBiosignalContext } from '#config'
import AppFooter from '#app/footers/AppFooter.vue'
import type { EpiCStore } from '#store'

export default defineComponent({
    name: 'BiosignalFooter',
    components: {
        AppFooter,
    },
    setup () {
        const store = useStore() as EpiCStore
        const dataset = null as typeof store.state.APP.activeDataset
        const modules = ref(null as {
            [key: string]: {
                label: string
                missing: number
                ready: number
                total: number
            }
        } | null)
        const unsubscribe = ref(null as (() => void) | null)
        return {
            dataset,
            modules,
            unsubscribe,
            ...useBiosignalContext(store),
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
        removeListeners () {
            if (this.dataset) {
                this.dataset.removeAllEventListeners(this.$options.name!)
                this.dataset.resources.forEach(ctx => {
                    ctx.resource.removeAllEventListeners(this.$options.name!)
                })
            }
        },
        updateDataset () {
            this.removeListeners()
            this.$store.state.APP.activeDataset?.onPropertyChange(
                'resources',
                this.updateResources,
                this.$options.name!
            )
            this.updateResources()
        },
        updateDependencies () {
            for (const ctx of this.$store.state.APP.activeDataset?.resources || []) {
                if (!this.modules) {
                    this.modules = {}
                }
                const resource = ctx.resource
                if (!this.modules[resource.modality]) {
                    this.modules[resource.modality] = {
                        label: this.$store.state.MODULES.get(resource.modality)?.moduleName.short || resource.modality,
                        missing: resource.dependenciesMissing.length,
                        ready: resource.dependenciesReady.length,
                        total: resource.dependenciesMissing.length + resource.dependenciesReady.length,
                    }
                } else {
                    this.modules[resource.modality].missing = resource.dependenciesMissing.length
                    this.modules[resource.modality].ready = resource.dependenciesReady.length
                    this.modules[resource.modality].total = resource.dependenciesMissing.length +
                                                            resource.dependenciesReady.length
                }
            }
            if (this.modules && !Object.values(this.modules).some(mod => mod.missing > 0)) {
                this.modules = null
            }
        },
        updateResources () {
            this.modules = null
            this.$store.state.APP.activeDataset?.resources.forEach(ctx => {
                // These won't be added more than once in each resource.
                ctx.resource.onPropertyChange('dependenciesReady', this.updateDependencies, this.$options.name!)
            })
            this.updateDependencies()
        }
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch('add-component-styles', { component: this.$options.name, styles: this.$options.__scopeId })
    },
    mounted () {
        this.RUNTIME.addEventListener('set-active-dataset', () => {
            // We need to wait for the dataset change to propagate.
            this.$nextTick(() => {
                this.updateDataset()
            })
        }, this.$options.name!)
        this.updateDataset()
    },
    beforeUnmount () {
        this.removeListeners()
        this.RUNTIME.removeAllEventListeners(this.$options.name!)
    },
})
</script>

<style scoped>
.modules {
    padding: 0.25em;
}
</style>
