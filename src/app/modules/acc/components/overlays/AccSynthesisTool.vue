<template>
    <div data-component="acc-synthesis-tool">
        <template v-if="activeSignal">
            <div class="control-panel">
                <div class="channel">{{ activeSelection?.channel?.label }}</div>
                <div class="controls">
                    <wa-button
                        appearance="filled"
                        class="play-button"
                        size="l"
                        :title="playing ? $t('Pause') : $t('Play')"
                        variant="brand"
                        @click="togglePlay"
                    >
                        <app-icon :name="playing ? 'pause' : 'play'"></app-icon>
                    </wa-button>
                    <div class="info">
                        <wa-input
                            class="speed"
                            :max="speedMax"
                            :min="speedMin"
                            :step="speedStep"
                            type="number"
                            v-property="'speedUp'"
                            @input="onSpeedInput"
                        >
                            <span slot="start">×</span>
                        </wa-input>
                    </div>
                </div>
                <div class="hint">{{ $t('Adjust speed between {min}-{max}', { min: speedMin, max: speedMax }) }}</div>
            </div>
            <svg v-if="waveformPoints"
                class="waveform"
                preserveAspectRatio="none"
                viewBox="0 0 600 100"
            >
                <polyline
                    fill="none"
                    :points="waveformPoints"
                    :stroke="waveformColor"
                    stroke-width="1"
                ></polyline>
            </svg>
        </template>
        <div v-else class="empty">{{ $t('Select a signal segment to hear its spectral tone.') }}</div>
    </div>
</template>

<script lang="ts">
/**
 * Plays a steady spectral tone synthesised from the active plot selection's
 * signal, alongside the FFT spectrum in the ACC analysis window. A stable
 * tremor (single dominant peak) sounds as a pure tone whose pitch tracks the
 * tremor frequency; a jittery one (several prominent peaks) stacks into a
 * dissonant cluster. The Speed control sets the fixed frequency multiplier
 * (peak × N) that lifts the sub-audible tremor into hearing range.
 *
 * The selection's samples are already held by the analysis window, so the tone
 * is synthesised straight off them (no worker round-trip); the rendered buffer
 * is both drawn as a waveform preview and handed to the recording's shared
 * audio player for looping playback.
 */
import { defineComponent, ref, shallowRef, type PropType } from "vue"
import { T } from "#i18n"
import { settingsColorToRgba } from "@epicurrents/core/util"
import type { PlotTraceSelection } from "#types/plot"
import { useStore } from "vuex"
import { useAccContext } from "../.."

// The tone is rendered once at this multiplier; the Speed control then shifts
// pitch via the source's playback rate (speed / BASE_SPEEDUP), so changing it
// is gap-free — no re-render, no restart.
const BASE_SPEEDUP = 20
// Speed-multiplier bounds for the number input; a typed out-of-range value is
// clamped here so playback stays in range even past the spinner limits.
const SPEED_MIN = 20
const SPEED_MAX = 50
const SPEED_STEP = 5
// Waveform preview geometry: a short window so a few periods stay legible; the
// SVG viewBox scales to fill whatever width the controls leave.
const WAVEFORM_SECONDS = 0.05
const VIEW_W = 600
const VIEW_H = 100

