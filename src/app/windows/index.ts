/**
 * The detachable window: one per document, shared by every application on the page, shown in Picture-in-Picture
 * where the browser offers it and over the page otherwise.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

export { default as DetachedWindow } from './DetachedWindow.vue'
export {
    getWindowHost,
    WINDOW_HOST_VERSION,
    type WindowHandle,
    type WindowHost,
    type WindowMode,
    type WindowRequest,
} from './windowHost'
