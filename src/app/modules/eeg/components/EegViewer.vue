<template>
    <split-panel-view
        data-component="eeg-viewer"
        orientation="vertical"
        :primary-size-bounds="bottomSlotBounds"
        primary-slot="end"
        :primary-start-size="navigatorHeight"
        @resize="handleNavigatorResize"
    >
        <template v-slot:start>
            <split-panel-view
                data-component="eeg-data"
                :primary-open="sidebarOpen !== null"
                :primary-size-bounds="['300px', '40%']"
                primary-slot="end"
                :primary-start-size="sidebarWidth"
                @resize="handleSidebarResize"
            >
                <template v-slot:start>
                    <div ref="component"
                        class="viewer"
                        @pointerleave="handlePointerLeave($event)"
                    >
                        <plot-y-axis ref="yaxis"
                            :offset="[0, 0, 0, 4]"
                            :width="yAxisWidth"
                            v-on:select-channel="toggleChannelMenu"
                            v-on:toggle-channel="toggleChannelActive"
                        />
                        <div ref="wrapper" class="main">
                            <!-- Highlights -->
                            <channel-highlights v-if="overlay"
                                :overlay="overlay"
                                :pxPerSecond="pxPerSecond"
                                :secPerPage="viewRange"
                                :SETTINGS="SETTINGS"
                                :viewRange="viewRange"
                            />
                            <!-- Timebase -->
                            <timescale-grid v-if="viewReady"
                                :pxPerSecond="pxPerSecond"
                                :viewerSize="plotDimensions"
                            />
                            <!--<div ref="timebase" class="timebase"></div>-->
                            <eeg-plot ref="plot" v-if="overlay && viewReady"
                                class="plot"
                                :dimensions="plotDimensions"
                                :epochFocus="epochFocusRange"
                                :overlay="overlay"
                                :pxPerSecond="pxPerSecond"
                                :secPerPage="secPerPage"
                                :viewRange="viewRange"
                                :visibleRange="navigatorRange"
                                v-on:double-click="handlePlotDoubleClick"
                                v-on:go-backward="goBackward"
                                v-on:go-forward="goForward"
                                v-on:go-to="goTo"
                                v-on:loaded="resizeElements"
                                v-on:mouse-click="handlePlotMouseClick"
                                v-on:pointer-down="handlePlotPointerdown"
                                v-on:pointer-drag="handlePlotPointerDrag"
                                v-on:pointer-drag-cancel="handlePlotPointerDragCancel"
                                v-on:pointer-drag-end="handlePlotPointerDragEnd"
                                v-on:pointer-up="handlePlotPointerup"
                                v-on:plot-navigation="handlePlotNavigation"
                                v-on:plot-updated="handlePlotUpdated"
                                v-on:touch-start="handlePlotTouchStart"
                            />
                            <!-- Cascade-specific overlay (per-row time labels + main-view indicator).
                                 Mounts only when the active montage is a cascade — non-cascade montages
                                 don't need either piece. -->
                            <cascade-overlay v-if="cascadeMontage && viewReady"
                                :montage="cascadeMontage"
                                :plotDimensions="plotDimensions"
                                :pxPerSecond="pxPerSecond"
                            />
                            <!-- Annotations — cascade uses a row-aware read-only renderer; regular
                                 montages use the full-featured (drag, resize, edit) variant. -->
                            <cascade-annotations v-if="cascadeMontage && viewReady"
                                :montage="cascadeMontage"
                                :plotDimensions="plotDimensions"
                                :pxPerSecond="pxPerSecond"
                            />
                            <annotation-labels v-if="!cascadeMontage && overlay && viewReady"
                                :overlay="overlay"
                                :pxPerSecond="pxPerSecond"
                                :secPerPage="viewRange"
                                :SETTINGS="SETTINGS"
                                :viewRange="viewRange"
                                v-on:delete-annotation="removeUserEvents"
                                v-on:edit-annotation="editEvent"
                                v-on:updated="handleEventsUpdated"
                            />
                            <!-- Selected signal segments. Regular montages render one clickable
                                 div per selection; cascade view renders multi-row segments via
                                 CascadeSelections (one bar per affected row, all sharing the same
                                 source selection). -->
                            <template v-if="!cascadeMontage">
                                <div v-for="(_selection, idx) in plotSelections" :key="`drag-selection-${idx}`"
                                    :id="`signal-selection-${idx}`"
                                    class="selection-area"
                                    :style="selectionStyles"
                                    @click="handleSelectionClick(idx)"
                                    @contextmenu.prevent=""
                                ></div>
                            </template>
                            <cascade-selections v-if="cascadeMontage && viewReady"
                                :activeSelectionIdx="cascadeActiveSelectionIdx"
                                :montage="cascadeMontage"
                                :plotDimensions="plotDimensions"
                                :plotSelections="plotSelections"
                                :pxPerSecond="pxPerSecond"
                                v-on:selection-click="handleSelectionClick"
                            />
                            <div v-if="selectionBound"
                                class="selection-bound"
                                :style="selectionBoundStyles"
                            ></div>
                            <!-- Cursors must come after the plot element to be placed on top of it -->
                            <vertical-cursors ref="cursors"
                                :overlay="overlay"
                                :pxPerSecond="pxPerSecond"
                                :viewRange="viewRange"
                                v-on:main-cursor-position=""
                            ></vertical-cursors>
                            <viewer-overlay ref="overlay"
                            ></viewer-overlay>
                            <context-menu v-if="contextMenu"
                                :context="contextMenu"
                                :selectionBound="selectionBound"
                                v-on:action="handleContextMenuAction"
                            ></context-menu>
                            <annotation-editor v-if="editingEvents.length"
                                :action="editingEventsMode"
                                :annotation="editingEvents[0]"
                                v-on:exit="exitEventEditor"
                                v-on:save="saveEventEdits"
                            ></annotation-editor>
                            <!-- Video must come after the cursor to stay on top -->
                            <div v-if="RESOURCE.videos.length" ref="videoWrapper"
                                :class="[
                                    'video',
                                    { 'epicv-hidden': !showVideo },
                                ]"
                            >
                                <video ref="video" controls :src="RESOURCE.videos[0].url" />
                            </div>
                            <!-- Windows must come after everything else to stay on top -->
                            <eeg-channel-properties v-if="overlay && menuChannel"
                                :changes="channelsChanged"
                                :channel="menuChannel"
                                :overlay="overlay"
                                :viewerHeight="viewerSize[1]"
                                v-on:close="closeChannelMenu"
                            />
                            <window-dialog v-if="overlay && analysisWindow.open && plotSelections.length"
                                :key="`eeg-tools-window-${analysisWindow.nr}`"
                                :height="analysisWindow.height"
                                :left="analysisWindow.left"
                                :open="true"
                                title="Signal properties"
                                :top="analysisWindow.top"
                                :width="analysisWindow.width"
                                v-on:close="closeAnalysisWindow"
                                v-on:update:left="analysisWindow.left = $event"
                                v-on:update:top="analysisWindow.top = $event"
                            >
                                <eeg-analysis-tools
                                    :cmPerSec="cmPerSec"
                                    :cursorPos="cursors?.mainCursorPos || 0"
                                    :selectedIdx="selectedIndex"
                                    :selections="plotSelections"
                                    :tab="analysisWindow.tab"
                                    v-on:set-cursor-pos="cursors.setCursorPos"
                                />
                            </window-dialog>
                            <window-dialog v-if="overlay && reportWindow.category && reportWindow.open"
                                :key="`eeg-report-window-${reportWindow.nr}`"
                                :height="reportWindow.height"
                                :left="reportWindow.left"
                                :open="true"
                                title="Report"
                                :top="reportWindow.top"
                                :width="reportWindow.width"
                                v-on:close="toggleReport(false)"
                                v-on:update:left="reportWindow.left = $event"
                                v-on:update:top="reportWindow.top = $event"
                            >
                                <dynamic-report-form
                                    :allow-freetext="false"
                                    :category="reportWindow.category"
                                    :manager="reportSchemaManager"
                                    :tab="reportWindow.tab"
                                />
                            </window-dialog>
                            <div v-if="!montageSetupDone && RESOURCE.state !== 'error'"
                                class="setup"
                            >
                                <div>
                                    <p>{{ $t('Please wait...') }}</p>
                                    <p>{{ setupMessage }}</p>
                                </div>
                            </div>
                            <div v-else-if="!dataSetupDone && RESOURCE.state !== 'error'"
                                class="setup"
                            >
                                <div>
                                    <p>{{ $t('Please wait...') }}</p>
                                    <p>{{ $t('Loading signal data.') }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
                <template v-slot:end>
                    <annotation-sidebar ref="sidebar"
                        :areDeletedEvents="undoableRemoveEvents.length > 0"
                        :availableTabs="sidebarTabs"
                        class="sidebar"
                        :open="sidebarOpen === 'annotations'"
                        :selections="plotSelections"
                        :tab="sidebarTab"
                        :visibleRange="navigatorRange"
                        v-on:close="hideSideDrawer"
                        v-on:create-events="createEvents"
                        v-on:remove-event="removeUserEvents"
                        v-on:tab-changed="selectDrawerTab"
                        v-on:undo-remove="undoRemoveEvents"
                    ></annotation-sidebar>
                </template>
            </split-panel-view>
        </template>
        <template v-slot:end>
            <div class="bottom-stack">
                <!-- Mount the trend strip whenever the user has toggled it on, regardless of
                     whether there is currently enough space to show it. Toggling visibility via
                     `v-if` from `effectiveTrendVisible` here creates a layout feedback loop:
                     unmounting changes the bottom slot's intrinsic content size, wa-split-panel
                     re-emits `wa-reposition`, `handleNavigatorResize` writes back into
                     `navigatorHeight`, the threshold check flips again, and the component remounts
                     — repeating forever. Using flex-basis 0 when the strip is "effectively
                     hidden" keeps it mounted but visually collapsed. -->
                <eeg-trend v-if="trendVisible"
                    v-show="effectiveTrendVisible"
                    class="trend"
                    :controlsOpen="controlsOpen"
                    :displayMode="effectiveTrendDisplayMode"
                    :height="effectiveTrendVisible ? trendHeight : 0"
                    :style="{ flex: `0 0 ${effectiveTrendVisible ? trendHeight : 0}px` }"
                    :visibleRange="navigatorRange"
                    :width="viewerSize[0]"
                    ref="trend"
                    v-on:navigation="handlePlotNavigation"
                    v-on:toggle-controls="handleTrendToggleControls"
                />
                <eeg-navigator ref="navigator"
                    class="navigator"
                    :controlsOpen="controlsOpen"
                    :cursorPos="cursors?.mainCursorPos || 0"
                    :height="actualNavigatorHeight"
                    :selectionBound="selectionBound"
                    :style="{ flex: `0 0 ${actualNavigatorHeight}px` }"
                    :visibleRange="navigatorRange"
                    :width="viewerSize[0]"
                    v-on:backward="goBackward"
                    v-on:forward="goForward"
                    v-on:loaded="resizeElements"
                    v-on:navigation="handlePlotNavigation"
                    v-on:toggle-controls="handleNavigatorToggleControls"
                />
            </div>
        </template>
    </split-panel-view>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, reactive, Ref, ref, toRef } from 'vue'
