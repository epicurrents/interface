<template>
    <div data-component="acc-analysis-tools" ref="wrapper">
        <wa-tab-group ref="tabgroup" @wa-tab-show="switchTab">
            <template v-for="(tab, _idx) in tabs" :key="`top-tab-${_idx}`">
                <wa-tab v-if="shouldShowTab(tab)"
                    :panel="tab.code"
                    slot="nav"
                >
                    {{ $t(tab.label) }}
                </wa-tab>
            </template>
            <wa-tab-panel name="examine">
                <template v-if="shouldShowPanel('examine')">
                    <examine-tool
                        :cmPerSec="cmPerSec"
                        :data="compareSelections"
                        :height="topPanelHeight"
                        :selected="activeIdx"
                        :width="panelWidth"
                    />
                    <div class="subtitle">
                        <div>{{ $t(`Crop signal`) }}</div>
                    </div>
                    <signal-crop-tool
                        :data="compareSelections"
                        :height="bottomPanelHeight"
                        :selected="activeIdx"
                        :width="panelWidth"
                    />
                </template>
            </wa-tab-panel>
            <wa-tab-panel name="fft">
                <template v-if="shouldShowPanel('fft')">
                    <fft-tool
                        :data="compareSelections"
                        :height="topPanelHeight"
                        :max-frequency="20"
                        :peak-count="5"
                        :selected="activeIdx"
                        :width="panelWidth"
                    />
                    <div class="subtitle">
                        <div>{{ $t(`Sound`) }}</div>
                    </div>
                    <acc-synthesis-tool
                        :data="compareSelections"
                        :height="bottomPanelHeight"
                        :selected="activeIdx"
                        :width="panelWidth"
                    />
                </template>
            </wa-tab-panel>
        </wa-tab-group>
        <div v-if="showLegend" ref="legend" class="legend">
            <template v-for="(selection, idx) in compareSelections" :key="`signal-tool-legend-${idx}`">
                <div v-if="selection.channel"
                    :class="[
                        { 'epicv-inactive': idx !== activeIdx },
                        { 'clickable': idx !== activeIdx },
                    ]"
                    @click="selectSignal(idx)"
                >
                    <span
                        class="color"
                        :style="
                            `border-color: ${settingsColorToRgba(SETTINGS.tools.signals[idx].color)};` +
                            `background-color: ${idx !== activeIdx ? 'none' : settingsColorToRgba(SETTINGS.tools.signals[idx].color, 0.1)};`
                        "
                    ></span>
                    {{ selection.channel.label }}
                </div>
            </template>
        </div>
    </div>
</template>

<script lang="ts">
import {
    defineComponent,
    reactive,
    ref,
    type Ref,
    type PropType
} from "vue"
import { T } from "#i18n"
import { settingsColorToRgba } from "@epicurrents/core/util"
import { type PlotTraceSelection } from "#types/plot"
import { useStore } from "vuex"
import { useAccContext } from "../.."
import type { default as WaTabGroup } from '@awesome.me/webawesome/dist/components/tab-group/tab-group.js'

import AccSynthesisTool from './AccSynthesisTool.vue'
import ExamineTool from '#app/views/biosignal/tools/ExamineTool.vue'
import FftTool from '#app/views/biosignal/tools/FftTool.vue'
import SignalCropTool from '#app/views/biosignal/tools/SignalCropTool.vue'
import { PlotSelection } from '#app/views/biosignal/types'

const MAX_COMPARE_SELECTIONS = 3

type AnalysisTraceSelections = Required<PlotTraceSelection>
type PanelTabProps = {
    code: string
    label: string
    requireChannel: boolean
    requireSignal: boolean
    showLegend: boolean
}

