import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import type { Machine, SyncEngine } from '../../sync/syncEngine'
import type { Store } from '../../store'
import type { WebAppEnv } from '../middleware/auth'
import { createMachinesRoutes } from './machines'

const mockStore = {
    providers: {
        getById: () => null,
    },
} as unknown as Store

function createMachine(overrides?: Partial<Machine>): Machine {
    return {
        id: 'machine-1',
        namespace: 'default',
        seq: 1,
        createdAt: 1,
        updatedAt: 1,
        active: true,
        activeAt: 1,
        metadata: {
            host: 'localhost',
            platform: 'darwin',
            hapiPowerCliVersion: '1.0.0'
        },
        metadataVersion: 1,
        runnerState: null,
        runnerStateVersion: 1,
        ...overrides
    }
}

type MachineFileRouteCall =
    | { operation: 'read'; machineId: string; path: string }
    | { operation: 'write'; machineId: string; options: { path: string; content: string; expectedHash?: string; forceOverwrite?: boolean } }
    | { operation: 'delete'; machineId: string; path: string; recursive?: boolean }
    | { operation: 'rename'; machineId: string; oldPath: string; newPath: string }
    | { operation: 'copy'; machineId: string; sourcePath: string; destinationPath: string }
    | { operation: 'move'; machineId: string; sourcePath: string; destinationPath: string }
    | { operation: 'mkdir'; machineId: string; path: string; recursive?: boolean }

