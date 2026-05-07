/**
 * Composable for keyboard hotkey handling shared across all biosignal viewers.
 *
 * Owns the hotkeyEvents reactive map and modKey ref, and registers the
 * window keydown and blur listeners via onMounted / onBeforeUnmount so the
 * viewer's mounted() only needs to manage its own keyup listener.
 *
 * The hotkey detection loop (setting flags in hotkeyEvents) is identical in
 * all viewers and lives here. The keyup dispatch logic (acting on those flags)
 * is fully modality-specific and stays in each viewer's handleKeyup method.
 *
 * Escape key: the composable calls cancelHotkeyEvents() then invokes the
 * viewer-supplied onEscape callback, which handles cursor-tool clearing,
 * overlay/sidebar teardown, and drag-state cleanup using setup()-scope refs.
 */

import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'

type HotkeyDef = { key: string; code: string; control?: boolean; shift?: boolean } | null | undefined

type KeyboardSettings = {
    hotkeys: Record<string, HotkeyDef>
}

export function useBiosignalKeyboard (
    /** Names of the flags to track in hotkeyEvents (modality-specific). */
    hotkeyKeys: string[],
    settings: KeyboardSettings,
    /** Getter for keys that should be ignored (e.g. browser shortcuts). */
    reservedKeys: () => string[],
    /** Getter for the hotkeyAltOrOpt setting. */
    hotkeyAltOrOpt: () => boolean,
    /** Called after cancelHotkeyEvents() when Escape is pressed. */
    onEscape: () => void,
) {
    const hotkeyEvents = reactive(Object.fromEntries(hotkeyKeys.map(k => [k, false])))
    const modKey = ref<KeyboardEvent['key'] | null>(null)

    function cancelHotkeyEvents () {
        for (const key of hotkeyKeys) {
            hotkeyEvents[key] = false
        }
    }

    function handleKeydown (event: KeyboardEvent) {
        if ((event.target as HTMLElement)?.tagName.match(/input|textarea/i)) {
            return
        }
        if (event.key === 'Escape') {
            cancelHotkeyEvents()
            onEscape()
            return
        }
        if (reservedKeys().includes(event.key)) {
            return
        }
        if ((hotkeyAltOrOpt() && event.altKey) || !event.altKey) {
            for (const key of hotkeyKeys) {
                const hotkey = settings.hotkeys[key]
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
                    // Also check event.code because alt changes the value in event.key.
                    (!event.altKey || hotkey.code !== event.code)
                ) {
                    continue
                }
                hotkeyEvents[key] = true
                if (event.altKey) {
                    event.preventDefault()
                }
                return
            }
            modKey.value = event.key
        }
    }

    onMounted(() => {
        window.addEventListener('keydown', handleKeydown, false)
        window.addEventListener('blur', cancelHotkeyEvents, false)
    })

    onBeforeUnmount(() => {
        window.removeEventListener('keydown', handleKeydown, false)
        window.removeEventListener('blur', cancelHotkeyEvents, false)
    })

    return {
        cancelHotkeyEvents,
        handleKeydown,
        hotkeyEvents,
        modKey,
    }
}
