<template>
    <div data-component="ratio-settings">
        <label class="field">
            <span class="label">{{ $t('Epoch length') }}</span>
            <wa-input
                class="epoch-length"
                id="epicv-ratio-epoch-length"
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
            <span class="label">{{ $t('Threshold') }}</span>
            <wa-input
                class="threshold"
                id="epicv-ratio-threshold"
                :min="-1"
                :max="1"
                :step="0.01"
                size="s"
                type="number"
                :value="String(localThreshold)"
                @change="onThresholdChanged($event)"
            ></wa-input>
        </label>
        <label class="field">
            <span class="label">{{ $t('Show threshold') }}</span>
            <div class="options">
                <button
                    :class="{ active: !localShowThreshold }"
                    @click="setShowThreshold(false)"
                >
                    {{ $t('Off') }}
                </button>
                <button
                    :class="{ active: localShowThreshold }"
                    @click="setShowThreshold(true)"
                >
                    {{ $t('On') }}
                </button>
            </div>
        </label>
        <label class="field">
            <span class="label">{{ $t('Show fill') }}</span>
            <div class="options">
                <button
                    :class="{ active: !localShowFill }"
                    @click="setShowFill(false)"
                >
                    {{ $t('Off') }}
                </button>
                <button
                    :class="{ active: localShowFill }"
                    @click="setShowFill(true)"
                >
                    {{ $t('On') }}
                </button>
            </div>
        </label>
        <label class="field">
            <span class="label">{{ $t('Mirror right') }}</span>
            <div class="options">
                <button
                    :class="{ active: !localMirrorMode }"
                    @click="setMirrorMode(false)"
                >
                    {{ $t('Off') }}
                </button>
                <button
                    :class="{ active: localMirrorMode }"
                    @click="setMirrorMode(true)"
                >
                    {{ $t('On') }}
                </button>
            </div>
        </label>
        <p class="hint">{{ $t('Epoch length changes require Recompute.') }}</p>
    </div>
</template>

<script lang="ts">
/**
 * Settings panel for the ratio trend.
 * Threshold and mirror-mode changes take effect on the next render frame; epoch
 * length changes require a manual recompute since they alter the trend signal.
 */
import { defineComponent } from 'vue'
import { T } from '#i18n'
import { useStore } from 'vuex'
import { useEegContext } from '../..'

const SCOPE = 'RatioSettings'

export default defineComponent({
    name: 'RatioSettings',
    setup () {
        return { ...useEegContext(useStore(), SCOPE) }
    },
    data () {
        return {
            localEpochLength:   2 as number,
            localThreshold:     0.26 as number,
            localShowThreshold: true as boolean,
            localShowFill:      true as boolean,
            localMirrorMode:    false as boolean,
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
                field: 'eeg.trends.ratio.epochLength',
                value: raw,
            })
        },
        onThresholdChanged (event: Event) {
            const raw = Number((event.target as HTMLInputElement).value)
            if (!Number.isFinite(raw)) {
                return
            }
            // Normalised ratio output lives on [-1, +1].
            const clamped = Math.min(1, Math.max(-1, raw))
            this.localThreshold = clamped
            this.$store.dispatch('set-settings-value', {
                field: 'eeg.trends.ratio.threshold',
                value: clamped,
            })
        },
        setShowThreshold (value: boolean) {
            this.localShowThreshold = value
            this.$store.dispatch('set-settings-value', {
                field: 'eeg.trends.ratio.showThreshold',
                value,
            })
        },
        setShowFill (value: boolean) {
            this.localShowFill = value
            this.$store.dispatch('set-settings-value', {
                field: 'eeg.trends.ratio.showFill',
                value,
            })
        },
        setMirrorMode (value: boolean) {
            this.localMirrorMode = value
            this.$store.dispatch('set-settings-value', {
                field: 'eeg.trends.ratio.mirrorMode',
                value,
            })
        },
    },
    beforeMount () {
        const s = (this.SETTINGS as Record<string, unknown> & {
            trends?: { ratio?: {
                epochLength?: number, threshold?: number,
                showThreshold?: boolean, showFill?: boolean, mirrorMode?: boolean,
            } }
        }).trends?.ratio
        this.localEpochLength   = s?.epochLength   ?? 2
        this.localThreshold     = s?.threshold     ?? 0.26
        this.localShowThreshold = s?.showThreshold !== false
        this.localShowFill      = s?.showFill      !== false
        this.localMirrorMode    = !!s?.mirrorMode
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
})
</script>

<style scoped>
[data-component="ratio-settings"] {
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
