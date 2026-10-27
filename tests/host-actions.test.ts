/**
 * The host actions a context menu offers, and running the one chosen.
 * @package    epicurrents/interface
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest'
import { Log } from 'scoped-event-log'
import { HOST_ACTION, hostActionItems, runHostAction } from '#app/views/biosignal/hostActions'
import type { ContextMenuAction, ContextMenuActionContext, DataResource } from '@epicurrents/core/types'

const context = (overrides: Partial<ContextMenuActionContext> = {}): ContextMenuActionContext => ({
    annotation: null,
    channel: null,
    resource: {} as DataResource,
    target: 'plot',
    timestamp: 12,
    ...overrides,
})

const action = (overrides: Partial<ContextMenuAction> = {}): ContextMenuAction => ({
    label: 'Action',
    targets: ['plot'],
    run: vi.fn(),
    ...overrides,
})

describe('host action items', () => {
    it('offers the actions of the menu target in registration order', () => {
        const actions = new Map([
            ['b', action({ icon: 'chat', label: 'B' })],
            ['event', action({ label: 'Event', targets: ['annotation'] })],
            ['a', action({ label: 'A', targets: ['annotation', 'plot'] })],
        ])
        expect(hostActionItems(actions, context())).toEqual([
            { action: `${HOST_ACTION}b`, icon: 'chat', label: 'B', type: 'item' },
            { action: `${HOST_ACTION}a`, icon: undefined, label: 'A', type: 'item' },
        ])
    })

    it('leaves out an action that is not available in the context, and asks with the context', () => {
        const isAvailable = vi.fn((ctx: ContextMenuActionContext) => ctx.channel === 'Fp1')
        const actions = new Map([['a', action({ isAvailable })]])
        expect(hostActionItems(actions, context())).toEqual([])
        expect(hostActionItems(actions, context({ channel: 'Fp1' }))).toHaveLength(1)
        expect(isAvailable).toHaveBeenLastCalledWith(expect.objectContaining({ channel: 'Fp1', timestamp: 12 }))
    })

    it('leaves out an action whose availability check throws, and offers the rest', () => {
        const error = vi.spyOn(Log, 'error').mockImplementation(() => {})
        const actions = new Map([
            ['broken', action({ isAvailable: () => { throw new Error('no') } })],
            ['fine', action()],
        ])
        expect(hostActionItems(actions, context()).map(item => item.action)).toEqual([`${HOST_ACTION}fine`])
        expect(error).toHaveBeenCalledTimes(1)
        error.mockRestore()
    })
})

describe('running a host action', () => {
    it('runs the named action with the context', () => {
        const run = vi.fn()
        const ctx = context({ target: 'annotation' })
        runHostAction(new Map([['a', action({ run })]]), 'a', ctx)
        expect(run).toHaveBeenCalledWith(ctx)
    })

    it('does nothing for an action no longer registered', () => {
        expect(() => runHostAction(new Map(), 'gone', context())).not.toThrow()
    })

    it('logs an action that throws', () => {
        const error = vi.spyOn(Log, 'error').mockImplementation(() => {})
        runHostAction(new Map([['a', action({ run: () => { throw new Error('no') } })]]), 'a', context())
        expect(error).toHaveBeenCalledTimes(1)
        error.mockRestore()
    })
})