import { T } from '#i18n'
import { settingsColorToRgba } from '@epicurrents/core/util'
import { useEegContext } from '../'
import { useStore } from 'vuex'
import { NUMERIC_ERROR_VALUE } from '@epicurrents/core/util'
import { NO_POINTER_BUTTON_DOWN } from '#util'
import { EventScopes } from '@epicurrents/core'
import { InterfaceEvents } from '#events/EventTypes'
import { Log } from 'scoped-event-log'
import type {
    AnnotationEventTemplate,
    BiosignalAnnotationEvent,
    BiosignalCascadeMontage,
    BiosignalChannel,
    ChannelPositionProperties,
    MontageChannel,
} from '@epicurrents/core/types'
import type { SignalSelectionLimit } from '#types/interface'
import { useBiosignalAnalysis } from '#app/views/biosignal/useBiosignalAnalysis'
import { useBiosignalAnnotations } from '#app/views/biosignal/useBiosignalAnnotations'
import { useBiosignalAnnotationEditor } from '#app/views/biosignal/useBiosignalAnnotationEditor'
import { useBiosignalKeyboard } from '#app/views/biosignal/useBiosignalKeyboard'
import { useBiosignalLayout } from '#app/views/biosignal/useBiosignalLayout'
import { useBiosignalNavigation } from '#app/views/biosignal/useBiosignalNavigation'
import { TREND_REGISTRY } from '../trends'
import { useBiosignalPointer } from '#app/views/biosignal/useBiosignalPointer'
import type { ContextMenuContext } from '#types/interface'
import { EegEvent } from '@epicurrents/eeg-module'
import type { PlotSelection } from '#app/views/biosignal/types'

// Persists the user's last explicit trend-strip state per resource across remounts.
// Keyed by resource id; only populated after the first unmount so a first-ever visit
// falls back to the hasTrends auto-restore heuristic.
const trendVisibilityByResource = new Map<string, boolean>()
import type { SignalHighlight } from '#types/plot'

// Child components
import AnnotationLabels from '#app/views/biosignal/overlays/AnnotationLabels.vue'
import AnnotationEditor from '#app/views/biosignal/overlays/AnnotationEditor.vue'
import AnnotationSidebar from '#app/views/biosignal/sidebars/AnnotationSidebar.vue'
import CascadeAnnotations from '#app/views/biosignal/overlays/CascadeAnnotations.vue'
import CascadeOverlay from '#app/views/biosignal/overlays/CascadeOverlay.vue'
import CascadeSelections from '#app/views/biosignal/overlays/CascadeSelections.vue'
import ChannelHighlights from '#app/views/biosignal/overlays/ChannelHighlights.vue'
import ContextMenu from '#app/views/biosignal/overlays/ContextMenu.vue'
import DynamicReportForm from '#components/report/components/DynamicReportForm.vue'
import EegAnalysisTools from './overlays/EegAnalysisTools.vue'
import EegChannelProperties from './overlays/EegChannelProperties.vue'
import EegNavigator from './EegNavigator.vue'
import EegPlot from './EegPlot.vue'
import EegTrend from './EegTrend.vue'
import PlotYAxis from '#app/views/biosignal/plots/PlotYAxis.vue'
import SplitPanelView from '#root/src/app/views/SplitPanelView.vue'
import TimescaleGrid from '#app/views/biosignal/overlays/TimescaleGrid.vue'
import VerticalCursors from '#app/views/biosignal/overlays/VerticalCursors.vue'
import ViewerOverlay, { type PointerEventOverlay } from '#app/overlays/PointerEventOverlay.vue'
import WindowDialog from '#app/overlays/WindowDialog.vue'
import { deepEqual } from '@epicurrents/core/util'
import type { default as WaSplitPanel } from '@awesome.me/webawesome/dist/components/split-panel/split-panel.js'
import { SchemaManager } from '#root/src/components/report'

const NAVIGATOR_MIN_HEIGHT = 75   // natural navigator strip height (px)
const TREND_MIN_HEIGHT = 40       // below this the strip auto-hides; navigator takes full slot
const TREND_SUPERIMPOSE_HEIGHT = 80  // below this the strip forces 'superimposed' display
const TREND_DEFAULT_HEIGHT = 110  // extra space added to the bottom slot when trend toggles on

