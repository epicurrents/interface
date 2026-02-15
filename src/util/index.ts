/**
 * Epicurrents Interface utilities.
 * @package    epicurrents/interface
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import {
    defineAsyncComponent,
    type AsyncComponentLoader,
    type ComponentOptionsBase,
    type ComponentPublicInstance,
} from 'vue'
import EmptyComponent from './components/EmptyComponent.vue'
import ErrorComponent from './components/ErrorComponent.vue'
import LoadingComponent from './components/LoadingComponent.vue'
import waDirective from './wa-directive'
import type { LoadingComponentProps } from '../types/interface'

export { waDirective }

/**
 * Value indicating that no pointer button is being pressed at the moment.
 */
export const NO_POINTER_BUTTON_DOWN = -1

/**
 * Load an asynchronous Vue component, displaying a temporary component until loading is complete.
 * @param loader - The import function of the component to load.
 * @param props - Loading component properties (optional, NYI).
 * @return Placeholder component that is replaced by the requested component.
 */
export const loadAsyncComponent = (loader: () => Promise<unknown> | null, _props?: LoadingComponentProps) => {
    return loader ? defineAsyncComponent({
        // the loader function
        loader: loader as AsyncComponentLoader<
                            new () => ComponentPublicInstance<
                                {}, {}, {}, {}, {}, {}, {}, {},
                                false,
                                ComponentOptionsBase<
                                    any, any, any, any, any, any, any, any, any, {}, {}, string, {}
                                >, {}, {}
                            >
                        >,
        // A component to use while the async component is loading.
        loadingComponent: LoadingComponent,
        // Delay before showing the loading component. Default: 200ms.
        delay: 200,
        // A component to use if the load fails.
        errorComponent: ErrorComponent,
        // The error component will be displayed if a timeout is provided and exceeded. Default: Infinity.
        timeout: 3000,
    }) : EmptyComponent
}
type TouchCallback = (event: TouchEvent) => void
type TouchOptions = {
    /** Swipe gestures to trigger. */
    gestures: ('left' | 'right' | 'up' | 'down' | 'tap')[]
    /** Minimum pixel distance to trigger a swipe action. */
    threshold: number
}
/**
 * Use touch gestures on a touchable `element`.
 * @param element - HTML element to listen to touch events from.
 * @param options - Gesture options (optional).
 * @returns A set of methods to add touch event listeners.
 * @privateRemarks
 * Modified from https://stackoverflow.com/a/73404480 to my needs.
 */
export const useTouchGestures = (
    element: HTMLElement,
    options: TouchOptions = {
        gestures: ['left', 'right', 'up', 'down', 'tap'],
        threshold: 25,
    }
) => {
    let touchStartX = 0
    let touchEndX = 0
    let touchStartY = 0
    let touchEndY = 0
    // Add event listeners for recording the starting and ending positions of the touch event.
    // This implementation only chesks for the difference between the starting and ending positions, but a future
    // improvement could track the movement and react to ongoing touch events.
    element.addEventListener(
        'touchstart',
        (event) => {
            touchStartX = event.changedTouches[0].screenX
            touchStartY = event.changedTouches[0].screenY
        },
        false
    )
    element.addEventListener(
        'touchend',
        (event) => {
            touchEndX = event.changedTouches[0].screenX
            touchEndY = event.changedTouches[0].screenY
            handleGesture(event)
        },
        false
    )
    /** Callbacks for swipe left actions. */
    const onSwipeLeft: TouchCallback[] = []
    /** Callbacks for swipe right actions. */
    const onSwipeRight: TouchCallback[] = []
    /** Callbacks for swipe up actions. */
    const onSwipeUp: TouchCallback[] = []
    /** Callbacks for swipe down actions. */
    const onSwipeDown: TouchCallback[] = []
    /** Callbacks for tap actions. */
    const onTap: TouchCallback[] = []

    const addCallback = (cbks: TouchCallback[], callback: TouchCallback) => {
        cbks.push(callback)
    }

    const handleGesture = (event: TouchEvent) => {
        const gs = options.gestures
        const th = options.threshold
        // Left swipe.
        if (gs.includes('left') && touchEndX < touchStartX && (Math.abs(touchStartY - touchEndY)) < th) {
            onSwipeLeft.forEach(callback => callback(event))
        }
        // Right swipe.
        if (gs.includes('right') && touchEndX > touchStartX && (Math.abs(touchStartY - touchEndY)) < th) {
            onSwipeRight.forEach(callback => callback(event))
        }
        // Up swipe.
        if (gs.includes('up') && touchEndY < touchStartY && (Math.abs(touchStartX - touchEndX)) < th) {
            onSwipeUp.forEach(callback => callback(event))
        }
        // Down swipe.
        if (gs.includes('down') && touchEndY > touchStartY && (Math.abs(touchStartX - touchEndX)) < th) {
            onSwipeDown.forEach(callback => callback(event))
        }
        // Tap.
        if (gs.includes('tap') && touchEndY === touchStartY) {
            onTap.forEach(callback => callback(event))
        }
    }
    return {
        /** Add a swipe left callback. */
        onSwipeLeft: (callback: TouchCallback) => addCallback(onSwipeLeft, callback),
        /** Add a swipe right callback. */
        onSwipeRight: (callback: TouchCallback) => addCallback(onSwipeRight, callback),
        /** Add a swipe up callback. */
        onSwipeUp: (callback: TouchCallback) => addCallback(onSwipeUp, callback),
        /** Add a swipe down callback. */
        onSwipeDown: (callback: TouchCallback) => addCallback(onSwipeDown, callback),
        /** Add a tap callback. */
        onTap: (callback: TouchCallback) => addCallback(onTap, callback),
    }
}
