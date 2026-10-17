/**
 * What the finding picker offers, and how it searches: HED-SCORE terms grouped under plain names, narrowed by the
 * host's policy, ranked by the reader's own recent picks.
 *
 * A finding is stored as a short-form HED string under `codes.hed`. The terms come from eeg-module's index, which
 * holds the whole schema; everything here is the picker's choice of what to show from it. A server validates what is
 * saved whatever the picker offers, so the policy narrows the picker to what that server accepts rather than being a
 * control of its own.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import type { HedScoreTerm, HedScoreTermIndex } from '@epicurrents/eeg-module/types'
import type { HedScorePolicy, HedScorePolicyProvider } from './types'

/** A plain-named group of findings, rooted at one branch of the index. */
export type FindingGroup = {
    /** Index branch the group's terms sit under. */
    branch: string
    /** Group name shown to the reader. */
    label: string
}

/** A term the picker offers, with the name it is shown by. */
export type OfferedFinding = {
    /** Index branch the term sits under. */
    branch: string
    /** Readable name: the tag with its hyphens as spaces. */
    label: string
    term: HedScoreTerm
}

/**
 * The groups the picker browses by, in the order they are listed. `Modulator` and `Feature-property` hold the
 * properties of a finding rather than findings, and are offered with the property sets, not here.
 */
export const FINDING_GROUPS: FindingGroup[] = [
    { branch: 'Interictal-activity', label: 'Interictal' },
    { branch: 'Episode', label: 'Seizures and episodes' },
    { branch: 'Background-activity', label: 'Background' },
    { branch: 'Sleep-and-drowsiness', label: 'Sleep' },
    { branch: 'Uncertain-significant-pattern', label: 'Benign variants' },
    { branch: 'Critically-ill-patient-patterns', label: 'Critical-care patterns' },
    { branch: 'Physiologic-pattern', label: 'Physiologic' },
    { branch: 'Polygraphic-channel-feature', label: 'Polygraphic channels' },
    { branch: 'Data-artifact', label: 'Artifacts' },
]

/** The most palette entries the picker shows; the first ten take the number keys. */
export const PALETTE_SIZE = 20

/** How many picks the recent list remembers. */
const RECENT_SIZE = 50

/** Storage key of the recent picks; per browser, a convenience only. */
const RECENT_KEY = 'epicurrents.eeg.recentFindings'

let _policy: { promise: Promise<HedScorePolicy | null>, provider: HedScorePolicyProvider } | null = null
let _recent: string[] | null = null

/**
 * The readable name of a tag: `Epileptiform-interictal-activity` reads as "Epileptiform interictal activity".
 * @param name - Short-form tag.
 */
export function findingLabel (name: string) {
    return name.replace(/-/g, ' ')
}

/**
 * Every term the picker may offer under `policy`, in index order. A term is offered when it stands as a code on its
 * own: not deprecated, not requiring a child or a value, under one of the groups, and in a branch the policy allows.
 * @param index - The loaded term index.
 * @param policy - The host's policy, or `null` when there is no host and the whole schema is offered.
 */
export function offeredFindings (index: HedScoreTermIndex, policy: HedScorePolicy | null): OfferedFinding[] {
    const groups = new Set(FINDING_GROUPS.map(group => group.branch))
    const allowed = policy?.allowedBranches ? new Set(policy.allowedBranches) : null
    const offered = [] as OfferedFinding[]
    for (const term of index.terms) {
        const branch = index.branchOf(term.name)
        if (!branch || !groups.has(branch) || term.deprecated || term.requireChild) {
            continue
        }
        if (allowed && !allowed.has(index.schemaBranchOf(term.name) ?? '')) {
            continue
        }
        offered.push({ branch, label: findingLabel(term.name), term })
    }
    return offered
}

/**
 * The palette entries that are offered, in the configured order and at most {@link PALETTE_SIZE}. A configured name
 * the policy does not offer is left out, so a palette written for a wider policy degrades rather than breaking.
 * @param offered - The offered terms.
 * @param palette - Configured term names.
 */
