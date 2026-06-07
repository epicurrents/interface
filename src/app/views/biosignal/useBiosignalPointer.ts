/**
 * Composable for pointer/drag/selection handling shared across all biosignal
 * viewers.  Manages signal selections, drag interactions, context menu state,
 * and the plot-update promise resolution.
 *
 * Viewer-specific operations (opening/closing the analysis window, exiting the
 * annotation editor) are injected as callbacks so this composable stays
 * modality-agnostic.
 */

import { computed, nextTick } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { NUMERIC_ERROR_VALUE } from '@epicurrents/core/util'
import { Log } from 'scoped-event-log'
import { settingsColorToRgba } from '@epicurrents/core/util'
import { NO_POINTER_BUTTON_DOWN } from '#util'
import type {
    BiosignalCascadeMontage,
    BiosignalChannel,
    BiosignalResource,
    ChannelPositionProperties,
    SettingsColor,
} from '@epicurrents/core/dist/types'
import type { ContextMenuContext, SignalSelectionLimit } from '#types/interface'
import type { PlotSelection } from '#app/views/biosignal/types'
import type { PointerEventOverlay } from '#app/overlays/PointerEventOverlay.vue'

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_SIGNAL_SELECTIONS = 20

// ── Types ────────────────────────────────────────────────────────────────────

export type DragAction = {
    button: 0 | 2 | typeof NO_POINTER_BUTTON_DOWN
    channelProps: ChannelPositionProperties | null
    dragging: 0 | 1
    dragPos: number
    fromLeft: number
    fromRight: number
    startPos: number
}

type BorderWidths = { bottom: number, left: number, right: number, top: number }

/** Minimal settings shape consumed by this composable. */
type PointerSettings = {
    minSignalSelection: number
    selectionBound: { color: SettingsColor, style?: string, width: number }
}

/** Duck-typed interface for the VerticalCursors template ref. */
type Cursors = {
    disable: () => void
    enable: () => void
    setCursorPos: (pos: number) => void
}

type PlotPointerUpDetail = {
    channelProps: ChannelPositionProperties | null,
    pointerButton: 0 | 2 | typeof NO_POINTER_BUTTON_DOWN,
    pointerPosition: [number, number],
    position: number,
    startPos: number,
    // Event properties.
    ctrlKey: boolean,
    shiftKey: boolean,
}

export type PointerComposableOptions = {
    resource: BiosignalResource
    settings: PointerSettings
    // Reactive state refs (same objects returned from setup)
    activeCursorTool: Ref<string | null>
    activeSelection: Ref<PlotSelection | null>
    borderWidth: ComputedRef<BorderWidths>
    contextMenu: Ref<ContextMenuContext | null>
    cursors: Ref<Cursors>
    dragAction: Ref<DragAction | null>
    overlay: Ref<PointerEventOverlay>
    plotSelections: PlotSelection[]
    pointerLeaveHandlers: ((event?: PointerEvent) => void)[]
    pxPerSecond: Ref<number>
    resolvePlotUpdate: Ref<((v: unknown) => void) | null>
    selectedIndex: Ref<number>
    selectionBound: Ref<SignalSelectionLimit | null>
    visibleRange: ComputedRef<number>
    wrapper: Ref<HTMLDivElement>
    // Callbacks for viewer-specific operations
    onCloseAnalysis: () => void
    onExitEditor: () => void
    onOpenAnalysis: () => void
}

// ── Composable ───────────────────────────────────────────────────────────────

