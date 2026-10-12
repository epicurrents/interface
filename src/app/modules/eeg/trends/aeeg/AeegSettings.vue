<template>
    <div data-component="aeeg-settings" class="settings">
        <label class="field">
            <span class="label with-info" id="epicv-aeeg-epoch-label">
                {{ $t('Epoch') }}
            </span>
            <wa-tooltip for="epicv-aeeg-epoch-label">
                {{ $t('The trend is computed in epochs.') }}<br />
                {{ $t('The epoch length is the duration of each epoch and controls the minimum frequency the trend can display.') }}
            </wa-tooltip>
            <wa-input
                class="epoch-length"
                id="epicv-aeeg-epoch-length"
                :min="0"
                :placeholder="String(derivedEpochLength)"
                :step="1"
                size="s"
                type="number"
                :value="epochLength ? String(epochLength) : ''"
                @change="onEpochLengthChanged($event)"
            >
                <span slot="end">s</span>
            </wa-input>
            <wa-tooltip for="epicv-aeeg-epoch-length">{{ $t('Epoch length (s)') }}</wa-tooltip>
        </label>
        <label class="field">
            <wa-checkbox
                :checked="isSuperimposed || undefined"
                id="epicv-aeeg-superimpose"
                size="s"
                @input="onSuperimposeChanged($event)"
            >
                {{ $t('Superimpose') }}
            </wa-checkbox>
        </label>
        <p class="hint">
            <a @click="$emit('recompute')">{{ $t('Recompute') }}</a>
            {{ $t('after changes.') }}
        </p>
    </div>
</template>

<script lang="ts">
/**
 * Settings panel for the aEEG trend. Shown inside the trend strip's controls drawer when
 * `selectedTrend === 'aeeg'` and the cog is open.
 *
 * Display mode changes apply immediately (visual only). Epoch length changes are written to
 * the common biosignal trend settings but require a manual recompute via the chrome's
 * recompute button to take effect on the existing trends.
 */
import { resolveTrendEpochLength } from '@epicurrents/core/util'
import { defineComponent } from 'vue'
import { T } from '#i18n'
import { useStore } from 'vuex'
import { useEegContext } from '../..'

const SCOPE = 'AeegSettings'

export default defineComponent({
    name: 'AeegSettings',
    setup () {
        return {
            ...useEegContext(useStore(), SCOPE),
        }
    },
    computed: {
        isSuperimposed (): boolean {
            return this.SETTINGS.trends?.aeeg?.displayMode === 'superimposed'
        },
        /** The length the trend actually computes at, shown as the placeholder while unpinned. */
        derivedEpochLength (): number {
            return resolveTrendEpochLength(this.RESOURCE?.totalDuration ?? 0, this.SETTINGS.trends?.amplitude)
        },
        /** The pinned epoch length, or 0 while it is left to scale with the recording. */
        epochLength (): number {
            return this.SETTINGS.trends?.amplitude?.epochLength ?? 0
        },
    },
    methods: {
        $t (key: string, params: Record<string, unknown> = {}, capitalized = false) {
            return T(key, SCOPE, params, capitalized)
        },
        onSuperimposeChanged (event: Event) {
            const checked = (event.target as HTMLInputElement).checked
            this.$store.dispatch('set-settings-value', {
                field: 'eeg.trends.aeeg.displayMode',
                value: checked ? 'superimposed' : 'separate',
            })
        },
        onEpochLengthChanged (event: Event) {
            // An emptied field asks for the length to scale with the recording again, which is what
            // a zero says in the settings; anything else is a length the user is pinning.
            const input = (event.target as HTMLInputElement).value.trim()
            const raw = input ? Number(input) : 0
            if (!Number.isFinite(raw) || raw < 0) {
                return
            }
            this.$store.dispatch('set-settings-value', {
                field: 'eeg.trends.amplitude.epochLength',
                value: raw,
            })
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
})
</script>

<style scoped>
[data-component="aeeg-settings"] {
    box-sizing: border-box;
    padding: 0.25rem 0.5rem;
}
    .field {
        align-items: center;
        display: flex;
        flex: 1;
        gap: 0.5rem;
        justify-content: space-between;
        max-height: 2.5rem;
        min-height: 2rem;
        width: 100%;
    }
        .field > wa-input {
            flex: 0 0 4rem !important;
            max-width: 4rem !important;
        }
        [data-component="aeeg-settings"] wa-checkbox {
            flex-shrink: 0;
            font-size: 0.75rem;
            padding-top: 0;
        }
</style>
