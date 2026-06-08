import type { Socket } from 'socket.io'
import { RPC_METHODS, type RpcMethod } from '@hapipower/protocol/rpcMethods'

export type RpcRegistrationScope = {
    kind: 'session' | 'machine'
    id: string
}

type RpcRegistration = RpcRegistrationScope & {
    socketId: string
    methodName: RpcMethod
}

const KNOWN_RPC_METHODS = new Set<string>(Object.values(RPC_METHODS))

function parseRegisteredMethod(method: string): { scopeId: string; methodName: RpcMethod } | null {
    const separator = method.indexOf(':')
    if (separator <= 0 || separator === method.length - 1) {
        return null
    }

    const scopeId = method.slice(0, separator)
    const methodName = method.slice(separator + 1)
    if (!KNOWN_RPC_METHODS.has(methodName)) {
        return null
    }

    return { scopeId, methodName: methodName as RpcMethod }
}

export class RpcRegistry {
    private readonly methodToRegistration: Map<string, RpcRegistration> = new Map()
    private readonly socketIdToMethods: Map<string, Set<string>> = new Map()

    register(socket: Socket, method: string, options?: { allowedScopes?: RpcRegistrationScope[] }): boolean {
        if (!method) {
            return false
        }

        const parsed = parseRegisteredMethod(method)
        if (!parsed) {
            return false
        }

        const allowedScopes = options?.allowedScopes
        const matchedScope = allowedScopes?.find((scope) => scope.id === parsed.scopeId)
        if (allowedScopes && !matchedScope) {
            return false
        }

        this.methodToRegistration.set(method, {
            kind: matchedScope?.kind ?? 'session',
            id: parsed.scopeId,
            socketId: socket.id,
            methodName: parsed.methodName
        })

        const existing = this.socketIdToMethods.get(socket.id)
        if (existing) {
            existing.add(method)
        } else {
            this.socketIdToMethods.set(socket.id, new Set([method]))
        }

        return true
    }

    unregister(socket: Socket, method: string): void {
        const registration = this.methodToRegistration.get(method)
        if (registration?.socketId === socket.id) {
            this.methodToRegistration.delete(method)
        }

        const methods = this.socketIdToMethods.get(socket.id)
        if (methods) {
            methods.delete(method)
            if (methods.size === 0) {
                this.socketIdToMethods.delete(socket.id)
            }
        }
    }

    unregisterAll(socket: Socket): void {
        const methods = this.socketIdToMethods.get(socket.id)
        if (!methods) {
            return
        }
        for (const method of methods) {
            const registration = this.methodToRegistration.get(method)
            if (registration?.socketId === socket.id) {
                this.methodToRegistration.delete(method)
            }
        }
        this.socketIdToMethods.delete(socket.id)
    }

    getSocketIdForMethod(method: string, expectedScope?: RpcRegistrationScope): string | null {
        const registration = this.methodToRegistration.get(method)
        if (!registration) {
            return null
        }
        if (expectedScope && (registration.kind !== expectedScope.kind || registration.id !== expectedScope.id)) {
            return null
        }
        return registration.socketId
    }
}
