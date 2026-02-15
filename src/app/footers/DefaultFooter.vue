<template>
    <AppFooter>
        <div class="breadcrumbs">
            <wa-breadcrumb>
                <wa-breadcrumb-item v-if="RESOURCE"
                    :class="{ 'no-link': RESOURCE.activeChildResource === null }"
                    @click="deactivateChild"
                >
                    {{ RESOURCE.name }}
                </wa-breadcrumb-item>
                <wa-breadcrumb-item v-if="RESOURCE?.activeChildResource" class="no-link">
                    {{ RESOURCE.activeChildResource.name }}
                </wa-breadcrumb-item>
            </wa-breadcrumb>
        </div>
        <slot></slot>
    </AppFooter>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue"
import AppFooter from "./AppFooter.vue"
import { T } from "#i18n"
import { DataResource } from "#workspace/epicurrents/core/dist/types"

export default defineComponent({
    name: 'DefaultFooter',
    components: {
        AppFooter, // This is loaded synchronously
    },
    setup () {
        const RESOURCE = ref(null as null | DataResource)
        const unsubscribe = null as null | (() => void)
        return {
            RESOURCE,
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
        checkActiveResource () {
            this.RESOURCE = this.$store.state.APP.activeDataset?.resources.find(
                r => r.resource.isActive
            )?.resource || null
        },
        deactivateChild () {
            if (this.RESOURCE && this.RESOURCE.activeChildResource) {
                this.RESOURCE.activeChildResource = null
                this.$store.dispatch('set-active-resource', this.RESOURCE)
            }
        }
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch('add-component-styles', { component: this.$options.name, styles: this.$options.__scopeId })
        this.checkActiveResource()
    },
    mounted () {
        this.unsubscribe = this.$store.subscribe((mutation: any) => {
            if (mutation.type === 'set-active-resource') {
                this.$nextTick(() => {
                    this.checkActiveResource()
                })
            }
        })
    },
    beforeUnmount () {
        this.unsubscribe?.()
    },
})
</script>

<style scoped>
.breadcrumbs {
    padding: 0 0.5rem;
}
    .breadcrumbs wa-breadcrumb-item::part(label) {
        font-size: 0.8rem;
        height: 1.5rem;
        line-height: 1.5rem;
    }
    .breadcrumbs wa-breadcrumb-item.no-link::part(label) {
        cursor: default;
    }
</style>