export default defineComponent({
    name: 'EegViewer',
    props: {
        viewerSize: {
            type: Array as PropType<number[]>,
            required: true,
        },
    },
    components: {
        AnnotationLabels,
        AnnotationEditor,
        AnnotationSidebar,
        CascadeAnnotations,
        CascadeOverlay,
        CascadeSelections,
        ChannelHighlights,
        ContextMenu,
        DynamicReportForm,
        EegAnalysisTools,
        EegChannelProperties,
        EegNavigator,
        EegPlot,
        EegTrend,
        PlotYAxis,
        SplitPanelView,
        TimescaleGrid,
        VerticalCursors,
        ViewerOverlay,
        WindowDialog,
    },
    setup (props) {
        const store = useStore()
        const viewerSize = toRef(props, 'viewerSize') as Ref<number[]>
        const activeCursorTool = ref(null as string | null)
        const activeSelection = ref(null as PlotSelection | null)
        const channelsChanged = ref(0)
        // Bumped by `activeMontageChanged` so the `cascadeMontage` computed has a tracked
        // dependency to invalidate on. `RESOURCE.activeMontage` is a plain getter on an
        // EventTarget-extended asset (not a Vue-reactive property), so without this trigger
        // Vue would cache the first result of `cascadeMontage` and never re-evaluate —
        // leaving CascadeOverlay / CascadeAnnotations / CascadeSelections mounted after
        // switching back to a regular montage.
        const activeMontageVersion = ref(0)
        const cmPerSec = ref(0)
        const contextMenu = ref(null as ContextMenuContext | null)
        const dataSetupDone = ref(false)
        const dragAction = ref(null as null | {
            /**
             * Pointer button that initiated the drag operation.
             * Only actions from the left and right mouse buttons are registered.
             */
            button: 0 | 2 | typeof NO_POINTER_BUTTON_DOWN
            /** Channel over which the drag operation started or null if this is a recording level (global) action. */
            channelProps: ChannelPositionProperties | null
            /** Range index (0 or 1) of the active drag position. */
            dragging: 0 | 1
            /** Drag active (cursor) position as recording time in seconds. */
            dragPos: number
            /** Drag element position as pixels from the left edge of the overlay. */
            fromLeft: number
            /** Drag element position as pixels from the right edge of the overlay. */
            fromRight: number
            /** Drag start position as recording time in seconds. */
            startPos: number
        })
        const dragButton = ref(NUMERIC_ERROR_VALUE)
        const editingEvents = ref([] as BiosignalAnnotationEvent[])
        const editingEventsMode = ref('new' as 'new' | 'edit')
        const lastCacheEnd = ref(0)
        const lastVideoTime = ref(0)
        const menuChannel = ref(null as MontageChannel | null)
        const montageSetupDone = ref(false)
        const pointerDownPoint = reactive({ x: NUMERIC_ERROR_VALUE, y: NUMERIC_ERROR_VALUE })
        const navigatorHeight = ref(NAVIGATOR_MIN_HEIGHT)
        const trendVisible = ref(false)
        // Controls-bar open state shared between navigator and trend. Initialised open on touch
        // devices (where controls are harder to discover) and closed otherwise.
        const isTouchScreen = 'ontouchstart' in window || window.navigator.maxTouchPoints > 0
        const controlsOpen = ref(isTouchScreen)
        const nextAnimationFrame = 0
        const onnxContinue = ref(false)
        const onnxHighlights = reactive([] as SignalHighlight[])
        const plotSelections = reactive([] as PlotSelection[])
        const recordingReady = ref(false)
        const reportSchemaManager = new SchemaManager()
        const reportWindow = reactive({
            category: null as string | null,
            height: window.innerHeight*0.9,
            left: window.innerWidth / 2 - 400,
            /** Update the number each time the analysis window is opened to discard any cached data. */
            nr: 0,
            open: false,
            tab: 'routine',
            top: window.innerHeight*0.05,
            width: 800,
        })
        const resolvePlotUpdate = ref(null as ((result: any) => void) | null)
        const secPerPage = ref(0)
        const selectedIndex = ref(0)
        const selectionBound = ref(null as SignalSelectionLimit | null)
        const setupMessage = ref('')
        const showVideo = ref(true)
        const sidebarOpen = ref(null as string | null)
        const sidebarTab = ref('events')
        const sidebarWidth = ref(350)
        const viewReady = ref(props.viewerSize[0] > 0 && props.viewerSize[1] > 0)
        const yAxisWidth = ref(80)
        // Template refs
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const cursors = ref<InstanceType<typeof VerticalCursors>>() as Ref<InstanceType<typeof VerticalCursors>>
        const navigator = ref<InstanceType<typeof EegNavigator>>() as Ref<InstanceType<typeof EegNavigator>>
        const trend = ref<InstanceType<typeof EegTrend>>() as Ref<InstanceType<typeof EegTrend>>
        const overlay = ref<PointerEventOverlay>() as Ref<PointerEventOverlay>
        const panel = ref<WaSplitPanel>() as Ref<WaSplitPanel>
        const plot = ref<InstanceType<typeof EegPlot>>() as Ref<InstanceType<typeof EegPlot>>
        const sidebar = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        //const timebase = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const video = ref<HTMLVideoElement>() as Ref<HTMLVideoElement>
        const videoWrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const wrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const yaxis = ref<InstanceType<typeof PlotYAxis>>() as Ref<InstanceType<typeof PlotYAxis>>
        // Pointer interaction handlers
        const pointerLeaveHandlers = ref([]) as Ref<((event?: PointerEvent) => void)[]>
        // Unsubscribe from store mutations
        const unsubscribe = ref(null as (() => void) | null)
        const unsubscribeActions = ref(null as (() => void) | null)
        // Unsubscribe from interface-scoped settings-change events on the event bus.
        const unsubscribeSettings = ref(null as (() => void) | null)
        // Unsubscribe from interface-scoped focused-epoch requests on the event bus.
        const unsubscribeEpochRequest = ref(null as (() => void) | null)
        // Unsubscribe from interface-scoped step-epoch commands on the event bus.
        const unsubscribeStepEpoch = ref(null as (() => void) | null)
        // ── Composable setup ─────────────────────────────────────────────────
        const eegCtx = useEegContext(store, 'EegViewer')
        const layout = useBiosignalLayout(
            eegCtx.SETTINGS,
            viewerSize,
            secPerPage,
            sidebarOpen,
            sidebarWidth,
            { plot, navigator },
            cursors as Ref<{ updateCursors(): void } | undefined>,
            yAxisWidth,
            navigatorHeight,
            cmPerSec,
            () => (store.state as any).INTERFACE.app.screenPPI,
        )
        const { borderWidth, pxPerSecond, viewRange, visibleRange } = layout
        // Navigator-side range: the seconds of the recording currently on screen across the *whole*
        // viewer (vs. visibleRange, which describes one renderer page). For a cascade montage with N
        // rows of pageLength seconds each, the user actually sees `rowCount * pageLength` seconds —
        // that's what the navigator viewbox should span and what click-to-center should bracket.
        // Falls back to `visibleRange` for regular montages (pageStep is null) so the existing
        // single-page semantics are preserved.
        const navigatorRange = computed(() => {
            // Read visibleRange first to introduce a reactive dependency. `pageStep` is a plain
            // value on the (non-reactive) montage object and wouldn't trigger re-evaluation on
            // its own — but it co-changes with visibleRange in every relevant transition
            // (`activeMontageChanged` calls `timebaseChanged` which updates `secPerPage` → updates
            // `visibleRange`).
            const fallback = visibleRange.value
            const step = eegCtx.RESOURCE.activeMontage?.pageStep
            return typeof step === 'number' && step > 0 ? step : fallback
        })
        const annoEditor = useBiosignalAnnotationEditor(eegCtx.RESOURCE, editingEvents, editingEventsMode)

        const analysis = useBiosignalAnalysis(eegCtx.RESOURCE, plotSelections, 'EegViewer')

        const nav = useBiosignalNavigation(
            eegCtx.RESOURCE,
            eegCtx.SETTINGS,
            navigatorRange,
            (position, _goTo) => {
                // Centre on the user-visible reach so cascade montages park N rows around the
                // clicked time rather than just one row.
                eegCtx.RESOURCE.viewStart = Math.max(Math.floor(position - navigatorRange.value/2), 0)
            },
            video,
        )

        // Absolute time range of the focused epoch when centered (semi-epoch) display is
        // active, else null. `secPerPage` is read as the reactive trigger: it changes on
        // every epoch-geometry setting (display / contextEpochs / epochLength), which the
        // SETTINGS proxy would not otherwise surface to a computed.
        const epochFocusRange = computed<[number, number] | null>(() => {
            void secPerPage.value
            const epochMode = eegCtx.SETTINGS.epochMode
            if (!nav.isInEpochMode.value || epochMode?.display !== 'centered') {
                return null
            }
            const epochLength = epochMode?.epochLength ?? 0
            if (epochLength <= 0) {
                return null
            }
            const start = nav.epochStart.value + nav.focusedEpoch.value * epochLength
            return [start, start + epochLength]
        })

        const pointer = useBiosignalPointer({
            resource: eegCtx.RESOURCE,
            settings: eegCtx.SETTINGS,
            activeCursorTool,
            activeSelection,
            borderWidth,
            contextMenu,
            cursors: cursors as Ref<{ disable: () => void, enable: () => void, setCursorPos: (n: number) => void }>,
            dragAction,
            overlay,
            plotSelections,
            pointerLeaveHandlers: pointerLeaveHandlers.value,
            pxPerSecond,
            resolvePlotUpdate,
            selectedIndex,
            selectionBound,
            visibleRange: viewRange,
            wrapper,
            onCloseAnalysis: analysis.closeAnalysisWindow,
            onExitEditor: annoEditor.exitEventEditor,
            onOpenAnalysis: () => analysis.openAnalysisWindow(),
        })

        const keyboard = useBiosignalKeyboard(
            ['annotation', 'examine', 'fft', 'inspect', 'montage1', 'montage2', 'montage3', 'montage4', 'notch', 'report', 'topogram'],
            eegCtx.SETTINGS,
            () => (store.state as any).INTERFACE.app.reservedKeys,
            () => (store.state as any).INTERFACE.app.hotkeyAltOrOpt,
            () => {
                store.dispatch('eeg.set-cursor-tool', null)
                analysis.closeAnalysisWindow()
                const activeChans = eegCtx.RESOURCE.activeMontage?.channels.filter((c: any) => c?.isActive) || []
                if (menuChannel.value && activeChans.length === 1 && (activeChans[0] as any)?.id === menuChannel.value.id) {
                    (menuChannel.value as any).isActive = false
                }
                menuChannel.value = null
                contextMenu.value = null
                pointer.hideAllDragElements()
                store.dispatch('eeg.set-open-sidebar', null)
                annoEditor.exitEventEditor()
                pointer.removeAllDragElements(true)
                if (activeSelection.value) {
                    activeSelection.value.canceled = true
                }
                dragAction.value = null
                selectionBound.value = null
            }
        )

        return {
            activeCursorTool,
            activeSelection,
            activeMontageVersion,
            channelsChanged,
            cmPerSec,
            contextMenu,
            dataSetupDone,
            dragAction,
            dragButton,
            editingEvents,
            editingEventsMode,
            epochFocusRange,
            lastCacheEnd,
            lastVideoTime,
            menuChannel,
            pointerDownPoint,
            navigatorHeight,
            nextAnimationFrame,
            onnxContinue,
            onnxHighlights,
            navigatorRange,
            recordingReady,
            reportSchemaManager,
            reportWindow,
            /** Alternative to the dynamic cm per second. */
            secPerPage,
            /** Index of the plot selection that was last clicked. */
            selectedIndex,
            selectionBound,
            showVideo,
            sidebarOpen,
            sidebarTab,
            sidebarWidth,
            plotSelections,
            trendVisible,
            viewReady,
            yAxisWidth,
            controlsOpen,
            // Template refs
            component,
            cursors,
            navigator,
            trend,
            overlay,
            panel,
            plot,
            montageSetupDone,
            setupMessage,
            sidebar,
            //timebase,
            video,
            videoWrapper,
            wrapper,
            yaxis,
            // Handlers
            pointerLeaveHandlers,
            // Unsubscribers
            unsubscribe,
            unsubscribeSettings,
            unsubscribeEpochRequest,
            unsubscribeStepEpoch,
            unsubscribeActions,
            // Imported methods
            settingsColorToRgba,
            resolvePlotUpdate,
            // Scope properties
            ...eegCtx,
            // Composables
            ...useBiosignalAnnotations(eegCtx.RESOURCE),
            ...layout,
            ...annoEditor,
            ...analysis,
            analysisWindow: analysis.analysisWindow,
            ...nav,
            ...keyboard,
            hotkeyEvents: keyboard.hotkeyEvents,
            modKey: keyboard.modKey,
            ...pointer,
        }
    },
    watch: {
        // Publish the focused epoch whenever the centered-view geometry changes (entering or
        // leaving centered display, or paging between epochs). `epochFocusRange` re-evaluates
        // only on those transitions, so this fires exactly once per real change.
        epochFocusRange () {
            this.emitFocusedEpoch()
        },
        viewerSize (value) {
            if (!this.viewReady && value[0] > 0 && value[1] > 0) {
                this.viewReady = true
            }
            if (!value || !value[0] || !value[1]) {
                return
            }
            // resizeElements updates plotDimensions and recomputes pxPerSecond
            // atomically; see useBiosignalLayout.ts.
            this.resizeElements()
        },
    },
    computed: {
        /** Bottom split-panel slot bounds (navigator + optional trend). When the trend is hidden
         *  the navigator is the only occupant and the layout doesn't support a resizable
         *  compartment — pin min === max so the divider becomes a no-op (handled by
         *  `SplitPanelView` via wa-split-panel's `disabled` and a hidden divider). */
        bottomSlotBounds (): [string, string] {
            return this.trendVisible
                ? [`${NAVIGATOR_MIN_HEIGHT}px`, '40%']
                : [`${NAVIGATOR_MIN_HEIGHT}px`, `${NAVIGATOR_MIN_HEIGHT}px`]
        },
        /**
         * Index of the currently-active selection within `plotSelections`. Used by the cascade
         * selection overlay to flag which set of row segments is the live drag (vs. finalised
         * historical selections that the user might be cycling between).
         */
        cascadeActiveSelectionIdx (): number {
            if (!this.activeSelection) {
                return -1
            }
            return this.plotSelections.indexOf(this.activeSelection)
        },
        /**
         * True while the view shows a focused epoch with faded context (centered semi-epoch
         * review). Number keys label the focused epoch in this mode, so montage-switch hotkeys
         * on the same keys are suppressed.
         */
        inCenteredEpochReview (): boolean {
            return this.isInEpochMode && this.SETTINGS.epochMode?.display === 'centered'
        },
        /**
         * Active montage narrowed to `BiosignalCascadeMontage` when it actually is one. Drives
         * `CascadeOverlay` mounting and the cascade-aware branch in the double-click handler.
         * Reads `activeMontageVersion` so Vue invalidates the cached result whenever
         * `activeMontageChanged` fires — without that read the computed has no reactive deps
         * (`RESOURCE.activeMontage` is a plain getter) and the cascade overlays survive the
         * switch back to a regular montage.
         */
        cascadeMontage (): BiosignalCascadeMontage | null {
            void this.activeMontageVersion
            const active = this.RESOURCE.activeMontage
            if (active?.isCascade) {
                return active as BiosignalCascadeMontage
            }
            return null
        },
        isOnlyMenuChannelActive (): boolean {
            if (this.menuChannel) {
                const activeChans = (this.RESOURCE.activeMontage?.channels || []).filter(c => c?.isActive)
                if (activeChans.length === 1 && activeChans[0]?.id === this.menuChannel.id) {
                    return true
                }
            }
            return false
        },
        pointerDragThreshold (): number {
            // Require at least 5 mm (~0.2 inches) of pointer movement to register a drag event
            return this.$store.state.INTERFACE.app.screenPPI/5
        },
        sidebarTabs (): string[] {
            return this.RESOURCE.annotationsLocked
                ? ['events']
                : ['create', 'events']
        },
        /** Height the trend strip would receive given the current bottom-slot size. */
        trendHeight (): number {
            return Math.max(0, this.navigatorHeight - NAVIGATOR_MIN_HEIGHT)
        },
        /** Whether the trend strip is shown right now. Even when `trendVisible` is true, the strip
         *  collapses when the user drags the bottom slot below the navigator + min trend height. */
        effectiveTrendVisible (): boolean {
            return this.trendVisible && this.trendHeight >= TREND_MIN_HEIGHT
        },
        /** When the user compresses the strip below the superimpose threshold, force the
         *  superimposed mode regardless of the configured display mode so all bands stay visible. */
        effectiveTrendDisplayMode (): 'separate' | 'superimposed' | null {
            if (!this.effectiveTrendVisible) {
                return null
            }
            if (this.trendHeight < TREND_SUPERIMPOSE_HEIGHT) {
                return 'superimposed'
            }
            return null
        },
        /** Height to pass to the navigator. When the trend is hidden, the navigator owns the full
         *  bottom slot; when the trend is visible, the navigator stays at its minimum height and
         *  the trend takes the rest. */
        actualNavigatorHeight (): number {
            return this.effectiveTrendVisible ? NAVIGATOR_MIN_HEIGHT : this.navigatorHeight
        },
    },
    methods: {
        /**
         * Override the default I18n translate method.
         * Returns a component-specific translation (default) or a
         * general translation (fallback) for the given key string.
         */
        $t: function (key: string, params = {}, capitalized = false) {
            return T(key, this.$options.name, params, capitalized)
        },
        Log (event: any) {
            console.log(event)
        },
        /**
         * Publish the currently focused epoch on the interface event bus. Out-of-viewer consumers
         * (e.g. a project panel that labels epochs) rely on this because the epoch index cannot be
         * reconstructed from the view start. Emits a null epoch when the view is not in centered
         * (semi-epoch) display.
         */
        emitFocusedEpoch () {
            const bus = window.__EPICURRENTS__.EVENT_BUS
            if (!bus) {
                return
            }
            const range = this.epochFocusRange
            const detail = range
                ? {
                    resourceId: this.RESOURCE.id,
                    epochNumber: this.focusedEpoch,
                    epochStart: range[0],
                    epochLength: range[1] - range[0],
                }
                : {
                    resourceId: this.RESOURCE.id,
                    epochNumber: null,
                    epochStart: null,
                    epochLength: null,
                }
            bus.dispatchScopedEvent(InterfaceEvents.EPOCH_CHANGED, EventScopes.INTERFACE, 'after', detail)
        },
        /** Step the focused epoch in response to an interface-scoped step-epoch command. */
        handleStepEpoch (e: Event) {
            const direction = (e as CustomEvent).detail?.direction
            if (direction === 'backward') {
                this.goBackward()
            } else {
                this.goForward()
            }
        },
        /**
         * Perform appropriate operations when the active montage changes.
         */
        activeMontageChanged () {
            this.hideAllOverlayElements()
            // Bump the reactive trigger that `cascadeMontage` reads, so the computed (and the
            // `v-if`-gated cascade overlays) re-evaluate against the new active montage. Without
            // this the cached value sticks across the switch and overlays from the previous
            // cascade keep rendering.
            this.activeMontageVersion++
            // The new montage may override timebaseUnit / pageLength (e.g. EegCascadeMontage forces
            // sec/page with a montage-specific page length). Recompute so the layout reflects the
            // effective values; falls back to the recording defaults when the montage doesn't
            // override.
            this.timebaseChanged()
        },
        /**
         * Add a `handler` method for when the pointer leaves the given `element`.
         * @param handler - method to execute in the event of pointer leaving the element
         */
        /**
         * Return a promise that resolves when the plot is updated next time.
         */
        awaitPlotUpdate (): Promise<any> {
            return new Promise<any>((resolve) => {
                this.resolvePlotUpdate = resolve
            })
        },
        async checkVideoPosLoop () {
            /*
            const vidOffset = this.RESOURCE.videos[0].startTime
            const vidTime = this.video.currentTime + vidOffset
            if (vidTime !== this.lastVideoTime) {
                this.cursorPos = vidTime
                this.lastVideoTime = vidTime
                // Mark cursor as moved only if video is playing
                if (this.isVideoPlaying()){
                    this.cursorMoved = true
                }
                if (
                    !this.video.paused && !this.video.ended &&
                    this.cursorPos >= this.RESOURCE.viewStart + this.viewRange
                ) {
                    // First check if the video is playing and we've moved to the next page
                    this.RESOURCE.viewStart = Math.floor(this.cursorPos)
                    // Don't update cursor position here, wait for plot to update first
                    await this.awaitPlotUpdate()
                } else {
                    // Else, check if the user has navigated outside the current page
                    if (
                        this.cursorPos < this.RESOURCE.viewStart ||
                        this.cursorPos >= this.RESOURCE.viewStart + this.viewRange
                    ) {
                        this.RESOURCE.viewStart = Math.min(
                            this.RESOURCE.totalDuration,
                            Math.max(0, Math.floor(this.cursorPos - this.viewRange/2))
                        )
                    }
                }
                this.updateCursorPos()
            }
            this.nextAnimationFrame = requestAnimationFrame(this.checkVideoPosLoop)
            */
        },
        clearCursorTool () {
            this.$store.dispatch('eeg.set-cursor-tool', null)
        },
        closeReportWindow () {
            console.log('Closing report window')
            // Reset channel and signal data
            this.reportWindow.open = false
        },
        closeChannelMenu () {
            this.menuChannel = null
            // Disable all active channels
            const actChans = (this.RESOURCE.activeMontage?.channels || [])
                             .filter(c => c?.isActive) as MontageChannel[]
            for (const chan of actChans) {
                chan.isActive = false
            }
        },
        createEvents (props?: {
            channels?: string[],
            codes?: Record<string, number | string>,
            duration?: number,
            name?: string,
            skipEditor?: boolean,
            start?: number,
            text?: string,
        }) {
            if (!this.RESOURCE.activeMontage) {
                Log.debug(`Cannot create annotations for raw input signals.`, this.$options.name!)
                return
            }
            const eventClass = !props?.codes
                               ? this.SETTINGS.annotations.classes.default
                               // The annotation name must match the event name.
                               : Object.entries(this.SETTINGS.annotations.classes)
                                       .filter(([k, t]) => k !== 'default' && t.name === props?.name)?.[0]?.[1]
            if (!eventClass) {
                Log.warn(`No annotation class matches the provided name.`, this.$options.name!)
                return
            }
            const undoEvents = [] as BiosignalAnnotationEvent[]
            if (this.plotSelections.length) {
                for (const selection of this.plotSelections) {
                    const newEvent = EegEvent.fromTemplate({
                        annotator: '',
                        background: false,
                        channels: selection.channel ? [selection.channel.name] : [],
                        class: eventClass.name,
                        codes: eventClass.codes || [],
                        duration: selection.range[1] - selection.range[0],
                        id: `annotation_${Date.now()}_${selection.channel ? selection.channel.name : 'global'}`,
                        label: props?.text || eventClass.label,
                        priority: 1,
                        start: selection.range[0],
                        text: '',
                        value: [selection.range[0], selection.range[1] - selection.range[0]],
                    } as AnnotationEventTemplate)
                    this.addUserEvents(newEvent)
                    undoEvents.push(newEvent)
                    if (!props?.skipEditor) {
                        this.editingEvents.push(newEvent)
                    }
                }
                this.plotSelections.splice(0)
            } else if (props?.channels?.length) {
                for (const chan of props.channels) {
                    const newEvent = EegEvent.fromTemplate({
                        annotator: 'Unknown',
                        background: false,
                        channels: this.RESOURCE.visibleChannels.filter(
                                     c => c.name === chan
                                   ).map(c => c.name),
                        class: eventClass.name,
                        codes: eventClass.codes || [],
                        duration: props?.duration ? props.duration : 0,
                        id: `annotation_${Date.now()}_${chan}`,
                        label: props?.text || eventClass.label,
                        priority: 1,
                        start: props?.start || 0,
                        text: '',
                        value: [props?.start || 0, props?.duration ? props.duration : 0],
                    } as AnnotationEventTemplate)
                    this.addUserEvents(newEvent)
                    undoEvents.push(newEvent)
                    if (!props?.skipEditor) {
                        this.editingEvents.push(newEvent)
                    }
                }
            } else {
                const newEvent = EegEvent.fromTemplate({
                    annotator: 'Unknown',
                    background: false,
                    channels: [],
                    class: eventClass.name,
                    codes: eventClass.codes || [],
                    duration: props?.duration ? props.duration : 0,
                    id: `annotation_${Date.now()}`,
                    label: props?.text || eventClass.label,
                    priority: 1,
                    start: props?.start || 0,
                    text: '',
                    value: [props?.start || 0, props?.duration ? props.duration : 0],
                } as AnnotationEventTemplate)
                this.RESOURCE.addEvents(newEvent)
                undoEvents.push(newEvent)
                if (!props?.skipEditor) {
                    this.editingEvents.push(newEvent)
                }
            }
            if (!props?.skipEditor) {
                this.editingEventsMode = 'new'
            }
            this.addUndoAction('add-annotations', true, ...undoEvents)
        },
        getHighlightProperties (channel: BiosignalChannel, range: number[]) {
            const overlayW = this.overlay.getOffsetWidth()
            const startX = (Math.max(range[0] - this.RESOURCE.viewStart, 0)/this.viewRange)*overlayW
            const endX = (Math.min(range[1] - this.RESOURCE.viewStart, this.viewRange)/this.viewRange)*overlayW
            const top = `${100*(1 - channel.offset.top)}%`
            const bottom = `${100*channel.offset.bottom}%`
            const left = `${startX}px`
            const right = `${overlayW - endX}px`
            return `top: ${top}; bottom: ${bottom}; left: ${left}; right: ${right}`
        },
        /**
         * Get the as-recorded montage channel name for the active source channel.
         * @param index - Index of the currently active montage.
         * @returns Name of the channel or null if the channel name cannot be found.
         */
        getSourceChannelName (channel: MontageChannel) {
            if (!this.RESOURCE.recordMontage) {
                return null
            }
            return this.RESOURCE.recordMontage.channels.filter(c => {
                if (
                    (
                        typeof c.active !== 'number'
                        && typeof channel.active !== 'number'
                        && deepEqual(c.active, channel.active)
                    ) || c.active === channel.active
                ) {
                    return true
                }
                return false
            })[0]?.name || null
        },
        handleContextMenuAction (props: any) {
            switch (props.action) {
                case ('cancel-selection'): {
                    this.selectionBound = null
                    break
                }
                case ('create-events'): {
                    this.createEvents(props)
                    break
                }
                case ('end-channel-selection'): {
                    if (!this.selectionBound?.channel || !this.contextMenu) {
                        break
                    }
                    this.createSignalSelection(
                        this.selectionBound.position,
                        this.contextMenu.timestamp,
                        this.selectionBound.channelProps
                    )
                    this.selectionBound = null
                    break
                }
                case ('end-global-selection'): {
                    if (!this.selectionBound || !this.contextMenu) {
                        break
                    }
                    this.createSignalSelection(this.selectionBound.position, this.contextMenu.timestamp, null)
                    this.selectionBound = null
                    break
                }
                case ('start-channel-selection'): {
                    if (this.contextMenu?.channel) {
                        const relY = (
                                this.contextMenu.position[1] + this.borderWidth.bottom
                            )/this.overlay.getOffsetHeight()
                        this.selectionBound = {
                            channel: this.contextMenu.channel,
                            channelProps: this.RESOURCE.getChannelAtYPosition(relY),
                            position: this.contextMenu.timestamp,
                        }
                    }
                    break
                }
                case ('start-global-selection'): {
                    if (this.contextMenu) {
                        this.selectionBound = {
                            channel: null,
                            channelProps: null,
                            position: this.contextMenu.timestamp,
                        }
                    }
                    break
                }
            }
            this.contextMenu = null
        },
        /**
         * Handle keyup events with the viewer visible.
         */
        /**
         * Handle keyup events with the viewer visible.
         */
        async handleKeyup (event: KeyboardEvent) {
            if (event.target && (event.target as HTMLElement).tagName.match(/input|textarea/i)) {
                // Don't handle hotkeys if the user is typing in an input or textarea element.
                return
            }
            if (event.key === 'Escape') {
                // These are handled on key down.
            } else {
                const quickCode = event.code.match(/Digit(\d)/)
                if (quickCode) {
                    // Execute a quick code action depending on the active hotkey.
                    if (this.hotkeyEvents.annotation) {
                        if (this.RESOURCE.annotationsLocked) {
                            Log.warn(
                                [
                                    'Annotations are locked.',
                                    'No events or labels can be added to the recording.'
                                ],
                                this.$options.name!,
                                { announce: true }
                            )
                            this.hotkeyEvents.annotation = false
                            return
                        }
                        for (const classProps of Object.values(this.SETTINGS.annotations.classes)) {
                            const code = parseInt(quickCode[1])
                            if (classProps.quickCode === code) {
                                const eventProps = { ...classProps } as typeof classProps & { start?: number }
                                if (!this.plotSelections.length) {
                                    // If no segments are selected, create the event at cursor position.
                                    eventProps.start = this.RESOURCE.viewStart + (this.cursors?.mainCursorPos || 0)
                                }
                                this.createEvents(eventProps)
                                this.hotkeyEvents.annotation = false
                                return
                            }
                        }
                    // In centered semi-epoch review the number keys label epochs (handled by the
                    // consuming panel), so montage-switch hotkeys on the same keys are suppressed.
                    } else if (this.inCenteredEpochReview) {
                        this.hotkeyEvents.montage1 = false
                        this.hotkeyEvents.montage2 = false
                        this.hotkeyEvents.montage3 = false
                        this.hotkeyEvents.montage4 = false
                    // If no modifying hotkey is active, treat this as a default montage selection.
                    } else if (this.isHotkeyMatch('montage1', event)) {
                        this.$store.dispatch('eeg.set-active-montage', this.RESOURCE.montages[0].name)
                        this.hotkeyEvents.montage1 = false
                    } else if (this.isHotkeyMatch('montage2', event)) {
                        this.$store.dispatch('eeg.set-active-montage', this.RESOURCE.montages[1].name)
                        this.hotkeyEvents.montage2 = false
                    } else if (this.isHotkeyMatch('montage3', event)) {
                        this.$store.dispatch('eeg.set-active-montage', this.RESOURCE.montages[2].name)
                        this.hotkeyEvents.montage3 = false
                    } else if (this.isHotkeyMatch('montage4', event)) {
                        this.$store.dispatch('eeg.set-active-montage', this.RESOURCE.montages[3].name)
                        this.hotkeyEvents.montage4 = false
                    }
                } else if (this.isHotkeyMatch('report', event)) {
                    this.toggleReport()
                    this.hotkeyEvents.annotation = false
                } else if (this.isHotkeyMatch('annotation', event)) {
                    this.toggleSidebar('annotations')
                    this.hotkeyEvents.annotation = false
                } else if (this.isHotkeyMatch('examine', event)) {
                    this.analysisWindow.nr++
                    this.analysisWindow.tab = 'examine'
                    if (!this.analysisWindow.open) {
                        await this.openAnalysisWindow()
                    }
                    this.hotkeyEvents.examine = false
                } else if (this.isHotkeyMatch('fft', event)) {
                    this.analysisWindow.nr++
                    this.analysisWindow.tab = 'fft'
                    if (!this.analysisWindow.open) {
                        await this.openAnalysisWindow()
                    }
                    this.hotkeyEvents.fft = false
                } else if (this.isHotkeyMatch('inspect', event)) {
                    this.toggleCursorTool('inspect')
                    this.hotkeyEvents.inspect = false
                } else if (this.isHotkeyMatch('notch', event) && this.SETTINGS.notchDefaultFrequency) {
                    if (this.RESOURCE.filters.notch) {
                        // If notch filter is active, disable.
                        this.$store.dispatch('eeg.set-notch-filter', 0)
                    } else {
                        // Enable notch filter with default frequency.
                        this.$store.dispatch('eeg.set-notch-filter', this.SETTINGS.notchDefaultFrequency)
                    }
                    this.hotkeyEvents.notch = false
                } else if (this.isHotkeyMatch('topogram', event)) {
                    if (!this.$store.state.SERVICES.get('pyodide')) {
                        return
                    }
                    this.analysisWindow.nr++
                    this.analysisWindow.tab = 'topo'
                    if (!this.analysisWindow.open) {
                        if (!(await this.loadSelectionSignals())) {
                            Log.error(`Could not load signal data to trace selections.`, this.$options.name as string)
                        } else {
                            this.analysisWindow.open = true
                        }
                    }
                    this.hotkeyEvents.topogram = false
                }
            }
            if (this.modKey === event.key) {
                this.modKey = null
            }
        },
        /**
         * Hide all elements overlaying the plot, including windows.
         */
        hideAllOverlayElements () {
            this.analysisWindow.open = false
            if (this.menuChannel && this.isOnlyMenuChannelActive) {
                this.menuChannel.isActive = false
            }
            this.menuChannel = null
            this.contextMenu = null
            this.hideAllDragElements()
        },
        hideSideDrawer () {
            this.$store.dispatch('eeg.set-open-sidebar', null)
        },
        /**
         * Does the keyboard event match the specified hotkey settings.
         * @param hotkey - Name of the hotkey settings.
         * @param event - Keyboard event to check.
         */
        isHotkeyMatch (hotkey: string, event: KeyboardEvent) {
            const hotkeySettings = this.SETTINGS.hotkeys[hotkey as keyof typeof this.SETTINGS.hotkeys]
            if (!hotkeySettings) {
                return false
            }
            if (!this.hotkeyEvents[hotkey as keyof typeof this.hotkeyEvents]) {
                return false
            }
            if (this.$store.state.INTERFACE.app.reservedKeys.includes(event.code)) {
                return false
            }
            if (hotkeySettings.control && !event.ctrlKey) {
                return false
            }
            if (hotkeySettings.shift && !event.shiftKey) {
                return false
            }
            if (
                (hotkeySettings.modKey === false && this.modKey) ||
                (hotkeySettings.modKey && hotkeySettings.modKey !== this.modKey)
            ) {
                return false
            }
            if (hotkeySettings.code !== event.code) {
                return false
            }
            return true
        },
        isVideoPlaying () {
            return this.video && !this.video.paused && !this.video.ended
        },
        async montagesChanged () {
            if (!this.montageSetupDone) {
                // Get number of montages in setups that are included in defaultSetups to load.
                const nDefaultMontages = Object.entries(this.SETTINGS.defaultMontages || {})
                                               .filter(([key, _value]) => this.SETTINGS.defaultSetups?.includes(key))
                                               .map(([_key, value]) => value)
                                               .flat().length || 0
                // Extra montages are loaded once the default montages are set up.
                const nExtraMontages = Object.values(this.SETTINGS.extraMontages || {}).flat().length || 0
                const totalMontages = this.SETTINGS.skipDefaultSetups
                                    ? nExtraMontages
                                    : nDefaultMontages + nExtraMontages
                if (!this.SETTINGS.skipDefaultSetups && this.RESOURCE.montages.length < nDefaultMontages) {
                    this.setupMessage = this.$t('Setting up montage {current} of {total}', {
                        current: this.RESOURCE.montages.length + 1,
                        total: totalMontages,
                    })
                } else {
                    this.montageSetupDone = true
                }
                // Apply viewer settings to all recording montages.
                for (const montage of this.RESOURCE.montages) {
                    montage.setChannelLayout({ ...this.SETTINGS })
                }
                // Activate the user default montage once it has been loaded. If it cannot be found for some reason,
                // activate the first montage in the list (as recorded).
                if (!this.RESOURCE.activeMontage) {
                    const defRgx = new RegExp(`:${this.SETTINGS.defaultMontage}$`)
                    const userDefault = this.RESOURCE.montages.find(m => m.name.match(defRgx))
                    if (userDefault) {
                        this.RESOURCE.setActiveMontage(userDefault.name)
                    } else if (this.montageSetupDone) {
                        this.RESOURCE.setActiveMontage(0)
                    }
                }
                if (this.montageSetupDone) {
                    // Finally, start setting up additional montages.
                    for (const [setup, montages] of Object.entries(this.SETTINGS.extraMontages)) {
                        for (const montage of montages) {
                            Log.debug(
                                `Adding extra montage '${montage.name}' to setup '${setup}''`,
                                this.$options.name!
                            )
                            this.RESOURCE.addMontage(`${setup}:${montage.name}`, montage.label, setup, montage)
                        }
                    }
                    // Resolve cascade montage entries against the now-populated setups list and
                    // register one cascade montage per entry whose source candidate matches. The
                    // recording exposes addCascadeMontagesFromEntries as a Promise-returning helper;
                    // we don't await here because additional montages are added in a fire-and-forget
                    // pattern (same as the extraMontages loop above). The settings shape is keyed
                    // by setup name (mirroring extraMontages), so check Object.keys().length, not
                    // Array.length.
                    const cascadeEntries = this.SETTINGS.cascadeMontages
                    if (cascadeEntries && Object.keys(cascadeEntries).length && this.RESOURCE.addCascadeMontagesFromEntries) {
                        this.RESOURCE.addCascadeMontagesFromEntries(cascadeEntries)
                    }
                }
            }
        },
        removeAllHighlights () {
            this.onnxHighlights.splice(0)
        },
        removeAllOverlayElements (keepActiveDrag = false) {
            this.analysisWindow.open = false
            this.contextMenu = null
            this.removeAllDragElements(keepActiveDrag)
            this.removeAllHighlights()
        },
        selectDrawerTab (value: string) {
            this.sidebarTab = value
        },
        signalCacheChanged () {
            if (this.RESOURCE.signalCacheStatus[1] > 0) {
                // Activate the first montage if the recording has been waiting for initial data to load.
                if (!this.dataSetupDone && !this.RESOURCE.activeMontage && this.RESOURCE.montages.length) {
                    this.RESOURCE.setActiveMontage(0)
                }
                this.dataSetupDone = true
            }
        },
        handleInterfaceSettingChange (e: Event) {
            const detail = (e as CustomEvent).detail
            const field = detail?.property as string
            const value = detail?.newValue
            if (field === 'eeg.epochMode.enabled' || field === 'eeg.epochMode.epochLength') {
                this.checkEpochMode()
                if (value) {
                    // Epoch mode was enabled or the epoch length was set above zero.
                    this.applyEpochView()
                }
                this.$nextTick(() => {
                    this.timebaseChanged()
                })
            } else if (field === 'eeg.epochMode.onlyFullEpochs' && value) {
                // Make sure we're not outside the epoch range if full epochs are required.
                this.applyEpochView()
            } else if (field === 'eeg.epochMode.display' || field === 'eeg.epochMode.contextEpochs') {
                // Keep the focused epoch; re-centre the view for the new context and resize
                // the page (secPerPage) to match.
                if (this.isInEpochMode) {
                    this.applyEpochView()
                }
                this.$nextTick(() => {
                    this.timebaseChanged()
                })
            }
        },
        timebaseChanged () {
            // RESOURCE.timebase and RESOURCE.timebaseUnit are routing-aware getters — they
            // surface the active montage's override values when `applyToMontage` is true
            // (e.g. cascade montages forcing sec/page with a row-sized page length). No
            // manual consult is needed here.
            if (this.isInEpochMode || this.RESOURCE.timebaseUnit === 'secPerPage') {
                this.cmPerSec = 0
                const epochMode = this.SETTINGS.epochMode
                // In centered (semi-epoch) display the page widens to fit the focused
                // epoch plus `contextEpochs` faded epochs on each side.
                const context = this.isInEpochMode && epochMode.display === 'centered'
                    ? Math.max(0, Math.round(epochMode.contextEpochs ?? 1))
                    : 0
                this.secPerPage = epochMode.epochLength
                    ? epochMode.epochLength * (1 + 2 * context)
                    : this.RESOURCE.timebase
            } else if (this.RESOURCE.timebaseUnit === 'cmPerSec') {
                this.secPerPage = 0
                this.cmPerSec = this.RESOURCE.timebase
            }
            this.calculatePxPerSecond()
        },
        toggleChannelActive (channel: MontageChannel) {
            if (!channel?.id) {
                return // Raw signals.
            }
            if (channel.isActive && channel.id === this.menuChannel?.id) {
                this.menuChannel = null
            }
            channel.isActive = !channel.isActive
            this.channelsChanged++
        },
        toggleChannelMenu (channel: MontageChannel) {
            if (!channel?.id) {
                return // Raw signals.
            }
            if (this.menuChannel?.id === channel.id) {
                this.menuChannel.isActive = false
                this.menuChannel = null
            } else {
                if (this.menuChannel && this.isOnlyMenuChannelActive) {
                    this.menuChannel.isActive = false
                }
                channel.isActive = true
                this.menuChannel = channel
            }
        },
        toggleCursorTool (tool: string | null) {
            if (this.activeCursorTool === tool) {
                this.$store.dispatch('eeg.set-cursor-tool', null)
            } else {
                this.$store.dispatch('eeg.set-cursor-tool', tool)
            }
        },
        /**
         * Toggle the trend strip and resize the bottom split-panel slot accordingly. Toggling on
         * expands the slot by `TREND_DEFAULT_HEIGHT` so the trend has room; toggling off snaps
         * the slot back to `NAVIGATOR_MIN_HEIGHT` (per user preference — simpler
         * model than remembering the dragged size).
         */
        handleNavigatorToggleControls (open: boolean) {
            this.controlsOpen = open
        },
        handleTrendToggleControls (open: boolean) {
            this.controlsOpen = open
        },
        setTrendVisible (visible: boolean) {
            if (this.trendVisible === visible) {
                return
            }
            this.trendVisible = visible
            // Suppress `handleNavigatorResize`'s writeback during the wa-split-panel transition.
            // Without this, wa-split-panel emits `wa-reposition` with intermediate / stale
            // offsetHeight values while it animates the divider, those values get written back
            // into `navigatorHeight`, our reactive cascade fires again, the split panel transitions
            // again, etc. — a feedback loop with ~250 ms per iteration (drawTrends iterating the
            // accumulated trend signal). 400 ms is generous for the transition to settle.
            this.suppressResizeFor(400)
            if (visible) {
                // Default to NAVIGATOR_MIN_HEIGHT + TREND_DEFAULT_HEIGHT unless the user has already dragged wider.
                if (this.navigatorHeight < NAVIGATOR_MIN_HEIGHT + TREND_DEFAULT_HEIGHT) {
                    this.navigatorHeight = NAVIGATOR_MIN_HEIGHT + TREND_DEFAULT_HEIGHT
                }
                // On-demand trend setup: when `aeeg.autoCompute` is false (the default), the
                // recording defers trend instantiation until something asks for it. Toggling
                // the strip visible IS that ask. `ensureTrendSetup` is a no-op when the
                // trend already exists for the active montage, so repeated toggles are cheap;
                // it also handles the case of caching not yet complete by queueing the request
                // for the `SIGNAL_CACHING_COMPLETE` event.
                const resource = this.RESOURCE as unknown as {
                    ensureTrendSetup?: (type?: string) => void
                    removeAllTrends?: () => void
                    clearTrendTypes?: () => void
                    trends?: Record<string, { derivation: { type: string } }>
                }
                const selectedTrend = (this.$store.state.INTERFACE as { modules?: Map<string, { selectedTrend?: string }> })
                    .modules?.get('eeg')?.selectedTrend ?? 'aeeg'
                const trendType = TREND_REGISTRY[selectedTrend]?.derivationType ?? selectedTrend
                // If the strip was hidden while the user switched trend types, existing
                // trends are the wrong type. Remove them before building the new type.
                const existingTypes = new Set(
                    Object.values(resource.trends ?? {}).map(t => t.derivation.type)
                )
                if (existingTypes.size > 0 && !existingTypes.has(trendType)) {
                    resource.removeAllTrends?.()
                    resource.clearTrendTypes?.()
                }
                resource.ensureTrendSetup?.(trendType)
            } else {
                this.navigatorHeight = NAVIGATOR_MIN_HEIGHT
            }
            this.$nextTick(() => this.resizeElements())
        },
        toggleReport (state?: boolean) {
            const isActive = this.$interface.store.modules.get('eeg')!.isReportOpen
            if (isActive && !state) {
                this.$store.dispatch('eeg.set-report-open', false)
            } else {
                this.$store.dispatch('eeg.set-report-open', true)
            }
        },
        toggleSidebar (sidebar: string, state?: boolean) {
            const isActive = this.$interface.store.modules.get('eeg')!.openSidebar === sidebar
            if (isActive && !state) {
                this.$store.dispatch('eeg.set-open-sidebar', null)
            } else {
                this.$store.dispatch('eeg.set-open-sidebar', sidebar)
            }
        },
        updateHighlights () {
            for (let i=0; i<this.onnxHighlights.length; i++) {
                const hl = this.onnxHighlights[i]
                if (
                    hl.start <= this.RESOURCE.viewStart + this.viewRange
                 && hl.end > this.RESOURCE.viewStart
                ) {
                    hl.visible = true
                } else {
                    hl.visible = false
                }
            }
        },
        videoEnteredPnP () {
            this.videoWrapper.style.height = '50px'
            this.videoWrapper.style.opacity = '0.1'
            this.video.style.top = '-310px'
        },
        videoLeftPnP () {
            this.videoWrapper.style.height = '360px'
            this.videoWrapper.style.opacity = 'initial'
            this.video.style.top = '0'
        },
        videoReady () {
            const vidOffset = this.RESOURCE.videos[0].startTime
            if (vidOffset <= this.cursors.mainCursorPos) {
                // We already have video available at current position
                this.video.currentTime = this.cursors.mainCursorPos - vidOffset
            } else {
                this.video.currentTime = NUMERIC_ERROR_VALUE
            }
            this.lastVideoTime = this.video.currentTime
            this.video.removeEventListener('canplay', this.videoReady)
            // Start a loop checking the video position and updating cursor to match it
            requestAnimationFrame(this.checkVideoPosLoop)
        },
        viewStartChanged (newStart: unknown, oldStart: unknown) {
            this.removeAllOverlayElements(true)
            if (this.dragAction) {
                const startDelta = (newStart as number) - (oldStart as number)
                this.dragAction.dragPos += startDelta
            }
        },
        viewStartUpdated () {
            this.updateDragElement()
            this.updateHighlights()
            if (this.RESOURCE.videos.length) {
                // Match video time to cursor time
                const vidOffset = this.RESOURCE.videos[0].startTime
                this.video.currentTime = this.cursors.mainCursorPos - vidOffset
            }
        },
    },
    beforeMount () {
        // Add component styles to shadow root.
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
        // Set default display properties.
        if (!this.RESOURCE.sensitivity) {
            const sensitivity =  this.SETTINGS.sensitivity[this.SETTINGS.sensitivityUnit]
            this.RESOURCE.sensitivity = sensitivity.default*(sensitivity.scale || 1)
        }
        if (!this.RESOURCE.timebase) {
            this.RESOURCE.timebaseUnit = this.SETTINGS.timebaseUnit
            this.RESOURCE.timebase = this.SETTINGS.timebase[this.SETTINGS.timebaseUnit].default
        }
        if (!this.RESOURCE.filters.highpass) {
            this.RESOURCE.setHighpassFilter(this.SETTINGS.filters.highpass.default)
        }
        if (!this.RESOURCE.filters.lowpass) {
            this.RESOURCE.setLowpassFilter(this.SETTINGS.filters.lowpass.default)
        }
        if (!this.RESOURCE.filters.notch) {
            this.RESOURCE.setNotchFilter(this.SETTINGS.filters.notch.default)
        }
        // Check if we are in epoch mode and adjust view start if needed.
        this.checkEpochMode()
        if (this.isInEpochMode) {
            this.applyEpochView()
        }
        // Check timebase scale to use and calculate pixels per second.
        this.timebaseChanged()
    },
    mounted () {
        // Add property update handlers
        this.RESOURCE.onPropertyChange('activeMontage', this.activeMontageChanged, this.ID)
        this.RESOURCE.onPropertyChange('displayViewStart', this.viewStartUpdated, this.ID)
        this.RESOURCE.onPropertyChange('isActive', () => {
            if (!this.RESOURCE.isActive) {
                // Remove all event listeners before the resource becomes null.
                this.RESOURCE.removeAllEventListeners(this.ID)
            }
        }, this.ID, 'before')
        this.RESOURCE.onPropertyChange('montages', this.montagesChanged, this.ID)
        this.RESOURCE.onPropertyChange('signalCacheStatus', this.signalCacheChanged, this.ID)
        this.RESOURCE.onPropertyChange('timebase', this.timebaseChanged, this.ID)
        this.RESOURCE.onPropertyChange('viewStart', this.viewStartChanged, this.ID)
        // keydown and blur are managed by useBiosignalKeyboard; register keyup here.
        window.addEventListener('keyup', this.handleKeyup, false)
        // Listen to some store state changes
        this.unsubscribe = this.$store.subscribe((mutation) => {
            if (mutation.type === 'set-settings-value') {
                if (mutation.payload.field === 'app.screenPPI') {
                    this.$nextTick(() => {
                        this.calculatePxPerSecond()
                        this.resizeElements()
                    })
                } else if (
                    mutation.payload.field.startsWith('eeg.majorGrid.') ||
                    mutation.payload.field.startsWith('eeg.minorGrid.')
                ) {
                    this.$nextTick(() => {
                        this.resizeElements()
                    })
                }
            }
        })
        // Epoch-mode reactivity is driven by the interface-scoped `setting-changed` event that
        // INTERFACE.setFieldValue emits, so dialog changes and external setFieldValue calls
        // both reach here.
        this.unsubscribeSettings = window.__EPICURRENTS__.EVENT_BUS?.addScopedEventListener(
            InterfaceEvents.SETTING_CHANGED,
            this.handleInterfaceSettingChange.bind(this),
            this.ID,
            EventScopes.INTERFACE,
            'after',
        ) ?? null
        // Answer focused-epoch requests so a consumer that subscribes after the last change (e.g. a
        // panel mounting mid-recording) can pull the current epoch instead of waiting for the next
        // navigation.
        this.unsubscribeEpochRequest = window.__EPICURRENTS__.EVENT_BUS?.addScopedEventListener(
            InterfaceEvents.REQUEST_EPOCH,
            this.emitFocusedEpoch.bind(this),
            this.ID,
            EventScopes.INTERFACE,
            'after',
        ) ?? null
        // Let a consumer step the focused epoch (e.g. advance after labelling one).
        this.unsubscribeStepEpoch = window.__EPICURRENTS__.EVENT_BUS?.addScopedEventListener(
            InterfaceEvents.STEP_EPOCH,
            this.handleStepEpoch.bind(this),
            this.ID,
            EventScopes.INTERFACE,
            'after',
        ) ?? null
        // Publish the initial epoch for any consumer already listening.
        this.emitFocusedEpoch()
        this.unsubscribeActions = this.$store.subscribeAction((action) => {
            if (action.type === 'redo-action') {
                this.redoAction()
            } else if (action.type === 'eeg.set-cursor-tool') {
                if (action.payload === 'inspect') {
                    this.overlay.style.cursor = 'zoom-in'
                    this.plot.$el.style.cursor = 'zoom-in'
                } else {
                    this.overlay.style.cursor = 'initial'
                    this.plot.$el.style.cursor = 'initial'
                }
                this.activeCursorTool = action.payload
            } else if (action.type === 'eeg.set-report-open') {
                this.reportWindow.open = action.payload
            } else if (action.type === 'eeg.set-open-sidebar') {
                this.sidebarOpen = action.payload
            } else if (action.type === 'eeg.set-trend-visible') {
                this.setTrendVisible(action.payload as boolean)
            } else if (action.type === 'eeg.toggle-trend-visible') {
                this.setTrendVisible(!this.trendVisible)
            } else if (action.type === 'undo-action') {
                this.undoAction()
            }
        })
        // Restore trend-strip visibility for this resource. If the user has previously
        // visited this resource, honour their last explicit choice (hide stays hidden
        // even if trend data exists). On a first visit, fall back to showing the strip
        // when the resource already has computed trend data.
        const lastKnown = trendVisibilityByResource.get(this.RESOURCE.id)
        const hasTrends = Object.keys(this.RESOURCE.trends || {}).length > 0
        this.$store.dispatch('eeg.set-trend-visible', lastKnown ?? hasTrends)
        if (this.video) {
            this.video.addEventListener('canplay', this.videoReady)
            this.video.addEventListener('enterpictureinpicture', this.videoEnteredPnP)
            this.video.addEventListener('leavepictureinpicture', this.videoLeftPnP)
            // Arrow keys will skip the video forward/backward if the element is allowed to keep focus
            this.video.onfocus = () => {
                this.video.blur()
            }
        }
        // Set up missing additional setups.
        for (const setup of this.SETTINGS.extraSetups) {
            this.RESOURCE.addSetup(setup)
        }
        this.montagesChanged()
        //const ONNX = window.__EPICURRENTS__.RUNTIME?.SERVICES.get('ONNX') as OnnxService
        //if (ONNX) {
        //    ONNX.resetProgress()
        //    ONNX.setSourceResource(this.RESOURCE)
        //}
        if (this.PYODIDE) {
            null
        }
        // Init signal cache monitoring.
        this.signalCacheChanged()
        // Load report categories, if needed.
        if (!this.reportSchemaManager.schemasLoaded) {
            this.reportSchemaManager.parseSchemas().then(() => {
                Log.debug('Report schemas loaded.', this.$options.name as string)
                this.reportWindow.category = 'eeg'
            }).catch((err) => {
                Log.error(`Could not load report schemas: ${err.message}`, this.$options.name as string)
            })
        }
    },
    beforeUnmount () {
        // Remember the user's current trend-strip choice so the next mount can restore it.
        if (this.RESOURCE?.id) {
            trendVisibilityByResource.set(this.RESOURCE.id, this.trendVisible)
        }
        // Clear possible undo and redo state.
        this.$store.commit('set-redoable-action', false)
        this.$store.commit('set-undoable-action', false)
        // Remove property update handlers
        this.RESOURCE?.removeAllEventListeners(this.ID)
        window.removeEventListener('keyup', this.handleKeyup, false)
        // Remove possible hanging promises
        this.resolvePlotUpdate = null
        // Unsubscribe from store
        this.unsubscribe?.()
        this.unsubscribeActions?.()
        this.unsubscribeSettings?.()
        this.unsubscribeEpochRequest?.()
        this.unsubscribeStepEpoch?.()
        // Cancel possible waiting animation frame
        if (this.nextAnimationFrame) {
            cancelAnimationFrame(this.nextAnimationFrame)
        }
        //const ONNX = this.$store.state.SERVICES.get('ONNX') as OnnxService
        //if (ONNX) {
        //    ONNX.setSourceResource(null)
        //}
    },
})
</script>

