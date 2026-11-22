<template>
    <AppFooter>
        <div class="breadcrumbs">
            <wa-breadcrumb>
                <wa-breadcrumb-item v-if="RESOURCE"
                    :class="{ 'no-link': activeChild === null }"
                    @click="deactivateChild"
                >
                    {{ RESOURCE.name }}
                </wa-breadcrumb-item>
                <wa-breadcrumb-item v-if="RESOURCE && activeChild" class="no-link">
                    {{ activeChild.name }}
                </wa-breadcrumb-item>
            </wa-breadcrumb>
        </div>
        <slot></slot>
    </AppFooter>
</template>

<script lang="ts">
import { defineComponent, shallowRef } from "vue"
import { useStore } from "vuex"
import AppFooter from "./AppFooter.vue"
import { T } from "#i18n"
import type { DataResource } from "@epicurrents/core/types"

export default defineComponent({
    name: 'DefaultFooter',
    components: {
        AppFooter, // This is loaded synchronously
    },
    setup () {
        const ID = 'DefaultFooter-' + useStore().state.APP.runningId++
        const RESOURCE = shallowRef(null as null | DataResource)
        // The open child is kept here and not read off the resource in the template: core sets it on the resource
        // itself, past the reactive proxy, so the change is heard through the resource's property event.
        const activeChild = shallowRef(null as null | DataResource)
        const unsubscribe = null as null | (() => void)
        return {
            ID,
            RESOURCE,
            activeChild,
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
            const active = this.$store.state.APP.activeDataset?.resources.find(
                r => r.resource.isActive
            )?.resource || null
            if (active?.id !== this.RESOURCE?.id) {
                this.RESOURCE?.unsubscribeAll(this.ID)
                this.RESOURCE = active
                active?.onPropertyChange('activeChildResource', this.readActiveChild, this.ID)
            }
            this.readActiveChild()
        },
        deactivateChild () {
            if (this.RESOURCE && this.activeChild) {
                this.$store.dispatch('set-active-child-resource', { child: null, parent: this.RESOURCE })
            }
        },
        readActiveChild () {
            this.activeChild = this.RESOURCE?.activeChildResource || null
        },
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
        this.RESOURCE?.unsubscribeAll(this.ID)
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
