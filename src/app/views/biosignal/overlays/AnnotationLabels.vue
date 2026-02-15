<template>
    <div data-component="annotation-labels" ref="component">
        <template v-for="([id, context], _idx) of annotationContexts" :key="`annotation-${_idx}`">
            <div v-if="!context.event.background"
                :data-annotation-id="context.event.id"
                :ref="storeAnnotationRef"
                :class="[
                    'annotation',
                    { 'active': context.event.isActive }
                ]"
                :style="context.style"
                @pointerdown.prevent.stop="handleAnnotationPointerdown(id, $event)"
                @pointerup.prevent.stop="handleAnnotationPointerup(id, $event)"
            >
                <!-- Annotation -->
                <div v-if="!context.event.duration" id="line" :style="getLineStyles(id)"></div>
                <div id="wrapper" class="labelwrapper">
                    <div v-if="context.event.duration && !context.extendsLeft"
                        id="start"
                        class="resize"
                        @pointerdown.prevent="handleStartPointerDown(id, $event)"
                    ></div>
                    <button id="label"
                        :class="[
                            `epicv-oneliner`,
                            'label',
                            { 'active': context.event.isActive }
                        ]"
                        :title="context.event.label + (context.event.text ? '\n' + context.event.text : '')"
                        @focusin="activateAnnotation(context.event)"
                        @focusout="deactivateAnnotation(context.event)"
                    >
                        {{ context.event.label }}
                    </button>
                    <div v-if="context.event.duration && !context.extendsRight"
                        id="end"
                        class="resize"
                        @pointerdown.prevent="handleEndPointerDown(id, $event)"
                    ></div>
                </div>
            </div>
        </template>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType, reactive, Ref, ref } from "vue"
import { T } from "#i18n"
import {
    deepEqual,
    INDEX_NOT_ASSIGNED,
    NUMERIC_ERROR_VALUE,
    shouldDisplayChannel,
    settingsColorToRgba,
} from "@epicurrents/core/util"
import { useStore } from "vuex"
import { useBiosignalContext } from "#config"
import { NO_POINTER_BUTTON_DOWN } from "#util"
import { Log } from "scoped-event-log"
import type {
    Annotation,
    BiosignalAnnotationEvent,
    BiosignalChannel,
    SettingsColor,
} from "@epicurrents/core/types"
import type { OverlayPointerEventMeta, PointerEventOverlay } from "#app/overlays/PointerEventOverlay.vue"

const DBLCLICK_THRESHOLD = 250

type AnnotationContext = {
    event: BiosignalAnnotationEvent
    color: SettingsColor
    dragging: boolean
    el: null | HTMLDivElement
    extendsLeft: boolean
    extendsRight: boolean
    opacity: number
    row: number
    style: string
    width: number
    setDuration: (duration: number) => void
    setStart: (start: number) =>  void
}

/** Margin size in pixels for a "grabbing zone" around an annotation marker line. */
const ANNOTATION_MARGIN = 5
/** Preserve a minimum visible duration (in seconds) to make it easier to grab the annotation label ends for dragging. */
const MIN_VISIBLE_DURATION = 0.25

