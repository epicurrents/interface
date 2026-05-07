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
                    :pxPerSecond="pxPerSecond"
                    :secPerPage="secPerPage"
                    :SETTINGS="SETTINGS"
                    :viewRange="secPerPage"
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
                <!-- Markers and cursors must come after the plot element to be placed on top of it -->
                <channel-markers v-if="overlay"
                    :overlay="overlay"
                    :secPerPage="secPerPage"
                    :sensitivityUnits="nVerticalDivs"
                />
                <vertical-cursors ref="cursors"
                    :overlay="overlay"
                    :pxPerSecond="pxPerSecond"
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
                v-on:remove-event="removeUserEvents"
                v-on:tab-changed="selectSidebarTab"
                v-on:undo-remove="undoRemoveEvents"
            ></annotation-sidebar>
        </template>
    </split-panel-view>
</template>

<script lang="ts">
import { defineComponent, PropType, reactive, Ref, ref, toRef } from "vue"
import { T } from "#i18n"
import { useStore } from "vuex"
import type {
    ContextMenuContext,
    SignalSelectionLimit,
} from "#types/interface"
import { useNcsContext } from '..'
import { useBiosignalAnalysis } from '#app/views/biosignal/useBiosignalAnalysis'
import { useBiosignalAnnotations } from '#app/views/biosignal/useBiosignalAnnotations'
import { useBiosignalAnnotationEditor } from '#app/views/biosignal/useBiosignalAnnotationEditor'
import { useBiosignalPointer } from '#app/views/biosignal/useBiosignalPointer'
import { useBiosignalLayout } from '#app/views/biosignal/useBiosignalLayout'
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
import type { AnnotationEventTemplate } from "@epicurrents/core/types"
import type { BiosignalAnnotationEvent } from "@epicurrents/core/types"
import { type DragAction } from '#app/views/biosignal/useBiosignalPointer'
import { NcsEvent } from "@epicurrents/ncs-module"


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
    setup (props) {
        const store = useStore()
        const context = useNcsContext(store, 'NcsViewer')
        const viewerSize = toRef(props, 'viewerSize') as Ref<number[]>
        const annotations = useBiosignalAnnotations(context.RESOURCE)
        const activeCursorTool = ref(null as string | null)
        const activeSelection = ref(null as PlotSelection | null)
        const contextMenu = ref(null as ContextMenuContext | null)
        const dataSetupDone = ref(false)
        const dragAction = ref<DragAction | null>(null)
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
        const plotSelections = reactive([] as PlotSelection[])
        const resolvePlotUpdate = ref(null as ((result: any) => void) | null)
        const selectedIndex = ref(0)
        const selectionBound = ref(null as SignalSelectionLimit | null)
        const sidebarOpen = ref(null as string | null)
        const sidebarTab = ref('events') // Default to events tab.
        const sidebarWidth = ref(350)
        // Template refs
        const cursors = ref<InstanceType<typeof VerticalCursors>>() as Ref<InstanceType<typeof VerticalCursors>>
        const overlay = ref<PointerEventOverlay>() as Ref<PointerEventOverlay>
        const plot = ref<InstanceType<typeof NcsPlot>>() as Ref<InstanceType<typeof NcsPlot>>
        const sidebar = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        const wrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        // Pointer interaction handlers
        const pointerLeaveHandlers = [] as ((event?: PointerEvent) => void)[]
        // Unsubscribe from store mutations
        // ── Composable setup ─────────────────────────────────────────────────
        const layout = useBiosignalLayout(
            context.SETTINGS,
            viewerSize,
            secPerPage,
            sidebarOpen,
            sidebarWidth,
            { plot },
            cursors as Ref<{ updateCursors(): void } | undefined>,
        )
        const { borderWidth, pxPerSecond, visibleRange } = layout
        const annoEditor = useBiosignalAnnotationEditor(context.RESOURCE, editingEvents, editingEventsMode)

        const analysis = useBiosignalAnalysis(context.RESOURCE, plotSelections, 'NcsViewer')

        const pointer = useBiosignalPointer({
            resource: context.RESOURCE,
            settings: context.SETTINGS,
            activeCursorTool,
            activeSelection,
            borderWidth,
            contextMenu,
            cursors: cursors as Ref<{ disable: () => void, enable: () => void, setCursorPos: (n: number) => void }>,
            dragAction,
            overlay,
            plotSelections,
            pointerLeaveHandlers,
            pxPerSecond,
            resolvePlotUpdate,
            selectedIndex,
            selectionBound,
            visibleRange,
            wrapper,
            onCloseAnalysis: analysis.closeAnalysisWindow,
            onExitEditor: annoEditor.exitEventEditor,
            onOpenAnalysis: () => analysis.openAnalysisWindow(),
        })
        const unsubscribe = null as (() => void) | null
        const unsubscribeActions = null as (() => void) | null
        return {
            activeCursorTool,
            activeSelection,
            contextMenu,
            dataSetupDone,
            dragAction,
            editingEvents,
            editingEventsMode,
            epochStart,
            hotkeyEvents,
            secPerPage,
            plotSelections,
            selectedIndex,
            selectionBound,
            sidebarOpen,
            sidebarTab,
            sidebarWidth,
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
            resolvePlotUpdate,
            // Context properties.
            ...context,
            // Composables
            ...annotations,
            ...layout,
            ...annoEditor,
            ...analysis,
            analysisWindow: analysis.analysisWindow,
            ...pointer,
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
        /**
         * Return a promise that resolves when the plot is updated next time.
         */
        awaitPlotUpdate (): Promise<any> {
            return new Promise<any>((resolve) => {
                this.resolvePlotUpdate = resolve
            })
        },
        cancelHotkeyEvents () {
            for (const key in this.hotkeyEvents) {
                this.hotkeyEvents[key as keyof typeof this.hotkeyEvents] = false
            }
        },
        clearCursorTool () {
            this.$store.dispatch('ncs.set-cursor-tool', null)
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
                    this.addUserEvents(newEvent)
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
                    this.addUserEvents(newEvent)
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
         * Get the channel name for the active source channel.
         * @returns Name of the channel or null if the channel name cannot be found.
         */
        getSourceChannelName (channel: { name?: string | null }) {
            return channel.name || null
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
                        if (this.RESOURCE.annotationsLocked) {
                            Log.warn(
                                [
                                    'Annotations are locked.',
                                    'No events or labels can be added to the recording.'
                                ],
                                this.$options.name!
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
        removeAllOverlayElements (keepActiveDrag = false) {
            this.analysisWindow.open = false
            this.contextMenu = null
            this.removeAllDragElements(keepActiveDrag)
        },
        selectSidebarTab (value: string) {
            this.sidebarTab = value
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
        toggleChannelActive (channel: { id?: string | null, isActive: boolean }) {
            if (!channel?.id) {
                return // Raw signals.
            }
            channel.isActive = !channel.isActive
        },
        toggleChannelMenu (channel: { id?: string | null }) {
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
