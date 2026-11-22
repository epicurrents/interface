/**
 * Key for the view components that keep the resource they were mounted with.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { DataResource, MediaDataset } from "@epicurrents/core/types"

/**
 * The key of a view's controls and footer: the active modality, and the id of each shown resource that is a child of
 * a dataset member rather than a member itself.
 *
 * Controls and footers keep the resource they were mounted with and move to another on core's `set-active-resource`
 * event. That event fires when a dataset member is activated, but not when a child is opened, changed or closed under
 * a member that is already active, so the key changes with the shown child and the components are mounted again for
 * it. A change from one member to another leaves the key alone, since the event covers it.
 * @param modality - The active modality.
 * @param dataset - The active dataset.
 * @param shown - The resources the view shows.
 */
export const shownResourceKey = (modality: string, dataset: MediaDataset | null, shown: readonly DataResource[]) => {
    const members = dataset?.resources || []
    const children = shown.filter(resource => !members.some(ctx => ctx.resource.id === resource.id))
    return [modality, ...children.map(child => child.id)].join('-')
}
