import { describe, expect, it } from 'bun:test'
import type { Socket } from 'socket.io'
import { RPC_METHODS } from '@hapipower/protocol/rpcMethods'
import { RpcRegistry } from './rpcRegistry'

function socket(id: string): Socket {
    return { id } as Socket
}

describe('RpcRegistry scoped registration', () => {
    it('rejects RPC methods outside the authenticated socket scope', () => {
        const registry = new RpcRegistry()
        const registered = registry.register(socket('socket-1'), `session-b:${RPC_METHODS.GitClone}`, {
            allowedScopes: [{ kind: 'session', id: 'session-a' }]
        })

        expect(registered).toBe(false)
        expect(registry.getSocketIdForMethod(`session-b:${RPC_METHODS.GitClone}`)).toBeNull()
    })

    it('binds registered handlers to the expected scope kind and id', () => {
        const registry = new RpcRegistry()
        const method = `machine-1:${RPC_METHODS.MachineGitClone}`

        expect(registry.register(socket('socket-1'), method, {
            allowedScopes: [{ kind: 'machine', id: 'machine-1' }]
        })).toBe(true)

        expect(registry.getSocketIdForMethod(method, { kind: 'machine', id: 'machine-1' })).toBe('socket-1')
        expect(registry.getSocketIdForMethod(method, { kind: 'session', id: 'machine-1' })).toBeNull()
        expect(registry.getSocketIdForMethod(method, { kind: 'machine', id: 'machine-2' })).toBeNull()
    })

    it('rejects unknown RPC method names even when the scope matches', () => {
        const registry = new RpcRegistry()

        expect(registry.register(socket('socket-1'), 'session-a:not-a-real-method', {
            allowedScopes: [{ kind: 'session', id: 'session-a' }]
        })).toBe(false)
    })
})
