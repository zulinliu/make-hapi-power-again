import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import type { Machine, SyncEngine } from '../../sync/syncEngine'
import type { Store } from '../../store'
import type { StoredProvider } from '../../store/providerStore'
import type { WebAppEnv } from '../middleware/auth'
import { getDefaultProviderCapabilities } from '../../services/providerSecurity'
import { encryptAES256GCM, getEncryptionKey } from '../../utils/crypto'
import { createMachinesRoutes } from './machines'

const TEST_ENCRYPTION_KEY = '3'.repeat(64)

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

function createStoredProvider(overrides?: Partial<StoredProvider>): StoredProvider {
    const now = 1
    return {
        id: '00000000-0000-4000-8000-000000000181',
        namespace: 'default',
        name: 'Example Gateway',
        baseUrl: 'https://api.example.com/v1',
        apiKeyEncrypted: encryptAES256GCM('provider-secret', getEncryptionKey()),
        protocol: 'openai',
        defaultModel: 'gpt-5.5',
        health: {
            status: 'online',
            latencyMs: 120,
            checkedAt: now,
            errorCode: null,
            errorMessage: null,
            protocolDetected: 'openai',
            capabilities: getDefaultProviderCapabilities(),
        },
        modelCache: [],
        modelCacheUpdatedAt: null,
        notes: '',
        createdAt: now,
        updatedAt: now,
        ...overrides,
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
    let originalEncryptionKey: string | undefined

    beforeEach(() => {
        originalEncryptionKey = process.env.HAPI_POWER_PROVIDER_ENCRYPTION_KEY
        process.env.HAPI_POWER_PROVIDER_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
    })

    afterEach(() => {
        if (originalEncryptionKey === undefined) {
            delete process.env.HAPI_POWER_PROVIDER_ENCRYPTION_KEY
        } else {
            process.env.HAPI_POWER_PROVIDER_ENCRYPTION_KEY = originalEncryptionKey
        }
    })

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

    it('applies provider config after spawning a session with providerId', async () => {
        const machine = createMachine()
        const provider = createStoredProvider()
        const applySessionConfigCalls: Array<[string, Record<string, unknown>]> = []
        const engine = {
            getMachine: () => machine,
            getMachineByNamespace: () => machine,
            spawnSession: async () => ({ type: 'success', sessionId: 'spawned-1' }),
            applySessionConfig: async (sessionId: string, config: Record<string, unknown>) => {
                applySessionConfigCalls.push([sessionId, config])
            },
        } as Partial<SyncEngine>
        const store = {
            providers: {
                getById: (id: string, namespace: string) =>
                    id === provider.id && namespace === provider.namespace ? provider : null,
            },
        } as unknown as Store

        const app = new Hono<WebAppEnv>()
        app.use('*', async (c, next) => {
            c.set('namespace', 'default')
            await next()
        })
        app.route('/api', createMachinesRoutes(() => engine as SyncEngine, store))

        const response = await app.request('/api/machines/machine-1/spawn', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                directory: '/home/tester/project',
                agent: 'codex',
                model: 'gpt-5.5',
                providerId: provider.id,
            })
        })

        const responseText = await response.text()
        expect(response.status).toBe(200)
        expect(JSON.parse(responseText)).toEqual({ type: 'success', sessionId: 'spawned-1' })
        expect(responseText).not.toContain('provider-secret')
        expect(applySessionConfigCalls).toEqual([
            ['spawned-1', {
                model: 'gpt-5.5',
                providerBaseUrl: 'https://api.example.com/v1',
                providerApiKey: 'provider-secret',
            }]
        ])
    })

    it('rejects spawn before creating a session when providerId is missing from the machine namespace', async () => {
        const machine = createMachine()
        const spawnSessionCalls: Array<{ directory: string; agent?: string; model?: string }> = []
        const applySessionConfigCalls: Array<[string, Record<string, unknown>]> = []
        const engine = {
            getMachine: () => machine,
            getMachineByNamespace: () => machine,
            spawnSession: async (_machineId: string, directory: string, agent?: string, model?: string) => {
                spawnSessionCalls.push({ directory, agent, model })
                return { type: 'success', sessionId: 'spawned-2' }
            },
            applySessionConfig: async (sessionId: string, config: Record<string, unknown>) => {
                applySessionConfigCalls.push([sessionId, config])
            },
        } as Partial<SyncEngine>
        const store = {
            providers: {
                getById: () => null,
            },
        } as unknown as Store

        const app = new Hono<WebAppEnv>()
        app.use('*', async (c, next) => {
            c.set('namespace', 'default')
            await next()
        })
        app.route('/api', createMachinesRoutes(() => engine as SyncEngine, store))

        const response = await app.request('/api/machines/machine-1/spawn', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                directory: '/home/tester/project',
                agent: 'codex',
                model: 'gpt-5.5',
                providerId: '00000000-0000-4000-8000-000000000182',
            })
        })

        const responseText = await response.text()
        expect(response.status).toBe(400)
        expect(JSON.parse(responseText)).toEqual({ error: 'Provider not found' })
        expect(responseText).not.toContain('provider-secret')
        expect(spawnSessionCalls).toEqual([])
        expect(applySessionConfigCalls).toEqual([])
    })

    it('returns 409 without leaking secrets when provider config cannot be applied after spawn', async () => {
        const machine = createMachine()
        const provider = createStoredProvider()
        const engine = {
            getMachine: () => machine,
            getMachineByNamespace: () => machine,
            spawnSession: async () => ({ type: 'success', sessionId: 'spawned-3' }),
            applySessionConfig: async () => {
                throw new Error('apply failed with provider-secret')
            },
        } as Partial<SyncEngine>
        const store = {
            providers: {
                getById: (id: string, namespace: string) =>
                    id === provider.id && namespace === provider.namespace ? provider : null,
            },
        } as unknown as Store

        const app = new Hono<WebAppEnv>()
        app.use('*', async (c, next) => {
            c.set('namespace', 'default')
            await next()
        })
        app.route('/api', createMachinesRoutes(() => engine as SyncEngine, store))

        const response = await app.request('/api/machines/machine-1/spawn', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                directory: '/home/tester/project',
                agent: 'codex',
                model: 'gpt-5.5',
                providerId: provider.id,
            })
        })

        const responseText = await response.text()
        expect(response.status).toBe(409)
        expect(JSON.parse(responseText)).toEqual({ error: 'Provider config could not be applied to spawned session' })
        expect(responseText).not.toContain('provider-secret')
    })

    it('returns 409 without spawning when provider key cannot be decrypted', async () => {
        const machine = createMachine()
        const provider = createStoredProvider({ apiKeyEncrypted: 'not-encrypted' })
        const spawnSessionCalls: string[] = []
        const engine = {
            getMachine: () => machine,
            getMachineByNamespace: () => machine,
            spawnSession: async () => {
                spawnSessionCalls.push('spawn')
                return { type: 'success', sessionId: 'spawned-4' }
            },
        } as Partial<SyncEngine>
        const store = {
            providers: {
                getById: (id: string, namespace: string) =>
                    id === provider.id && namespace === provider.namespace ? provider : null,
            },
        } as unknown as Store

        const app = new Hono<WebAppEnv>()
        app.use('*', async (c, next) => {
            c.set('namespace', 'default')
            await next()
        })
        app.route('/api', createMachinesRoutes(() => engine as SyncEngine, store))

        const response = await app.request('/api/machines/machine-1/spawn', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                directory: '/home/tester/project',
                agent: 'codex',
                model: 'gpt-5.5',
                providerId: provider.id,
            })
        })

        const responseText = await response.text()
        expect(response.status).toBe(409)
        expect(JSON.parse(responseText)).toEqual({ error: 'Provider key could not be decrypted' })
        expect(responseText).not.toContain('not-encrypted')
        expect(spawnSessionCalls).toEqual([])
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
