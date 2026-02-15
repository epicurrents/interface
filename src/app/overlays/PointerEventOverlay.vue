<template>
    <div data-component="pointer-event-overlay"
        ref="component"
        @contextmenu.prevent=""
        @pointerleave="handlePointerLeave"
    ></div>
</template>

<script lang="ts">
import { PointerEventHandler, TouchEventHandler } from '#types/interface'
import { defineComponent, Ref, ref } from 'vue'

/**
 * Handle pointer move event.
 * @param left - New left position of the element.
 * @param top - New top position of the element.
 * @param meta - Meta information for the overlay move handler event.
 */
export type OverlayPointerEventHandler = (left: number, top: number, meta: OverlayPointerEventMeta) => void
/** Meta information for the overlay move handler event. */
export type OverlayPointerEventMeta = {
    /** The pointer event. */
    event?: PointerEvent
    /** Initial X position of the pointer relative to the element. */
    initialX: number
    /** Initial Y position of the pointer relative to the element. */
    initialY: number
    /** Relative X position (as fraction of element's width) of the pointer within the element. */
    relX: number
    /** Relative Y position (as fraction of element's height) of the pointer within the element. */
    relY: number
}
/**
 * Handle touch move event.
 * @param left - New left position of the element.
 * @param top - New top position of the element.
 * @param meta - Meta information for the overlay move handler event.
 */
export type OverlayTouchEventHandler = (left: number, top: number, meta: OverlayTouchEventMeta) => void
/** Meta information for the overlay move handler event. */
export type OverlayTouchEventMeta = {
    /** The touch event. */
    event?: TouchEvent
    /** Initial X position of the pointer relative to the element. */
    initialX: number
    /** Initial Y position of the pointer relative to the element. */
    initialY: number
    /** Relative X position (as fraction of element's width) of the pointer within the element. */
    relX: number
    /** Relative Y position (as fraction of element's height) of the pointer within the element. */
    relY: number
}
/**
 * Handlers for pointer move events.
 * @property move - Handler for pointer move event.
 * @property down - Handler for pointer down event, optional.
 * @property leave - Handler for pointer leave event, optional.
 * @property up - Handler for pointer up event, optional.
 */
export type OverlayMoveHandlers = {
    /**
     * Handler for pointer move event.
     * @param left - New left position of the element.
     * @param top - New top position of the element.
     * @param meta - Meta information for the overlay move handler event.
     */
    move: OverlayPointerEventHandler
    /**
     * Handler for pointer down event, optional.
     * @param left - New left position of the element.
     * @param top - New top position of the element.
     * @param meta - Meta information for the overlay move handler event.
     */
    down?: OverlayPointerEventHandler
    /**
     * Handler for pointer leave event, optional.
     * @param event - Pointer event that triggered the leave.
     */
    leave?: (event: PointerEvent) => void
    /**
     * Handler for touch cancel event, optional.
     * @param event - Touch event that triggered the cancel.
     */
    touchCancel?: (event: TouchEvent) => void
    /**
     * Handler for touch end event, optional.
     * @param left - New left position of the element.
     * @param top - New top position of the element.
     * @param meta - Meta information for the overlay move handler event.
     */
    touchEnd?: OverlayTouchEventHandler
    /**
     * Handler for touch move event, optional.
     * @param left - New left position of the element.
     * @param top - New top position of the element.
     * @param meta - Meta information for the overlay move handler event.
     */
    touchMove?: OverlayTouchEventHandler
    /**
     * Handler for touch start event, optional.
     * @param left - New left position of the element.
     * @param top - New top position of the element.
     * @param meta - Meta information for the overlay move handler event.
     */
    touchStart?: OverlayTouchEventHandler
    /**
     * Handler for pointer up event, optional.
     * @param left - New left position of the element.
     * @param top - New top position of the element.
     * @param meta - Meta information for the overlay move handler event.
     */
    up?: OverlayPointerEventHandler
}

/**
 * Component for handling pointer events on an overlay.
 * It automatically handles touch and mouse events in a consistent way, but allows executing custom handlers for touch
 * events if they need special treatment.
 *
 * In order to attain precise position information the overlay element should have the exact same position and size as
 * the element it is overlaying.
 */