export function useBiosignalPointer ({
    resource,
    settings,
    activeCursorTool,
    activeSelection,
    borderWidth,
    contextMenu,
    cursors,
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
    onCloseAnalysis,
    onExitEditor,
    onOpenAnalysis,
}: PointerComposableOptions) {

    // ── Coordinate helpers ────────────────────────────────────────────────────

    function timeToOverlayX (time: number): number {
        if (time <= resource.viewStart) {
            return borderWidth.value.left
        }
        return Math.min(
            (time - resource.viewStart) * pxPerSecond.value + borderWidth.value.left,
            overlay.value.getOffsetWidth() - borderWidth.value.right,
        )
    }

    const selectionBoundStyles = computed((): string => {
        if (!selectionBound.value) {
            return 'display:none'
        }
        const borderStyle = `border-left: ${[
            settings.selectionBound.style || 'solid',
            settings.selectionBound.width + 'px',
            settingsColorToRgba(settings.selectionBound.color),
        ].join(' ')}`
        // Cascade: the dashed line marks an x position relative to the row containing the chosen
        // time, and its vertical extent is the row's channel band (not the full viewport — that
        // would obscure every other row's signal). For both channel-specific (start-selection
        // from a labelled channel) and global (start-global-selection) actions in cascade view
        // the marker only makes sense on one row, so they render identically.
        const active = resource.activeMontage
        if (active?.isCascade) {
            const cascade = active as BiosignalCascadeMontage
            const rowIdx = cascade.getRowAtTime(selectionBound.value.position)
            if (rowIdx < 0) {
                return 'display:none'
            }
            const range = cascade.getRowTimeRange(rowIdx)
            const chan = cascade.channels[rowIdx]
            if (!range || !chan?.offset) {
                return 'display:none'
            }
            const xWithinRow = (selectionBound.value.position - range[0]) * pxPerSecond.value
            const leftPx = xWithinRow + borderWidth.value.left - settings.selectionBound.width / 2
            return [
                `display:block`,
                `top:${(1 - chan.offset.top) * 100}%`,
                `bottom:${chan.offset.bottom * 100}%`,
                `left:${leftPx}px`,
                borderStyle,
            ].join(';')
        }
        const relPos = selectionBound.value.position - resource.viewStart
        if (relPos < 0 || relPos >= visibleRange.value) {
            return 'display:none'
        }
        const leftPos = timeToOverlayX(selectionBound.value.position)
        if (leftPos !== NUMERIC_ERROR_VALUE) {
            return [
                `display:block`,
                `left:${leftPos - settings.selectionBound.width / 2}px`,
                borderStyle,
            ].join(';')
        }
        return 'display:none'
    })

    // ── Pointer leave handlers ────────────────────────────────────────────────

    function addPointerLeaveHandler (handler: (event?: PointerEvent) => void) {
        pointerLeaveHandlers.push(handler)
    }

    function removePointerLeaveHandler (handler: (event?: PointerEvent) => void) {
        for (let i = 0; i < pointerLeaveHandlers.length; i++) {
            if (pointerLeaveHandlers[i] === handler) {
                pointerLeaveHandlers.splice(i, 1)
            }
        }
    }

    function handlePointerLeave (event: PointerEvent) {
        while (pointerLeaveHandlers.length) {
            const evHandler = pointerLeaveHandlers.shift()
            if (evHandler) {
                evHandler(event)
            }
        }
    }

    // ── Selection management ──────────────────────────────────────────────────

    function removeSelection (index: number) {
        if (!plotSelections[index]) {
            return
        }
        if (plotSelections[index] === activeSelection.value) {
            activeSelection.value = null
        }
        plotSelections.splice(index, 1)
    }

    function removeActiveSelection () {
        if (!activeSelection.value) {
            return
        }
        removeSelection(plotSelections.indexOf(activeSelection.value))
        activeSelection.value = null
    }

    function removeAllDragElements (keepActive = false) {
        if (keepActive) {
            for (let i = 0; i < plotSelections.length; i++) {
                if (plotSelections[i] !== activeSelection.value) {
                    plotSelections.splice(i, 1)
                    i--
                }
            }
        } else {
            plotSelections.splice(0)
            activeSelection.value = null
            dragAction.value = null
        }
    }

    function hideAllDragElements () {
        for (const selection of plotSelections) {
            // Cascade-mode selections live in the CascadeSelections overlay (no per-selection
            // `#signal-selection-<idx>` div), so `getElement()` is null. Optional-chain so the
            // hide path is a no-op there.
            selection.getElement()?.classList.add('epicv-hidden')
        }
    }

    function showAllDragElements () {
        for (const selection of plotSelections) {
            selection.getElement()?.classList.remove('epicv-hidden')
        }
    }

    function updateDragElement () {
        if (!activeSelection.value || !dragAction.value) {
            return
        }
        // Cascade montages route selection rendering through CascadeSelections.vue — there's no
        // single DOM element per selection (one bar per affected row), so the imperative style
        // path below would have nothing to mutate. Update `dimensions` so analysis-side consumers
        // that key off it still see consistent values and let the overlay re-render reactively
        // from `activeSelection.value.range`.
        if (resource.activeMontage?.isCascade) {
            activeSelection.value.dimensions = [
                timeToOverlayX(dragAction.value.startPos),
                timeToOverlayX(dragAction.value.dragPos),
            ].sort((a, b) => a - b)
            return
        }
        const dragEl = activeSelection.value.getElement()
        if (!dragEl) {
            Log.error('Drag element not available!', 'useBiosignalPointer')
            return
        }
        activeSelection.value.dimensions = [
            timeToOverlayX(dragAction.value.startPos),
            timeToOverlayX(dragAction.value.dragPos),
        ].sort((a, b) => a - b)
        const dif = activeSelection.value.dimensions[1] - activeSelection.value.dimensions[0]
        dragEl.style.top = `${100 * (1 - (dragAction.value.channelProps?.top || 1))}%`
        dragEl.style.bottom = `${100 * (dragAction.value.channelProps?.bottom || 0)}%`
        dragEl.style.left = `${activeSelection.value.dimensions[0]}px`
        dragEl.style.width = `${Math.abs(dif)}px`
        dragEl.style.pointerEvents = 'none'
    }

    function createSignalSelection (
        start: number,
        end: number,
        channelProps: ChannelPositionProperties | null,
        pointerButton?: 0 | 2,
    ) {
        selectedIndex.value = 0
        const nextIndex = plotSelections.length
        const selection = {
            canceled: false,
            channel: channelProps ? resource.visibleChannels[channelProps.index] : null,
            crop: [],
            dimensions: [],
            getElement: () => wrapper.value.querySelector(`#signal-selection-${nextIndex}`) as HTMLDivElement,
            markers: [],
            range: [start, end].sort((a, b) => a - b),
            signal: null,
        } as PlotSelection
        plotSelections.push(selection)
        if (pointerButton !== undefined) {
            activeSelection.value = selection
            dragAction.value = {
                button: pointerButton,
                channelProps,
                dragging: end < start ? 0 : 1,
                dragPos: end,
                fromLeft: 0,
                fromRight: 0,
                startPos: start,
            }
            cursors.value.disable()
            nextTick(() => { updateDragElement() })
        } else {
            if (selection.channel) {
                resource.getChannelSignal(selection.channel.name, selection.range).then(response => {
                    if (response) {
                        selection.signal = response.signals[0]
                    }
                })
            }
            nextTick(() => {
                // Cascade montages render selections reactively via CascadeSelections.vue —
                // there's no single DOM element to mutate. Just publish dimensions so analysis
                // tools that key off them see consistent values; the overlay handles drawing.
                if (resource.activeMontage?.isCascade) {
                    selection.dimensions = [
                        timeToOverlayX(start),
                        timeToOverlayX(end),
                    ].sort((a, b) => a - b)
                    return
                }
                const selEl = selection.getElement()
                if (!selEl) {
                    Log.error('Selection element not available.', 'useBiosignalPointer')
                    return
                }
                selection.dimensions = [
                    timeToOverlayX(start),
                    timeToOverlayX(end),
                ].sort((a, b) => a - b)
                const dif = selection.dimensions[1] - selection.dimensions[0]
                selEl.style.top = `${100 * (1 - (channelProps?.top || 1))}%`
                selEl.style.bottom = `${100 * (channelProps?.bottom || 0)}%`
                selEl.style.left = `${selection.dimensions[0]}px`
                selEl.style.width = `${Math.abs(dif)}px`
            })
        }
    }

    function handleSelectionClick (index: number) {
        selectedIndex.value = index
        onOpenAnalysis()
    }

    // ── Plot event handlers ───────────────────────────────────────────────────

    function handlePlotPointerdown (event: CustomEvent) {
        const { detail } = event
        onCloseAnalysis()
        onExitEditor()
        if (!detail.ctrlKey || activeCursorTool.value) {
            removeAllDragElements()
            contextMenu.value = null
        }
    }

    function handlePlotPointerDrag (event: CustomEvent) {
        const { detail } = event
        if (!activeSelection.value) {
            if (
                plotSelections.length >= MAX_SIGNAL_SELECTIONS
                || (plotSelections.length && !detail.ctrlKey)
            ) {
                return
            }
            createSignalSelection(detail.startPos, detail.position, detail.channelProps, detail.pointerButton)
        } else if (dragAction.value) {
            dragAction.value.dragPos = detail.position
            dragAction.value.dragging = detail.position < detail.startPos ? 0 : 1
            activeSelection.value.range = [detail.startPos, detail.position].sort((a, b) => a - b)
            updateDragElement()
        }
    }

    function handlePlotPointerDragCancel () {
        removeActiveSelection()
        dragAction.value = null
    }

    function handlePlotPointerDragEnd (event: CustomEvent) {
        if (activeSelection.value?.canceled) {
            removeActiveSelection()
            return
        }
        if (!dragAction.value) {
            return
        }
        if (Math.abs(dragAction.value.dragPos - dragAction.value.startPos) < settings.minSignalSelection) {
            handlePlotPointerDragCancel()
            return
        }
        const { detail } = event
        if (detail.channelProps) {
            const chans = resource.activeMontage?.visibleChannels || []
            const selectionChannel = chans[detail.channelProps.index]
            if (!activeSelection.value || !selectionChannel) {
                return
            }
            activeSelection.value.channel = selectionChannel
            // Cascade montages render selections through CascadeSelections.vue — there is no
            // single `#signal-selection-<idx>` div, so `getElement()` returns null and a naïve
            // `.style.pointerEvents = ...` would throw. The overlay segments already carry
            // `pointer-events: auto` in their own CSS, so just skip the imperative DOM mutation
            // here. The dragEl can also legitimately be null for regular montages if the v-for
            // hasn't flushed yet (race between push to plotSelections and Vue's nextTick); guard
            // both paths.
            if (!resource.activeMontage?.isCascade) {
                const dragEl = activeSelection.value.getElement()
                if (dragEl) {
                    dragEl.style.pointerEvents = 'initial'
                }
            }
            cursors.value.enable()
            if (detail.pointerButton === 2 || activeCursorTool.value === 'inspect') {
                onOpenAnalysis()
            }
        }
        activeSelection.value = null
        dragAction.value = null
    }

    function handlePlotPointerup (event: CustomEvent) {
        cursors.value.enable()
        const { detail } = event
        const chans = resource.activeMontage?.visibleChannels || []
        if (activeSelection.value) {
            activeSelection.value = null
            plotSelections.pop()
            dragAction.value = null
        } else if (
            plotSelections.length
            && plotSelections.length < MAX_SIGNAL_SELECTIONS
            && detail.ctrlKey
        ) {
            if (!detail.channelProps) {
                return
            }
            const channelProps = detail.channelProps as ChannelPositionProperties
            const lastSelection = plotSelections[plotSelections.length - 1]
            const selectionChannel = chans[channelProps.index]
            if (!selectionChannel) {
                return
            }
            for (const sel of plotSelections) {
                if (sel.channel?.id === selectionChannel.id) {
                    return
                }
            }
            const nextIndex = plotSelections.length
            const selection = {
                canceled: false,
                channel: selectionChannel,
                crop: [],
                dimensions: [...lastSelection.dimensions],
                getElement: () => wrapper.value.querySelector(`#signal-selection-${nextIndex}`) as HTMLDivElement,
                markers: [],
                range: [...lastSelection.range],
                signal: null,
            } as PlotSelection
            plotSelections.push(selection)
            nextTick(() => {
                // Cascade selections are drawn by the CascadeSelections overlay reactively; no
                // single DOM element to style. The overlay already mirrors the time range so
                // there's nothing to do here besides opening analysis if the trigger matches.
                if (resource.activeMontage?.isCascade) {
                    if (detail.pointerButton === 2 || activeCursorTool.value === 'inspect') {
                        onOpenAnalysis()
                    }
                    return
                }
                const dragEl = selection.getElement()
                if (!dragEl) {
                    Log.error('New drag element not available!', 'useBiosignalPointer')
                    return
                }
                const offsetLeft = lastSelection.dimensions[0]
                const dif = lastSelection.dimensions[1] - lastSelection.dimensions[0]
                dragEl.style.top = `${100 * (1 - channelProps.top)}%`
                dragEl.style.bottom = `${100 * channelProps.bottom}%`
                dragEl.style.left = `${offsetLeft}px`
                dragEl.style.width = `${Math.abs(dif)}px`
                if (detail.pointerButton === 2 || activeCursorTool.value === 'inspect') {
                    onOpenAnalysis()
                }
            })
        } else if (detail.pointerButton === 2) {
            contextMenu.value = {
                channel: detail?.channelProps ? (chans[detail.channelProps.index] as BiosignalChannel) : null,
                position: detail.pointerPosition,
                target: 'plot',
                timestamp: detail.position,
                props: null,
            }
        } else if (detail.pointerType === 'touch') {
            contextMenu.value = null
            removeAllDragElements()
        }
    }

    function handlePlotMouseClick (event: CustomEvent) {
        onCloseAnalysis()
        onExitEditor()
        const { detail } = event
        if ([0, 2].includes(detail.pointerButton)) {
            removeAllDragElements()
            if (detail.pointerButton === 2) {
                contextMenu.value = null
                nextTick(() => {
                    contextMenu.value = {
                        channel: null,
                        position: detail.pointerPosition,
                        target: 'plot',
                        timestamp: detail.position,
                        props: null,
                    }
                })
            } else if (detail.pointerButton === 0) {
                contextMenu.value = null
            }
        }
    }

    function handlePlotDoubleClick (event: CustomEvent<PlotPointerUpDetail>) {
        if (activeSelection.value || plotSelections.length) {
            return
        }
        const { detail } = event
        // Cascade view: a double-click moves the recording's viewStart so the clicked time
        // becomes the centre of the next non-cascade montage's window. The user picks the
        // target montage themselves — viewStart is a recording-level property, so whichever
        // they activate will inherit the new position. Skip the selection / cursor logic
        // below because cascade rows aren't currently editable.
        if (resource.activeMontage?.isCascade) {
            const mainLen = resource.mainViewLength
            const target = mainLen && mainLen > 0
                ? Math.max(detail.startPos - mainLen / 2, 0)
                : Math.max(detail.startPos, 0)
            resource.viewStart = Math.floor(target)
            return
        }
        const startPos = Math.max(resource.viewStart, detail.startPos - 0.5)
        const endPos = Math.min(resource.viewStart + visibleRange.value, detail.startPos + 0.5)
        if (event.detail.ctrlKey && detail.channelProps) {
            createSignalSelection(startPos, endPos, detail.channelProps)
        } else if (event.detail.shiftKey) {
            createSignalSelection(startPos, endPos, null)
        }
        if (activeCursorTool.value === 'inspect') {
            onOpenAnalysis()
        }
        cursors.value.setCursorPos(detail.startPos)
    }

    function handlePlotTouchStart (_event: TouchEvent) {
        onCloseAnalysis()
        onExitEditor()
    }

    function handlePlotUpdated (context: unknown) {
        if (resolvePlotUpdate.value) {
            resolvePlotUpdate.value(context)
            resolvePlotUpdate.value = null
        }
    }

    return {
        selectionBoundStyles,
        timeToOverlayX,
        addPointerLeaveHandler,
        removePointerLeaveHandler,
        handlePointerLeave,
        createSignalSelection,
        handleSelectionClick,
        handlePlotPointerdown,
        handlePlotPointerDrag,
        handlePlotPointerDragCancel,
        handlePlotPointerDragEnd,
        handlePlotPointerup,
        handlePlotMouseClick,
        handlePlotDoubleClick,
        handlePlotTouchStart,
        handlePlotUpdated,
        hideAllDragElements,
        showAllDragElements,
        removeAllDragElements,
        removeActiveSelection,
        removeSelection,
        updateDragElement,
    }
}
