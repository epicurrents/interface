/**
 * Naming an annotation's target channels, and resolving them back to positions in the active
 * montage.
 *
 * An event names its channels as they exist in the *record* montage — by index or by name — but it
 * has to be drawn against the *active* montage, whose channels are derivations of those. The two
 * are related through each active channel's `active` property, which holds the record-channel
 * index or indices it derives from.
 *
 * Matching is by intersection, not by equality of the whole set. A name that matches several record
 * channels, and a derived channel that draws on several sources, both have to resolve — an equality
 * check fails exactly when there is more than one of either, which is the case where an event is
 * most worth showing.
 *
 * Both halves of that convention live here on purpose. `eventChannelNames` names the channels an
 * event is created on and `resolveEventChannelIndices` finds them again when it is drawn, so the
 * two have to agree about what "the same channel" means. They did not while the naming half sat in
 * the viewer components: an event created on a derivation was stored under the derivation's own
 * name ('Fp1-F7'), which matches no record channel, and so was drawn on none of them.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type {
    BiosignalMontage,
    BiosignalResource,
    DerivedChannelProperties,
} from '@epicurrents/core/types'

/** Sentinel used by the montage layer for "this channel maps to no source signal". */
const NOT_MAPPED = -1

/**
 * Flatten a channel's `active` property into the record-channel indices it draws on.
 *
 * A derived channel lists its sources as either a bare index or an `[index, …]` tuple, so both
 * shapes collapse to the leading number here.
 * @param active - The `active` property of a montage channel.
 */
export function sourceIndices (active: number | DerivedChannelProperties | undefined): number[] {
    if (active === undefined) {
        return []
    }
    if (typeof active === 'number') {
        return active === NOT_MAPPED ? [] : [active]
    }
    const indices = [] as number[]
    for (const entry of active) {
        const index = Array.isArray(entry) ? entry[0] : entry
        if (typeof index === 'number' && index !== NOT_MAPPED) {
            indices.push(index)
        }
    }
    return indices
}

/**
 * Get the record-montage channel names an event created on `channel` should target.
 *
 * A derivation's own name resolves to nothing in the record montage, so what gets stored is the
 * as-recorded name of the channel it is active on. That is what lets the event surface later on
 * every derivation sharing that channel, and — through `resolveEventChannelIndices`'s fallback —
 * on one referenced against it where nothing is active on it.
 *
 * Naming uses the same intersection rule the drawing side does rather than comparing whole `active`
 * properties, so a derivation drawing on several record channels names all of them.
 *
 * Returns the channel's own name where no record channel resolves, which leaves the annotation
 * readable rather than empty, and an empty array for a general event created on no channel.
 * @param recordMontage - The record montage to name the channel against.
 * @param channel - The channel the event was created on, or null for a general event.
 */
export function eventChannelNames (
    recordMontage: BiosignalMontage | null | undefined,
    channel: { active?: number | DerivedChannelProperties, name?: string | null } | null | undefined,
): string[] {
    if (!channel) {
        return []
    }
    const targets = new Set(sourceIndices(channel.active))
    const names = [] as string[]
    if (recordMontage && targets.size) {
        for (const recordChannel of recordMontage.channels) {
            if (!recordChannel?.name) {
                continue
            }
            if (sourceIndices(recordChannel.active).some(source => targets.has(source))) {
                names.push(recordChannel.name)
            }
        }
    }
    if (names.length) {
        return names
    }
    return channel.name ? [channel.name] : []
}

/**
 * Resolve one channel reference from an annotation into record-channel indices.
 *
 * A number is an index into the record montage; a string is matched against channel names,
 * case-insensitively, and may legitimately match more than one.
 * @param montage - The record montage the reference is expressed against.
 * @param reference - A channel index or channel name taken from an annotation's `channels`.
 */
function referenceToSourceIndices (montage: BiosignalMontage, reference: number | string): number[] {
    if (typeof reference === 'number') {
        const channel = montage.channels[reference]
        return channel ? sourceIndices(channel.active) : []
    }
    const name = reference.toLowerCase()
    return montage.channels
        .filter(channel => channel?.name?.toLowerCase() === name)
        .flatMap(channel => sourceIndices(channel.active))
}

/**
 * Find the positions in the active montage at which an annotation on `channels` should be drawn.
 *
 * Returns an empty array when the annotation targets no channel (a general annotation, which the
 * caller draws across the whole plot instead) and when nothing matches.
 * @param resource - The resource being displayed, for its record and active montages.
 * @param channels - The annotation's `channels`, as indices or names in the record montage.
 * @param matchReferences - Also match an active channel whose *reference* is the target signal, used where an annotation on a signal should surface on channels derived against it.
 */
export function resolveEventChannelIndices (
    resource: BiosignalResource,
    channels: (number | string)[] | undefined,
    matchReferences = false,
): number[] {
    const recordMontage = resource.recordMontage
    const activeMontage = resource.activeMontage
    if (!channels?.length || !recordMontage || !activeMontage) {
        return []
    }
    const targets = new Set<number>()
    for (const reference of channels) {
        for (const index of referenceToSourceIndices(recordMontage, reference)) {
            targets.add(index)
        }
    }
    if (!targets.size) {
        return []
    }
    const matched = [] as number[]
    activeMontage.channels.forEach((channel, index) => {
        if (!channel) {
            return
        }
        if (sourceIndices(channel.active).some(source => targets.has(source))) {
            matched.push(index)
        }
    })
    if (matched.length || !matchReferences) {
        return matched
    }
    // Nothing derives *from* the target signal. Fall back to channels derived *against* it, but
    // only those with a single reference: in an average-referenced montage every channel references
    // every signal, and matching there would put the annotation on the whole page.
    activeMontage.channels.forEach((channel, index) => {
        const references = sourceIndices(channel?.reference)
        if (references.length === 1 && targets.has(references[0])) {
            matched.push(index)
        }
    })
    return matched
}

/**
 * Group selections into the events they create: selections on channels that share both their start and their end
 * make one event on all of those channels, and every other selection makes one of its own. A selection on no channel
 * is a general event and is never merged. Groups come in the order of their first selection.
 *
 * The spans are compared exactly. A selection copied onto another channel copies its range, so equal spans are
 * equal numbers; two spans drawn by hand to look alike are two events.
 * @param selections - The plot selections.
 */
export function groupSelectionsBySpan<T extends { channel: unknown | null, range: number[] }> (selections: T[]) {
    const groups = [] as { range: number[], selections: T[] }[]
    const bySpan = new Map<string, { range: number[], selections: T[] }>()
    for (const selection of selections) {
        const key = `${selection.range[0]}|${selection.range[1]}`
        const group = selection.channel ? bySpan.get(key) : undefined
        if (group) {
            group.selections.push(selection)
            continue
        }
        const created = { range: selection.range, selections: [selection] }
        groups.push(created)
        if (selection.channel) {
            bySpan.set(key, created)
        }
    }
    return groups
}
