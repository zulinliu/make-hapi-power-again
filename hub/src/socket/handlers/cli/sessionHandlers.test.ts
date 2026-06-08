import { describe, expect, it } from 'bun:test'
import { Store, type StoredSession } from '../../../store'
import type { SyncEvent } from '../../../sync/syncEngine'
import type { CliSocketWithData } from '../../socketTypes'
import { registerSessionHandlers } from './sessionHandlers'

class FakeSocket {
    readonly id = 'socket-1'
    readonly roomEvents: Array<{ room: string; event: string; data: unknown }> = []
    private readonly handlers = new Map<string, (...args: unknown[]) => void>()

    on(event: string, handler: (...args: unknown[]) => void): this {
        this.handlers.set(event, handler)
        return this
    }

    to(room: string): { emit: (event: string, data: unknown) => void } {
        return {
            emit: (event: string, data: unknown) => {
                this.roomEvents.push({ room, event, data })
            }
        }
    }

    trigger(event: string, ...args: unknown[]): void {
        this.handlers.get(event)?.(...args)
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getGuideMeta(content: unknown): Record<string, unknown> {
    if (!isRecord(content) || !isRecord(content.meta) || !isRecord(content.meta.guide)) {
        throw new Error('expected guide meta')
    }
    return content.meta.guide
}

function redundantGoalStatusContent(message: string): unknown {
    return {
        role: 'agent',
        content: {
            id: `event-${message}`,
            type: 'event',
            data: { type: 'message', message }
        }
    }
}

describe('cli session handlers', () => {
    it('records connected guide capability only after metadata update succeeds', () => {
        const store = new Store(':memory:')
        const session = store.sessions.getOrCreateSession('guide-capability-handshake-session', {}, null, 'default')
        const socket = new FakeSocket()
        const connectedCapabilities: Array<{ sessionId: string; socketId: string; metadata: unknown }> = []
        const answers: unknown[] = []
        const metadata = {
            path: '/tmp/project',
            capabilities: {
                terminal: true,
                guideInterrupt: {
                    supported: true,
                    preservesQueue: true,
                    isolatedDelivery: true,
                    version: 1
                }
            }
        }

        registerSessionHandlers(socket as unknown as CliSocketWithData, {
            store,
            resolveSessionAccess: () => ({ ok: true, value: session as StoredSession }),
            emitAccessError: () => {
                throw new Error('unexpected access error')
            },
            onConnectedSessionCapabilities: (sessionId, socketId, updatedMetadata) => {
                connectedCapabilities.push({ sessionId, socketId, metadata: updatedMetadata })
            }
        })

        socket.trigger('update-metadata', {
            sid: session.id,
            expectedVersion: session.metadataVersion,
            metadata
        }, (answer: unknown) => {
            answers.push(answer)
        })

        expect(answers).toEqual([{
            result: 'success',
            version: session.metadataVersion + 1,
            metadata
        }])
        expect(connectedCapabilities).toEqual([{
            sessionId: session.id,
            socketId: socket.id,
            metadata
        }])
    })

    it('drops redundant goal status events before persistence and broadcast', () => {
        const store = new Store(':memory:')
        const session = store.sessions.getOrCreateSession('goal-status-session', {}, null, 'default')
        const socket = new FakeSocket()
        const webEvents: SyncEvent[] = []

        registerSessionHandlers(socket as unknown as CliSocketWithData, {
            store,
            resolveSessionAccess: () => ({ ok: true, value: session as StoredSession }),
            emitAccessError: () => {
                throw new Error('unexpected access error')
            },
            onWebappEvent: (event) => {
                webEvents.push(event)
            }
        })

        socket.trigger('message', {
            sid: session.id,
            message: redundantGoalStatusContent('Goal active · 8016 tokens')
        })

        expect(store.messages.getMessages(session.id)).toHaveLength(0)
        expect(socket.roomEvents).toHaveLength(0)
        expect(webEvents).toHaveLength(0)
    })

    it('emits guide fallback only for guide messages and does not mark messages invoked', () => {
        const store = new Store(':memory:')
        const session = store.sessions.getOrCreateSession('guide-fallback-session', {}, null, 'default')
        const guide = store.messages.addMessage(
            session.id,
            {
                role: 'user',
                content: { type: 'text', text: 'guide correction' },
                meta: {
                    deliveryMode: 'guide',
                    guide: {
                        requestedAt: 1,
                        status: 'requested'
                    }
                }
            },
            'local-guide'
        )
        const normal = store.messages.addMessage(
            session.id,
            {
                role: 'user',
                content: { type: 'text', text: 'normal queue' },
                meta: {
                    deliveryMode: 'queue'
                }
            },
            'local-normal'
        )
        const socket = new FakeSocket()
        const webEvents: SyncEvent[] = []

        registerSessionHandlers(socket as unknown as CliSocketWithData, {
            store,
            resolveSessionAccess: () => ({ ok: true, value: session as StoredSession }),
            emitAccessError: () => {
                throw new Error('unexpected access error')
            },
            onWebappEvent: (event) => {
                webEvents.push(event)
            }
        })

        socket.trigger('guide-fallback', {
            sid: session.id,
            localIds: ['local-guide', 'local-normal'],
            reason: 'interrupt-failed'
        })

        expect(webEvents).toEqual([{
            type: 'guide-fallback-queued',
            sessionId: session.id,
            messageId: guide.id,
            localId: 'local-guide',
            reason: 'interrupt-failed'
        }])

        const rows = store.messages.getMessagesByLocalIds(session.id, ['local-guide', 'local-normal'])
        expect(rows.find(row => row.id === guide.id)?.invokedAt).toBeNull()
        expect(rows.find(row => row.id === normal.id)?.invokedAt).toBeNull()
        expect(getGuideMeta(rows.find(row => row.id === guide.id)?.content).status).toBe('fallback-queued')
        expect(getGuideMeta(rows.find(row => row.id === guide.id)?.content).fallbackReason).toBe('interrupt-failed')
    })

    it('does not roll back consumed guide status on late fallback', () => {
        const store = new Store(':memory:')
        const session = store.sessions.getOrCreateSession('guide-late-fallback-session', {}, null, 'default')
        const guide = store.messages.addMessage(
            session.id,
            {
                role: 'user',
                content: { type: 'text', text: 'guide correction' },
                meta: {
                    deliveryMode: 'guide',
                    guide: {
                        requestedAt: 1,
                        status: 'consumed'
                    }
                }
            },
            'local-guide'
        )
        store.messages.markMessagesInvoked(session.id, ['local-guide'], 123)
        const socket = new FakeSocket()
        const webEvents: SyncEvent[] = []

        registerSessionHandlers(socket as unknown as CliSocketWithData, {
            store,
            resolveSessionAccess: () => ({ ok: true, value: session as StoredSession }),
            emitAccessError: () => {
                throw new Error('unexpected access error')
            },
            onWebappEvent: (event) => {
                webEvents.push(event)
            }
        })

        socket.trigger('guide-fallback', {
            sid: session.id,
            localIds: ['local-guide'],
            reason: 'interrupt-failed'
        })

        expect(webEvents).toHaveLength(0)
        const row = store.messages.getMessagesByLocalIds(session.id, ['local-guide'])[0]
        expect(row.id).toBe(guide.id)
        expect(row.invokedAt).toBe(123)
        expect(getGuideMeta(row.content).status).toBe('consumed')
        expect(getGuideMeta(row.content).fallbackReason).toBeUndefined()
    })
})
