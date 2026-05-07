<template>
    <split-panel-view
        data-component="eeg-viewer"
        orientation="vertical"
        :primary-size-bounds="['75px', '20%']"
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
                                :overlay="overlay"
                                :pxPerSecond="pxPerSecond"
                                :secPerPage="secPerPage"
                                :viewRange="viewRange"
                                :visibleRange="visibleRange"
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
                            <!-- Annotations-->
                            <annotation-labels v-if="overlay && viewReady"
                                :overlay="overlay"
                                :pxPerSecond="pxPerSecond"
                                :secPerPage="viewRange"
                                :SETTINGS="SETTINGS"
                                :viewRange="viewRange"
                                v-on:delete-annotation="removeUserEvents"
                                v-on:edit-annotation="editEvent"
                                v-on:updated="handleEventsUpdated"
                            />
                            <!-- Selected signal segments -->
                            <div v-for="(_selection, idx) in plotSelections" :key="`drag-selection-${idx}`"
                                :id="`signal-selection-${idx}`"
                                class="selection-area"
                                :style="selectionStyles"
                                @click="handleSelectionClick(idx)"
                                @contextmenu.prevent=""
                            ></div>
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
                        :availableTabs="['create', 'events']"
                        class="sidebar"
                        :open="sidebarOpen === 'annotations'"
                        :selections="plotSelections"
                        :tab="sidebarTab"
                        :visibleRange="visibleRange"
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
            <eeg-navigator ref="navigator"
                class="navigator"
                :cursorPos="cursors?.mainCursorPos || 0"
                :height="navigatorHeight"
                :selectionBound="selectionBound"
                :visibleRange="visibleRange"
                :width="viewerSize[0]"
                v-on:loaded="resizeElements"
                v-on:backward="goBackward"
                v-on:forward="goForward"
                v-on:navigation="handlePlotNavigation"
            />
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
import { Log } from 'scoped-event-log'
import type {
    AnnotationEventTemplate,
    BiosignalAnnotationEvent,
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
import { useBiosignalPointer } from '#app/views/biosignal/useBiosignalPointer'
import type { ContextMenuContext } from '#types/interface'
import { EegEvent } from '@epicurrents/eeg-module'
import type { PlotSelection } from '#app/views/biosignal/types'
import type { SignalHighlight } from '#types/plot'

// Child components
import AnnotationLabels from '#app/views/biosignal/overlays/AnnotationLabels.vue'
import AnnotationEditor from '#app/views/biosignal/overlays/AnnotationEditor.vue'
import AnnotationSidebar from '#app/views/biosignal/sidebars/AnnotationSidebar.vue'
import ChannelHighlights from '#app/views/biosignal/overlays/ChannelHighlights.vue'
import ContextMenu from '#app/views/biosignal/overlays/ContextMenu.vue'
import DynamicReportForm from '#components/report/components/DynamicReportForm.vue'
import EegAnalysisTools from './overlays/EegAnalysisTools.vue'
import EegChannelProperties from './overlays/EegChannelProperties.vue'
import EegNavigator from './EegNavigator.vue'
import EegPlot from './EegPlot.vue'
import PlotYAxis from '#app/views/biosignal/plots/PlotYAxis.vue'
import SplitPanelView from '#root/src/app/views/SplitPanelView.vue'
import TimescaleGrid from '#app/views/biosignal/overlays/TimescaleGrid.vue'
import VerticalCursors from '#app/views/biosignal/overlays/VerticalCursors.vue'
import ViewerOverlay, { type PointerEventOverlay } from '#app/overlays/PointerEventOverlay.vue'
import WindowDialog from '#app/overlays/WindowDialog.vue'
import { deepEqual } from '@epicurrents/core/util'
import type { default as WaSplitPanel } from '@awesome.me/webawesome/dist/components/split-panel/split-panel.js'
import { SchemaManager } from '#root/src/components/report'


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
        ChannelHighlights,
        ContextMenu,
        DynamicReportForm,
        EegAnalysisTools,
        EegChannelProperties,
        EegNavigator,
        EegPlot,
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
        const navigatorHeight = ref(75)
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
        const { borderWidth, plotDimensions, pxPerSecond, visibleRange } = layout
        const viewRange = computed(() => secPerPage.value || plotDimensions.value[0] / pxPerSecond.value)
        const annoEditor = useBiosignalAnnotationEditor(eegCtx.RESOURCE, editingEvents, editingEventsMode)

        const analysis = useBiosignalAnalysis(eegCtx.RESOURCE, plotSelections, 'EegViewer')

        const nav = useBiosignalNavigation(
            eegCtx.RESOURCE,
            eegCtx.SETTINGS,
            visibleRange,
            (position, _goTo) => {
                eegCtx.RESOURCE.viewStart = Math.max(Math.floor(position - visibleRange.value/2), 0)
            },
            video,
        )

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
            channelsChanged,
            cmPerSec,
            contextMenu,
            dataSetupDone,
            dragAction,
            dragButton,
            editingEvents,
            editingEventsMode,
            lastCacheEnd,
            lastVideoTime,
            menuChannel,
            pointerDownPoint,
            navigatorHeight,
            nextAnimationFrame,
            onnxContinue,
            onnxHighlights,
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
            viewRange,
            viewReady,
            yAxisWidth,
            // Template refs
            component,
            cursors,
            navigator,
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
        viewerSize (value) {
            if (!this.viewReady && value[0] > 0 && value[1] > 0) {
                this.viewReady = true
            }
            if (!value || !value[0] || !value[1]) {
                return
            }
            this.resizeElements()
            if (this.secPerPage) {
                this.$nextTick(() => {
                    this.calculatePxPerSecond()
                })
            }
        },
    },
    computed: {
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
         * Perform appropriate operations when the active montage changes.
         */
        activeMontageChanged () {
            this.hideAllOverlayElements()
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
                    if (this.hotkeyEvents.annotation && this.plotSelections.length) {
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
                        for (const props of Object.values(this.SETTINGS.annotations.classes)) {
                            const code = parseInt(quickCode[1])
                            if (props.quickCode === code) {
                                this.createEvents(props)
                                this.hotkeyEvents.annotation = false
                                return
                            }
                        }
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
        timebaseChanged () {
            if (this.isInEpochMode || this.RESOURCE.timebaseUnit === 'secPerPage') {
                this.cmPerSec = 0
                this.secPerPage = this.SETTINGS.epochMode.epochLength || this.RESOURCE.timebase
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
            this.goTo(this.RESOURCE.viewStart)
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
                    mutation.payload.field === 'eeg.epochMode.enabled'
                    || mutation.payload.field === 'eeg.epochMode.epochLength'
                ) {
                    this.checkEpochMode()
                    if (mutation.payload.value) {
                        // Either epoch mode was enable or epoch length was set to over zero.
                        this.goTo(this.RESOURCE.viewStart)
                    }
                    this.$nextTick(() => {
                        this.timebaseChanged()
                    })
                } else if (mutation.payload.field === 'eeg.epochMode.onlyFullEpochs' && mutation.payload.value) {
                    // Make sure we're not outside the epoch range if full epochs are required.
                    this.goTo(this.RESOURCE.viewStart)
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
            } else if (action.type === 'undo-action') {
                this.undoAction()
            }
        })
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
</style>
