<template>
    <div data-component="eeg-trend">
        <component v-if="rendererComponent"
            :is="rendererComponent"
            :controls-open="isControlsOpen"
            :display-mode="displayMode"
            :height="height"
            :visible-range="visibleRange"
            :width="width"
        />
        <div :class="{ controls: true, open: isControlsOpen }">
            <div class="toggle">
                <app-icon
                    id="epicv-trend-controls-toggle"
                    name="settings"
                    @click="toggleControls"
                ></app-icon>
                <wa-tooltip
                    for="epicv-trend-controls-toggle"
                    placement="left"
                >
                    {{ isControlsOpen ? $t('Hide trend controls') : $t('Show trend controls') }}
                </wa-tooltip>
            </div>
            <div v-if="isControlsOpen" class="panel">
                <component v-if="settingsComponent" :is="settingsComponent" />
                <wa-button
                    appearance="plain"
                    id="epicv-trend-recompute"
                    size="small"
                    variant="brand"
                    @click="recomputeTrends"
                >
                    <app-icon name="arrows-rotate"></app-icon>
                    {{ $t('Recompute') }}
                </wa-button>
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
        // Controls drawer state. Closed by default; opening reserves additional right-side
        // width via the renderer's `controlsOpen` prop so the trend canvas's right edge stays
        // aligned with the navigator's when both controls panels are open.
        const isControlsOpen = ref(false)
        // Local reactive mirror of `INTERFACE.modules.get('eeg').selectedTrend`. The runtime
        // field is exposed via a non-reactive getter, so Vue can't track changes through the
        // INTERFACE singleton — the value is refreshed on `eeg.set-selected-trend` and on
        // resource lifecycle events via subscribeAction (see mounted()).
        const readSelectedTrend = () =>
            (store.state.INTERFACE as { modules: Map<string, { selectedTrend?: string }> })
                .modules.get('eeg')?.selectedTrend || 'aeeg'
        const selectedTrend = ref(readSelectedTrend())
        return {
            isControlsOpen,
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
            return this.registryEntry?.getSettingsComponent() ?? null
        },
    },
    methods: {
        $t (key: string, params = {}, capitalized = false) {
            return T(key, this.$options.name, params, capitalized)
        },
        toggleControls () {
            this.isControlsOpen = !this.isControlsOpen
        },
        /**
         * Re-run trend setup on the current active resource. Today only the aEEG hook is
         * wired — when additional trend types add their own setup methods, switch on
         * `selectedTrend` (or move the hook resolution into the registry entry).
         */
        recomputeTrends () {
            const resource = this.RESOURCE as unknown as { ensureAeegTrendSetup?: () => void }
            resource.ensureAeegTrendSetup?.()
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
        overflow: visible;
    }
    .controls > .toggle {
        cursor: pointer;
        flex: 0 0 20px;
        font-size: 0.625rem;
        line-height: 1;
        position: absolute;
        right: 0.1rem;
        text-align: center;
        top: 0.1rem;
    }
    .controls > .panel {
        box-sizing: border-box;
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        gap: 0.5rem;
        height: 100%;
        padding: 1.5rem 0 0.5rem 0;
        width: 100%;
    }
</style>
