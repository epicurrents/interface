<template>
    <div data-component="ratio-settings">
        <label class="field">
            <span class="label with-info" id="epicv-ratio-epoch-label">
                {{ $t('Epoch') }}
            </span>
            <wa-tooltip for="epicv-ratio-epoch-label">
                {{ $t('The trend is computed in epochs.') }}<br />
                {{ $t('The epoch length is the duration of each epoch and controls the minimum frequency the trend can display.') }}<br />
                {{ $t('The epoch step is the time between the start of consecutive epochs and controls the temporal resolution of the trend.') }}
            </wa-tooltip>
            <wa-input
                class="epoch-length"
                id="epicv-ratio-epoch-length"
                :min="0"
                :placeholder="String(derivedEpochLength)"
                :step="1"
                size="s"
                type="number"
                :value="localEpochLength ? String(localEpochLength) : ''"
                @change="onEpochLengthChanged($event)"
            >
            </wa-input>
            <wa-tooltip for="epicv-ratio-epoch-length">{{ $t('Epoch length (s)') }}</wa-tooltip>
            /
            <epoch-step-field :epoch-length="effectiveEpochLength" trend="ratio"></epoch-step-field>
        </label>
        <label class="field">
            <span class="label">{{ $t('Limit') }}</span>
            <wa-checkbox
                :checked="localShowThreshold || undefined"
                id="epicv-ratio-show-threshold"
                size="s"
                @input="setShowThreshold($event.target.checked)"
            ></wa-checkbox>
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
            <span class="label">{{ $t('Fill') }}</span>
            <div class="options">
                <a
                    :class="{ active: !localShowFill }"
                    @click="setShowFill(false)"
                >
                    {{ $t('Off') }}
                </a>
                /
                <a
                    :class="{ active: localShowFill }"
                    @click="setShowFill(true)"
                >
                    {{ $t('On') }}
                </a>
            </div>
        </label>
        <label class="field">
            <span class="label">{{ $t('Mirror') }}</span>
            <div class="options">
                <a
                    :class="{ active: !localMirrorMode }"
                    @click="setMirrorMode(false)"
                >
                    {{ $t('Off') }}
                </a>
                /
                <a
                    :class="{ active: localMirrorMode }"
                    @click="setMirrorMode(true)"
                >
                    {{ $t('On') }}
                </a>
            </div>
        </label>
        <p class="hint">{{ $t('Empty scales the epoch with the recording. Recompute after changes.') }}</p>
    </div>
</template>

<script lang="ts">
/**
 * Settings panel for the ratio trend.
 * Threshold and mirror-mode changes take effect on the next render frame; epoch
 * length changes require a manual recompute since they alter the trend signal.
 */
import { resolveTrendEpochLength } from '@epicurrents/core/util'
import { defineComponent, ref } from 'vue'
import { T } from '#i18n'
import { useStore } from 'vuex'
import { useEegContext } from '../..'
import EpochStepField from '../EpochStepField.vue'

const SCOPE = 'RatioSettings'

export default defineComponent({
    name: 'RatioSettings',
    components: {
        EpochStepField,
    },
    setup () {
        const localEpochLength = ref(0)
        const localMirrorMode = ref(false)
        const localShowFill = ref(true)
        const localShowThreshold = ref(true)
        const localThreshold = ref(0.26)
        return {
            localEpochLength,
            localMirrorMode,
            localShowFill,
            localShowThreshold,
            localThreshold,
            ...useEegContext(useStore(), SCOPE),
        }
    },
    computed: {
        /** The epoch length the step applies to: the pinned one, or the derived one while unpinned. */
        effectiveEpochLength (): number {
            return this.localEpochLength || this.derivedEpochLength
        },
        /** The length the trend actually computes at, shown as the placeholder while unpinned. */
        derivedEpochLength (): number {
            return resolveTrendEpochLength(this.RESOURCE?.totalDuration ?? 0, this.SETTINGS.trends?.ratio)
        },
    },
    methods: {
        $t (key: string) {
            return T(key, SCOPE)
        },
        onEpochLengthChanged (event: Event) {
            // An emptied field asks for the length to scale with the recording again, which is what
            // a zero says in the settings; anything else is a length the user is pinning.
            const input = (event.target as HTMLInputElement).value.trim()
            const raw = input ? Number(input) : 0
            if (!Number.isFinite(raw) || raw < 0) {
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
        this.localEpochLength   = s?.epochLength   ?? 0
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
        padding: 0.25rem 0;
        width: 100%;
    }
        .field > .label {
            flex: 1 1 auto;
        }
        .field > wa-input {
            flex: 0 0 3.75rem;
            height: 2rem;
            max-width: 3.75rem;
        }
        .field > wa-input.threshold {
            flex: 0 0 4.25rem;
            max-width: 4.25rem;
        }
    .options {
        display: flex;
        gap: 0.25rem;
    }
        .options a {
            cursor: pointer;
        }
        .options a.active {
            font-weight: bold;
        }
    .hint {
        flex-shrink: 0;
        font-style: italic;
        margin: 0;
        opacity: 0.65;
    }
</style>
