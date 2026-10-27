/**
 * The actions a host registers on the application for the plot's context menus: which of them a menu offers, and
 * running the one chosen. A host action that throws is logged and leaves the menu working.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { Log } from 'scoped-event-log'
import type { ContextMenuAction, ContextMenuActionContext } from '@epicurrents/core/types'

const SCOPE = 'hostActions'

/** Prefix of a menu item's action when the item runs a host action; the rest is the name it was registered under. */
export const HOST_ACTION = 'host:'

/** A menu item for a host action. */
export type HostActionItem = {
    action: string
    icon?: string
    label: string
    type: 'item'
}

/**
 * Menu items for the host actions offered in the given context, in registration order.
 * @param actions - The registered actions by name.
 * @param context - What the menu was opened on.
 */
export function hostActionItems (actions: Map<string, ContextMenuAction>, context: ContextMenuActionContext) {
    const items = [] as HostActionItem[]
    for (const [name, action] of actions) {
        if (!action.targets.includes(context.target)) {
            continue
        }
        try {
            if (action.isAvailable && !action.isAvailable(context)) {
                continue
            }
        } catch (error) {
            Log.error(`Context menu action '${name}' could not tell if it is available.`, SCOPE, error as Error)
            continue
        }
        items.push({ action: `${HOST_ACTION}${name}`, icon: action.icon, label: action.label, type: 'item' })
    }
    return items
}

/**
 * Run the host action registered under `name`, if there still is one.
 * @param actions - The registered actions by name.
 * @param name - Name the action was registered under.
 * @param context - What the menu was opened on.
 */
export function runHostAction (
    actions: Map<string, ContextMenuAction>,
    name: string,
    context: ContextMenuActionContext,
) {
    const action = actions.get(name)
    if (!action) {
        return
    }
    try {
        action.run(context)
    } catch (error) {
        Log.error(`Context menu action '${name}' failed.`, SCOPE, error as Error)
    }
}
