<template>
    <split-panel-view
        data-component="ncs-viewer"
        :primary-size-bounds="['300px', '40%']"
        primary-slot="end"
        :primary-start-size="350"
        @pointerleave="handlePointerLeave($event)"
    >
        <template v-slot:start>
            <div ref="wrapper" class="main">
                <division-grid
                    :horizontalDivs="nHorizontalDivs"
                    :verticalDivs="nVerticalDivs"
                    :viewerSize="viewerSize"
                />
                <ncs-plot ref="plot" v-if="overlay"
                    class="plot"
                    :dimensions="plotDimensions"
                    :horizontalDivs="nHorizontalDivs"
                    :overlay="overlay"
                    :verticalDivs="nVerticalDivs"
                    :secPerPage="secPerPage"
                    :visibleRange="visibleRange"
                    v-on:double-click="handlePlotDoubleClick"
                    v-on:loaded="resizeElements"
                    v-on:mouse-click="handlePlotMouseClick"
                    v-on:pointer-down="handlePlotPointerdown"
                    v-on:pointer-drag="handlePlotPointerDrag"
                    v-on:pointer-drag-cancel="handlePlotPointerDragCancel"
                    v-on:pointer-drag-end="handlePlotPointerDragEnd"
                    v-on:pointer-up="handlePlotPointerup"
                    v-on:plot-updated="handlePlotUpdated"
                    v-on:touch-start="handlePlotTouchStart"
                />
                <!-- Annotations-->
                <annotation-labels v-if="overlay"
                    :overlay="overlay"
                    :secPerPage="secPerPage"
                    :SETTINGS="SETTINGS"
                    :viewRange="secPerPage"
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
                <!-- Markers and cursors must come after the plot element to be placed on top of it -->
                <channel-markers v-if="overlay"
                    :overlay="overlay"
                    :secPerPage="secPerPage"
                    :sensitivityUnits="nVerticalDivs"
                />
                <vertical-cursors ref="cursors"
                    :overlay="overlay"
                    :viewRange="secPerPage"
                    v-on:main-cursor-position=""
                ></vertical-cursors>
                <viewer-overlay ref="overlay"
                ></viewer-overlay>
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
                :viewStep="secPerPage"
                :visibleRange="visibleRange"
                :width="sidebarWidth"
                v-on:close="hideSidebar"
                v-on:create-events="createEvents"
                v-on:remove-event="removeEvents"
                v-on:tab-changed="selectSidebarTab"
                v-on:undo-remove="undoRemoveEvents"
            ></annotation-sidebar>
        </template>
    </split-panel-view>
</template>

<script lang="ts">
import { defineComponent, PropType, reactive, Ref, ref } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import type {
    ContextMenuContext,
    PointerEventHandler,
    SignalSelectionLimit,
    UndoOrRedoAction,
} from "#types/interface"
import { useNcsContext } from '..'
import { Log } from 'scoped-event-log'

import AnnotationLabels from '#app/views/biosignal/overlays/AnnotationLabels.vue'
import AnnotationEditor from '#app/views/biosignal/overlays/AnnotationEditor.vue'
import AnnotationSidebar from '#app/views/biosignal/sidebars/AnnotationSidebar.vue'
import ChannelHighlights from '#app/views/biosignal/overlays/ChannelHighlights.vue'
import ChannelMarkers from '#app/views/biosignal/overlays/ChannelMarkers.vue'
import DivisionGrid from '#app/views/biosignal/overlays/DivisionGrid.vue'
import NcsPlot from './NcsPlot.vue'
import SplitPanelView from '#app/views/SplitPanelView.vue'
import VerticalCursors from '#app/views/biosignal/overlays/VerticalCursors.vue'
import ViewerOverlay, { type PointerEventOverlay } from '#app/overlays/PointerEventOverlay.vue'
import type { PlotSelection } from '#app/views/biosignal/types'
import { NO_POINTER_BUTTON_DOWN } from "#util"
import type {
    AnnotationLabel,
    AnnotationEventTemplate,
    BiosignalAnnotationEvent,
    ChannelPositionProperties,
    SourceChannel,
} from "@epicurrents/core/dist/types"
import { NUMERIC_ERROR_VALUE, settingsColorToRgba } from "@epicurrents/core/dist/util"
import { NcsEvent } from "@epicurrents/ncs-module"

