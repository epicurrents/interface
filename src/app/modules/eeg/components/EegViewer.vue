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
                            <!-- Highlights
                            <channel-highlights v-if="overlay"
                                :overlay="overlay"
                                :secPerPage="viewRange"
                                :SETTINGS="SETTINGS"
                                :viewRange="viewRange"
                                v-on:updated="handleEventsUpdated"
                            /> -->
                            <!-- Timebase -->
                            <timescale-grid
                                :pxPerSecond="pxPerSecond"
                                :viewerSize="plotDimensions"
                            />
                            <!--<div ref="timebase" class="timebase"></div>-->
                            <eeg-plot ref="plot" v-if="overlay"
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
                            <annotation-labels v-if="overlay"
                                :overlay="overlay"
                                :secPerPage="viewRange"
                                :SETTINGS="SETTINGS"
                                :viewRange="viewRange"
                                v-on:delete-annotation="removeEvents"
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
                        class="sidebar"
                        :open="sidebarOpen === 'annotations'"
                        :selections="plotSelections"
                        :tab="sidebarTab"
                        :visibleRange="visibleRange"
                        v-on:close="hideSideDrawer"
                        v-on:create-events="createEvents"
                        v-on:remove-event="removeEvents"
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
import { defineComponent, PropType, reactive, Ref, ref } from 'vue'
import { T } from '#i18n'
import { settingsColorToRgba } from '@epicurrents/core/util'
import { useEegContext } from '../'
import { useStore } from 'vuex'
import { NUMERIC_ERROR_VALUE } from '@epicurrents/core/util'
import { NO_POINTER_BUTTON_DOWN } from '#util'
import { Log } from 'scoped-event-log'
import type {
    AnnotationLabel,
    AnnotationEventTemplate,
    BiosignalAnnotationEvent,
    BiosignalChannel,
    ChannelPositionProperties,
    MontageChannel,
} from '@epicurrents/core/types'
import type { SignalSelectionLimit, UndoOrRedoAction } from '#types/interface'
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