<style scoped>
.viewer {
    display: flex;
    height: 100%;
    overflow: hidden;
    width: 100%;
}
.main {
    flex: 1;
    height: 100%;
    position: relative;
}
    .timebase {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }
    .selection-bound {
        position: absolute;
        top: 0;
        bottom: 0;
        box-sizing: content-box;
        width: 0;
        pointer-events: none;
    }
    .cursor {
        display: none;
        position: absolute;
        top: 0;
        left: -5px;
        bottom: 0;
        padding: 0 5px;
        cursor: pointer;
    }
        .cursor > div {
            height: 100%;
            pointer-events: none;
        }
    .selection-area {
        position: absolute;
    }
    .highlight-area {
        position: absolute;
        pointer-events: none;
    }
    .video {
        position: absolute;
        bottom: 0;
        right: 0;
        height: 360px;
        overflow: hidden;
        transition: opacity ease 0.25s;
    }
        .video:hover {
            opacity: 1 !important;
        }
        .video video {
            position: relative;
            height: 360px;
        }
        .video video::-webkit-media-controls-timeline {
            display: none;
        }
    .setup {
        position: absolute;
        inset: 0;
    }
        .setup > div {
            position: absolute;
            top: 50%;
            left: 80px;
            transform: translateY(-50%);
            padding: 2rem;
            font-size: 2rem;
            background-color: var(--epicv-background);
            opacity: 30%;
        }
.bottom-stack {
    /* Explicit pixel flex basis is bound inline via :style on each child (trend / navigator) —
       this is the only way to guarantee the two strips don't overlap when wa-split-panel's
       layout update lags behind the prop change. The CSS here only sets the layout direction. */
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
}
    .bottom-stack > .trend,
    .bottom-stack > .navigator {
        min-height: 0;
        overflow: hidden;
    }
</style>