const OverlayComponent = defineComponent({
    name: 'PointerEventOverlay',
    setup () {
        const pointerLeaveHandlers = ref([] as PointerEventHandler[])
        const touchCancelHandlers = ref([] as TouchEventHandler[])
        const component = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            pointerLeaveHandlers,
            touchCancelHandlers,
            component,
        }
    },
    computed: {
        style (): CSSStyleDeclaration {
            // Return the style of the overlay element.
            return this.component?.style ? this.component.style : {} as CSSStyleDeclaration
        },
    },
    methods: {
        addEventListener (type: string, handler: (event: Event) => void) {
            // Add an event listener to the overlay element.
            return this.component.addEventListener(type, handler)
        },
        /**
         * Add a `handler` method for when the pointer leaves the overlay.
         * @param handler - method to execute in the event of pointer leaving the element
         */
        addPointerLeaveHandler (handler: (event?: PointerEvent) => void) {
            this.pointerLeaveHandlers.push({
                el: this.component,
                handler: handler,
            })
        },
        addTouchCancelHandler (handler: (event: TouchEvent) => void) {
            this.touchCancelHandlers.push({
                el: this.component,
                handler: handler,
            })
        },
        /**
         * Disable pointer events on the overlay element.
         */
        disable () {
            this.component.style.pointerEvents = 'none'
            this.component.style.cursor = 'default'
        },
        getBoundingClientRect (): DOMRect {
            // Return the bounding client rectangle of the overlay element.
            return this.component.getBoundingClientRect()
        },
        /**
         * Get the height of the overlay element.
         * @returns Height of the overlay element.
         */
        getOffsetHeight (): number {
            // Return the height of the overlay element.
            return this.component?.offsetHeight ? this.component.offsetHeight : 0
        },
        /**
         * Get the width of the overlay element.
         * @returns Width of the overlay element.
         */
        getOffsetWidth (): number {
            // Return the width of the overlay element.
            return this.component?.offsetWidth ? this.component.offsetWidth : 0
        },
        /**
         * Handle pointer leave events by executing and removing the handlers.
         */
        handlePointerLeave (event: PointerEvent) {
            // Run all appropriate pointerleave handlers
            while (this.pointerLeaveHandlers.length) {
                // Remove handlers from the list and execute them
                const evHandler = this.pointerLeaveHandlers.shift()
                // Check that element still exists
                if (evHandler && evHandler.el) {
                    evHandler.handler(event)
                }
            }
        },
        removeEventListener (type: string, handler: (event: Event) => void) {
            // Remove an event listener from the overlay element.
            return this.component.removeEventListener(type, handler)
        },
        /**
         * Remove a pointer leave handler from the list.
         * @param handler - Handler to remove.
         */
        removePointerLeaveHandler (handler: (event?: PointerEvent) => void) {
            for (let i=0; i<this.pointerLeaveHandlers.length; i++) {
                if (this.pointerLeaveHandlers[i].handler === handler) {
                    this.pointerLeaveHandlers.splice(i, 1)
                    return
                }
            }
        },
        /**
         * Remove a touch cancel handler from the list.
         * @param handler - Handler to remove.
         */
        removeTouchCancelHandler (handler: (event: TouchEvent) => void) {
            for (let i=0; i<this.touchCancelHandlers.length; i++) {
                if (this.touchCancelHandlers[i].handler === handler) {
                    this.touchCancelHandlers.splice(i, 1)
                    return
                }
            }
        },
        /**
         * Track pointer movement on the overlay and execute the handler method.
         * @param event - Pointer event to track.
         * @param handlers - Handlers to execute on pointer events.
         * @param elements - Elements to disable pointer events on while tracking.
         */
        trackPointer (event: PointerEvent, handlers: OverlayMoveHandlers, ...elements: HTMLElement[]) {
            // Prevent the same event from triggering other effects.
            event.stopPropagation()
            // Save relative position of the overlay element.
            const { left, top } = this.component.getBoundingClientRect()
            // Save initial pointer position.
            const initialX = event.clientX - left
            const initialY = event.clientY - top
            // Disable pointer events on the element to prevent it from receiving pointer events while dragging.
            elements.forEach(el => el.style.pointerEvents = 'none')
            // Allow pointer events on the overlay to track pointer movement.
            this.component.style.pointerEvents = 'auto'
            // Show a pointer icon while dragging.
            this.component.style.cursor = 'pointer'
            if (
                event.pointerType === 'touch'
                && (event.target as HTMLDivElement).hasPointerCapture(event.pointerId)
            ) {
                // Release pointer capture on the original target to allow tracking movement on the overlay element.
                (event.target as HTMLDivElement).releasePointerCapture(event.pointerId)
                this.component.setPointerCapture(event.pointerId)
            }
            if (handlers.down) {
                const [relX, relY] = [left/this.getOffsetWidth(), top/this.getOffsetHeight()]
                // Execute the down handler if defined.
                handlers.down(left, top, { initialX, initialY, relX, relY, event })
            }
            /** Handle pointer moving over the overlay. */
            const pointerMove = (ev: PointerEvent) => {
                const newLeft = ev.clientX - left
                const newTop = ev.clientY - top
                const [relX, relY] = [newLeft/this.getOffsetWidth(), newTop/this.getOffsetHeight()]
                handlers.move(newLeft, newTop, { initialX, initialY, relX, relY, event: ev })
            }
            /** Handle pointer up event to stop tracking pointer movement. */
            const pointerUp = (ev?: PointerEvent) => {
                this.component.removeEventListener('pointermove', pointerMove)
                this.component.removeEventListener('pointerup', pointerUp)
                elements.forEach(el => el.style.pointerEvents = 'auto')
                this.component.style.pointerEvents = 'none'
                this.component.style.cursor = ''
                if (handlers.up && ev) {
                    // Execute the up handler if defined and the event is valid (mouseleave handler will not pass an event).
                    const upLeft = ev.clientX - left
                    const upTop = ev.clientY - top
                    const [relX, relY] = [upLeft/this.getOffsetWidth(), upTop/this.getOffsetHeight()]
                    handlers.up(upLeft, upTop, { initialX, initialY, relX, relY, event: ev })
                }
                this.removePointerLeaveHandler(pointerUp)
            }
            this.component.addEventListener('pointermove', pointerMove)
            this.component.addEventListener('pointerup', pointerUp)
            // Add pointerleave handler to the list.
            this.addPointerLeaveHandler(pointerUp)
            if (handlers.leave) {
                this.pointerLeaveHandlers.push({
                    el: this.component,
                    handler: handlers.leave,
                })
            }
            const pointerEvent = new PointerEvent('pointerdown', {
                clientX: event.clientX,
                clientY: event.clientY,
                bubbles: true,
                cancelable: true,
            })
            this.component.dispatchEvent(pointerEvent)
        },
    },
})
export type PointerEventOverlay = InstanceType<typeof OverlayComponent>
export default OverlayComponent
</script>

<style scoped>
div[data-component="pointer-event-overlay"] {
    inset: 0;
    pointer-events: none;
    position: absolute;
    z-index: 10;
}
</style>