const MAX_SIGNAL_SELECTIONS = 20

export default defineComponent({
    name: 'NcsViewer',
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
        ChannelMarkers,
        DivisionGrid,
        NcsPlot,
        SplitPanelView,
        VerticalCursors,
        ViewerOverlay,
    },
    setup () {
        const store = useStore()
        const context = useNcsContext(store, 'NcsViewer')
        const activeCursorTool = ref(null as string | null)
        const activeSelection = ref(null as PlotSelection | null)
        const analysisWindow = reactive({
            height: 600,
            left: 0,
            /** Update the number each time the analysis window is opened to discard any cached data. */
            nr: 0,
            open: false,
            tab: 'fft',
            top: 0,
            width: 700,
        })
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
        const editingEvents = ref([] as BiosignalAnnotationEvent[])
        const editingEventsMode = ref('new' as 'new' | 'edit')
        const epochStart = ref(0)
        const hotkeyEvents = reactive({
            annotation: false,
            examine: false,
            inspect: false,
            notch: false,
        })
        const secPerPage = ref(0)
        const plotDimensions = ref([0, 0])
        const plotSelections = reactive([] as PlotSelection[])
        const pxPerSecond = ref(0)
        /**
         * List of redoable actions ordered from the oldest to the most recent.
         * Type of `args` depends on the action:
         * - `add-annotations`: BiosignalAnnotation[]
         * - `remove-annotations`: BiosignalAnnotation[]
         */
        const redoableActions = ref([] as UndoOrRedoAction[])
        const resolvePlotUpdate = null as ((result: any) => void) | null
        const selectedIndex = ref(0)
        const selectionBound = ref(null as SignalSelectionLimit | null)
        const sidebarOpen = ref(null as string | null)
        const sidebarTab = ref('events') // Default to events tab.
        const sidebarWidth = ref(350)
        /**
         * List of undoable actions ordered from the oldest to the most recent.
         * Type of `args` depends on the action:
         * - `add-annotations`: BiosignalAnnotation[]
         * - `remove-annotations`: BiosignalAnnotation[]
         */
        const undoableActions = ref([] as UndoOrRedoAction[])
        // Template refs
        const cursors = ref<InstanceType<typeof VerticalCursors>>() as Ref<InstanceType<typeof VerticalCursors>>
        const overlay = ref<PointerEventOverlay>() as Ref<PointerEventOverlay>
        const plot = ref<InstanceType<typeof NcsPlot>>() as Ref<InstanceType<typeof NcsPlot>>
        const sidebar = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const wrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        // Pointer interaction handlers
        const pointerLeaveHandlers = [] as PointerEventHandler[]
        // Unsubscribe from store mutations
        const unsubscribe = null as (() => void) | null
        const unsubscribeActions = null as (() => void) | null
        return {
            activeCursorTool,
            activeSelection,
            analysisWindow,
            contextMenu,
            dataSetupDone,
            dragAction,
            editingEvents,
            editingEventsMode,
            epochStart,
            hotkeyEvents,
            secPerPage,
            plotDimensions,
            plotSelections,
            pxPerSecond,
            redoableActions,
            resolvePlotUpdate,
            selectedIndex,
            selectionBound,
            sidebarOpen,
            sidebarTab,
            sidebarWidth,
            undoableActions,
            // Template refs
            cursors,
            navigator,
            overlay,
            plot,
            sidebar,
            wrapper,
            // Handlers
            pointerLeaveHandlers,
            // Unsubscribers
            unsubscribe,
            unsubscribeActions,
            // Context properties.
            ...context,
        }
    },
    watch: {
        viewerSize (value) {
            if (!value || !value[0] || !value[1]) {
                return
            }
            this.resizeElements()
            this.$nextTick(() => {
                this.calculatePxPerSecond()
            })
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
        nHorizontalDivs (): number {
            return this.SETTINGS.viewport.mainAxis === 'y' && this.SETTINGS.viewport.verticalDivs
            ? this.SETTINGS.viewport.verticalDivs*this.viewerSize[0]/this.viewerSize[1]
            : this.SETTINGS.viewport.horizontalDivs
        },
        nVerticalDivs (): number {
            return this.SETTINGS.viewport.mainAxis === 'x' && this.SETTINGS.viewport.horizontalDivs
            ? this.SETTINGS.viewport.horizontalDivs*this.viewerSize[1]/this.viewerSize[0]
            : this.SETTINGS.viewport.verticalDivs
        },
        selectionBoundStyles (): string {
            if (!this.selectionBound) {
                return 'display:none'
            }
            const relPos = this.selectionBound.position - this.RESOURCE.viewStart
            if (relPos < 0 || relPos >= this.secPerPage) {
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
        /** Signal range visible outside the side sidebar. */
        visibleRange (): number {
            const anySidebarOpen = this.sidebarOpen !== null
            // Subtract the sidebar width from the visible width if any sidebar is open.
            if (anySidebarOpen) {
                return (this.plotDimensions[0] - this.sidebarWidth)/this.pxPerSecond
            }
            // If not and the view width is a whole number, use that value.
            return this.secPerPage
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
         * Add a `handler` method for when the pointer leaves the given `element`.
         * @param handler - method to execute in the event of pointer leaving the element
         */
        addPointerLeaveHandler (handler: PointerEventHandler) {
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
            // Total viewer size minus y-label part.
            this.pxPerSecond = Math.max(0, this.viewerSize[0])/this.secPerPage
        },
        cancelHotkeyEvents () {
            for (const key in this.hotkeyEvents) {
                this.hotkeyEvents[key as keyof typeof this.hotkeyEvents] = false
            }
        },
        clearCursorTool () {
            this.$store.dispatch('ncs.set-cursor-tool', null)
        },
        /**
         * Close the analysis window, clearing the associated chennal and signal data.
         */
        closeAnalysisWindow () {
            // Reset channel and signal data
            this.analysisWindow.open = false
        },
        createEvents (props?: {
            channels?: string[],
            codes?: Record<string, number | string>,
            duration?: number,
            skipEditor?: boolean,
            start?: number,
            text?: string,
        }) {
            const eventClass = !props || props.codes === undefined
                               ? this.SETTINGS.annotations.classes.default
                               : Object.entries(this.SETTINGS.annotations.classes)
                                       .filter(
                                        ([k, t]) => k === 'event-code' &&
                                                    Object.keys(t.codes)
                                                          .every((c) => Object.keys(props.codes || {}).includes(c))
                                       )[0][1]
            const undoEvents = [] as BiosignalAnnotationEvent[]
            if (this.plotSelections.length) {
                for (const selection of this.plotSelections) {
                    const newEvent = NcsEvent.fromTemplate({
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
                    const newEvent = NcsEvent.fromTemplate({
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
                const newEvent = NcsEvent.fromTemplate({
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
        editEvent (event: BiosignalAnnotationEvent) {
            this.editingEvents.push(event)
            this.editingEventsMode = 'edit'
        },
        exitEventEditor () {
            for (const event of this.editingEvents) {
                event.isActive = false
            }
            this.editingEvents.splice(0)
        },
        /**
         * Get the channel name for the active source channel.
         * @returns Name of the channel or null if the channel name cannot be found.
         */
        getSourceChannelName (channel: SourceChannel) {
            return channel.name || null
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
                this.hideSidebar()
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
                    }
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
                } else if (this.hotkeyEvents.inspect && event.code === this.SETTINGS.hotkeys.inspect.code) {
                    this.toggleCursorTool('inspect')
                    this.hotkeyEvents.inspect = false
                } else if (
                    this.hotkeyEvents.notch && event.code === this.SETTINGS.hotkeys.notch.code &&
                    this.SETTINGS.notchDefaultFrequency
                ) {
                    if (this.RESOURCE.filters.notch) {
                        // If notch filter is active, disable.
                        this.$store.dispatch('ncs.set-notch-filter', 0)
                    } else {
                        // Enable notch filter with default frequency.
                        this.$store.dispatch('ncs.set-notch-filter', this.SETTINGS.notchDefaultFrequency)
                    }
                    this.hotkeyEvents.notch = false
                }
            }
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
                    evHandler.handler(event)
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
                const chans = this.RESOURCE.visibleChannels || []
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
            const chans = this.RESOURCE.visibleChannels || []
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
                        Log.error('New drag element not available!', this.$options.name!)
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
            this.contextMenu = null
            this.hideAllDragElements()
        },
        hideSidebar () {
            this.$store.dispatch('ncs.set-open-sidebar', null)
        },
        /**
         * Load up-to-date signals into all trace selection objects.
         * @returns Promise that resolves with the success of the operation (true/false).
         */
        async loadSelectionSignals (): Promise<boolean> {
            const result = await Promise.all(this.plotSelections.map(async (selection) => {
                const channel = this.RESOURCE.channels.length === 1 ? this.RESOURCE.channels[0] : selection.channel
                if (channel) {
                    const signal = await this.RESOURCE.getChannelSignal(
                        channel.name,
                        [...selection.range].sort((a, b) => a - b)
                    )
                    if (signal) {
                        selection.signal = signal.signals[0]
                        return true
                    }
                    return false
                } else {
                    // Global selection that contains multiple signals.
                    return true
                }
            }))
            return result.every((value) => value !== false)
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
        removeAllOverlayElements (keepActiveDrag = false) {
            this.analysisWindow.open = false
            this.contextMenu = null
            this.removeAllDragElements(keepActiveDrag)
        },
        /**
         * Remove the given events from active recording.
         * @param events - Events or event IDs to remove.
         */
        removeEvents (...events: string[] | number[] | BiosignalAnnotationEvent[]) {
            const removed = this.RESOURCE.removeEvents(...events)
            this.addUndoAction('remove-events', true, ...removed)
        },
        removePointerLeaveHandler (handler: PointerEventHandler) {
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
            // Check that trace and navigator are ready.
            if (!this.plot || !this.navigator) {
                return
            }
            // Recalculate trace dimensions and x-label position.
            this.plotDimensions = [
                // Deduct border widths.
                this.viewerSize[0]
                    - (this.SETTINGS.border.left?.width || 0)
                    - (this.SETTINGS.border.right?.width || 0),
                this.viewerSize[1]
                    - (this.SETTINGS.border.top?.width || 0)
                    - (this.SETTINGS.border.bottom?.width || 0)
            ]
            this.cursors?.updateCursors()
        },
        saveEventEdits (props: { class: string, label: string }) {
            let anyChanged = false
            for (const evt of this.editingEvents) {
                if (evt.class !== props.class) {
                    evt.class = props.class as typeof evt['class']
                    anyChanged = true
                }
                if (evt.label !== props.label) {
                    evt.label = props.label
                    anyChanged = true
                }
            }
            if (anyChanged) {
                this.RESOURCE.dispatchPropertyChangeEvent('events')
            }
            this.exitEventEditor()
        },
        selectSidebarTab (value: string) {
            this.sidebarTab = value
        },
        showAllDragElements () {
            for (const selection of this.plotSelections) {
                selection.getElement().classList.remove('epicv-hidden')
            }
        },
        signalCacheChanged () {
            if (this.RESOURCE.signalCacheStatus[1] > 0) {
                this.dataSetupDone = true
            }
        },
        timebaseChanged () {
            this.secPerPage = this.SETTINGS.epochMode.epochLength ||
                              this.nHorizontalDivs*this.RESOURCE.timebase/1000
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
        toggleChannelActive (channel: SourceChannel) {
            if (!channel?.id) {
                return // Raw signals.
            }
            channel.isActive = !channel.isActive
        },
        toggleChannelMenu (channel: SourceChannel) {
            if (!channel?.id) {
                return // Raw signals.
            }
        },
        toggleCursorTool (tool: string | null) {
            if (this.activeCursorTool === tool) {
                this.$store.dispatch('ncs.set-cursor-tool', null)
            } else {
                this.$store.dispatch('ncs.set-cursor-tool', tool)
            }
        },
        toggleSidebar (sidebar: string, state?: boolean) {
            const isActive = this.$interface.store.modules.get('ncs')!.openSidebar === sidebar
            if (isActive && !state) {
                this.$store.dispatch('ncs.set-open-sidebar', null)
            } else {
                this.$store.dispatch('ncs.set-open-sidebar', sidebar)
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
                Log.error('Drag element not available!', this.$options.name!)
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
        viewStartChanged (newStart: unknown, oldStart: unknown) {
            this.removeAllOverlayElements(true)
            if (this.dragAction) {
                const startDelta = (newStart as number) - (oldStart as number)
                this.dragAction.dragPos += startDelta
            }
        },
        viewStartUpdated () {
            this.updateDragElement()
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
        // Set default display properties.
        if (!this.RESOURCE.sensitivity) {
            const sensType = Object.hasOwn(this.SETTINGS.sensitivity, this.RESOURCE.type)
                           ? this.RESOURCE.type
                           : 'default'
            this.$store.dispatch('set-settings-value', { field: 'ncs.sensitivityUnit', value: sensType })
            const sensitivity = this.SETTINGS.sensitivity[this.SETTINGS.sensitivityUnit]
            this.RESOURCE.sensitivity = sensitivity.default*(sensitivity.scale || 1)
        }
        if (!this.RESOURCE.timebase) {
            const tbUnit = Object.hasOwn(this.SETTINGS.timebase, this.RESOURCE.type)
                         ? this.RESOURCE.type
                         : 'default'
            this.$store.dispatch('set-settings-value', { field: 'ncs.timebaseUnit', value: tbUnit })
            this.RESOURCE.timebaseUnit = this.SETTINGS.timebaseUnit
            this.RESOURCE.timebase = this.SETTINGS.timebase[this.SETTINGS.timebaseUnit].default
        }
        // Check timebase scale to use and calculate pixels per second.
        this.timebaseChanged()
    },
    mounted () {
        // Add property update handlers.
        this.RESOURCE.onPropertyChange('displayViewStart', this.viewStartUpdated, this.ID)
        this.RESOURCE.onPropertyChange('isActive', () => {
            if (!this.RESOURCE.isActive) {
                // Remove all event listeners before the resource becomes null.
                this.RESOURCE.removeAllEventListeners(this.ID)
            }
        }, this.ID, 'before')
        this.RESOURCE.onPropertyChange('signalCacheStatus', this.signalCacheChanged, this.ID)
        this.RESOURCE.onPropertyChange('timebase', this.timebaseChanged, this.ID)
        this.RESOURCE.onPropertyChange('viewStart', this.viewStartChanged, this.ID)
        // Add event listeners.
        window.addEventListener('keydown', this.handleKeydown, false)
        window.addEventListener('keyup', this.handleKeyup, false)
        // Cancel all hotkey events if user leaves the tab.
        window.addEventListener('blur', this.cancelHotkeyEvents, false)
        // Subscribe to actions.
        this.unsubscribeActions = this.$store.subscribeAction((action) => {
            if (action.type === 'redo-action') {
                this.redoAction()
            } else if (action.type === 'ncs.set-cursor-tool') {
                if (action.payload === 'inspect') {
                    this.overlay.style.cursor = 'zoom-in'
                    this.plot.$el.style.cursor = 'zoom-in'
                } else {
                    this.overlay.style.cursor = 'initial'
                    this.plot.$el.style.cursor = 'initial'
                }
                this.activeCursorTool = action.payload
            } else if (action.type === 'ncs.set-open-sidebar') {
                this.sidebarOpen = action.payload
            } else if (action.type === 'undo-action') {
                this.undoAction()
            }
        })
        // Init signal cache monitoring.
        this.signalCacheChanged()
    },
    beforeUnmount () {
        this.RESOURCE?.removeAllEventListeners(this.ID)
        window.removeEventListener('keydown', this.handleKeydown, false)
        window.removeEventListener('keyup', this.handleKeyup, false)
        window.removeEventListener('blur', this.cancelHotkeyEvents, false)
        // Unsubscribe from store
        this.unsubscribe?.()
        this.unsubscribeActions?.()
    },
})
</script>

<style scoped>
[data-component="ncs-viewer"] {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
}
.main {
    position: absolute;
    inset: 0;
}
.overlay {
    position: absolute;
    top: 0;
    left: 0;
    display: none;
    color: rgba(0, 0, 0, 0);
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
.sidebar {
    /* Place sidebar over channel markers. */
    position: relative;
    z-index: 2;
}
.navigator {
    position: absolute;
    left: 0;
    bottom: 0;
    z-index: 1;
    width: 100%;
}
</style>