export default defineComponent({
    name: 'AccAnalysisTools',
    props: {
        cmPerSec: {
            type: Number,
            required: true,
        },
        cursorPos: {
            type: Number,
            required: true,
        },
        left: {
            type: Number,
            default: 0,
        },
        selectedIdx: {
            type: Number,
            default: 0,
        },
        selections: {
            type: Object as PropType<PlotSelection[]>,
            default: [],
        },
        tab: {
            type: String,
            default: 'fft',
        },
        top: {
            type: Number,
            default: 0,
        },
    },
    components: {
        AccSynthesisTool,
        ExamineTool,
        FftTool,
        SignalCropTool,
    },
    setup (props) {
        const store = useStore()
        const activeIdx = ref(Math.min(props.selectedIdx, MAX_COMPARE_SELECTIONS - 1))
        const activeTab = ref('')
        const tabs = reactive([
            { code: 'fft', label: 'FFT', requireChannel: true, requireSignal: true, showLegend: true },
            { code: 'examine', label: 'Examine', requireChannel: true, requireSignal: true, showLegend: true },
        ] as PanelTabProps[])
        const bottomPanelHeight = ref(0)
        const panelHeight = ref(0)
        const panelWidth = ref(0)
        const rso = null as null | ResizeObserver
        const showLegend = ref(false)
        const topPanelHeight = ref(0)
        const legend = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const tabgroup = ref<WaTabGroup>() as Ref<WaTabGroup>
        const wrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            activeIdx,
            activeTab,
            bottomPanelHeight,
            legend,
            panelHeight,
            panelWidth,
            rso,
            showLegend,
            tabgroup,
            tabs,
            topPanelHeight,
            wrapper,
            settingsColorToRgba,
            ...useAccContext(store, 'AccAnalysisTools'),
        }
    },
    computed: {
        compareSelections (): AnalysisTraceSelections[] {
            const selectionsWithChannel = this.selections.filter(s => s.channel) as AnalysisTraceSelections[]
            const showChannels = [] as AnalysisTraceSelections[]
            let activeIncluded = this.selectedIdx < MAX_COMPARE_SELECTIONS
            for (const selection of selectionsWithChannel) {
                if (activeIncluded || showChannels.length < MAX_COMPARE_SELECTIONS - 1) {
                    showChannels.push(selection)
                } else if (showChannels.length === MAX_COMPARE_SELECTIONS - 1) {
                    showChannels.push(selectionsWithChannel[this.selectedIdx])
                }
                if (showChannels.length >= MAX_COMPARE_SELECTIONS) {
                    break
                }
            }
            return showChannels
        },
        isVisible (): boolean {
            return (this.panelWidth > 0) && (this.panelHeight > 0)
        },
    },
    methods: {
        $t: function (key: string, params = {}, capitalized = false) {
            return T(key, this.$options.name, params, capitalized)
        },
        resize () {
            if (!this.wrapper) {
                return
            }
            this.panelWidth = this.wrapper.offsetWidth
            const tabRow = this.wrapper.querySelector('wa-tab-group')?.shadowRoot?.querySelector('div[part=tabs]') as HTMLElement
            const panels = this.wrapper.querySelectorAll('wa-tab-panel') as NodeListOf<HTMLElement>
            this.panelHeight = this.wrapper.offsetHeight - (tabRow?.offsetHeight || 0)
            for (const panel of panels) {
                const base = panel.shadowRoot?.querySelector('.tab-panel')
                if (base) {
                    (base as HTMLElement).style.height = `${this.panelHeight}px`
                }
            }
            const splitContentHeight = this.panelHeight - 45 - 10
            this.topPanelHeight = splitContentHeight*0.75
            this.bottomPanelHeight = splitContentHeight*0.25
        },
        selectSignal (idx: number) {
            if (idx < 0 || idx >= this.compareSelections.length) {
                return
            }
            this.activeIdx = idx
        },
        shouldShowPanel (tab: string) {
            if (!this.isVisible) {
                return false
            }
            if (this.activeTab !== tab) {
                return false
            }
            const tabProps = this.tabs.filter(t => t.code === tab)[0]
            if (!tabProps) {
                return false
            }
            return this.shouldShowTab(tabProps)
        },
        shouldShowTab (tab: PanelTabProps) {
            if (tab.requireChannel) {
                if (!this.selections.length || !this.selections[this.activeIdx]?.channel) {
                    return false
                }
            }
            if (tab.requireSignal && !this.selections[this.activeIdx]?.signal) {
                return false
            }
            return true
        },
        switchTab (event: CustomEvent) {
            const { name } = event.detail
            const tabProps = this.tabs.filter(t => t.code === name)[0]
            if (!tabProps) {
                return
            }
            this.activeTab = name
            this.showLegend = tabProps.showLegend
        },
    },
    beforeMount () {
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        this.rso = new ResizeObserver(this.resize)
        this.rso.observe(this.wrapper)
        this.resize()
        this.tabgroup.updateComplete.then(() => {
            this.tabgroup.active = this.tab
            this.activeTab = this.tab
            this.showLegend = this.tabs.filter(t => t.code === this.tab)[0].showLegend
        })
    },
})
</script>

<style scoped>
[data-component="acc-analysis-tools"] {
    position: relative;
    width: 100%;
    height: 525px;
    overflow: hidden;
}
    [data-component="acc-analysis-tools"] wa-tab-panel::part(base) {
        display: flex;
        flex-direction: column;
        padding: 10px 0 0;
    }
    [data-component="acc-analysis-tools"] wa-tab::part(base) {
        height: 0px;
        padding: 1rem 1rem 1rem 0.25rem;
    }
    .subtitle {
        flex: 0 0 3rem;
        line-height: 1.5rem;
        margin: 0;
        padding: 10px 0;
        font-variant: small-caps;
        overflow: hidden;
    }
        .subtitle > div {
            width: 100%;
            border-bottom: 1px solid var(--epicv-border);
        }
    .legend {
        position: absolute;
        top: 0.25rem;
        right: 0;
        height: 2rem;
        margin-left: 1rem;
        font-size: 0.9rem;
        text-align: right;
    }
        .legend > div {
            display: inline-block;
            height: 1rem;
            margin: 0.5rem 0 0.5rem 0.6rem;
            line-height: 16px;
        }
        .legend > .clickable {
            cursor: pointer;
        }
        .legend .color {
            position: relative;
            top: -1px;
            display: inline-block;
            width: 0.9rem;
            height: 0.9rem;
            vertical-align: middle;
            margin: 0 0.125rem 0 0.25rem;
            border: 1px solid;
        }
</style>
