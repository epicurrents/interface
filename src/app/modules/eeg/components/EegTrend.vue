<template>
    <div data-component="eeg-trend">
        <component v-if="rendererComponent"
            :is="rendererComponent"
            :controls-open="controlsOpen"
            :display-mode="displayMode"
            :height="height"
            :visible-range="visibleRange"
            :width="width"
            @navigation="$emit('navigation', $event)"
        />
        <div :class="{ controls: true, open: controlsOpen }">
            <div class="toggle">
                <wa-dropdown>
                    <app-icon
                        id="epicv-trend-controls-toggle"
                        name="settings"
                        :scale="controlsOpen ? null : 0.5"
                        slot="trigger"
                    ></app-icon>
                    <wa-dropdown-item @click="recomputeTrends">
                        <app-icon
                            name="arrows-rotate"
                            slot="icon"
                        ></app-icon>
                        {{ $t('Recompute') }}
                    </wa-dropdown-item>
                    <wa-dropdown-item @click="$emit('toggle-controls', !controlsOpen)">
                        <app-icon
                            :name="controlsOpen ? 'arrow-right-to-line' : 'arrow-left-to-line'"
                            slot="icon"
                        ></app-icon>
                        {{ controlsOpen ? $t('Hide options') : $t('Show options') }}
                    </wa-dropdown-item>
                </wa-dropdown>
                <wa-tooltip
                    for="epicv-trend-controls-toggle"
                    placement="left"
                >
                    {{ $t('Trend options') }}
                </wa-tooltip>
            </div>
            <div v-if="controlsOpen" class="panel">
                <component v-if="settingsComponent"
                    :is="settingsComponent"
                />
            </div>
        </div>
    </div>
</template>

<script lang="ts">
/**
 * EegTrend — chrome host for the trend strip.
 *
 * The strip itself is composed of two pluggable parts that swap when `selectedTrend` changes:
 *   - a **renderer** (e.g. `AeegRenderer`) that draws the labels, canvas and scale
 *   - a **settings panel** (e.g. `AeegSettings`) rendered inside the cog drawer
 *
 * Both are resolved from `TREND_REGISTRY` via the runtime's `selectedTrend` field. The chrome
 * keeps the trend-agnostic UX — cog toggle, recompute button — and forwards the `EegViewer`
 * layout props through to the renderer.
 *
 * The renderer is responsible for filtering trends by its supported `derivationType` (see
 * `useTrendController`), so this component doesn't need to know which trends exist on the
 * active montage.
 */
import { defineComponent, ref, type Component } from 'vue'
import { T } from '#i18n'
import { useEegContext } from '#app/modules/eeg'
import { useStore } from 'vuex'
import { TREND_REGISTRY } from '../trends'

