import { describe, expect, it } from 'vitest'
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Machine } from '@hapipower/protocol/types'
import { RPC_METHODS } from '@hapipower/protocol/rpcMethods'
import { ApiMachineClient } from './apiMachine'
import type { RpcHandlerManager } from './rpc/RpcHandlerManager'

async function createTempDir(prefix: string): Promise<string> {
    const path = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    await mkdir(path, { recursive: true })
    return path
}

function createMachine(id: string): Machine {
    const now = Date.now()
    return {
        id,
        namespace: 'default',
        seq: 0,
        createdAt: now,
        updatedAt: now,
        active: true,
        activeAt: now,
        metadata: {
            host: 'test-host',
            platform: 'linux',
            hapiPowerCliVersion: 'test'
        },
        metadataVersion: 0,
        runnerState: null,
        runnerStateVersion: 0
    }
}

function getRpc(client: ApiMachineClient): RpcHandlerManager {
    return (client as unknown as { rpcHandlerManager: RpcHandlerManager }).rpcHandlerManager
}

async function callRpc<T>(rpc: RpcHandlerManager, machineId: string, method: string, params: unknown): Promise<T> {
    const raw = await rpc.handleRequest({
        method: `${machineId}:${method}`,
        params: JSON.stringify(params)
    })
    return JSON.parse(raw) as T
}

async function createDirectoryLink(target: string, path: string): Promise<boolean> {
    try {
        await symlink(target, path, process.platform === 'win32' ? 'junction' : 'dir')
        return true
    } catch (error) {
        if (isSymlinkPermissionError(error)) {
            return false
        }
        throw error
    }
}

function isSymlinkPermissionError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false
    }

    const code = (error as { code?: unknown }).code
    return code === 'EPERM' || code === 'EACCES'
}

