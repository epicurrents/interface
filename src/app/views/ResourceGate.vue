<template>
    <slot v-if="isReady"></slot>
    <div v-else-if="isFailed" data-component="resource-gate" class="error">
        <app-icon class="inline" name="triangle-exclamation"></app-icon>
        {{ errorReason ? $t('Loading the resource failed: {reason}', { reason: $t(errorReason) })
                       : $t('Loading the resource failed.') }}
    </div>
    <div v-else data-component="resource-gate" class="loading">
        <wa-spinner class="inline"></wa-spinner>
        {{ $t('Loading resource') }}
    </div>
</template>

<script lang="ts">
/**
 * Holds a modality viewer back until its resource is ready.
 *
 * A resource may be activated before it has loaded: a listed study loads on its first activation, and a resource read
 * from a file is still setting up when it is first shown. The viewer is mounted only once the resource reports
 * `isReady`, so it never reads a recording that has no channels, service or cache yet; until then the slot shows one
 * loading state, and the reason the resource gives if it fails. A resource that becomes not ready again, such as one
 * waiting on a dependency added after it loaded, takes the viewer down until it is ready once more.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import { defineComponent, PropType, ref } from "vue"
import { T } from "#i18n"
import type { DataResource } from "@epicurrents/core/types"
import { useStore } from "vuex"

export default defineComponent({
    name: 'ResourceGate',
    props: {
        resource: {
            type: Object as PropType<DataResource>,
            required: true,
        },
    },
    setup () {
        const ID = 'ResourceGate-' + useStore().state.APP.runningId++
        const errorReason = ref('')
        const isFailed = ref(false)
        const isReady = ref(false)
        return {
            ID,
            errorReason,
            isFailed,
            isReady,
        }
    },
    watch: {
        resource (next: DataResource, previous: DataResource) {
            previous.unsubscribeAll(this.ID)
            this.watchResource(next)
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
        readState () {
            this.isReady = this.resource.isReady
            this.isFailed = this.resource.state === 'error'
            this.errorReason = this.isFailed ? this.resource.errorReason : ''
        },
        watchResource (resource: DataResource) {
            resource.onPropertyChange(['dependenciesReady', 'isReady', 'state'], this.readState, this.ID)
            this.readState()
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this.watchResource(this.resource)
    },
    beforeUnmount () {
        this.resource.unsubscribeAll(this.ID)
    },
})
</script>

<style scoped>
[data-component="resource-gate"] {
    color: var(--epicv-text-faint);
    padding: 0.75rem 1rem;
}
</style>
