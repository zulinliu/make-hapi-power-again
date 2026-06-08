import { describe, expect, it } from 'bun:test'
import type { Store, StoredMachine, StoredSession } from '../../../store'
import type { SyncEvent } from '../../../sync/syncEngine'
import type { CliSocketWithData, SocketServer } from '../../socketTypes'
import { RpcRegistry } from '../../rpcRegistry'
import { TerminalRegistry } from '../../terminalRegistry'
import { registerCliHandlers } from './index'

type FakeSocket = CliSocketWithData & {
    trigger: (event: string, payload?: unknown) => void
    emitted: Array<{ event: string; payload: unknown }>
    joined: string[]
}

function createStoredSession(id: string, namespace: string): StoredSession {
    return {
        id,
        tag: null,
        namespace,
        machineId: null,
        createdAt: 0,
        updatedAt: 0,
        metadata: null,
        metadataVersion: 0,
        agentState: null,
        agentStateVersion: 0,
        model: null,
        modelReasoningEffort: null,
        effort: null,
        todos: null,
        todosUpdatedAt: null,
        teamState: null,
        teamStateUpdatedAt: null,
        active: true,
        activeAt: 0,
        seq: 0
    }
}

function createStoredMachine(id: string, namespace: string): StoredMachine {
    return {
        id,
        namespace,
        createdAt: 0,
        updatedAt: 0,
        metadata: null,
        metadataVersion: 0,
        runnerState: null,
        runnerStateVersion: 0,
        active: true,
        activeAt: 0,
        seq: 0
    }
}

function createFakeSocket(auth: Record<string, unknown>): FakeSocket {
    const handlers = new Map<string, (payload?: unknown) => void>()
    const emitted: Array<{ event: string; payload: unknown }> = []
    const joined: string[] = []
    const socket = {
        id: 'socket-1',
        data: { namespace: 'alpha' },
        handshake: { auth },
        emitted,
        joined,
        on: (event: string, handler: (payload?: unknown) => void) => {
            handlers.set(event, handler)
            return socket
        },
        emit: (event: string, payload: unknown) => {
            emitted.push({ event, payload })
            return true
        },
        join: (room: string) => {
            joined.push(room)
        },
        to: () => ({ emit: () => true }),
        trigger: (event: string, payload?: unknown) => {
            handlers.get(event)?.(payload)
        }
    }
    return socket as unknown as FakeSocket
}

function createDeps(events: SyncEvent[]) {
    const session = createStoredSession('session-1', 'alpha')
    const machine = createStoredMachine('machine-1', 'alpha')
    const store = {
        sessions: {
            getSessionByNamespace: (id: string, namespace: string) => id === session.id && namespace === session.namespace ? session : null,
            getSession: (id: string) => id === session.id ? session : null
        },
        machines: {
            getMachineByNamespace: (id: string, namespace: string) => id === machine.id && namespace === machine.namespace ? machine : null,
            getMachine: (id: string) => id === machine.id ? machine : null
        }
    } as unknown as Store

    const io = {
        of: () => ({ sockets: new Map() })
    } as unknown as SocketServer

    return {
        io,
        store,
        rpcRegistry: new RpcRegistry(),
        terminalRegistry: new TerminalRegistry({ idleTimeoutMs: 0 }),
        onWebappEvent: (event: SyncEvent) => {
            events.push(event)
        }
    }
}

describe('CLI clone progress handler', () => {
    it('accepts clone progress only for the authenticated session or machine scope', () => {
        const events: SyncEvent[] = []
        const socket = createFakeSocket({ sessionId: 'session-1', machineId: 'machine-1' })
        registerCliHandlers(socket, createDeps(events))

        socket.trigger('clone:progress', {
            cloneId: '11111111-1111-4111-8111-111111111111',
            sessionId: 'session-1',
            phase: 'writing',
            progress: 25
        })
        socket.trigger('clone:progress', {
            cloneId: '22222222-2222-4222-8222-222222222222',
            machineId: 'machine-1',
            phase: 'done',
            progress: 100
        })

        expect(events).toHaveLength(2)
        expect(events[0]).toMatchObject({ type: 'clone-progress', namespace: 'alpha', sessionId: 'session-1' })
        expect(events[1]).toMatchObject({ type: 'clone-progress', namespace: 'alpha', machineId: 'machine-1' })
        expect(socket.emitted).toHaveLength(0)
    })

    it('rejects malformed or cross-scope clone progress payloads', () => {
        const events: SyncEvent[] = []
        const socket = createFakeSocket({ sessionId: 'session-1' })
        registerCliHandlers(socket, createDeps(events))

        socket.trigger('clone:progress', {
            sessionId: 'session-1',
            phase: 'writing',
            progress: 25
        })
        socket.trigger('clone:progress', {
            cloneId: '11111111-1111-4111-8111-111111111111',
            sessionId: 'session-2',
            phase: 'writing',
            progress: 25
        })

        expect(events).toHaveLength(0)
        expect(socket.emitted).toEqual([
            {
                event: 'error',
                payload: { message: 'Clone progress scope rejected', code: 'access-denied' }
            }
        ])
    })

    it('rejects mixed clone progress scopes at the schema boundary', () => {
        const events: SyncEvent[] = []
        const socket = createFakeSocket({ sessionId: 'session-1' })
        registerCliHandlers(socket, createDeps(events))

        socket.trigger('clone:progress', {
            cloneId: '33333333-3333-4333-8333-333333333333',
            sessionId: 'session-1',
            machineId: 'machine-1',
            phase: 'writing',
            progress: 50
        })

        expect(events).toHaveLength(0)
        expect(socket.emitted).toHaveLength(0)
    })
})
