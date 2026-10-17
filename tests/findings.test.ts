/**
 * The finding picker's logic: what it offers under a policy, how it searches and ranks, the palette, the policy
 * lookup and mismatch, and the editor saving a picked code onto the event.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { loadHedScoreIndex } from '@epicurrents/eeg-module'
import type { HedScoreTermIndex } from '@epicurrents/eeg-module/types'
import type { BiosignalAnnotationEvent, BiosignalResource } from '@epicurrents/core/types'
import {
    FINDING_GROUPS,
    PALETTE_SIZE,
    findingLabel,
    findingPolicy,
    offeredFindings,
    paletteFindings,
    policyMismatch,
    recentFindings,
    rememberFinding,
    resetRecentFindings,
    searchFindings,
} from '#app/modules/eeg/findings'
import type { HedScorePolicy } from '#app/modules/eeg/types'
import { useBiosignalAnnotationEditor } from '#app/views/biosignal/useBiosignalAnnotationEditor'

let index: HedScoreTermIndex

beforeAll(async () => {
    index = await loadHedScoreIndex()
})

afterEach(() => {
    window.localStorage.clear()
    resetRecentFindings()
    vi.restoreAllMocks()
})

const policyFor = (overrides: Partial<HedScorePolicy> = {}): HedScorePolicy => ({
    allowedBranches: null,
    schema: { ...index.schema },
    ...overrides,
})

const names = (findings: { term: { name: string } }[]) => findings.map(finding => finding.term.name)

describe('offered findings', () => {
    it('offers only terms that stand as a code, under a group', () => {
        const offered = offeredFindings(index, null)
        const groups = new Set(FINDING_GROUPS.map(group => group.branch))
        expect(offered.length).toBeGreaterThan(100)
        for (const finding of offered) {
            expect(groups.has(finding.branch)).toBe(true)
            expect(finding.term.deprecated).toBeFalsy()
            expect(finding.term.requireChild).toBeFalsy()
        }
        expect(names(offered)).toContain('Epileptiform-interictal-activity')
        expect(names(offered)).toContain('Eye-blink-artifact')
        expect(names(offered)).not.toContain('Sensor-list')
        expect(names(offered)).not.toContain('Hyperventilation')
    })

    it('every group has terms to browse', () => {
        const offered = offeredFindings(index, null)
        for (const group of FINDING_GROUPS) {
            expect(offered.some(finding => finding.branch === group.branch), group.branch).toBe(true)
        }
    })

    it('narrows to the branches the policy allows, by the schema branch', () => {
        const scoreOnly = offeredFindings(index, policyFor({ allowedBranches: ['Episode', 'Interictal-activity'] }))
        expect(new Set(scoreOnly.map(finding => finding.branch))).toEqual(new Set(['Episode', 'Interictal-activity']))
        const artifactsOnly = offeredFindings(index, policyFor({ allowedBranches: ['Property'] }))
        expect(new Set(artifactsOnly.map(finding => finding.branch))).toEqual(new Set(['Data-artifact']))
    })

    it('reads a tag as a name', () => {
        expect(findingLabel('Epileptiform-interictal-activity')).toBe('Epileptiform interictal activity')
    })
})

describe('search', () => {
    it('matches every word against the starts of the words of the tag', () => {
        const offered = offeredFindings(index, null)
        expect(names(searchFindings(offered, 'eye blink'))[0]).toBe('Eye-blink-artifact')
        expect(names(searchFindings(offered, 'EPILEPTIFORM INTER'))).toContain('Epileptiform-interictal-activity')
        expect(searchFindings(offered, 'blinkx')).toEqual([])
        expect(searchFindings(offered, '   ')).toEqual([])
    })

    it('ranks a recent pick first, and keeps to the limit', () => {
        const offered = offeredFindings(index, null)
        const plain = names(searchFindings(offered, 'artifact', [], 50))
        const last = plain[plain.length - 1]
        expect(names(searchFindings(offered, 'artifact', [last], 50))[0]).toBe(last)
        expect(searchFindings(offered, 'artifact', [], 3)).toHaveLength(3)
    })

    it('remembers picks newest first, across a reload of the list', () => {
        rememberFinding('Eye-blink-artifact')
        rememberFinding('Epileptiform-interictal-activity')
        rememberFinding('Eye-blink-artifact')
        resetRecentFindings()
        expect(recentFindings()).toEqual(['Eye-blink-artifact', 'Epileptiform-interictal-activity'])
    })

    it('works without browser storage', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked')
        })
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('blocked')
        })
        expect(recentFindings()).toEqual([])
        rememberFinding('Eye-blink-artifact')
        expect(recentFindings()).toEqual(['Eye-blink-artifact'])
    })
})

describe('palette', () => {
    it('keeps the configured order, drops what is not offered, and caps the size', () => {
        const offered = offeredFindings(index, policyFor({ allowedBranches: ['Episode', 'Property'] }))
        const palette = paletteFindings(offered, ['Eye-blink-artifact', 'Epileptiform-interictal-activity', 'Nope'])
        expect(names(palette)).toEqual(['Eye-blink-artifact'])
        const many = paletteFindings(offered, names(offered))
        expect(many).toHaveLength(PALETTE_SIZE)
    })
})

describe('policy', () => {
    it('accepts the release the index was generated from', () => {
        expect(policyMismatch(index, null)).toBeNull()
        expect(policyMismatch(index, policyFor())).toBeNull()
        const { sha256: _sha256, ...withoutDigest } = index.schema
        expect(policyMismatch(index, policyFor({ schema: withoutDigest }))).toBeNull()
    })

    it('refuses another release, or another copy of the same one', () => {
        expect(policyMismatch(index, policyFor({ schema: { ...index.schema, version: '9.9.9' } }))).toBe('version')
        expect(policyMismatch(index, policyFor({ schema: { ...index.schema, library: 'other' } }))).toBe('version')
        expect(policyMismatch(index, policyFor({ schema: { ...index.schema, sha256: '0'.repeat(64) } })))
            .toBe('digest')
    })

    it('asks the provider once, and again after a failed lookup', async () => {
        expect(await findingPolicy(null)).toBeNull()
        const policy = policyFor()
        const provider = vi.fn(async () => policy)
        expect(await findingPolicy(provider)).toBe(policy)
        expect(await findingPolicy(provider)).toBe(policy)
        expect(provider).toHaveBeenCalledTimes(1)
        const failing = vi.fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce(policy)
        await expect(findingPolicy(failing)).rejects.toThrow('offline')
        expect(await findingPolicy(failing)).toBe(policy)
        expect(failing).toHaveBeenCalledTimes(2)
    })
})

describe('saving a picked code', () => {
    const editorFor = (...editing: object[]) => {
        const dispatchPropertyChangeEvent = vi.fn()
        const resource = { dispatchPropertyChangeEvent } as unknown as BiosignalResource
        const events = ref(editing as unknown as BiosignalAnnotationEvent[])
        const editor = useBiosignalAnnotationEditor(resource, events, ref('edit'))
        return { dispatchPropertyChangeEvent, editor }
    }

    it('sets the codes of an event created with an empty array', () => {
        const event = { class: 'event', codes: [] as unknown as Record<string, string>, label: 'x' }
        const { dispatchPropertyChangeEvent, editor } = editorFor(event)
        editor.saveEventEdits({ class: 'event', codes: { hed: 'Eye-blink-artifact' }, label: 'x' })
        expect(event.codes).toEqual({ hed: 'Eye-blink-artifact' })
        expect(dispatchPropertyChangeEvent).toHaveBeenCalledTimes(1)
    })

    it('removes a code and reports nothing when nothing changed', () => {
        const event = { class: 'event', codes: { hed: 'Eye-blink-artifact', other: 1 }, label: 'x' }
        const unchanged = editorFor(event)
        unchanged.editor.saveEventEdits({ class: 'event', codes: { hed: 'Eye-blink-artifact', other: 1 }, label: 'x' })
        expect(unchanged.dispatchPropertyChangeEvent).not.toHaveBeenCalled()
        const removed = editorFor(event)
        removed.editor.saveEventEdits({ class: 'event', codes: { other: 1 }, label: 'x' })
        expect(event.codes).toEqual({ other: 1 })
        expect(removed.dispatchPropertyChangeEvent).toHaveBeenCalledTimes(1)
    })

    it('applies only the changed standard to every event being edited', () => {
        const first = { class: 'event', codes: { other: 1 }, label: 'x' }
        const second = { class: 'event', codes: { another: 2 }, label: 'x' }
        const { editor } = editorFor(first, second)
        editor.saveEventEdits({ class: 'event', codes: { hed: 'Eye-blink-artifact', other: 1 }, label: 'x' })
        expect(first.codes).toEqual({ hed: 'Eye-blink-artifact', other: 1 })
        expect(second.codes).toEqual({ another: 2, hed: 'Eye-blink-artifact' })
    })
})
