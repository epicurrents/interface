/**
 * Toast notification stack for the standalone viewer. A copy of the platform's toast system, used as the fallback
 * surface when the viewer runs without a host (the host otherwise renders announcements via the `announce` callback).
 * @package    epicurrents/interface
 * @copyright  2025 Sampsa Lohi
 * @license    Apache-2.0
 */

import { reactive } from 'vue'

export type ToastVariant = 'brand' | 'success' | 'neutral' | 'warning' | 'danger'

export type Toast = {
    id: number
    /** Optional bold topic line shown above the message. */
    topic?: string
    message: string
    variant: ToastVariant
    duration: number
}

export const toasts = reactive<Toast[]>([])

const _timers = new Map<number, { handle: number; remainingMs: number; startedAt: number }>()
let _nextId = 0

const MIN_DURATION_MS = 6000
const MAX_DURATION_MS = 10000
const MS_PER_CHAR = 75

function computeDuration(message: string): number {
    return Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, message.length * MS_PER_CHAR))
}

function _startTimer(id: number, ms: number): void {
    const handle = window.setTimeout(() => dismissToast(id), ms)
    _timers.set(id, { handle, remainingMs: ms, startedAt: performance.now() })
}

/**
 * Display a toast notification.
 *
 * Pushes onto a reactive stack rendered by `ToastStack.vue` (mounted in
 * App.vue). The toast is auto-dismissed after a duration derived from the
 * message length (clamped to 6–10 seconds). Hovering pauses the timer; the
 * remaining time resumes on mouse-leave. Pass `duration` explicitly to
 * override; `duration: 0` keeps the toast until the user clicks it.
 *
 * @param message  - Plain-text message. Pass an array to use the first line as a bold topic and the rest, joined,
 *                   as the message body.
 * @param variant  - Toast colour variant (default: 'neutral').
 * @param duration - Override auto-derived duration; 0 = never dismiss.
 */
export function showToast(
    message: string | string[],
    variant: ToastVariant = 'neutral',
    duration?: number,
): void {
    const lines = (Array.isArray(message) ? message : [message]).filter(line => line.length)
    const topic = lines.length > 1 ? lines[0] : undefined
    const body = lines.length > 1 ? lines.slice(1).join(' ') : (lines[0] ?? '')
    const id = _nextId++
    const actualDuration = duration ?? computeDuration(topic ? `${topic} ${body}` : body)
    toasts.push({ id, topic, message: body, variant, duration: actualDuration })
    if (actualDuration > 0) {
        _startTimer(id, actualDuration)
    }
}

export function dismissToast(id: number): void {
    const state = _timers.get(id)
    if (state) {
        clearTimeout(state.handle)
        _timers.delete(id)
    }
    const idx = toasts.findIndex(t => t.id === id)
    if (idx >= 0) {
        toasts.splice(idx, 1)
    }
}

export function pauseToast(id: number): void {
    const state = _timers.get(id)
    if (!state || state.handle === 0) {
        return
    }
    clearTimeout(state.handle)
    const elapsed = performance.now() - state.startedAt
    const remaining = Math.max(0, state.remainingMs - elapsed)
    _timers.set(id, { handle: 0, remainingMs: remaining, startedAt: 0 })
}

export function resumeToast(id: number): void {
    const state = _timers.get(id)
    if (!state || state.handle !== 0) {
        return
    }
    if (state.remainingMs <= 0) {
        dismissToast(id)
        return
    }
    _startTimer(id, state.remainingMs)
}