export default defineComponent({
    name: 'EegTrend',
    props: {
        /** Whether the controls panel is open — owned by the parent to stay in sync with the
         *  navigator controls and survive the trend strip being hidden and reshown. */
        controlsOpen: {
            type: Boolean,
            required: true,
        },
        /**
         * Display mode for multi-trend layout. Overrides per-trend setting so the parent can
         * force `'superimposed'` mode when the available height drops below the threshold.
         */
        displayMode: {
            type: String as () => 'separate' | 'superimposed' | null,
            default: null,
        },
        height: {
            type: Number,
            required: true,
        },
        /** Length of the visible signal page in seconds — used by the renderer to size the
         *  view-position marker identically to the navigator's viewbox. */
        visibleRange: {
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
        // Local reactive mirror of `INTERFACE.modules.get('eeg').selectedTrend`. The runtime
        // field is exposed via a non-reactive getter, so Vue can't track changes through the
        // INTERFACE singleton — the value is refreshed on `eeg.set-selected-trend` and on
        // resource lifecycle events via subscribeAction (see mounted()).
        const readSelectedTrend = () =>
            (store.state.INTERFACE as { modules: Map<string, { selectedTrend?: string }> })
                .modules.get('eeg')?.selectedTrend || 'aeeg'
        const selectedTrend = ref(readSelectedTrend())
        return {
            readSelectedTrend,
            selectedTrend,
            ...useEegContext(store, 'EegTrend'),
        }
    },
    computed: {
        registryEntry () {
            return TREND_REGISTRY[this.selectedTrend] || null
        },
        rendererComponent (): Component | null {
            return this.registryEntry?.getRendererComponent() ?? null
        },
        settingsComponent (): Component | null {
            return this.registryEntry?.getSettingsComponent?.() ?? null
        },
    },
    methods: {
        $t (key: string, params = {}, capitalized = false) {
            return T(key, this.$options.name, params, capitalized)
        },
        /**
         * Re-run trend setup on the current active resource. Today only the aEEG hook is
         * wired — when additional trend types add their own setup methods, switch on
         * `selectedTrend` (or move the hook resolution into the registry entry).
         */
        recomputeTrends () {
            const resource = this.RESOURCE as unknown as {
                clearTrendTypes?: () => void
                ensureTrendSetup?: (type?: string) => void
                removeAllTrends?: () => void
            }
            const selectedTrend = (this.$store.state.INTERFACE as { modules?: Map<string, { selectedTrend?: string }> })
                .modules?.get('eeg')?.selectedTrend ?? 'aeeg'
            const trendType = TREND_REGISTRY[selectedTrend]?.derivationType ?? selectedTrend
            // Remove trend objects, then clear the enabled-types set so stale types
            // (e.g. 'spectrogram' when switching to 'amplitude') don't cause both
            // trend types to be built in the same setup pass.
            resource.removeAllTrends?.()
            resource.clearTrendTypes?.()
            resource.ensureTrendSetup?.(trendType)
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this._unsubscribe = this.$store.subscribeAction({
            after: (action) => {
                if (action.type === 'eeg.set-selected-trend') {
                    this.selectedTrend = this.readSelectedTrend()
                    // Auto-recompute immediately when the strip is visible so the
                    // user never has to hit Recompute after changing the trend type.
                    const trendVisible = (this.$store.state.INTERFACE as {
                        modules?: Map<string, { trendVisible?: boolean }>
                    }).modules?.get('eeg')?.trendVisible
                    if (trendVisible) {
                        this.recomputeTrends()
                    }
                }
            },
        })
    },
    beforeUnmount () {
        this._unsubscribe?.()
    },
    data () {
        return {
            _unsubscribe: null as null | (() => void),
        }
    },
})
</script>

<style scoped>
[data-component="eeg-trend"] {
    box-sizing: border-box;
    display: flex;
    height: 100%;
    position: relative;
    width: 100%;
}
/* Trend controls drawer.
   Closed: 20 px wide, only the cog icon visible at the strip's right edge.
   Open:   200 px wide, settings panel visible alongside the cog. The renderer reads
   `controlsOpen` and reserves matching right-side width so its canvas's right edge stays
   aligned with the navigator's when both controls panels are open. */
.controls {
    align-items: end;
    bottom: 0;
    display: flex;
    flex: 0 0 20px;
    height: 100%;
    max-width: 200px;
    padding: 0 1rem;
    position: absolute;
    right: 0;
}
    .controls:not(.open) > *:not(.toggle) {
        display: none;
    }
    .controls.open {
        flex: 0 0 200px;
        overflow: hidden;
    }
    .controls > .toggle {
        cursor: pointer;
        flex: 0 0 20px;
        line-height: 1;
        position: absolute;
        right: 0.1rem;
        text-align: center;
        top: 0.1rem;
    }
    .controls:not(.open) > .toggle {
        opacity: 0.5;
    }
    .controls > .panel {
        box-sizing: border-box;
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        gap: 0.5rem;
        height: 100%;
        padding-top: 0.25rem;
        width: 100%;
    }
</style>
