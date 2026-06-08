import { describe, expect, it } from 'bun:test'
import { SSEManager } from './sseManager'
import type { SyncEvent } from '../sync/syncEngine'
import { VisibilityTracker } from '../visibility/visibilityTracker'

describe('SSEManager namespace filtering', () => {
    it('routes events to matching namespace', () => {
        const manager = new SSEManager(0, new VisibilityTracker())
        const receivedAlpha: SyncEvent[] = []
        const receivedBeta: SyncEvent[] = []

        manager.subscribe({
            id: 'alpha',
            namespace: 'alpha',
            all: true,
            send: (event) => {
                receivedAlpha.push(event)
            },
            sendHeartbeat: () => {}
        })

        manager.subscribe({
            id: 'beta',
            namespace: 'beta',
            all: true,
            send: (event) => {
                receivedBeta.push(event)
            },
            sendHeartbeat: () => {}
        })

        manager.broadcast({ type: 'session-updated', sessionId: 's1', namespace: 'alpha' })

        expect(receivedAlpha).toHaveLength(1)
        expect(receivedBeta).toHaveLength(0)
    })

    it('broadcasts connection-changed to all namespaces', () => {
        const manager = new SSEManager(0, new VisibilityTracker())
        const received: Array<{ id: string; event: SyncEvent }> = []

        manager.subscribe({
            id: 'alpha',
            namespace: 'alpha',
            all: true,
            send: (event) => {
                received.push({ id: 'alpha', event })
            },
            sendHeartbeat: () => {}
        })

        manager.subscribe({
            id: 'beta',
            namespace: 'beta',
            all: true,
            send: (event) => {
                received.push({ id: 'beta', event })
            },
            sendHeartbeat: () => {}
        })

        manager.broadcast({ type: 'connection-changed', data: { status: 'connected' } })

        expect(received).toHaveLength(2)
        expect(received.map((entry) => entry.id).sort()).toEqual(['alpha', 'beta'])
    })

    it('sends toast only to visible connections in a namespace', async () => {
        const manager = new SSEManager(0, new VisibilityTracker())
        const received: Array<{ id: string; event: SyncEvent }> = []

        manager.subscribe({
            id: 'visible',
            namespace: 'alpha',
            all: true,
            visibility: 'visible',
            send: (event) => {
                received.push({ id: 'visible', event })
            },
            sendHeartbeat: () => {}
        })

        manager.subscribe({
            id: 'hidden',
            namespace: 'alpha',
            all: true,
            visibility: 'hidden',
            send: (event) => {
                received.push({ id: 'hidden', event })
            },
            sendHeartbeat: () => {}
        })

        manager.subscribe({
            id: 'other',
            namespace: 'beta',
            all: true,
            visibility: 'visible',
            send: (event) => {
                received.push({ id: 'other', event })
            },
            sendHeartbeat: () => {}
        })

        const toastEvent: Extract<SyncEvent, { type: 'toast' }> = {
            type: 'toast',
            data: {
                title: 'Test',
                body: 'Toast body',
                sessionId: 'session-1',
                url: '/sessions/session-1'
            }
        }

        const delivered = await manager.sendToast('alpha', toastEvent)

        expect(delivered).toBe(1)
        expect(received).toHaveLength(1)
        expect(received[0]?.id).toBe('visible')
    })

    it('routes clone progress only to matching session or all subscribers in the same namespace', () => {
        const manager = new SSEManager(0, new VisibilityTracker())
        const received: Record<string, SyncEvent[]> = {
            session: [],
            machine: [],
            all: [],
            otherNamespace: [],
            otherScope: []
        }

        manager.subscribe({
            id: 'session',
            namespace: 'alpha',
            sessionId: 'session-1',
            send: (event) => {
                received.session.push(event)
            },
            sendHeartbeat: () => {}
        })
        manager.subscribe({
            id: 'machine',
            namespace: 'alpha',
            machineId: 'machine-1',
            send: (event) => {
                received.machine.push(event)
            },
            sendHeartbeat: () => {}
        })
        manager.subscribe({
            id: 'all',
            namespace: 'alpha',
            all: true,
            send: (event) => {
                received.all.push(event)
            },
            sendHeartbeat: () => {}
        })
        manager.subscribe({
            id: 'other-namespace',
            namespace: 'beta',
            all: true,
            send: (event) => {
                received.otherNamespace.push(event)
            },
            sendHeartbeat: () => {}
        })
        manager.subscribe({
            id: 'other-scope',
            namespace: 'alpha',
            sessionId: 'session-2',
            machineId: 'machine-2',
            send: (event) => {
                received.otherScope.push(event)
            },
            sendHeartbeat: () => {}
        })

        const cloneEvent: SyncEvent = {
            type: 'clone-progress',
            namespace: 'alpha',
            sessionId: 'session-1',
            data: {
                cloneId: '11111111-1111-4111-8111-111111111111',
                sessionId: 'session-1',
                phase: 'writing',
                progress: 50
            }
        }

        manager.broadcast(cloneEvent)

        expect(received.session).toHaveLength(1)
        expect(received.machine).toHaveLength(0)
        expect(received.all).toHaveLength(1)
        expect(received.otherNamespace).toHaveLength(0)
        expect(received.otherScope).toHaveLength(0)
    })

    it('routes machine clone progress using data-level scope fallback', () => {
        const manager = new SSEManager(0, new VisibilityTracker())
        const receivedSession: SyncEvent[] = []
        const receivedMachine: SyncEvent[] = []

        manager.subscribe({
            id: 'session-fallback',
            namespace: 'alpha',
            sessionId: 'session-1',
            send: (event) => {
                receivedSession.push(event)
            },
            sendHeartbeat: () => {}
        })
        manager.subscribe({
            id: 'machine-fallback',
            namespace: 'alpha',
            machineId: 'machine-1',
            send: (event) => {
                receivedMachine.push(event)
            },
            sendHeartbeat: () => {}
        })

        manager.broadcast({
            type: 'clone-progress',
            namespace: 'alpha',
            data: {
                cloneId: '11111111-1111-4111-8111-111111111111',
                machineId: 'machine-1',
                phase: 'done',
                progress: 100
            }
        })

        expect(receivedSession).toHaveLength(0)
        expect(receivedMachine).toHaveLength(1)
    })

    it('uses clone progress data scope over inconsistent top-level scope fields', () => {
        const manager = new SSEManager(0, new VisibilityTracker())
        const receivedSession: SyncEvent[] = []
        const receivedMachine: SyncEvent[] = []

        manager.subscribe({
            id: 'session-canonical',
            namespace: 'alpha',
            sessionId: 'session-1',
            send: (event) => {
                receivedSession.push(event)
            },
            sendHeartbeat: () => {}
        })
        manager.subscribe({
            id: 'machine-stray',
            namespace: 'alpha',
            machineId: 'machine-1',
            send: (event) => {
                receivedMachine.push(event)
            },
            sendHeartbeat: () => {}
        })

        manager.broadcast({
            type: 'clone-progress',
            namespace: 'alpha',
            machineId: 'machine-1',
            data: {
                cloneId: '11111111-1111-4111-8111-111111111111',
                sessionId: 'session-1',
                phase: 'writing',
                progress: 50
            }
        })

        expect(receivedSession).toHaveLength(1)
        expect(receivedMachine).toHaveLength(0)
    })
})
