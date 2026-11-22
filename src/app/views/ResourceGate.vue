<template>
    <slot v-if="isReady"></slot>
    <div v-else-if="isFailed" data-component="resource-gate" class="error">
        <app-icon class="inline" name="triangle-exclamation"></app-icon>
        {{ errorReason ? $t('Loading the resource failed: {reason}', { reason: $t(errorReason) })
                       : $t('Loading the resource failed.') }}
        <wa-button v-if="canRetry"
            appearance="filled-outlined"
            class="retry"
            size="s"
            @click="retry"
        >
            {{ $t('Try again') }}
        </wa-button>
    </div>
    <div v-else-if="isDestroyed" data-component="resource-gate" class="closed">
        {{ $t('This resource is no longer available.') }}
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
 * loading state, and the reason the resource gives if it fails. A failed dataset member is deactivated by the runtime
 * and leaves the view, so the failed state is what a resource still shown in `error` gets: one that stands in for a
 * failure, or one shown outside a dataset. Where the resource can be loaded again the state offers the retry, and the
 * gate goes back to the loading state as the retry starts, since it follows the resource's state. A resource that
 * becomes not ready again, such as one waiting on a dependency added after it loaded, takes the viewer down until it
 * is ready once more. A destroyed resource will never load, so it gets a state of its own with nothing in progress.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */
import { defineComponent, PropType, ref } from "vue"
import { T } from "#i18n"
import type { DataResource } from "@epicurrents/core/types"
import { Log } from "scoped-event-log"
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
        /** The resource failed and can be loaded again. */
        const canRetry = ref(false)
        const errorReason = ref('')
        const isDestroyed = ref(false)
        const isFailed = ref(false)
        const isReady = ref(false)
        return {
            ID,
            canRetry,
            errorReason,
            isDestroyed,
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
            this.isDestroyed = this.resource.state === 'destroyed'
            this.isFailed = this.resource.state === 'error'
            this.canRetry = this.isFailed && this.resource.canRetryLoad
            this.errorReason = this.isFailed ? this.resource.errorReason : ''
        },
        /**
         * Load the failed resource again. The outcome is read off the resource, which the gate follows: it shows the
         * loading state as the retry starts, and the viewer or the new reason once it settles.
         */
        retry () {
            this.resource.retryLoad().catch((error: unknown) => {
                Log.error(`Retrying the load of ${this.resource.name} failed: ${error}`, this.$options.name!)
            })
        },
        watchResource (resource: DataResource) {
            this.readState()
            if (resource.state === 'destroyed') {
                // A destroyed resource has given up its event bus and has nothing more to report.
                return
            }
            // The reason is followed on its own, since a resource may give it after it has entered the error state.
            resource.onPropertyChange(
                ['dependenciesReady', 'errorReason', 'isReady', 'state'], this.readState, this.ID
            )
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
.retry {
    margin-inline-start: 0.5rem;
}
</style>
