<template>
    <div data-component="spectrogram-settings">
        <label class="field">
            <span class="label">{{ $t('Epoch length') }}</span>
            <wa-input
                class="epoch-length"
                id="epicv-spectrogram-epoch-length"
                :min="1"
                :step="1"
                size="s"
                type="number"
                :value="String(localEpochLength)"
                @change="onEpochLengthChanged($event)"
            >
                <span slot="end">s</span>
            </wa-input>
        </label>
        <label class="field">
            <span class="label">{{ $t('Mode') }}</span>
            <div class="options">
                <button
                    :class="{ active: localMode === 'proportion' }"
                    @click="setMode('proportion')"
                >
                    {{ $t('Proportion') }}
                </button>
                <button
                    :class="{ active: localMode === 'power' }"
                    @click="setMode('power')"
                >
                    {{ $t('Power') }}
                </button>
            </div>
        </label>
        <label class="field">
            <span class="label">{{ $t('Reference') }}</span>
            <div class="options">
                <button
                    :class="{ active: !localAverageReference }"
                    @click="setAverageReference(false)"
                >
                    {{ $t('Derivation') }}
                </button>
                <button
                    :class="{ active: localAverageReference }"
                    @click="setAverageReference(true)"
                >
                    {{ $t('Average') }}
                </button>
            </div>
        </label>
        <p class="hint">{{ $t('Recompute after changes.') }}</p>
    </div>
</template>

<script lang="ts">
/**
 * Settings panel for the spectrogram trend.
 * Epoch length changes require a manual recompute to take effect.
 */
import { defineComponent } from 'vue'
import { T } from '#i18n'
import { useStore } from 'vuex'
import { useEegContext } from '../..'

const SCOPE = 'SpectrogramSettings'

export default defineComponent({
    name: 'SpectrogramSettings',
    setup () {
        return { ...useEegContext(useStore(), SCOPE) }
    },
    data () {
        return {
            localAverageReference: false as boolean,
            localEpochLength: 1 as number,
            localMode: 'proportion' as 'power' | 'proportion',
        }
    },
    methods: {
        $t (key: string) {
            return T(key, SCOPE)
        },
        onEpochLengthChanged (event: Event) {
            const raw = Number((event.target as HTMLInputElement).value)
            if (!Number.isFinite(raw) || raw <= 0) {
                return
            }
            this.localEpochLength = raw
            this.$store.dispatch('set-settings-value', {
                field: 'eeg.trends.spectrogram.epochLength',
                value: raw,
            })
        },
        setAverageReference (value: boolean) {
            this.localAverageReference = value
            this.$store.dispatch('set-settings-value', {
                field: 'eeg.trends.spectrogram.averageReference',
                value,
            })
        },
        setMode (m: 'power' | 'proportion') {
            this.localMode = m
            this.$store.dispatch('set-settings-value', {
                field: 'eeg.trends.spectrogram.mode',
                value: m,
            })
        },
    },
    beforeMount () {
        // Initialise local state from persisted settings so the buttons reflect
        // any value that was saved from a previous session.
        const s = (this.SETTINGS as Record<string, unknown> & {
            trends?: { spectrogram?: { averageReference?: boolean, epochLength?: number, mode?: string } }
        }).trends?.spectrogram
        this.localAverageReference = s?.averageReference ?? false
        this.localEpochLength      = s?.epochLength      ?? 1
        this.localMode             = (s?.mode as 'power' | 'proportion') ?? 'proportion'
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
})
</script>

<style scoped>
[data-component="spectrogram-settings"] {
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
    .options {
        display: flex;
        gap: 0.25rem;
    }
        .options button {
            background: none;
            border: 1px solid var(--wa-color-surface-border);
            border-radius: 0.25rem;
            color: var(--wa-color-text-quiet);
            cursor: pointer;
            font-size: 0.7rem;
            padding: 0.1rem 0.4rem;
        }
        .options button.active {
            background: var(--wa-color-brand-fill-loud);
            border-color: transparent;
            color: #fff;
        }
    .hint {
        flex-shrink: 0;
        font-style: italic;
        margin: 0;
        opacity: 0.65;
    }
</style>
