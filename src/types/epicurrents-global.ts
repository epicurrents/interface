/**
 * Standalone (non-ambient) export of the `EpicurrentsGlobal` shape so host pages
 * embedding the viewer can `import type` it without inheriting the ambient
 * `declare global { Window.__EPICURRENTS__ }` declaration that lives alongside
 * it in {@link ./globals.d.ts}. Mixing the ambient block into a host project
 * causes TypeScript declaration merging to intersect both Window declarations
 * with potentially incompatible types — most concretely the strict `SETUP:
 * ApplicationInterfaceConfig` here clashing with a looser `Record<string,
 * unknown>` on the host side.
 *
 * The ambient `globals.d.ts` file re-exports this same type so the viewer's
 * own code keeps a single source of truth.
 *
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { StateManager } from '@epicurrents/core/types'
import type { ScopedEventBus } from 'scoped-event-bus/types'
import type { ApplicationInterfaceConfig } from './globals'

export type EpicurrentsGlobal = {
    /**
     * Optional host-provided callback for user-facing announcements (toasts,
     * banners, etc.). The viewer ships as a UMD bundle with its own embedded
     * `scoped-event-log` singleton, so a host page's `Log.addEventListener`
     * fires on a different registry and never sees viewer events. The viewer
     * forwards `Log.announce` events to this callback instead; the host
     * decides how to render. Unset = standalone mode, no host-side rendering.
     */
    announce?: (message: string, level: 'ERROR' | 'WARN') => void
    /**
     * Master event bus for broadcasting application events.
     */
    EVENT_BUS: ScopedEventBus | null
    /**
     * Runtime state manager of the initiated application (null before initiation).
     * @remarks
     * This property is required by the core application.
     */
    RUNTIME: StateManager | null
    /**
     * Initial application setup. This constant can be defined in the file or script that
     * loads the main epicurrents interface script to control what features are available
     * at application startup.
     */
    SETUP: ApplicationInterfaceConfig
}
