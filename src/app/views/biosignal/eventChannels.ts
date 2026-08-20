/**
 * Resolving an annotation's target channels to positions in the active montage.
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
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type {
    BiosignalMontage,
    BiosignalResource,
    DerivedChannelProperties,
} from '@epicurrents/core/dist/types'

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