export function paletteFindings (offered: OfferedFinding[], palette: string[]) {
    const byName = new Map(offered.map(finding => [finding.term.name, finding]))
    return palette.map(name => byName.get(name)).filter(finding => !!finding).slice(0, PALETTE_SIZE)
}

/**
 * The host's policy, asked of `provider` once and shared by every later call with the same provider. `null` without a
 * provider. A rejected lookup is not kept, so the next call asks again.
 * @param provider - The host's policy source, or `null` when there is no host.
 */
export function findingPolicy (provider: HedScorePolicyProvider | null): Promise<HedScorePolicy | null> {
    if (!provider) {
        return Promise.resolve(null)
    }
    if (_policy?.provider !== provider) {
        const promise = provider()
        _policy = { promise, provider }
        promise.catch(() => {
            if (_policy?.promise === promise) {
                _policy = null
            }
        })
    }
    return _policy.promise
}

/**
 * The reader's recent picks, newest first. Read from browser storage once; an unreadable store reads as empty.
 */
export function recentFindings (): string[] {
    if (_recent === null) {
        _recent = []
        try {
            const stored = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]')
            if (Array.isArray(stored)) {
                _recent = stored.filter(name => typeof name === 'string').slice(0, RECENT_SIZE)
            }
        } catch {
            // Storage blocked or the value unreadable: start with no history.
        }
    }
    return _recent
}

/**
 * Record a pick, moving it to the front of the recent list.
 * @param name - Short-form tag picked.
 */
export function rememberFinding (name: string) {
    const recent = [name, ...recentFindings().filter(other => other !== name)].slice(0, RECENT_SIZE)
    _recent = recent
    try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
    } catch {
        // The list still holds for this page.
    }
}

/**
 * Forget the in-memory copy of the recent picks, so the next read goes to storage again. For tests.
 */
export function resetRecentFindings () {
    _recent = null
}

/**
 * The offered terms matching `query`, best first. Every word of the query must start a word of the tag, case ignored;
 * a recent pick ranks first, the newest first, then a tag whose first word the query's first word starts, then the
 * shorter tag. An empty query matches nothing.
 * @param offered - The offered terms.
 * @param query - What the reader typed.
 * @param recent - Recent picks, newest first.
 * @param limit - Most matches returned.
 */
export function searchFindings (offered: OfferedFinding[], query: string, recent: string[] = [], limit = 8) {
    const words = query.toLowerCase().split(/[\s-]+/).filter(word => word.length)
    if (!words.length) {
        return []
    }
    const rank = new Map(recent.map((name, idx) => [name, idx]))
    const scored = [] as { finding: OfferedFinding, score: number }[]
    for (const finding of offered) {
        const nameWords = finding.term.name.toLowerCase().split('-')
        if (!words.every(word => nameWords.some(nameWord => nameWord.startsWith(word)))) {
            continue
        }
        const recentRank = rank.get(finding.term.name)
        const score = (recentRank !== undefined ? 1000 - recentRank : 0)
                      + (nameWords[0].startsWith(words[0]) ? 100 : 0)
                      - nameWords.length
        scored.push({ finding, score })
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(entry => entry.finding)
}

/**
 * Why the picker cannot offer findings under `policy` with `index`, or `null` when it can: `'version'` when the host
 * validates against another release, `'digest'` when its copy of the same release differs from the index's. The
 * picker disables itself in either case, since what it would write might be refused.
 * @param index - The loaded term index.
 * @param policy - The host's policy, or `null` with no host.
 */
export function policyMismatch (index: HedScoreTermIndex, policy: HedScorePolicy | null) {
    if (!policy) {
        return null
    }
    if (policy.schema.library !== index.schema.library || policy.schema.version !== index.schema.version) {
        return 'version'
    }
    if (policy.schema.sha256 && policy.schema.sha256 !== index.schema.sha256) {
        return 'digest'
    }
    return null
}