describe('machines routes', () => {
    it('returns Codex models for an online machine', async () => {
        const machine = createMachine()
        const engine = {
            getMachine: () => machine,
            getMachineByNamespace: () => machine,
            listCodexModelsForMachine: async () => ({
                success: true,
                models: [
                    { id: 'gpt-5.5', displayName: 'GPT-5.5', isDefault: true }
                ]
            })
        } as Partial<SyncEngine>

        const app = new Hono<WebAppEnv>()
        app.use('*', async (c, next) => {
            c.set('namespace', 'default')
            await next()
        })
        app.route('/api', createMachinesRoutes(() => engine as SyncEngine, mockStore))

        const response = await app.request('/api/machines/machine-1/codex-models')

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            success: true,
            models: [
                { id: 'gpt-5.5', displayName: 'GPT-5.5', isDefault: true }
            ]
        })
    })

    it('returns 400 when /opencode-models is called without cwd', async () => {
        const machine = createMachine()
        const engine = {
            getMachine: () => machine,
            getMachineByNamespace: () => machine,
            listOpencodeModelsForCwd: async () => ({ success: true, availableModels: [] })
        } as Partial<SyncEngine>

        const app = new Hono<WebAppEnv>()
        app.use('*', async (c, next) => {
            c.set('namespace', 'default')
            await next()
        })
        app.route('/api', createMachinesRoutes(() => engine as SyncEngine, mockStore))

        const response = await app.request('/api/machines/machine-1/opencode-models')

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            success: false,
            error: 'cwd query parameter is required'
        })
    })

    it('forwards cwd to listOpencodeModelsForCwd and returns availableModels', async () => {
        const machine = createMachine()
        const calls: Array<{ machineId: string; cwd: string }> = []
        const engine = {
            getMachine: () => machine,
            getMachineByNamespace: () => machine,
            listOpencodeModelsForCwd: async (machineId: string, cwd: string) => {
                calls.push({ machineId, cwd })
                return {
                    success: true,
                    availableModels: [
                        { modelId: 'ollama/exaone:4.5-33b-q8', name: 'Ollama/EXAONE 4.5 33B Q8' }
                    ],
                    currentModelId: 'ollama/exaone:4.5-33b-q8'
                }
            }
        } as Partial<SyncEngine>

        const app = new Hono<WebAppEnv>()
        app.use('*', async (c, next) => {
            c.set('namespace', 'default')
            await next()
        })
        app.route('/api', createMachinesRoutes(() => engine as SyncEngine, mockStore))

        const response = await app.request(
            '/api/machines/machine-1/opencode-models?cwd=' + encodeURIComponent('/home/user/proj')
        )

        expect(response.status).toBe(200)
        expect(calls).toEqual([{ machineId: 'machine-1', cwd: '/home/user/proj' }])
        expect(await response.json()).toEqual({
            success: true,
            availableModels: [
                { modelId: 'ollama/exaone:4.5-33b-q8', name: 'Ollama/EXAONE 4.5 33B Q8' }
            ],
            currentModelId: 'ollama/exaone:4.5-33b-q8'
        })
    })

    it('returns Cursor models for an online machine', async () => {
        const machine = createMachine()
        const engine = {
            getMachine: () => machine,
            getMachineByNamespace: () => machine,
            listCursorModelsForMachine: async () => ({
                success: true,
                availableModels: [
                    { modelId: 'composer-2.5', name: 'Composer 2.5' },
                    { modelId: 'gpt-5.5-high-fast', name: 'GPT-5.5 High Fast' }
                ],
                currentModelId: 'composer-2.5'
            })
        } as Partial<SyncEngine>

        const app = new Hono<WebAppEnv>()
        app.use('*', async (c, next) => {
            c.set('namespace', 'default')
            await next()
        })
        app.route('/api', createMachinesRoutes(() => engine as SyncEngine, mockStore))

        const response = await app.request('/api/machines/machine-1/cursor-models')

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            success: true,
            availableModels: [
                { modelId: 'composer-2.5', name: 'Composer 2.5' },
                { modelId: 'gpt-5.5-high-fast', name: 'GPT-5.5 High Fast' }
            ],
            currentModelId: 'composer-2.5'
        })
    })

    it('forwards machine file routes to SyncEngine', async () => {
        const machine = createMachine()
        const calls: MachineFileRouteCall[] = []
        const engine = {
            getMachine: () => machine,
            getMachineByNamespace: () => machine,
            readMachineFile: async (machineId: string, path: string) => {
                calls.push({ operation: 'read', machineId, path })
                return { success: true, content: Buffer.from('hello').toString('base64') }
            },
            writeMachineFile: async (machineId: string, options: { path: string; content: string; expectedHash?: string; forceOverwrite?: boolean }) => {
                calls.push({ operation: 'write', machineId, options })
                return { success: true }
            },
            deleteMachineFile: async (machineId: string, path: string, recursive?: boolean) => {
                calls.push({ operation: 'delete', machineId, path, recursive })
                return { success: true }
            },
            renameMachineFile: async (machineId: string, oldPath: string, newPath: string) => {
                calls.push({ operation: 'rename', machineId, oldPath, newPath })
                return { success: true }
            },
            copyMachineFile: async (machineId: string, sourcePath: string, destinationPath: string) => {
                calls.push({ operation: 'copy', machineId, sourcePath, destinationPath })
                return { success: true }
            },
            moveMachineFile: async (machineId: string, sourcePath: string, destinationPath: string) => {
                calls.push({ operation: 'move', machineId, sourcePath, destinationPath })
                return { success: true }
            },
            createMachineDirectory: async (machineId: string, path: string, recursive?: boolean) => {
                calls.push({ operation: 'mkdir', machineId, path, recursive })
                return { success: true }
            }
        } as Partial<SyncEngine>

        const app = new Hono<WebAppEnv>()
        app.use('*', async (c, next) => {
            c.set('namespace', 'default')
            await next()
        })
        app.route('/api', createMachinesRoutes(() => engine as SyncEngine, mockStore))

        const read = await app.request('/api/machines/machine-1/file?path=' + encodeURIComponent('/repo/a.txt'))
        expect(read.status).toBe(200)
        expect(await read.json()).toEqual({ success: true, content: Buffer.from('hello').toString('base64') })

        const write = await app.request('/api/machines/machine-1/file', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: '/repo/a.txt', content: 'aGVsbG8=', expectedHash: 'hash-1', forceOverwrite: false })
        })
        expect(write.status).toBe(200)

        const deleteResponse = await app.request('/api/machines/machine-1/file', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: '/repo/a.txt', recursive: false })
        })
        expect(deleteResponse.status).toBe(200)

        const rename = await app.request('/api/machines/machine-1/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPath: '/repo/a.txt', newPath: '/repo/b.txt' })
        })
        expect(rename.status).toBe(200)

        const copy = await app.request('/api/machines/machine-1/copy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourcePath: '/repo/b.txt', destinationPath: '/repo/c.txt' })
        })
        expect(copy.status).toBe(200)

        const move = await app.request('/api/machines/machine-1/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourcePath: '/repo/c.txt', destinationPath: '/repo/d.txt' })
        })
        expect(move.status).toBe(200)

        const mkdir = await app.request('/api/machines/machine-1/mkdir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: '/repo/new-dir', recursive: true })
        })
        expect(mkdir.status).toBe(200)

        expect(calls).toEqual([
            { operation: 'read', machineId: 'machine-1', path: '/repo/a.txt' },
            { operation: 'write', machineId: 'machine-1', options: { path: '/repo/a.txt', content: 'aGVsbG8=', expectedHash: 'hash-1', forceOverwrite: false } },
            { operation: 'delete', machineId: 'machine-1', path: '/repo/a.txt', recursive: false },
            { operation: 'rename', machineId: 'machine-1', oldPath: '/repo/a.txt', newPath: '/repo/b.txt' },
            { operation: 'copy', machineId: 'machine-1', sourcePath: '/repo/b.txt', destinationPath: '/repo/c.txt' },
            { operation: 'move', machineId: 'machine-1', sourcePath: '/repo/c.txt', destinationPath: '/repo/d.txt' },
            { operation: 'mkdir', machineId: 'machine-1', path: '/repo/new-dir', recursive: true }
        ])
    })

    it('rejects invalid machine file route payloads', async () => {
        const machine = createMachine()
        const engine = {
            getMachine: () => machine,
            getMachineByNamespace: () => machine,
            writeMachineFile: async () => ({ success: true })
        } as Partial<SyncEngine>

        const app = new Hono<WebAppEnv>()
        app.use('*', async (c, next) => {
            c.set('namespace', 'default')
            await next()
        })
        app.route('/api', createMachinesRoutes(() => engine as SyncEngine, mockStore))

        const response = await app.request('/api/machines/machine-1/file', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: '', content: 'aGVsbG8=' })
        })

        expect(response.status).toBe(400)
    })

    it('searches machine files by name and content', async () => {
        const machine = createMachine()
        const engine = {
            getMachine: () => machine,
            getMachineByNamespace: () => machine,
            listMachineDirectory: async (_machineId: string, path: string) => {
                if (path === '/repo') {
                    return {
                        success: true,
                        entries: [
                            { name: 'src', type: 'directory' },
                            { name: 'README.md', type: 'file', size: 20 }
                        ]
                    }
                }
                if (path === '/repo/src') {
                    return {
                        success: true,
                        entries: [
                            { name: 'feature.ts', type: 'file', size: 30 },
                            { name: 'large.log', type: 'file', size: 2_000_000 }
                        ]
                    }
                }
                return { success: true, entries: [] }
            },
            readMachineFile: async (_machineId: string, path: string) => {
                if (path === '/repo/src/feature.ts') {
                    return { success: true, content: Buffer.from('export const marker = true').toString('base64') }
                }
                return { success: true, content: Buffer.from('hello').toString('base64') }
            }
        } as Partial<SyncEngine>

        const app = new Hono<WebAppEnv>()
        app.use('*', async (c, next) => {
            c.set('namespace', 'default')
            await next()
        })
        app.route('/api', createMachinesRoutes(() => engine as SyncEngine, mockStore))

        const nameResponse = await app.request('/api/machines/machine-1/files?path=' + encodeURIComponent('/repo') + '&query=read&mode=name')
        expect(nameResponse.status).toBe(200)
        expect(await nameResponse.json()).toEqual({
            success: true,
            files: [
                { fileName: 'README.md', filePath: '/repo', fullPath: '/repo/README.md', fileType: 'file' }
            ]
        })

        const contentResponse = await app.request('/api/machines/machine-1/files?path=' + encodeURIComponent('/repo') + '&query=marker&mode=content')
        expect(contentResponse.status).toBe(200)
        expect(await contentResponse.json()).toEqual({
            success: true,
            files: [
                { fileName: 'feature.ts', filePath: '/repo/src', fullPath: '/repo/src/feature.ts', fileType: 'file' }
            ]
        })
    })
})
