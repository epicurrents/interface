<template>
    <wa-input data-component="epoch-step-field"
        :id="`epicv-${trend}-epoch-step`"
        :min="0"
        :placeholder="epochLength ? String(epochLength) : ''"
        size="s"
        step="0.5"
        type="number"
        :value="localStep ? String(localStep) : ''"
        @change="onStepChanged($event)"
        @keydown.stop=""
        @keyup.stop=""
    >
    </wa-input>
    <wa-tooltip :for="`epicv-${trend}-epoch-step`"
    >{{ $t('Epoch step (s)') }}</wa-tooltip>
</template>

<script lang="ts">
/**
 * Epoch step field shared by the trend settings panels whose trends support overlapping epochs.
 *
 * Writes `eeg.trends.<trend>.epochStep`. The stored value follows {@link normaliseEpochStep}: an emptied field, a zero
 * and a step at or above the epoch length all store `0`, no overlap, and the field then shows the epoch length as its
 * placeholder, which is the step in effect. A change of the epoch length that leaves the step at or above it resets
 * the step the same way. Like the epoch length, a change takes effect on the next recompute.
 */
import { defineComponent, ref, type PropType } from 'vue'
import { T } from '#i18n'
import { useStore } from 'vuex'
import { useEegContext } from '..'
import { EPOCH_STEP_PRESETS, normaliseEpochStep } from './epochStep'

const SCOPE = 'EpochStepField'

export default defineComponent({
    name: 'EpochStepField',
    props: {
        /** Epoch length in effect in seconds, pinned or derived; `0` when unknown. */
        epochLength: {
            type: Number,
            required: true,
        },
        /** Key of the trend settings the step belongs to. */
        trend: {
            type: String as PropType<'pdbsi' | 'ratio' | 'spectrogram'>,
            required: true,
        },
    },
    setup () {
        const localStep = ref(0)
        return {
            localStep,
            ...useEegContext(useStore(), SCOPE),
        }
    },
    computed: {
        presets (): number[] {
            return EPOCH_STEP_PRESETS.filter(preset => !this.epochLength || preset < this.epochLength)
        },
    },
    watch: {
        epochLength (length: number) {
            const step = normaliseEpochStep(this.localStep, length)
            if (step !== this.localStep) {
                this.setStep(step)
            }
        },
    },
    methods: {
        $t (key: string) {
            return T(key, SCOPE)
        },
        onStepChanged (event: Event) {
            const field = event.target as HTMLInputElement
            this.setStep(normaliseEpochStep(field.value, this.epochLength))
            // Shown as stored even when the value did not change, so a corrected entry does not linger in the field.
            field.value = this.localStep ? String(this.localStep) : ''
        },
        setStep (step: number) {
            this.localStep = step
            this.$store.dispatch('set-settings-value', {
                field: `eeg.trends.${this.trend}.epochStep`,
                value: step,
            })
        },
    },
    beforeMount () {
        this.localStep = normaliseEpochStep(this.SETTINGS.trends?.[this.trend]?.epochStep ?? 0, this.epochLength)
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
})
</script>

<style scoped>
[data-component="epoch-step-field"] {
    flex: 0 0 3.75rem;
    height: 2rem;
    max-width: 3.75rem;
}
</style>