export default defineComponent({
    name: 'AccSynthesisTool',
    props: {
        data: {
            type: Array as PropType<PlotTraceSelection[]>,
            required: true,
        },
        height: {
            type: Number,
            required: true,
        },
        selected: {
            type: Number,
            required: true,
        },
        width: {
            type: Number,
            required: true,
        },
    },
    setup () {
        const store = useStore()
        const playing = ref(false)
        // Fixed frequency multiplier: pitch tracks tremor frequency (slow lower,
        // fast higher) and prominent peaks stack into a dissonant cluster.
        const speedUp = ref(BASE_SPEEDUP)
        // shallowRef so the native AudioBuffer is stored as-is (a deep reactive
        // proxy would break getChannelData).
        const buffer = shallowRef<AudioBuffer | null>(null)
        const waveformPoints = ref('')
        return {
            buffer,
            playing,
            speedMax: SPEED_MAX,
            speedMin: SPEED_MIN,
            speedStep: SPEED_STEP,
            speedUp,
            waveformPoints,
            settingsColorToRgba,
            ...useAccContext(store, 'AccSynthesisTool'),
        }
    },
    computed: {
        activeSelection (): PlotTraceSelection | null {
            return this.data[this.selected] ?? null
        },
        activeSignal (): { data: Float32Array, samplingRate: number } | null {
            return this.activeSelection?.signal ?? null
        },
        waveformColor (): string {
            const signals = this.SETTINGS.tools.signals
            return settingsColorToRgba(signals[this.selected]?.color ?? signals[0].color)
        },
    },
    watch: {
        data () {
            this.refresh()
        },
        selected () {
            this.refresh()
        },
    },
    methods: {
        $t: function (key: string, params = {}, capitalized = false) {
            return T(key, this.$options.name, params, capitalized)
        },
        drawWaveform () {
            const buffer = this.buffer
            if (!buffer) {
                this.waveformPoints = ''
                return
            }
            const data = buffer.getChannelData(0)
            // Window proportional to the playback rate so the drawn cycles match
            // the heard pitch (faster → more cycles in view).
            const rate = this.speedUp/BASE_SPEEDUP
            const windowSamples = Math.min(data.length, Math.round(buffer.sampleRate*WAVEFORM_SECONDS*rate))
            if (windowSamples < 2) {
                this.waveformPoints = ''
                return
            }
            const points = [] as string[]
            for (let x=0; x<=VIEW_W; x++) {
                const i = Math.min(windowSamples - 1, Math.round((x/VIEW_W)*(windowSamples - 1)))
                const v = Math.max(-1, Math.min(1, data[i]))
                points.push(`${x},${((VIEW_H/2)*(1 - v)).toFixed(1)}`)
            }
            this.waveformPoints = points.join(' ')
        },
        onSpeedInput (event: Event) {
            const raw = (event.target as HTMLInputElement).value
            if (!raw.length) {
                // Let the field be cleared before a new value is typed.
                return
            }
            const value = Math.min(SPEED_MAX, Math.max(SPEED_MIN, Number(raw)))
            if (!Number.isFinite(value)) {
                return
            }
            this.speedUp = value
            // Pitch is the source playback rate, so it shifts live with no
            // re-render or restart; redraw the preview to match.
            this.RESOURCE.setAudioPlaybackRate(value/BASE_SPEEDUP)
            this.drawWaveform()
        },
        async play () {
            if (!this.buffer) {
                await this.synthesize()
            }
            if (!this.buffer) {
                return
            }
            this.RESOURCE.setAudioPlaybackRate(this.speedUp/BASE_SPEEDUP)
            this.playing = await this.RESOURCE.playBuffer(this.buffer)
        },
        refresh () {
            // A new active segment retires the running tone and re-renders the
            // preview; the user replays the new one explicitly.
            this.stopIfPlaying()
            this.synthesize()
        },
        stopIfPlaying () {
            if (this.playing) {
                this.RESOURCE.pauseAudio()
                this.playing = false
            }
        },
        async synthesize () {
            const signal = this.activeSignal
            if (!signal?.data?.length) {
                this.buffer = null
                this.waveformPoints = ''
                return
            }
            this.buffer = await this.RESOURCE.synthesizeSegment(
                signal.data, signal.samplingRate, BASE_SPEEDUP,
            )
            this.drawWaveform()
        },
        togglePlay () {
            if (this.playing) {
                this.RESOURCE.pauseAudio()
                this.playing = false
                return
            }
            this.play()
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this.synthesize()
        // Mirror the shared audio player: anything that stops playback (a pause
        // from the controls bar, the stethoscope taking over, the buffer ending)
        // clears the button.
        this.RESOURCE.onPropertyChange('isAudioPlaying', () => {
            if (!this.RESOURCE.isAudioPlaying) {
                this.playing = false
            }
        }, this.ID)
    },
    beforeUnmount () {
        this.stopIfPlaying()
        this.RESOURCE.removeAllEventListeners(this.ID)
    },
})
</script>

<style scoped>
[data-component="acc-synthesis-tool"] {
    display: flex;
    align-items: stretch;
    gap: 1rem;
    overflow: hidden;
    flex: 1 1 0px;
}
    .control-panel {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        flex: 0 0 auto;
    }
    .controls {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex: 0 0 auto;
    }
    .play-button {
        flex: 0 0 auto;
    }
    .channel {
        font-weight: 600;
    }
    .info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
        .info .speed {
            width: 5.5rem;
        }
    .hint {
        color: var(--epicv-text-faint, var(--epicv-text-main));
        font-size: 0.8rem;
        white-space: nowrap;
    }
    .waveform {
        flex: 1 1 0;
        min-width: 0;
        border: solid 1px var(--epicv-border-faint);
    }
    .empty {
        color: var(--epicv-text-faint, var(--epicv-text-main));
        font-size: 0.9rem;
    }
</style>