const MAX_SIGNAL_SELECTIONS = 20

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
    setup () {
        const store = useStore()
        const activeCursorTool = ref(null as string | null)
        const activeSelection = ref(null as PlotSelection | null)
        const analysisWindow = reactive({
            height: 600,
            left: window.innerWidth / 2 - 350,
            /** Update the number each time the analysis window is opened to discard any cached data. */
            nr: 0,
            open: false,
            tab: 'fft',
            top: window.innerHeight / 2 - 300,
            width: 700,
        })
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
        const epochStart = ref(0)
        const hotkeyEvents = reactive({
            annotation: false,
            examine: false,
            fft: false,
            inspect: false,
            montage1: false,
            montage2: false,
            montage3: false,
            montage4: false,
            notch: false,
            report: false,
            topogram: false,
        })
        const isAtEnd = ref(false)
        const isAtStart = ref(false)
        const isInEpochMode = ref(false)
        const lastCacheEnd = ref(0)
        const lastVideoTime = ref(0)
        const menuChannel = ref(null as MontageChannel | null)
        const montageSetupDone = ref(false)
        const pointerDownPoint = reactive({ x: NUMERIC_ERROR_VALUE, y: NUMERIC_ERROR_VALUE })
        const navigatorHeight = ref(75)
        const nextAnimationFrame = 0
        const onnxContinue = ref(false)
        const onnxHighlights = reactive([] as SignalHighlight[])
        const plotDimensions = ref([0, 0])
        const plotSelections = reactive([] as PlotSelection[])
        const pxPerSecond = ref(0)
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
        const resolvePlotUpdate = null as ((result: any) => void) | null
        const secPerPage = ref(0)
        const selectedIndex = ref(0)
        const selectionBound = ref(null as SignalSelectionLimit | null)
        const setupMessage = ref('')
        const showVideo = ref(true)
        const sidebarOpen = ref(null as string | null)
        const sidebarTab = ref('events')
        const sidebarWidth = ref(350)
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
        /**
         * List of redoable actions ordered from the oldest to the most recent.
         * Type of `args` depends on the action:
         * - `add-annotations`: BiosignalAnnotationEvent[]
         * - `remove-annotations`: BiosignalAnnotationEvent[]
         */
        const redoableActions = ref([] as UndoOrRedoAction[])
        /**
         * List of undoable actions ordered from the oldest to the most recent.
         * Type of `args` depends on the action:
         * - `add-annotations`: BiosignalAnnotationEvent[]
         * - `remove-annotations`: BiosignalAnnotationEvent[]
         */
        const undoableActions = ref([] as UndoOrRedoAction[])
        // Unsubscribe from store mutations
        const unsubscribe = ref(null as (() => void) | null)
        const unsubscribeActions = ref(null as (() => void) | null)
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
            /** Time position where the first epoch starts. */
            epochStart,
            hotkeyEvents,
            /** Is the current view at the end of the loaded data? */
            isAtEnd,
            /** Is the current view at the start of the loaded data? */
            isAtStart,
            /** Should data be browsed in epocs. */
            isInEpochMode,
            lastCacheEnd,
            lastVideoTime,
            menuChannel,
            pointerDownPoint,
            navigatorHeight,
            nextAnimationFrame,
            onnxContinue,
            onnxHighlights,
            plotDimensions,
            recordingReady,
            redoableActions,
            reportSchemaManager,
            reportWindow,
            resolvePlotUpdate,
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
            undoableActions,
            yAxisWidth,
            // Template refs
            component,
            cursors,
            navigator,
            overlay,
            panel,
            plot,
            pxPerSecond,
            montageSetupDone,
            setupMessage,
            sidebar,
            //timebase,
            analysisWindow,
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
            // Scope properties
            ...useEegContext(store, 'EegViewer'),
        }
    },
    watch: {
        viewerSize (value) {
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
        borderWidth () {
            const showLeftBorder = this.SETTINGS.border.left !== undefined
                                   ? this.SETTINGS.border.left.show === false
                                     ? false : true
                                   : false
            const showRightBorder = this.SETTINGS.border.right !== undefined
                                    ? this.SETTINGS.border.right.show === false
                                      ? false : true
                                    : false
            const showTopBorder = this.SETTINGS.border.top !== undefined
                                  ? this.SETTINGS.border.top.show === false
                                    ? false : true
                                  : false
            const showBtmBorder = this.SETTINGS.border.bottom !== undefined
                                  ? this.SETTINGS.border.bottom.show === false
                                    ? false : true
                                  : false
            return {
                bottom: showBtmBorder ? this.SETTINGS.border.bottom?.width || 0 : 0,
                left: showLeftBorder ? this.SETTINGS.border.left?.width || 0 : 0,
                right: showRightBorder ? this.SETTINGS.border.right?.width || 0 : 0,
                top: showTopBorder ? this.SETTINGS.border.top?.width || 0 : 0,
            }
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
        selectionBoundStyles (): string {
            if (!this.selectionBound) {
                return 'display:none'
            }
            const relPos = this.selectionBound.position - this.RESOURCE.viewStart
            if (relPos < 0 || relPos >= this.viewRange) {
                return 'display:none'
            }
            const leftPos = this.timeToOverlayX(this.selectionBound.position)
            if (leftPos !== NUMERIC_ERROR_VALUE) {
                return [
                    `display:block`,
                    `left:${leftPos - this.SETTINGS.selectionBound.width/2}px`,
                    `border-left: ${[
                        this.SETTINGS.selectionBound.style || 'solid',
                        this.SETTINGS.selectionBound.width + 'px',
                        settingsColorToRgba(this.SETTINGS.selectionBound.color)
                    ].join(' ')}`
                ].join(';')
            }
            return 'display:none'
        },
        selectionStyles (): string {
            return [
                `background-color:${settingsColorToRgba(this.SETTINGS.trace.selections.color)}`,
                `cursor:pointer`,
            ].join(';')
        },
        undoableRemoveEvents (): UndoOrRedoAction[] {
            const removedEvents = this.undoableActions.filter(a => a.action === 'remove-events')
            return removedEvents
        },
        undoableRemoveLabels (): UndoOrRedoAction[] {
            const removedLabels = this.undoableActions.filter(a => a.action === 'remove-labels')
            return removedLabels
        },
        /** Current view range in seconds. */
        viewRange (): number {
            return this.secPerPage || this.plotDimensions[0]/this.pxPerSecond
        },
        /** Signal range visible outside the side sidebar. */
        visibleRange (): number {
            const anyDrawerOpen = this.sidebarOpen !== null
            // Subtract the sidebar width from the visible width if any sidebar is open.
            if (anyDrawerOpen) {
                return (this.plotDimensions[0] - this.sidebarWidth)/this.pxPerSecond
            }
            // If not and the view width is a whole number, use that value.
            return this.viewRange
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
        addPointerLeaveHandler (handler: (event?: PointerEvent) => void) {
            this.pointerLeaveHandlers.push(handler)
        },
        addRedoAction (action: string, ...args: unknown[]) {
            this.redoableActions.push({ action: action, args: Array.isArray(args) ? args : [args] })
            if (!this.$store.state.APP.hasRedoableAction) {
                this.$store.commit('set-redoable-action', true)
            }
        },
        /**
         * Add an actions to undoable actions.
         * @param action - Name of the action.
         * @param isOriginal - Was this an original action or a redo action. Original actions will clear any remaining actions from the redoable actions queue.
         * @param args - Arguments to use with the action.
         */
        addUndoAction (action: string, isOriginal: boolean, ...args: unknown[]) {
            this.undoableActions.push({ action: action, args: Array.isArray(args) ? args : [args] })
            // Remove possible redo actions from the array.
            if (isOriginal && this.redoableActions.length) {
                this.redoableActions.splice(0)
                this.$store.commit('set-redoable-action', false)
            }
            if (!this.$store.state.APP.hasUndoableAction) {
                this.$store.commit('set-undoable-action', true)
            }
        },
        /**
         * Return a promise that resolves when the plot is updated next time.
         */
        awaitPlotUpdate (): Promise<any> {
            return new Promise<any>((resolve) => {
                this.resolvePlotUpdate = resolve
            })
        },
        calculatePxPerSecond () {
            if (this.secPerPage) {
                // Total viewer size minus y-label part.
                this.pxPerSecond = Math.max(0, this.viewerSize[0] - 80)/this.secPerPage
            } else {
                this.pxPerSecond = (this.$store.state.INTERFACE.app.screenPPI/2.54)*this.cmPerSec
            }
        },
        cancelHotkeyEvents () {
            for (const key in this.hotkeyEvents) {
                this.hotkeyEvents[key as keyof typeof this.hotkeyEvents] = false
            }
        },
        checkEpochMode () {
            this.isInEpochMode = this.SETTINGS.epochMode.enabled && this.SETTINGS.epochMode.epochLength > 0
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
        /**
         * Close the analysis window, clearing the associated chennal and signal data.
         */
        closeAnalysisWindow () {
            // Reset channel and signal data
            this.analysisWindow.open = false
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
            skipEditor?: boolean,
            start?: number,
            text?: string,
        }) {
            if (!this.RESOURCE.activeMontage) {
                Log.warn(`Cannot create annotations for raw input signals.`, this.$options.name!)
                return
            }
            const eventClass = !props?.codes
                               ? this.SETTINGS.annotations.classes.default
                               // The annotation codes must match the event codes.
                               : Object.entries(this.SETTINGS.annotations.classes)
                                       .filter(
                                        ([k, t]) => k === 'event-code' &&
                                                    Object.keys(t.codes)
                                                          .every((c) => Object.keys(props.codes || {}).includes(c))
                                       )[0][1]
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
                    this.RESOURCE.addEvents(newEvent)
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
                    this.RESOURCE.addEvents(newEvent)
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
        /**
         * Create a new signal selection.
         * @param start - The starting position of the selection (in recording seconds).
         * @param end - Ending position of the selection (in recording seconds).
         * @param channelProps - Channel properties if this is a channel selection.
         * @param pointerButton - Possible pointer button (if this is a dragging action).
         */
        createSignalSelection (
            start: number,
            end: number,
            channelProps: ChannelPositionProperties | null,
            pointerButton?: 0 | 2
        ) {
            // Reset the selected index.
            this.selectedIndex = 0
            // Create a new selection
            const nextIndex = this.plotSelections.length
            const selection = {
                canceled: false,
                channel: channelProps ? this.RESOURCE.visibleChannels[channelProps.index] : null,
                crop: [],
                dimensions: [],
                getElement: () => {
                    return this.wrapper.querySelector(`#signal-selection-${nextIndex}`) as HTMLDivElement
                },
                markers: [], // TODO: grab possible markers within the selection.
                range: [start, end].sort((a, b) => a - b),
                signal: null,
            } as PlotSelection
            this.plotSelections.push(selection)
            if (pointerButton !== undefined) {
                // This is a dragging selection.
                this.activeSelection = selection
                this.dragAction = {
                    button: pointerButton !== undefined ? pointerButton : NO_POINTER_BUTTON_DOWN,
                    channelProps: channelProps,
                    dragging: end < start ? 0 : 1,
                    dragPos: end,
                    fromLeft: 0,
                    fromRight: 0,
                    startPos: start,
                }
                // Don't register any more pointer events on the cursor before this interaction finishes
                this.cursors.disable()
                this.$nextTick(() => {
                    this.updateDragElement()
                })
            } else {
                if (selection.channel) {
                    // If this is a channel selection, try to fetch the signal part.
                    this.RESOURCE.getChannelSignal(selection.channel.name, selection.range).then(response => {
                        if (response) {
                            selection.signal = response.signals[0]
                        }
                    })
                }
                // Add selection element styles in next tick, when the after the DOM has updated.
                this.$nextTick(() => {
                    const selEl = selection.getElement()
                    if (!selEl) {
                        Log.error(`Selection element not available.`, this.$options.name as string)
                    }
                    selection.dimensions = [
                        this.timeToOverlayX(start),
                        this.timeToOverlayX(end)
                    ].sort((a, b) => a - b)
                    const dif = selection.dimensions[1] - selection.dimensions[0]
                    // Apply appropriate y-coordinates for the clicked channel
                    selEl.style.top = `${100*(1 - (channelProps?.top || 1))}%`
                    selEl.style.bottom = `${100*(channelProps?.bottom || 0)}%`
                    selEl.style.left = `${selection.dimensions[0]}px`
                    selEl.style.width = `${Math.abs(dif)}px`
                })
            }
        },
        editEvent (annotation: BiosignalAnnotationEvent) {
            this.editingEvents.push(annotation)
            this.editingEventsMode = 'edit'
        },
        exitEventEditor () {
            for (const anno of this.editingEvents) {
                anno.isActive = false
            }
            this.editingEvents.splice(0)
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
        /**
         * Move the view backward `step` amount of seconds from the current location.
         * @param step - Amount of seconds (optional, defaults to page length setting).
         */
        goBackward (step?: number) {
            if (this.isAtStart) {
                return
            }
            if (this.isInEpochMode) {
                // When using epoch mode, any move backward is an epoch backward.
                this.goTo(this.RESOURCE.viewStart - this.SETTINGS.epochMode.epochLength)
            } else {
                if (!step) {
                    // Maximum move distance is the number of full visible seconds to avoid skipping any data.
                    step = Math.min(
                        this.SETTINGS.pageLength,
                        // If page length is in whole seconds, move distance is 1 second less than that.
                        Math.ceil(this.visibleRange) - 1
                    )
                }
                // Don't backtrack beyond the start of the recording.
                if (this.RESOURCE.viewStart <= step) {
                    this.RESOURCE.viewStart = 0
                    this.isAtStart = true
                } else {
                    this.goTo(this.RESOURCE.viewStart - step)
                }
            }
        },
        /**
         * Move the view forward `step` amount of seconds from the current location.
         * @param step - amount of seconds (optional, defaults to page length setting)
         */
        goForward (step?: number) {
            // Browse right
            if (this.isAtEnd) {
                return
            }
            if (this.isInEpochMode) {
                // When using epoch mode, any move forward is an epoch forward.
                step = this.SETTINGS.epochMode.epochLength
            } else {
                if (!step) {
                    step = Math.min(this.SETTINGS.pageLength, Math.ceil(this.visibleRange) - 1)
                }
            }
            this.goTo(this.RESOURCE.viewStart + step)
        },
        /**
         * Move the view to `time` point in the resource.
         * @param time - recording time point in seconds from record start
         */
        goTo (time: number) {
            if (time < 0 || time >= this.RESOURCE.totalDuration) {
                return
            }
            const nEpochs = (this.RESOURCE.totalDuration - this.epochStart)/(this.SETTINGS.epochMode.epochLength || 1)
            const endEpoch = (this.SETTINGS.epochMode.onlyFullEpochs ? Math.floor(nEpochs) : Math.ceil(nEpochs)) - 1
            if (this.isInEpochMode) {
                if (time < this.epochStart) {
                    // Correct time position before epoch start to the epoch start.
                    this.RESOURCE.viewStart = this.epochStart
                } else if ((time - this.epochStart)/this.SETTINGS.epochMode.epochLength >= endEpoch + 1) {
                    // Correct time position at or after the last epoch end to the last epoch start.
                    this.RESOURCE.viewStart = this.epochStart + endEpoch*this.SETTINGS.epochMode.epochLength
                } else {
                    // Find the epoch containing the time point.
                    const epochIndex = Math.min(
                        Math.floor((time - this.epochStart)/this.SETTINGS.epochMode.epochLength),
                        // Do not exceed the last epoch.
                        endEpoch
                    )
                    this.RESOURCE.viewStart = this.epochStart + epochIndex*this.SETTINGS.epochMode.epochLength
                }
            } else {
                this.RESOURCE.viewStart = time
            }
            if (
                !this.RESOURCE.viewStart
                || (this.isInEpochMode && this.RESOURCE.viewStart === this.epochStart)
            ) {
                this.isAtStart = true
            } else {
                this.isAtStart = false
            }
            if (
                this.RESOURCE.viewStart + this.visibleRange >= this.RESOURCE.totalDuration
                || (this.isInEpochMode
                    && this.RESOURCE.viewStart === this.epochStart + (nEpochs - 1)*this.SETTINGS.epochMode.epochLength
                )
            ) {
                this.isAtEnd = true
            } else {
                this.isAtEnd = false
            }
        },
        handleEventsUpdated () {
            this.RESOURCE.dispatchPropertyChangeEvent('events')
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
        handleKeydown (event: KeyboardEvent) {
            if (event.target && (event.target as HTMLElement).tagName.match(/input|textarea/i)) {
                // Don't handle hotkeys if the user is typing in an input or textarea element.
                return
            }
            if (event.key === 'Escape') {
                this.cancelHotkeyEvents()
                this.clearCursorTool()
                this.hideAllOverlayElements()
                this.hideSideDrawer()
                this.exitEventEditor()
                // Remove all drag elements and cancel the active selection (or it will be reapplied on drag).
                this.removeAllDragElements(true)
                if (this.activeSelection) {
                    this.activeSelection.canceled = true
                }
                this.dragAction = null
                this.selectionBound = null
            } else if ((this.$store.state.INTERFACE.app.hotkeyAltOrOpt && event.altKey) || !event.altKey) {
                for (const key in this.hotkeyEvents) {
                    if (Object.keys(this.SETTINGS.hotkeys).includes(key)) {
                        const hotkey = this.SETTINGS.hotkeys[key as keyof typeof this.SETTINGS.hotkeys]
                        if (!hotkey) {
                            continue
                        }
                        if (hotkey.control && !event.ctrlKey) {
                            continue
                        }
                        if (hotkey.shift && !event.shiftKey) {
                            continue
                        }
                        if (
                            hotkey.key !== event.key &&
                            // We also have to check event.code here, because alt changes the value in event.key.
                            // There is a slight possibility that a single physical key would map to a different actions
                            // via event.key and event.code (on a non-QWERTY keyboard), and maybe there's a better way
                            // to handle this.
                            (!event.altKey || hotkey.code !== event.code)
                        ) {
                            continue
                        }
                        this.hotkeyEvents[key as keyof typeof this.hotkeyEvents] = true
                        if (event.altKey) {
                            event.preventDefault()
                        }
                    }
                }
            }
        },
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
                        for (const props of Object.values(this.SETTINGS.annotations.classes)) {
                            const code = parseInt(quickCode[1])
                            if (props.quickCode === code) {
                                this.createEvents(props)
                                this.hotkeyEvents.annotation = false
                                return
                            }
                        }
                    // If no modifying hotkey is active, treat this as a default montage selection.
                    } else if (this.hotkeyEvents.montage1 && event.code === this.SETTINGS.hotkeys.montage1.code) {
                        this.$store.dispatch('eeg.set-active-montage', this.RESOURCE.montages[0].name)
                        this.hotkeyEvents.montage1 = false
                    } else if (this.hotkeyEvents.montage2 && event.code === this.SETTINGS.hotkeys.montage2.code) {
                        this.$store.dispatch('eeg.set-active-montage', this.RESOURCE.montages[1].name)
                        this.hotkeyEvents.montage2 = false
                    } else if (this.hotkeyEvents.montage3 && event.code === this.SETTINGS.hotkeys.montage3.code) {
                        this.$store.dispatch('eeg.set-active-montage', this.RESOURCE.montages[2].name)
                        this.hotkeyEvents.montage3 = false
                    } else if (this.hotkeyEvents.montage4 && event.code === this.SETTINGS.hotkeys.montage4.code) {
                        this.$store.dispatch('eeg.set-active-montage', this.RESOURCE.montages[3].name)
                        this.hotkeyEvents.montage4 = false
                    }
                } else if (this.hotkeyEvents.report && event.code === this.SETTINGS.hotkeys.report.code) {
                    this.toggleReport()
                    this.hotkeyEvents.annotation = false
                } else if (this.hotkeyEvents.annotation && event.code === this.SETTINGS.hotkeys.annotation.code) {
                    this.toggleSidebar('annotations')
                    this.hotkeyEvents.annotation = false
                } else if (this.hotkeyEvents.examine && event.code === this.SETTINGS.hotkeys.examine.code) {
                    this.analysisWindow.nr++
                    this.analysisWindow.tab = 'examine'
                    if (!this.analysisWindow.open) {
                        await this.openAnalysisWindow()
                    }
                    this.hotkeyEvents.examine = false
                } else if (this.hotkeyEvents.fft && event.code === this.SETTINGS.hotkeys.fft.code) {
                    this.analysisWindow.nr++
                    this.analysisWindow.tab = 'fft'
                    if (!this.analysisWindow.open) {
                        await this.openAnalysisWindow()
                    }
                    this.hotkeyEvents.fft = false
                } else if (this.hotkeyEvents.inspect && event.code === this.SETTINGS.hotkeys.inspect.code) {
                    this.toggleCursorTool('inspect')
                    this.hotkeyEvents.inspect = false
                } else if (
                    this.hotkeyEvents.notch && event.code === this.SETTINGS.hotkeys.notch.code &&
                    this.SETTINGS.notchDefaultFrequency
                ) {
                    if (this.RESOURCE.filters.notch) {
                        // If notch filter is active, disable.
                        this.$store.dispatch('eeg.set-notch-filter', 0)
                    } else {
                        // Enable notch filter with default frequency.
                        this.$store.dispatch('eeg.set-notch-filter', this.SETTINGS.notchDefaultFrequency)
                    }
                    this.hotkeyEvents.notch = false
                } else if (this.hotkeyEvents.topogram && event.code === this.SETTINGS.hotkeys.topogram.code) {
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
        },
        handleNavigatorResize (value: { start: number, end: number }) {
            this.navigatorHeight = value.end
            this.resizeElements()
        },
        handlePlotDoubleClick (event: CustomEvent) {
            if (this.activeSelection || this.plotSelections.length) {
                return
            }
            const { detail } = event
            // Select a range of 1 second around the double-clicked point, not excdeeding visible range.
            const startPos = Math.max(
                this.RESOURCE.viewStart,
                detail.startPos - 0.5
            )
            const endPos = Math.min(
                this.RESOURCE.viewStart + this.visibleRange,
                detail.startPos + 0.5
            )
            this.createSignalSelection(startPos, endPos, detail.channelProps)
            if (this.activeCursorTool === 'inspect') {
                this.openAnalysisWindow()
            }
            this.cursors.setCursorPos(detail.startPos)
        },
        /**
         * Handle pointer leave events by executing and removing the appropriate the handlers.
         */
        handlePointerLeave (event: PointerEvent) {
            // Run all appropriate pointerleave handlers
            while (this.pointerLeaveHandlers.length) {
                // Remove handlers from the list and execute them
                const evHandler = this.pointerLeaveHandlers.shift()
                // Check that element still exists
                if (evHandler) {
                    evHandler(event)
                }
            }
        },
        /**
         * Handle mouse click on the plot.
         */
        handlePlotMouseClick (event: CustomEvent) {
            // Practically only emitted when the user clicks a part of the plot that
            // does not support drag or select interactions (empty space).
            this.closeAnalysisWindow()
            this.exitEventEditor()
            const { detail } = event
            if ([0, 2].includes(detail.pointerButton)) {
                this.removeAllDragElements()
                if (detail.pointerButton === 2) {
                    // Display context menu (make sure it has time to reset in case it was already open).
                    this.contextMenu = null
                    this.$nextTick(() => {
                        this.contextMenu = {
                            channel: null,
                            position: detail.pointerPosition,
                            target: 'plot',
                            timestamp: detail.position,
                            props: null,
                        }
                    })
                } else if (detail.pointerButton === 0) {
                    // Close the context menu on left mouse click.
                    this.contextMenu = null
                }
            }
        },
        /**
         * React to updates in the plot.
         */
        handlePlotNavigation (position: number) {
            if (this.isInEpochMode) {
                this.goTo(position)
            } else {
                // Set middle of the view to double clicked point.
                const newView = Math.floor(position - this.visibleRange/2)
                this.RESOURCE.viewStart = Math.max(newView, 0)
            }
            // Pause video if it is running
            if (this.isVideoPlaying()) {
                this.video.pause()
            }
        },
        /**
         * Handle pointer down event on the overlay.
         */
        handlePlotPointerdown (event: CustomEvent) {
            const { detail } = event
            this.closeAnalysisWindow()
            this.exitEventEditor()
            if (!detail.ctrlKey || this.activeCursorTool) {
                // New pointer click removes active drag elements if ctrl is not pressed.
                this.removeAllDragElements()
                this.contextMenu = null
            }
        },
        handlePlotPointerDrag (event: CustomEvent) {
            const { detail } = event
            // Allow drag in both directions.
            if (!this.activeSelection) {
                if (
                    this.plotSelections.length >= MAX_SIGNAL_SELECTIONS ||
                    // Only allow more than one selection of control is pressed
                    this.plotSelections.length && !detail.ctrlKey
                ) {
                    return
                }
                this.createSignalSelection(
                    detail.startPos,
                    detail.position,
                    detail.channelProps,
                    detail.pointerButton
                )
            } else if (this.dragAction) {
                this.dragAction.dragPos = detail.position
                this.dragAction.dragging = detail.position < detail.startPos ? 0 : 1
                this.activeSelection.range = [detail.startPos, detail.position].sort((a, b) => a - b)
                this.updateDragElement()
            }
        },
        handlePlotPointerDragCancel () {
            this.removeActiveSelection()
            this.dragAction = null
        },
        handlePlotPointerDragEnd (event: CustomEvent) {
            if (this.activeSelection?.canceled) {
                // If the selection was cancelled, remove it.
                this.removeActiveSelection()
                return
            }
            if (!this.dragAction) {
                return
            }
            if (Math.abs(this.dragAction.dragPos - this.dragAction.startPos) < this.SETTINGS.minSignalSelection) {
                this.handlePlotPointerDragCancel()
                return
            }
            const { detail } = event
            if (detail.channelProps) {
                const chans = this.RESOURCE.activeMontage?.visibleChannels || []
                const selectionChannel = chans[detail.channelProps.index]
                if (!this.activeSelection || !selectionChannel) {
                    return
                }
                this.activeSelection.channel = selectionChannel
                this.activeSelection.getElement().style.pointerEvents = 'initial'
                this.cursors.enable()
                if (detail.pointerButton === 2 || this.activeCursorTool === 'inspect') {
                    this.openAnalysisWindow()
                }
            }
            this.activeSelection = null
            this.dragAction = null
        },
        /**
         * Triggered when pointer button is released without triggering a drag event.
         * Essentially equals a click.
         */
        handlePlotPointerup (event: CustomEvent) {
            this.cursors.enable()
            const { detail } = event
            const chans = this.RESOURCE.activeMontage?.visibleChannels || []
            if (this.activeSelection) {
                this.activeSelection = null
                // Remove the last element as this drag action was cancelled.
                this.plotSelections.pop()
                this.dragAction = null
            } else if (
                this.plotSelections.length &&
                this.plotSelections.length < MAX_SIGNAL_SELECTIONS &&
                detail.ctrlKey
            ) {
                if (!detail.channelProps) {
                    return
                }
                const channelProps =  detail.channelProps as ChannelPositionProperties
                // If control was pressed, try to add an identical selection to this channel.
                const lastSelection = this.plotSelections[this.plotSelections.length - 1]
                const selectionChannel = chans[channelProps.index]
                if (!selectionChannel) {
                    return
                }
                // Check that there isn't already a selection on this channel.
                // Previously the signal data was loaded when the selection was made which made it possible to compare the same
                // selection with different filter settings by selecting the same channel repeatedly while changing the filter
                // settings between selections. This is not the most useful feature but could be worth re-implementing in some way,
                // at some point.
                for (const sel of this.plotSelections) {
                    if (sel.channel?.id === selectionChannel.id) {
                        return
                    }
                }
                const nextIndex = this.plotSelections.length
                const selection = {
                    canceled: false,
                    channel: selectionChannel,
                    crop: [],
                    dimensions: [...lastSelection.dimensions],
                    getElement: () => {
                        return this.wrapper.querySelector(`#signal-selection-${nextIndex}`) as HTMLDivElement
                    },
                    markers: [],
                    range: [...lastSelection.range],
                    // Delay signal loading to when the analysis window is opened.
                    // This way filter changes between marking the selection and opening the window are reflected in the signal.
                    signal: null,
                } as PlotSelection
                this.plotSelections.push(selection)
                this.$nextTick(() => {
                    const dragEl = selection.getElement()
                    if (!dragEl) {
                        Log.error('New drag element not available!', 'EegViewer')
                        return
                    }
                    const offsetLeft = lastSelection.dimensions[0]
                    const dif = lastSelection.dimensions[1] - lastSelection.dimensions[0]
                    // Apply appropriate y-coordinates for the clicked channel
                    dragEl.style.top = `${100*(1 - channelProps.top)}%`
                    dragEl.style.bottom = `${100*channelProps.bottom}%`
                    dragEl.style.left = `${offsetLeft}px`
                    dragEl.style.width = `${Math.abs(dif)}px`
                    if (detail.pointerButton === 2 || this.activeCursorTool === 'inspect') {
                        this.openAnalysisWindow()
                    }
                })
            } else if (detail.pointerButton === 2) {
                // Display context menu.
                this.contextMenu = {
                    channel: detail?.channelProps ? chans[detail.channelProps.index] : null,
                    position: detail.pointerPosition,
                    target: 'plot',
                    timestamp: detail.position,
                    props: null,
                }
            } else if (detail.pointerType === 'touch') {
                // Clear the context menu and selections if the pointer type is touch.
                this.contextMenu = null
                this.removeAllDragElements()
            }
        },
        /**
         * Handle touch start event on the overlay. This event is triggered when the user touches the plot but hasn't
         * moved their finger yet.
         */
        handlePlotTouchStart (_event: TouchEvent) {
            // We just use this to close the overlays.
            this.closeAnalysisWindow()
            this.exitEventEditor()
        },
        /**
         * React to updates in the plot.
         */
        handlePlotUpdated (context: any) {
            // Resolve the possible update promise
            if (this.resolvePlotUpdate) {
                this.resolvePlotUpdate(context)
                this.resolvePlotUpdate = null
            }
        },
        handleSelectionClick (index: number) {
            this.selectedIndex = index
            this.openAnalysisWindow()
        },
        handleSidebarResize (value: { start: number, end: number }) {
            this.sidebarWidth = value.end
            this.resizeElements()
        },
        /**
         * Hide drag indicators overlaying the plot.
         */
        hideAllDragElements () {
            for (const selection of this.plotSelections) {
                selection.getElement().classList.add('epicv-hidden')
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
        isVideoPlaying () {
            return this.video && !this.video.paused && !this.video.ended
        },
        /**
         * Load up-to-date signals into all trace selection objects.
         * @returns Promise that resolves with the success of the operation (true/false).
         */
        async loadSelectionSignals (): Promise<boolean> {
            const result = await Promise.all(this.plotSelections.map(async (selection) => {
                if (selection.channel) {
                    const signal = await this.RESOURCE.getChannelSignal(
                        selection.channel.name,
                        [...selection.range].sort((a, b) => a - b)
                    )
                    if (signal) {
                        selection.signal = signal.signals[0]
                        return true
                    }
                    return false
                } else {
                    // Global selections don't contain signals.
                    // TODO: Or should they load all signals?
                    return true
                }
            }))
            return result.every((value) => value !== false)
        },
        async montagesChanged () {
            if (!this.montageSetupDone) {
                const totalMontages = this.SETTINGS.defaultMontages?.['default:10-20'].length || 0
                if (this.RESOURCE.montages.length < totalMontages) {
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
        async openAnalysisWindow (tab?: string) {
            this.analysisWindow.nr++
            if (tab) {
                this.analysisWindow.tab = tab
            }
            if (!this.analysisWindow.open) {
                if (!(await this.loadSelectionSignals())) {
                    Log.error(`Could not load signal data to trace selections.`, this.$options.name as string)
                } else {
                    this.analysisWindow.open = true
                }
            }
        },
        redoAction () {
            const lastAction = this.redoableActions.pop()
            if (lastAction) {
                switch (lastAction.action) {
                    case 'add-events': {
                        const events = lastAction.args as BiosignalAnnotationEvent[]
                        this.RESOURCE.addEvents(...events)
                        this.addUndoAction('add-events', false, ...events)
                        break
                    }
                    case 'remove-events': {
                        const delEvents = lastAction.args as BiosignalAnnotationEvent[]
                        this.RESOURCE.removeEvents(...delEvents)
                        this.addUndoAction('remove-events', false, ...delEvents)
                        break
                    }
                }
                if (!this.redoableActions.length) {
                    this.$store.commit('set-redoable-action', false)
                }
            }
        },
        removeActiveSelection () {
            if (!this.activeSelection) {
                return
            }
            this.removeSelection(this.plotSelections.indexOf(this.activeSelection))
            this.activeSelection = null
        },
        removeAllDragElements (keepActive = false) {
            if (keepActive) {
                for (let i=0; i<this.plotSelections.length; i++) {
                    if (this.plotSelections[i] !== this.activeSelection) {
                        this.plotSelections.splice(i, 1)
                        i--
                        continue
                    }
                }
            } else {
                this.plotSelections.splice(0)
                this.activeSelection = null
                this.dragAction = null
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
        /**
         * Remove the given events from active recording.
         * @param events - Events or event IDs to remove.
         */
        removeEvents (...events: string[] | number[] | BiosignalAnnotationEvent[]) {
            const removed = this.RESOURCE.removeEvents(...events)
            this.addUndoAction('remove-events', true, ...removed)
        },
        removePointerLeaveHandler (handler: (event?: PointerEvent) => void) {
            for (let i=0; i<this.pointerLeaveHandlers.length; i++) {
                if (this.pointerLeaveHandlers[i] === handler) {
                    this.pointerLeaveHandlers.splice(i, 1)
                }
            }
        },
        removeSelection (index: number) {
            if (!this.plotSelections[index]) {
                return
            }
            if (this.plotSelections[index] === this.activeSelection) {
                this.activeSelection = null
            }
            this.plotSelections.splice(index, 1)
        },
        resizeElements () {
            // Check that trace and navigator are ready
            if (!this.plot || !this.navigator) {
                return
            }
            // Recalculate trace dimensions and x-label position
            this.plotDimensions = [
                // Deduct y-label width (but not sidebar width; draw behind it)
                this.viewerSize[0] - this.yAxisWidth,
                // Deduct navigator height
                this.viewerSize[1] - this.navigatorHeight
            ]
            // Update the timebase lines
            //const majColor = settingsColorToRgba(this.SETTINGS.majorGrid.color)
            //const minColor = settingsColorToRgba(this.SETTINGS.minorGrid.color)
            //const majWidth = this.SETTINGS.majorGrid.width
            //const majSpace = this.pxPerSecond - majWidth
            //const bgStyle = `repeating-linear-gradient(
            //    90deg,
            //    transparent 0 ${majSpace}px,
            //    ${majColor} ${majSpace}px ${majSpace + majWidth}px
            //)`
            //this.timebase.style.backgroundImage = bgStyle
            //this.timebase.style.backgroundPosition = `${majWidth}px 0`
            // Set cursor properties
            this.cursors.updateCursors()
        },
        saveEventEdits (props: { class: string, label: string }) {
            let anyChanged = false
            for (const event of this.editingEvents) {
                if (event.class !== props.class) {
                    event.class = props.class as typeof event['class']
                    anyChanged = true
                }
                if (event.label !== props.label) {
                    event.label = props.label
                    anyChanged = true
                }
            }
            if (anyChanged) {
                this.RESOURCE.dispatchPropertyChangeEvent('events')
            }
            this.exitEventEditor()
        },
        selectDrawerTab (value: string) {
            this.sidebarTab = value
        },
        showAllDragElements () {
            for (const selection of this.plotSelections) {
                selection.getElement().classList.remove('epicv-hidden')
            }
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
        /**
         * Convert a recording `time` to corresponding x-axis position as pixels from the left edge of the overlay.
         * Offset (including left border) from the actual edge is applied to the returned value.
         * @param time - Recording time (in seconds).
         * @returns Overlay x-position at the given time index. This method always returns a valid coordinate, even if the time position is outside visible range.
         */
        timeToOverlayX (time: number) {
            // First check if position is outside of view range.
            if (time <= this.RESOURCE.viewStart) {
                return this.borderWidth.left
            }
            return Math.min(
                (time - this.RESOURCE.viewStart)*this.pxPerSecond + this.borderWidth.left,
                this.overlay.getOffsetWidth() - this.borderWidth.right
            )
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
        undoAction () {
            const lastAction = this.undoableActions.pop()
            if (lastAction) {
                switch (lastAction.action) {
                    case 'add-events': {
                        const addedEvents = lastAction.args as BiosignalAnnotationEvent[]
                        const deletedEvents = this.RESOURCE.removeEvents(...addedEvents)
                        this.addRedoAction('add-events', ...deletedEvents)
                        break
                    }
                    case 'add-labels': {
                        const addedLabels = lastAction.args as BiosignalAnnotationEvent[]
                        const deletedLabels = this.RESOURCE.removeEvents(...addedLabels)
                        this.addRedoAction('add-labels', ...deletedLabels)
                        break
                    }
                    case 'remove-events': {
                        const delEvents = lastAction.args as BiosignalAnnotationEvent[]
                        this.RESOURCE.addEvents(...delEvents)
                        this.addRedoAction('remove-events', ...delEvents)
                        break
                    }
                    case 'remove-labels': {
                        const delLabels = lastAction.args as BiosignalAnnotationEvent[]
                        this.RESOURCE.addEvents(...delLabels)
                        this.addRedoAction('remove-labels', ...delLabels)
                        break
                    }
                }
                if (!this.undoableActions.length) {
                    this.$store.commit('set-undoable-action', false)
                }
            }
        },
        undoRemoveEvents () {
            if (!this.undoableRemoveEvents.length) {
                return
            }
            // Find the most recent removed events and return them to the array.
            for (let i = this.undoableActions.length - 1; i >= 0; i--) {
                const undo = this.undoableActions[i]
                if (undo.action === 'remove-events') {
                    const removed = this.undoableActions.splice(i, 1)[0]
                    this.RESOURCE.addEvents(...(removed.args as BiosignalAnnotationEvent[]))
                    this.addRedoAction(removed.action, ...(removed.args as BiosignalAnnotationEvent[]))
                    return
                }
            }
        },
        undoRemoveLabels () {
            if (!this.undoableRemoveLabels.length) {
                return
            }
            // Find the most recent removed labels and return them to the array.
            for (let i = this.undoableActions.length - 1; i >= 0; i--) {
                const undo = this.undoableActions[i]
                if (undo.action === 'remove-labels') {
                    const removed = this.undoableActions.splice(i, 1)[0]
                    this.RESOURCE.addLabels(...(removed.args as AnnotationLabel[]))
                    this.addRedoAction(removed.action, ...(removed.args as AnnotationLabel[]))
                    return
                }
            }
        },
        updateDragElement () {
            if (!this.activeSelection || !this.dragAction) {
                return
            }
            const dragEl = this.activeSelection.getElement()
            if (!dragEl) {
                Log.error('Drag element not available!', 'EegViewer')
                return
            }
            this.activeSelection.dimensions = [
                this.timeToOverlayX(this.dragAction.startPos),
                this.timeToOverlayX(this.dragAction.dragPos)
            ].sort((a, b) => a - b)
            const dif = this.activeSelection.dimensions[1] - this.activeSelection.dimensions[0]
            // Apply appropriate y-coordinates for the clicked channel
            dragEl.style.top = `${100*(1 - (this.dragAction.channelProps?.top || 1))}%`
            dragEl.style.bottom = `${100*(this.dragAction.channelProps?.bottom || 0)}%`
            dragEl.style.left = `${this.activeSelection.dimensions[0]}px`
            dragEl.style.width = `${Math.abs(dif)}px`
            dragEl.style.pointerEvents = 'none'
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
        // Add event listeners
        window.addEventListener('keydown', this.handleKeydown, false)
        window.addEventListener('keyup', this.handleKeyup, false)
        // Cancel all hotkey events if user leaves the tab.
        window.addEventListener('blur', this.cancelHotkeyEvents, false)
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
        // Remove event listeners
        window.removeEventListener('keydown', this.handleKeydown, false)
        window.removeEventListener('keyup', this.handleKeyup, false)
        window.removeEventListener('blur', this.cancelHotkeyEvents, false)
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
