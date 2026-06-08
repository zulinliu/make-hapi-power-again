import { z } from 'zod'
import type { RpcRegistry, RpcRegistrationScope } from '../../rpcRegistry'
import type { CliSocketWithData } from '../../socketTypes'

const rpcRegisterSchema = z.object({
    method: z.string().min(1)
})

const rpcUnregisterSchema = z.object({
    method: z.string().min(1)
})

export function registerRpcHandlers(
    socket: CliSocketWithData,
    rpcRegistry: RpcRegistry,
    options?: { allowedScopes?: RpcRegistrationScope[] }
): void {
    socket.on('rpc-register', (data: unknown) => {
        const parsed = rpcRegisterSchema.safeParse(data)
        if (!parsed.success) {
            return
        }
        const registered = rpcRegistry.register(socket, parsed.data.method, { allowedScopes: options?.allowedScopes })
        if (!registered) {
            socket.emit('error', { message: 'RPC registration rejected', code: 'access-denied' })
        }
    })

    socket.on('rpc-unregister', (data: unknown) => {
        const parsed = rpcUnregisterSchema.safeParse(data)
        if (!parsed.success) {
            return
        }
        rpcRegistry.unregister(socket, parsed.data.method)
    })
}
