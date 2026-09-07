<template>
    <div data-component="aeeg-settings">
        <label class="field">
            <span class="label">{{ $t('Epoch length') }}</span>
            <wa-input
                class="epoch-length"
                :id="`epicv-aeeg-epoch-length`"
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
        </label>
        <label class="field">
            <wa-switch
                :checked="isSuperimposed || undefined"
                id="epicv-aeeg-superimpose"
                size="s"
                @input="onSuperimposeChanged($event)"
            >
                {{ $t('Superimpose') }}
            </wa-switch>
        </label>
        <p class="hint">{{ $t('Empty scales the epoch with the recording. Recompute after changes.') }}</p>
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
import { resolveTrendEpochLength } from '@epicurrents/core/dist/util'
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
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    font-size: 0.75rem;
    gap: 0;
    min-height: 0;
    overflow: hidden;
    padding: 0.25rem 0.5rem;
    width: 100%;
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
        .field > .label {
            flex: 1 1 auto;
        }
        .field > wa-input {
            flex: 0 0 5rem;
            height: 2rem;
            max-width: 5rem;
        }
        [data-component="aeeg-settings"] wa-switch {
            flex-shrink: 0;
            padding-top: 0;
        }
    .hint {
        flex-shrink: 0;
        font-style: italic;
        margin: 0;
        opacity: 0.65;
    }
</style>
