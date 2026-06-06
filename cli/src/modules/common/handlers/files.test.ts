import { beforeEach, describe, expect, it } from 'vitest'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createHash } from 'crypto'
import { RPC_METHODS } from '@hapipower/protocol/rpcMethods'
import { RpcHandlerManager } from '../../../api/rpc/RpcHandlerManager'
import { registerFileHandlers } from './files'

async function createTempDir(prefix: string): Promise<string> {
    const path = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    await mkdir(path, { recursive: true })
    return path
}

async function callRpc<T>(rpc: RpcHandlerManager, method: string, params: unknown): Promise<T> {
    const response = await rpc.handleRequest({ method: `session-test:${method}`, params: JSON.stringify(params) })
    return JSON.parse(response) as T
}

describe('file RPC handlers', () => {
    let rootDir: string
    let rpc: RpcHandlerManager

    beforeEach(async () => {
        if (rootDir) await rm(rootDir, { recursive: true, force: true })
        rootDir = await createTempDir('hapi-power-file-handler')
        rpc = new RpcHandlerManager({ scopePrefix: 'session-test' })
        registerFileHandlers(rpc, rootDir)
    })

    it('reads files with hash, size and modified metadata', async () => {
        const filePath = join(rootDir, 'note.txt')
        await writeFile(filePath, 'hello')

        const read = await callRpc<{ success: boolean; content?: string; hash?: string; size?: number; modified?: number }>(rpc, RPC_METHODS.ReadFile, { path: 'note.txt' })

        expect(read.success).toBe(true)
        expect(Buffer.from(read.content ?? '', 'base64').toString('utf8')).toBe('hello')
        expect(read.hash).toBe(createHash('sha256').update(await readFile(filePath)).digest('hex'))
        expect(read.size).toBe(5)
        expect(read.modified).toBeGreaterThan(0)
    })

    it('rejects stale expectedHash writes', async () => {
        const filePath = join(rootDir, 'note.txt')
        await writeFile(filePath, 'hello')

        const write = await callRpc<{ success: boolean; error?: string }>(rpc, RPC_METHODS.WriteFile, {
            path: 'note.txt',
            content: Buffer.from('new').toString('base64'),
            expectedHash: 'stale'
        })

        expect(write.success).toBe(false)
        expect(write.error).toContain('hash mismatch')
        expect(await readFile(filePath, 'utf8')).toBe('hello')
    })
})