describe('ApiMachineClient workspace file operations', () => {
    it('honors showHidden when listing machine directories', async () => {
        const root = await createTempDir('hapi-power-machine-list')
        try {
            await writeFile(join(root, 'visible.txt'), 'ok')
            await writeFile(join(root, '.hidden'), 'secret')
            const machine = createMachine('machine-list')
            const client = new ApiMachineClient('token', machine, [root])
            const rpc = getRpc(client)

            const hiddenOff = await callRpc<{ success: boolean; entries?: Array<{ name: string }> }>(rpc, machine.id, RPC_METHODS.ListMachineDirectory, { path: root })
            expect(hiddenOff.success).toBe(true)
            expect(hiddenOff.entries?.map((entry) => entry.name)).toEqual(['visible.txt'])

            const hiddenOn = await callRpc<{ success: boolean; entries?: Array<{ name: string }> }>(rpc, machine.id, RPC_METHODS.ListMachineDirectory, { path: root, showHidden: true })
            expect(hiddenOn.success).toBe(true)
            expect(hiddenOn.entries?.map((entry) => entry.name).sort()).toEqual(['.hidden', 'visible.txt'])
        } finally {
            await rm(root, { recursive: true, force: true })
        }
    })

    it('writes, reads and deletes files inside workspace roots', async () => {
        const root = await createTempDir('hapi-power-machine-crud')
        try {
            const machine = createMachine('machine-crud')
            const client = new ApiMachineClient('token', machine, [root])
            const rpc = getRpc(client)
            const filePath = join(root, 'note.txt')
            const content = Buffer.from('hello').toString('base64')

            const write = await callRpc<{ success: boolean; hash?: string; error?: string }>(rpc, machine.id, RPC_METHODS.WriteFile, { path: filePath, content })
            expect(write.success).toBe(true)
            expect(write.hash).toBeTruthy()
            expect(await readFile(filePath, 'utf8')).toBe('hello')

            const read = await callRpc<{ success: boolean; content?: string; hash?: string; size?: number }>(rpc, machine.id, RPC_METHODS.ReadFile, { path: filePath })
            expect(read.success).toBe(true)
            expect(Buffer.from(read.content ?? '', 'base64').toString('utf8')).toBe('hello')
            expect(read.hash).toBe(write.hash)
            expect(read.size).toBe(5)

            const del = await callRpc<{ success: boolean; error?: string }>(rpc, machine.id, RPC_METHODS.DeleteFile, { path: filePath })
            expect(del.success).toBe(true)
        } finally {
            await rm(root, { recursive: true, force: true })
        }
    })

    it('rejects file operations outside workspace roots', async () => {
        const root = await createTempDir('hapi-power-machine-safe')
        const outside = await createTempDir('hapi-power-machine-outside')
        try {
            const machine = createMachine('machine-safe')
            const client = new ApiMachineClient('token', machine, [root])
            const rpc = getRpc(client)
            const outsidePath = join(outside, 'blocked.txt')

            const write = await callRpc<{ success: boolean; error?: string }>(rpc, machine.id, RPC_METHODS.WriteFile, {
                path: outsidePath,
                content: Buffer.from('no').toString('base64')
            })

            expect(write.success).toBe(false)
            expect(write.error).toContain('outside workspace roots')
        } finally {
            await rm(root, { recursive: true, force: true })
            await rm(outside, { recursive: true, force: true })
        }
    })

    it('creates directories, copies, moves and renames inside workspace roots', async () => {
        const root = await createTempDir('hapi-power-machine-ops')
        try {
            const machine = createMachine('machine-ops')
            const client = new ApiMachineClient('token', machine, [root])
            const rpc = getRpc(client)
            const sourcePath = join(root, 'source.txt')
            const copyPath = join(root, 'drafts', 'copy.txt')
            const movedPath = join(root, 'archive', 'copy.txt')
            const renamedPath = join(root, 'archive', 'final.txt')

            const mkdirRes = await callRpc<{ success: boolean; error?: string }>(rpc, machine.id, RPC_METHODS.CreateDirectory, {
                path: join(root, 'drafts')
            })
            expect(mkdirRes.success).toBe(true)

            const write = await callRpc<{ success: boolean; error?: string }>(rpc, machine.id, RPC_METHODS.WriteFile, {
                path: sourcePath,
                content: Buffer.from('copy me').toString('base64')
            })
            expect(write.success).toBe(true)

            const copy = await callRpc<{ success: boolean; error?: string }>(rpc, machine.id, RPC_METHODS.CopyFile, {
                sourcePath,
                destinationPath: copyPath
            })
            expect(copy.success).toBe(true)
            expect(await readFile(copyPath, 'utf8')).toBe('copy me')

            const move = await callRpc<{ success: boolean; error?: string }>(rpc, machine.id, RPC_METHODS.MoveFile, {
                sourcePath: copyPath,
                destinationPath: movedPath
            })
            expect(move.success).toBe(true)
            expect(await readFile(movedPath, 'utf8')).toBe('copy me')

            const rename = await callRpc<{ success: boolean; error?: string }>(rpc, machine.id, RPC_METHODS.RenameFile, {
                oldPath: movedPath,
                newPath: renamedPath
            })
            expect(rename.success).toBe(true)
            expect(await readFile(renamedPath, 'utf8')).toBe('copy me')
        } finally {
            await rm(root, { recursive: true, force: true })
        }
    })

    it('protects existing files unless hash or force overwrite is supplied', async () => {
        const root = await createTempDir('hapi-power-machine-conflict')
        try {
            const machine = createMachine('machine-conflict')
            const client = new ApiMachineClient('token', machine, [root])
            const rpc = getRpc(client)
            const filePath = join(root, 'note.txt')

            const initial = await callRpc<{ success: boolean; hash?: string; error?: string }>(rpc, machine.id, RPC_METHODS.WriteFile, {
                path: filePath,
                content: Buffer.from('initial').toString('base64')
            })
            expect(initial.success).toBe(true)
            expect(initial.hash).toBeTruthy()

            const overwriteWithoutHash = await callRpc<{ success: boolean; error?: string }>(rpc, machine.id, RPC_METHODS.WriteFile, {
                path: filePath,
                content: Buffer.from('unsafe').toString('base64')
            })
            expect(overwriteWithoutHash.success).toBe(false)
            expect(overwriteWithoutHash.error).toContain('already exists')

            const wrongHash = await callRpc<{ success: boolean; error?: string }>(rpc, machine.id, RPC_METHODS.WriteFile, {
                path: filePath,
                content: Buffer.from('unsafe').toString('base64'),
                expectedHash: 'not-the-current-hash'
            })
            expect(wrongHash.success).toBe(false)
            expect(wrongHash.error).toContain('hash mismatch')

            const safeOverwrite = await callRpc<{ success: boolean; error?: string }>(rpc, machine.id, RPC_METHODS.WriteFile, {
                path: filePath,
                content: Buffer.from('safe').toString('base64'),
                expectedHash: initial.hash
            })
            expect(safeOverwrite.success).toBe(true)
            expect(await readFile(filePath, 'utf8')).toBe('safe')

            const forceOverwrite = await callRpc<{ success: boolean; error?: string }>(rpc, machine.id, RPC_METHODS.WriteFile, {
                path: filePath,
                content: Buffer.from('forced').toString('base64'),
                forceOverwrite: true
            })
            expect(forceOverwrite.success).toBe(true)
            expect(await readFile(filePath, 'utf8')).toBe('forced')
        } finally {
            await rm(root, { recursive: true, force: true })
        }
    })

    it('rejects relative paths, null bytes and symlink escapes', async () => {
        const root = await createTempDir('hapi-power-machine-paths')
        const outside = await createTempDir('hapi-power-machine-escape')
        try {
            const machine = createMachine('machine-paths')
            const client = new ApiMachineClient('token', machine, [root])
            const rpc = getRpc(client)

            const relative = await callRpc<{ success: boolean; error?: string }>(rpc, machine.id, RPC_METHODS.WriteFile, {
                path: 'relative.txt',
                content: Buffer.from('no').toString('base64')
            })
            expect(relative.success).toBe(false)
            expect(relative.error).toContain('absolute')

            const nullByte = await callRpc<{ success: boolean; error?: string }>(rpc, machine.id, RPC_METHODS.WriteFile, {
                path: `${root}/bad\0name.txt`,
                content: Buffer.from('no').toString('base64')
            })
            expect(nullByte.success).toBe(false)
            expect(nullByte.error).toContain('null bytes')

            const linkPath = join(root, 'escape')
            if (await createDirectoryLink(outside, linkPath)) {
                const symlinkEscape = await callRpc<{ success: boolean; error?: string }>(rpc, machine.id, RPC_METHODS.WriteFile, {
                    path: join(linkPath, 'blocked.txt'),
                    content: Buffer.from('no').toString('base64')
                })
                expect(symlinkEscape.success).toBe(false)
                expect(symlinkEscape.error).toContain('outside workspace roots')
            }
        } finally {
            await rm(root, { recursive: true, force: true })
            await rm(outside, { recursive: true, force: true })
        }
    })
})