export default defineComponent({
    name: 'AnnotationLabels',
    props: {
        overlay: {
            type: Object as PropType<PointerEventOverlay>,
            required: true,
        },
        secPerPage: {
            type: Number,
            required: true,
        },
        SETTINGS: {
            type: Object,
            required: true,
        },
        viewRange: {
            type: Number,
            required: true,
        },
    },
    setup () {
        const store = useStore()
        const annotationContexts = ref(new Map<string, AnnotationContext>())
        const draggingAnnotation = {
            anchor: 'start' as 'start' | 'end',
            context: null as AnnotationContext | null,
            overThreshold: false,
        }
        const editingAnnotation = null as Annotation | null
        const labelStyles = reactive([] as string[]) // Styles need to be updated asynchronously
        const lastClicked = {
            /** Pointer button index. */
            button: NO_POINTER_BUTTON_DOWN,
            /** Annotation ID. */
            id: null as string | null,
            /** Date timestamp of the last pointer action. */
            timestamp: 0,
        }
        // Handlers
        const pointerLeaveHandlers = reactive([] as ((event?: PointerEvent) => void)[])
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        // Unsubscribe from store mutations
        const unsubscribe = ref(null as (() => void) | null)
        return {
            /** References to contexts of currently visible annotations. */
            annotationContexts,
            /** Reference to an annotation currently being dragged. */
            draggingAnnotation,
            /** Annotation currently being edited. */
            editingAnnotation,
            labelStyles,
            /** Information regarding the latest click event on an annotation. */
            lastClicked,
            /** An array of handlers that are called when pointer leaves the overlay. */
            pointerLeaveHandlers,
            component,
            // Imported methods
            settingsColorToRgba,
            ...useBiosignalContext(store, 'AnnotationLabels'),
            // Unsubscribers
            unsubscribe,
        }
    },
    watch: {
        msPerPage () {
            this.updateAnnotations()
        },
        viewRange () {
            this.updateAnnotations()
        },
    },
    computed: {
        annotationStyles (): string {
            const styles = [
                `width: ${10 + this.SETTINGS.annotations.width}px`,
            ]
            return styles.join(';')
        },
        /** Require at least ~2,5 mm (0.1 inches) of pointer movement to register a drag event. */
        pointerDragThreshold (): number {
            return this.$store.state.INTERFACE.app.screenPPI/10
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
        activateAnnotation (event: BiosignalAnnotationEvent) {
            // First deactivate all other annotations.
            // TODO: Multiple active annotations at the same time?
            for (const evt of this.RESOURCE.events) {
                if (evt.isActive) {
                    evt.isActive = false
                }
            }
            event.isActive = true
        },
        addPointerLeaveHandler (handler: (event?: PointerEvent) => void) {
            this.pointerLeaveHandlers.push(handler)
        },
        adjustDraggingAnnotation (newVal: unknown, prevVal: unknown) {
            const viewStart = newVal as number
            const prevStart = prevVal as number
            if (this.draggingAnnotation.context) {
                const { anchor, context, overThreshold } = this.draggingAnnotation
                if (!overThreshold) {
                    // Handle view start change as a drag action.
                    this.draggingAnnotation.overThreshold = true
                }
                if (anchor === 'start') {
                    this.setAnnotationStart(context, context.event.start + viewStart - prevStart)
                } else {
                    this.setAnnotationEnd(context, context.event.start + context.event.duration + viewStart - prevStart)
                }
            }
        },
        annotationColorToBgColor (color: SettingsColor) {
            // Legacy method, may need this later to alter the returned color somehow.
            return settingsColorToRgba(color)
        },
        cancelPointerDrag () {
            if (this.pointerLeaveHandlers.length) {
                this.handlePointerLeave()
            }
        },
        deactivateAllAnnotations () {
            for (const context of this.annotationContexts.values()) {
                if (context.event.isActive) {
                    // We need to unfocus the button label in order to register an immediate focusin event.
                    const annoLbl = context.el?.querySelector('#label') as HTMLButtonElement
                    annoLbl?.blur()
                }
            }
        },
        deactivateAnnotation (annotation: Annotation) {
            // Manually update annotations in case the handler has already fired (this caused problems at one point).
            annotation.removeEventListener('isActive', this.updateAnnotations, this.ID)
            annotation.isActive = false
            this.updateAnnotations()
        },
        /**
         * Find all channel indices that contain the specified signal.
         * @param signal - The signal to search for.
         * @param checkRef - Whether to check reference channels.
         * @returns An array of channel indices that contain the specified signal.
         */
        findChannelIndicesWithSignal (signal: string | number, checkRef = false) {
            if (!this.RESOURCE.recordMontage || !this.RESOURCE.activeMontage) {
                return []
            }
            const activeIndex = typeof signal === 'number'
                              ? [this.RESOURCE.recordMontage.channels[signal].active]
                              : this.RESOURCE.recordMontage.channels.filter(
                                    c => c.name.toLowerCase() === signal.toLowerCase()
                                ).map(c => c.active)
            if (!activeIndex?.length || activeIndex[0] === -1) {
                return []
            }
            const activeMontageIndices = [] as number[]
            this.RESOURCE.activeMontage.channels.map((c, i) => {
                const cActive = Array.isArray(c.active) ? c.active : [c.active]
                if (cActive === activeIndex[0] || deepEqual(cActive, activeIndex)) {
                    activeMontageIndices.push(i)
                }
            })
            if (!activeMontageIndices.length && activeIndex.length && checkRef) {
                // If no active channels were matched but we have something to check against reference signals.
                // We will only match channels with one reference.
                // Otherwise this would match all channels in an average reference montage for example.
                const refIndex = this.RESOURCE.activeMontage.channels.findIndex(
                    c => (typeof c.reference === 'number' && activeIndex.includes(c.reference))
                        || (
                            c.reference.length === 1 && (
                                (Array.isArray(c.reference[0]) && activeIndex.includes(c.reference[0][0]))
                                || activeIndex.includes(c.reference[0])
                            )
                        )
                )
                if (refIndex !== -1) {
                    activeMontageIndices.push(refIndex)
                }
            }
            return activeMontageIndices
        },
        /**
         * Helper method to calculate annotation properties.
         */
        getAnnotationProperties (event: BiosignalAnnotationEvent) {
            const properties = {
                color: this.SETTINGS.annotations.color,
                extendsLeft: false,
                extendsRight: false,
                styles: [] as string[],
                width: 0,
            }
            const contW = this.overlay.getOffsetWidth()
            const evtPos = this.getPagePosition(event.start)
            properties.styles = [
                `left: ${Math.max(evtPos*contW, 0) - ANNOTATION_MARGIN}px`,
                `${this.annotationStyles}`,
            ]
            if (event.duration) {
                if (evtPos < 0) {
                    properties.extendsLeft = true
                }
                const spanEnd = this.getPagePosition(event.start + event.duration)
                if (spanEnd > 1) {
                    properties.extendsRight = true
                }
                properties.width = (
                    Math.min(spanEnd, 1) - Math.max(evtPos, 0)
                )*this.overlay.getOffsetWidth()
            }
            return properties
        },
        getBackgroundProperties (context: AnnotationContext, channel: BiosignalChannel) {
            const range = [context.event.start, context.event.start + context.event.duration]
            const overlayW = this.overlay.getOffsetWidth()
            const startX = (Math.max(range[0] - this.RESOURCE.viewStart, 0)/this.viewRange)*overlayW
            const endX = (Math.min(range[1] - this.RESOURCE.viewStart, this.viewRange)/this.viewRange)*overlayW
            const left = `${startX}px`
            const right = `${overlayW - endX}px`
            const top = `${100*(1 - channel.offset.top)}%`
            const bottom = `${100*channel.offset.bottom}%`
            return `top: ${top}; bottom: ${bottom}; left: ${left}; right: ${right}`
        },
        getLineStyles (id: string): string {
            const annoColor = this.annotationContexts.get(id)?.color
            if (!annoColor) {
                return ''
            }
            const styles = [
                `width: ${this.SETTINGS.annotations.width}px`,
                `background-color: ${settingsColorToRgba(annoColor)}`,
            ]
            return styles.join(';')
        },
        getPagePosition (startTime: number): number {
            return (startTime - this.RESOURCE.viewStart)/this.secPerPage
        },
        handleAnnotationFocusout (annotation: Annotation) {
            if (this.editingAnnotation?.id !== annotation.id) {
                this.deactivateAnnotation(annotation)
            }
        },
        /**
         * Handle pointer down event on any of the annotations.
         */
        handleAnnotationPointerdown: function (id: string, event: PointerEvent) {
            const context = this.annotationContexts.get(id)
            const annoEl = context?.el
            if (!annoEl) {
                return // TypeScript.
            }
            // Check if this qualifies as a double-click.
            // TODO: Touch action support?
            if (event.button === 0) {
                const timestamp = Date.now()
                // Check if annotation and button match the last click event.
                if (this.lastClicked.id === id && this.lastClicked.button === event.button) {
                    if (timestamp - this.lastClicked.timestamp < DBLCLICK_THRESHOLD) {
                        this.editingAnnotation = context.event
                        this.lastClicked.timestamp = timestamp
                        return
                    } else {
                        this.lastClicked.timestamp = timestamp
                    }
                } else {
                    this.lastClicked = { button: event.button, id: context.event.id, timestamp: timestamp }
                }
            }
            // Only allow drag on spot annotations
            if (context.event.duration) {
                return
            }
            this.draggingAnnotation = {
                anchor: 'start',
                context: context,
                overThreshold: false,
            }
            const pointerMove = (left: number, _top: number, meta: OverlayPointerEventMeta) => {
                if (!this.draggingAnnotation.overThreshold) {
                    // Expect threshold to be crossed at least once before moving the annotation.
                    if (Math.abs(left - meta.initialX) < this.pointerDragThreshold) {
                        return
                    } else {
                        this.draggingAnnotation.overThreshold = true
                    }
                }
                this.setAnnotationStart(context, this.RESOURCE.viewStart + meta.relX*this.secPerPage)
            }
            const pointerUp = (_left: number, _top: number, _meta: OverlayPointerEventMeta) => {
                this.draggingAnnotation.context = null
                if (this.draggingAnnotation.overThreshold) {
                    // Deactivate the event and update to reflect the new position.
                    this.deactivateAnnotation(context.event)
                    this.RESOURCE.dispatchPropertyChangeEvent('events')
                }
            }
            this.overlay.trackPointer(
                event,
                { move: pointerMove, up: pointerUp },
                ...Array.from(this.annotationContexts.values()).map(ctx => ctx.el).filter(el => el !== null),
            )
            // Fire pointerup handler to register "click" event.
            this.handleAnnotationPointerup(id, event)
        },
        handleAnnotationPointerup (id: string, event: PointerEvent) {
            // Only handle pointerup events that originate from the same annotation and the same button as the last pointerdown.
            if (id !== this.lastClicked.id || event.button !== this.lastClicked.button) {
                return
            }
            const context = this.annotationContexts.get(id)
            const annoEl = context?.el
            if (!annoEl) {
                return // TypeScript.
            }
            const timeNow = Date.now()
            if (timeNow - this.lastClicked.timestamp) {
                // Add a single execution handler for annotation deactivation.
                const singleUpdate = () => {
                    this.updateAnnotations()
                    context.event.removeEventListener('isActive', singleUpdate, this.ID)
                }
                context.event.onPropertyChange('isActive', singleUpdate, this.ID)
                this.updateAnnotations()
            }
            if (this.editingAnnotation) {
                // If pointer button was not release immediately after, it may have been an attempted drag event.
                if (Date.now() - this.lastClicked.timestamp < DBLCLICK_THRESHOLD) {
                    // Only emit unambiguous click events.
                    this.$emit('edit-annotation', context.event)
                }
                this.lastClicked = { button: INDEX_NOT_ASSIGNED, id: null, timestamp: 0 }
                this.editingAnnotation = null
            }
        },
        handleEndPointerDown (id: string, event: PointerEvent) {
            const context = this.annotationContexts.get(id)
            const annoEl = context?.el
            if (!annoEl) {
                return
            }
            // Maintain opacity for the duration of the drag action.
            const annotationWrapper = annoEl.querySelector('#wrapper') as HTMLDivElement
            annotationWrapper.style.opacity = '1'
            const contW = this.overlay.getOffsetWidth()
            const wrapperRight = annotationWrapper.getBoundingClientRect().left + annotationWrapper.offsetWidth
            /** Starting pixel difference between the pointer position and the annotation wrapper start position. */
            const startDif = event.clientX - wrapperRight
            // Do not allow dragging annotation end too close to start of the page.
            const minX = this.getPagePosition(this.RESOURCE.viewStart + MIN_VISIBLE_DURATION)*contW + startDif
            const maxX = contW + startDif - (this.SETTINGS.border.right?.width || 0) - 1
            this.draggingAnnotation = {
                anchor: 'end',
                context: context,
                overThreshold: false,
            }
            const pointerMove = (left: number, _top: number, meta: OverlayPointerEventMeta) => {
                if (left < minX || left >= maxX || !meta.event) {
                    return
                }
                if (!this.draggingAnnotation.overThreshold) {
                    // Expect threshold to be crossed at least once before moving the annotation.
                    if (Math.abs(meta.event.clientX - event.clientX) < this.pointerDragThreshold) {
                        return
                    } else {
                        this.draggingAnnotation.overThreshold =  true
                    }
                }
                this.setAnnotationEnd(context, this.RESOURCE.viewStart + meta.relX*this.secPerPage)
            }
            const pointerUp = (_left: number, _top: number, _meta: OverlayPointerEventMeta) => {
                // Reset opacity.
                annotationWrapper.style.opacity = ''
                this.draggingAnnotation.context = null
                if (this.draggingAnnotation.overThreshold) {
                    // Deactivate the annotation and update to reflect new duration.
                    this.deactivateAnnotation(context.event)
                }
            }
            this.overlay.trackPointer(
                event,
                { move: pointerMove, up: pointerUp },
                ...Array.from(this.annotationContexts.values()).map(ctx => ctx.el).filter(el => el !== null),
            )
            // Show a resize icon while dragging.
            this.overlay.style.cursor = 'ew-resize'
        },
        handleKeydown (event: KeyboardEvent) {
            if (event.key === 'Escape') {
                this.deactivateAllAnnotations()
            }
        },
        handleKeyup (event: KeyboardEvent) {
            if (event.key === 'Delete') {
                // Handle delete event in keyup so it can be cancelled by hitting Escape before the key is released.
                for (const context of this.annotationContexts.values()) {
                    if (context.event.isActive) {
                        // Stop drag action if one is active.
                        if (this.draggingAnnotation.context?.event.id === context.event.id) {
                            this.draggingAnnotation.context = null
                        }
                        // We need to unfocus the button label or it will remain focused if the deletion is undo'ed.
                        const annoLbl = context.el?.querySelector('#label') as HTMLButtonElement
                        annoLbl?.blur()
                        this.$emit('delete-annotation', context.event)
                    }
                }
            }
        },
        /**
         * Handle pointer leave events by executing and removing the appropriate the handlers.
         */
        handlePointerLeave (event?: PointerEvent) {
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
        handleStartPointerDown (id: string, event: PointerEvent) {
            const context = this.annotationContexts.get(id)
            const annoEl = context?.el
            if (!annoEl) {
                return
            }
            // Maintain opacity for the duration of the drag action.
            const annotationWrapper = annoEl.querySelector('#wrapper') as HTMLDivElement
            annotationWrapper.style.opacity = '1'
            const contW = this.overlay.getOffsetWidth()
            const wrapperLeft = annotationWrapper.getBoundingClientRect().left
            /** Starting pixel difference between the pointer position and the annotation wrapper start position. */
            const startDif = event.clientX - wrapperLeft
            // Do not allow dragging event duration too close to page start or page end.
            const minX = (this.SETTINGS.border.left?.width || 0) + startDif + 1
            const maxX = this.getPagePosition(
                Math.min(
                    // Prevent setting the annotation duration too close to zero.
                    context.event.start + context.event.duration,
                    // Prevent resizing the annotation start too close to the right edge.
                    this.RESOURCE.viewStart + this.viewRange
                ) - MIN_VISIBLE_DURATION
            )*contW + startDif
            this.draggingAnnotation = {
                anchor: 'start',
                context: context,
                overThreshold: false,
            }
            const pointerMove = (left: number, _top: number, meta: OverlayPointerEventMeta) => {
                if (left > maxX || left <= minX || !meta.event) {
                    return
                }
                if (!this.draggingAnnotation.overThreshold) {
                    // Expect threshold to be crossed at least once before moving the annotation.
                    if (Math.abs(meta.event.clientX - event.clientX) < this.pointerDragThreshold) {
                        return
                    } else {
                        this.draggingAnnotation.overThreshold =  true
                    }
                }
                this.setAnnotationStart(context, this.RESOURCE.viewStart + meta.relX*this.secPerPage)
            }
            const pointerUp = (_left: number, _top: number, _meta: OverlayPointerEventMeta) => {
                // Reset opacity.
                annotationWrapper.style.opacity = ''
                this.draggingAnnotation.context = null
                if (this.draggingAnnotation.overThreshold) {
                    // Deactivate the annotation and update to reflect new start and duration.
                    this.deactivateAnnotation(context.event)
                }
            }
            this.overlay.trackPointer(
                event,
                { move: pointerMove, up: pointerUp },
                ...Array.from(this.annotationContexts.values()).map(ctx => ctx.el).filter(el => el !== null),
            )
            // Show a resize icon while dragging
            this.overlay.style.cursor = 'ew-resize'
        },
        removePointerLeaveHandler (handler: (event?: PointerEvent) => void) {
            for (let i=0; i<this.pointerLeaveHandlers.length; i++) {
                if (this.pointerLeaveHandlers[i] === handler) {
                    this.pointerLeaveHandlers.splice(i, 1)
                }
            }
        },
        /**
         * Set new ending position for an annotation, altering its duration.
         * @param context - Context of the annotation to alter.
         * @param end - New annotation end position (in recording seconds).
         */
        setAnnotationEnd (context: AnnotationContext, end: number) {
            if (this.SETTINGS.annotations.containWithinRecording && end >= this.RESOURCE.totalDuration) {
                return
            }
            if (!context.event.duration) {
                // Only works for annotations with a duration.
                return
            }
            if (end - context.event.start < MIN_VISIBLE_DURATION) {
                // Don't resize annotation duration to less than minimum visible duration.
                return
            }
            const prevEnd = context.event.start + context.event.duration
            context.event.duration += end - prevEnd
            const newProps = this.getAnnotationProperties(context.event)
            context.extendsLeft = newProps.extendsLeft
            context.extendsRight = newProps.extendsRight
            context.style = newProps.styles.join(';')
            context.width = newProps.width
            this.$nextTick(() => {
                this.updateAnnotationStyles()
            })
        },
        /**
         * Set new starting position for an annotation.
         * @param context - Context of the annotation to alter.
         * @param start - New annotation start position (in recording seconds).
         */
        setAnnotationStart (context: AnnotationContext, start: number) {
            if (this.SETTINGS.annotations.containWithinRecording && start < 0) {
                return
            }
            const prevStart = context.event.start
            if (context.event.duration) {
                if (context.event.duration - (start - prevStart) < MIN_VISIBLE_DURATION) {
                    // Don't resize annotation duration to less than minimum visible duration.
                    return
                }
                context.event.duration += prevStart - start
            }
            context.event.start = start
            const newProps = this.getAnnotationProperties(context.event)
            context.extendsLeft = newProps.extendsLeft
            context.extendsRight = newProps.extendsRight
            context.style = newProps.styles.join(';')
            context.width = newProps.width
            this.$nextTick(() => {
                this.updateAnnotationStyles()
            })
        },
        storeAnnotationRef (el: any) {
            if (el) {
                if (!el.dataset?.annotationId) {
                    Log.error(`Annotation element did not have annotation ID data property.`, this.$options.name as string)
                    return
                }
                const annoCtx = this.annotationContexts.get(el.dataset.annotationId)
                if (annoCtx) {
                    annoCtx.el = el
                } else {
                    Log.error(`${el.dataset.annotationId} did not have a corresponding context.`, this.$options.name as string)
                }
            }
        },
        updateAnnotations () {
            // Store visible annotation IDs to prune the annotation map later.
            const visibleAnnoIds = [] as string[]
            for (const event of this.RESOURCE.events) {
                // Channel annotations are always visible in raw signal view, but may not be in every montage.
                if (event.channels.length && this.RESOURCE.activeMontage) {
                    // Check that at least one of the annotation channels is visible
                    let anyChanVisible = false
                    for (const chan of event.channels) {
                        const cIndex = this.findChannelIndicesWithSignal(chan, true)
                        if (
                            cIndex.some(
                                i => shouldDisplayChannel(
                                    this.RESOURCE.visibleChannels[i],
                                    this.RESOURCE.activeMontage === null,
                                    this.SETTINGS
                                )
                            )
                        ) {
                            anyChanVisible = true
                            break
                        }
                    }
                    if (!anyChanVisible) {
                        continue
                    }
                }
                const startPos = this.getPagePosition(event.start)
                if (startPos > 1) {
                    // Future annotations from now on, we're done here.
                    break
                } else if (event.start + event.duration < this.RESOURCE.viewStart) {
                    // Annotation does not extend to view.
                    continue
                }
                visibleAnnoIds.push(event.id)
                const properties = this.getAnnotationProperties(event)
                for (const [annoClass, props] of Object.entries(this.SETTINGS.annotations.classes)) {
                    if (event.class === annoClass) {
                        properties.color = (props as any).color as SettingsColor
                        break
                    }
                }
                for (const [typeName, color] of Object.entries(this.SETTINGS.annotations.typeColors)) {
                    if (event.type?.startsWith(typeName)) {
                        properties.color = color as SettingsColor
                        break
                    }
                }
                const existingContext = this.annotationContexts.get(event.id)
                if (existingContext) {
                    // This annotation already exists, only update properties.
                    existingContext.color = properties.color
                    existingContext.extendsLeft = properties.extendsLeft
                    existingContext.extendsRight = properties.extendsRight
                    existingContext.style = properties.styles.join(';')
                    existingContext.width = properties.width
                    //continue
                } else {
                    const newAnnotation = {
                        event,
                        color: properties.color,
                        el: null,
                        dragging: false,
                        extendsLeft: properties.extendsLeft,
                        extendsRight: properties.extendsRight,
                        opacity: event.opacity || 1,
                        row: NUMERIC_ERROR_VALUE,
                        style: properties.styles.join(';'),
                        width: properties.width,
                    } as AnnotationContext
                    this.annotationContexts.set(event.id, newAnnotation)
                }
            }
            // Remove references to annotations that are no longer in view.
            [...this.annotationContexts.keys()].filter(id => !visibleAnnoIds.includes(id)).forEach((id) => {
                this.annotationContexts.delete(id)
            })
            // Start style update in next tick.
            this.$nextTick(() => {
                this.updateAnnotationStyles()
            })
        },
        /**
         * Update annotation styles incrementally to avoid overlapping labels.
         * @param index - Index of the annotation context to update.
         */
        updateAnnotationStyles (index = 0) {
            // Grab sorted annotation IDs as reference.´
            const sortedIds = [...this.annotationContexts.values()].sort((a, b) => {
                return a.event.start - b.event.start ||
                       a.event.priority - b.event.priority ||
                       a.event.label.localeCompare(b.event.label)
            }).map(ctx => ctx.event.id)
            const curId = sortedIds[index]
            //const context = this.visibleAnnotations[index]
            const context = this.annotationContexts.get(curId)
            if (!context?.el) {
                return
            }
            //const annoDiv = this.annotationDivs[index]
            const lblWrapper = context.el.querySelector('#wrapper') as HTMLButtonElement
            const annoLabel = context.el.querySelector('#label') as HTMLButtonElement
            const annoStart = context.el.querySelector('#start') as HTMLDivElement
            const annoEnd = context.el.querySelector('#end') as HTMLDivElement
            if (!lblWrapper || !annoLabel) {
                return
            }
            //const annoPos = this.getPagePosition(annotation.start)
            if (annoStart) {
                annoStart.style.left = `-${0.5*ANNOTATION_MARGIN}px`
            }
            if (annoEnd) {
                annoEnd.style.right = `-${0.5*ANNOTATION_MARGIN}px`
            }
            lblWrapper.style.left = `${0 + ANNOTATION_MARGIN + this.SETTINGS.annotations.width}px`
            lblWrapper.style.boxShadow = `inset 0 0 0.25rem ${settingsColorToRgba(context.color)}`
            lblWrapper.style.borderTop = `solid 1px ${settingsColorToRgba(context.color)}`
            lblWrapper.style.borderBottom = `solid 1px ${settingsColorToRgba(context.color)}`
            lblWrapper.style.backgroundColor = `color-mix(in srgb, var(--epicv-background), ${
                                                    this.annotationColorToBgColor(context.color)
                                                } 10%)`
            const thisStart = Math.max(this.getPagePosition(context.event.start)*this.overlay.getOffsetWidth(), 0)
            // This conditional clauses must always set the same properties at each conclusion, else
            // some of the properties may "spill over" to other annotation elements.
            if (context.event.duration) {
                lblWrapper.style.width = `${context.width}px`
                annoLabel.style.textAlign = `center`
                context.el.style.pointerEvents = `none`
                lblWrapper.style.pointerEvents = `initial`
                lblWrapper.style.cursor = `initial`
                if (context.extendsLeft) {
                    lblWrapper.style.borderLeft = `none`
                } else {
                    lblWrapper.style.borderLeft = `solid 1px ${settingsColorToRgba(context.color)}`
                }
                if (context.extendsRight) {
                    lblWrapper.style.borderRight = `none`
                } else {
                    lblWrapper.style.borderRight = `solid 1px ${settingsColorToRgba(context.color)}`
                }
            } else {
                context.el.style.bottom = `${this.SETTINGS.border.bottom?.width || 1}px`
                context.el.style.pointerEvents = 'initial'
                lblWrapper.style.width = `auto`
                annoLabel.style.textAlign = `left`
                lblWrapper.style.borderLeft = `none`
                lblWrapper.style.borderRight = `solid 1px ${settingsColorToRgba(context.color)}`
                lblWrapper.style.cursor = `pointer`
            }
            // Each label must be processed in the next tick or the label's DOM properties won't be available yet.
            this.$nextTick(() => {
                if (!context || !context.el) {
                    return
                }
                // Label wrapper end position may depend on the length of the label.
                const thisEnd = thisStart + (context.el.querySelector('#wrapper') as HTMLDivElement)?.offsetWidth || 0
                // Find onverlapping label spans.
                const overlapRanges = [] as number[][]
                const overlapRows = [] as number[]
                // Start at row index zero.
                for (let i=0; i<index; i++) {
                    const otherCtx = this.annotationContexts.get(sortedIds[i])
                    if (!otherCtx || !otherCtx.el) {
                        continue
                    }
                    //const otherDiv = this.annotationDivs[i]
                    const otherStart = this.getPagePosition(otherCtx.event.start)*this.overlay.getOffsetWidth()
                    if (otherStart < 0 && !otherCtx.event.duration) {
                        // Out of sight instant annotation
                        continue
                    }
                    const otherLabelStart = Math.max(otherStart, 0)
                    const otherEnd = otherLabelStart + (otherCtx.el.querySelector('#wrapper') as HTMLDivElement)?.offsetWidth || 0
                    if (
                        (otherLabelStart <= thisStart && thisStart < otherEnd) ||
                        (thisStart <= otherLabelStart && otherStart < thisEnd)
                    ) {
                        overlapRanges.push(
                            [Math.max(thisStart, otherLabelStart), 0, otherCtx.row],
                            [Math.min(thisEnd, otherEnd), 1, otherCtx.row]
                        )
                    }
                }
                let nextRow = 0
                if (overlapRanges.length) {
                    // Arrange the overlapping spans by first element and see if there are additional overlaps
                    overlapRanges.sort((a, b) => {
                        return a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]
                    })
                    // Go through the sorted array to find first available row
                    for (const range of overlapRanges) {
                        if (!range[1]) {
                            // This is a range start. Add its height to the final height.
                            overlapRows.push(range[2])
                            // Calculate total height from the elements and save the top sum (2 is for padding between labels).
                            // This has been replaced by annotation rows, but will keep it here just in case I want to
                            // return to flexible annotation label heights.
                            //const sum = overlapHeights.reduce((partial, a) => partial + a + 2, 0)
                            //if (sum > top) {
                            //    top = sum
                            //}
                        } else {
                            // This is a range end. Remove the respective height from the final heights.
                            //for (let i=0; i<overlapHeights.length; i++) {
                            //    if (overlapHeights[i] === range[2]) {
                            //        overlapHeights.splice(i, 1)
                            //        break
                            //    }
                            //}
                        }
                    }
                    // Find the first empty row
                    overlapRows.sort((a, b) => a - b)
                    while (overlapRows.length) {
                        const nextTaken = overlapRows.shift()
                        if (nextTaken === undefined) {
                            break
                        }
                        if (nextTaken > nextRow) {
                            break
                        } else {
                            nextRow = nextTaken + 1
                        }
                    }
                }
                context.row = nextRow
                // Leave 4px of extra space between each label row.
                context.el.style.top = `calc(${1.5*Math.min(nextRow)}rem + ${nextRow*4}px)`
                // Continue updating annotations.
                if (index < this.annotationContexts.size - 1) {
                    this.updateAnnotationStyles(index + 1)
                }
            })
        },
    },
    beforeMount () {
        // Add component styles to shadow root
        this.$store.dispatch(
            'add-component-styles',
            { component: this.$options.name, styles: this.$options.__scopeId }
        )
    },
    mounted () {
        // Add property update handlers
        this.RESOURCE.onPropertyChange('activeMontage', this.updateAnnotations, this.ID)
        this.RESOURCE.onPropertyChange('events', this.updateAnnotations, this.ID)
        this.RESOURCE.onPropertyChange('displayViewStart', this.updateAnnotations, this.ID)
        //this.RESOURCE.onPropertyChange('pageLength', this.updateAnnotations, this.ID)
        // Cancel all ongoing drag events if the view start changes.
        this.RESOURCE.onPropertyChange('viewStart', this.adjustDraggingAnnotation, this.ID)
        // Listen to keydown and keyup events.
        window.addEventListener('keydown', this.handleKeydown, false)
        window.addEventListener('keyup', this.handleKeyup, false)
        requestAnimationFrame(() => {
            this.updateAnnotations()
        })
    },
    beforeUnmount () {
        // Remove property update handlers
        this.RESOURCE.removeAllEventListeners(this.ID)
        // Remove key handlers.
        window.removeEventListener('keydown', this.handleKeydown, false)
        window.removeEventListener('keyup', this.handleKeyup, false)
    }
})
</script>

<style scoped>
[data-component="annotation-labels"] {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
    [data-component="annotation-labels"] button {
        /* First reset all button styles */
        all: unset;
    }
    .overlay {
        position: absolute;
        inset: 0;
        z-index: -1;
        pointer-events: none;
    }
    .annotation {
        position: absolute;
        top: 0;
        left: -5px;
        padding: 0 5px;
        overflow-x: visible;
        cursor: pointer;
        pointer-events: all;
    }
        .annotation > div {
            height: 100%;
        }
        .annotation .labelwrapper {
            position: absolute;
            top: 0;
            display: flex;
            cursor: pointer;
            height: 1.5rem;
            line-height: 1.5rem;
            background-color: var(--epicv-background);
            opacity: 0.5;
        }
        .annotation .label {
            flex: 1 1 0;
            padding: 0 5px;
        }
            .annotation .labelwrapper:hover,
            .annotation.active .labelwrapper {
                opacity: 1;
            }
            .annotation .labelwrapper:has(button:not(.active)) {
                /* Applying dynamic color to the shadow via JS. */
                box-shadow: none !important;
            }
        .annotation .resize {
            position: relative;
            flex: 0 0 10px;
            height: 1.5rem;
            cursor: ew-resize;
        }
</style>
