/**
 * The interface's additions to the core-owned `window.__EPICURRENTS__` global, plus a standalone
 * (non-ambient) export of the full `EpicurrentsGlobal` shape so host pages embedding the viewer can
 * `import type` it without inheriting the ambient `declare global { Window.__EPICURRENTS__ }` block in
 * {@link ./globals.ambient.d.ts}. The core handles (`APP` / `EVENT_BUS` / `RUNTIME`) and `SETUP` are owned by
 * `@epicurrents/core`; this module declares only the interface-specific additions ({@link InterfaceGlobalAdditions}),
 * which {@link ./core-global-augment} merges into core's `EpicurrentsGlobal` so a single `Window.__EPICURRENTS__`
 * carries both.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { EpicurrentsGlobal as CoreEpicurrentsGlobal } from '@epicurrents/core/types'
import type { ApplicationInterfaceConfig } from './globals'

/**
 * Interface-specific additions to the core `EpicurrentsGlobal`. Merged into core's interface by the
 * augmentation in {@link ./core-global-augment} and intersected into the host-facing {@link EpicurrentsGlobal}
 * type below. The augmentation cannot import this type (see its header), so keep the `announce` signature there
 * in sync with the one here.
 */
export interface InterfaceGlobalAdditions {
    /**
     * Optional host-provided callback for user-facing announcements (toasts, banners, etc.). The viewer ships
     * as a UMD bundle with its own embedded `scoped-event-log` singleton, so a host page's `Log.addEventListener`
     * fires on a different registry and never sees viewer events. The viewer forwards its callouts to this
     * callback instead; the host decides how to render. Unset = standalone mode, where the viewer renders its
     * own toast stack. The `variant` is the toast colour variant so the host can render success / neutral /
     * warning / danger callouts, not only errors. An array `message` uses its first line as a bold topic and the
     * rest as the body.
     */
    announce?: (
        message: string | string[],
        variant: 'brand' | 'success' | 'neutral' | 'warning' | 'danger',
    ) => void
}

/**
 * Full `window.__EPICURRENTS__` shape: the core handles plus the interface additions, with `SETUP` narrowed to
 * the interface's richer {@link ApplicationInterfaceConfig}. For host pages to `import type` without pulling in
 * the ambient block.
 */
export type EpicurrentsGlobal =
    Omit<CoreEpicurrentsGlobal, 'SETUP'> &
    InterfaceGlobalAdditions & {
        /** Static application setup, defined before launch. */
        SETUP: Readonly<ApplicationInterfaceConfig>
    }
