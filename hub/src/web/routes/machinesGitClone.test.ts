import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import type { Machine, SyncEngine } from '../../sync/syncEngine'
import type { Store } from '../../store'
import type { WebAppEnv } from '../middleware/auth'
import { createMachinesRoutes } from './machines'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'
const mockStore = { providers: { getById: () => null } } as unknown as Store

function createMachine(overrides?: Partial<Machine>): Machine {
    const now = Date.now()
    return {
        id: 'machine-1',
        namespace: 'default',
        seq: 1,
        createdAt: now,
        updatedAt: now,
        active: true,
        activeAt: now,
        metadata: {
            host: 'test-host',
            platform: 'linux',
            hapiPowerCliVersion: 'test',
            workspaceRoots: ['/workspace']
        },
        metadataVersion: 1,
        runnerState: null,
        runnerStateVersion: 1,
        ...overrides
    }
}

function createApp(engine: Partial<SyncEngine>): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()
    app.use('*', async (c, next) => {
        c.set('namespace', 'default')
        await next()
    })
    app.route('/api', createMachinesRoutes(() => engine as SyncEngine, mockStore))
    return app
}

describe('machine git clone routes', () => {
    it('requires an explicit target path for machine clone', async () => {
        const machine = createMachine()
        let called = false
        const engine = {
            getMachine: () => machine,
            gitCloneMachine: async () => {
                called = true
                return { success: true }
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const response = await app.request('/api/machines/machine-1/git-clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: 'https://github.com/acme/repo.git',
                cloneId: VALID_UUID
            })
        })

        expect(response.status).toBe(400)
        expect(called).toBe(false)
    })

    it('forwards parent targetDir, targetName and cloneId to machine RPC', async () => {
        const machine = createMachine()
        const calls: unknown[] = []
        const engine = {
            getMachine: () => machine,
            gitCloneMachine: async (_machineId: string, options: unknown) => {
                calls.push(options)
                return { success: true }
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const response = await app.request('/api/machines/machine-1/git-clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: 'https://github.com/acme/repo.git',
                targetDir: '/workspace',
                targetName: 'repo',
                cloneId: VALID_UUID
            })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ success: true })
        expect(calls).toEqual([{
            url: 'https://github.com/acme/repo.git',
            targetDir: '/workspace',
            targetName: 'repo',
            destinationPath: undefined,
            branch: undefined,
            depth: undefined,
            cloneId: VALID_UUID,
            auth: undefined
        }])
    })

    it('does not leak thrown RPC error details from machine clone', async () => {
        const machine = createMachine()
        const engine = {
            getMachine: () => machine,
            gitCloneMachine: async () => {
                throw new Error('secret-token leaked in lower layer')
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)
        const originalConsoleError = console.error
        const logs: unknown[][] = []
        console.error = (...args: unknown[]) => {
            logs.push(args)
        }

        try {
            const response = await app.request('/api/machines/machine-1/git-clone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: 'https://github.com/acme/repo.git',
                    targetDir: '/workspace',
                    targetName: 'repo',
                    cloneId: VALID_UUID
                })
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body).toEqual({ success: false, error: 'Machine operation failed' })
            expect(JSON.stringify(body)).not.toContain('secret-token')
            expect(logs.length).toBe(1)
        } finally {
            console.error = originalConsoleError
        }
    })

    it('routes clone cancellation to machine RPC', async () => {
        const machine = createMachine()
        const calls: unknown[] = []
        const engine = {
            getMachine: () => machine,
            cancelGitCloneMachine: async (_machineId: string, request: unknown) => {
                calls.push(request)
                return { success: true }
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const response = await app.request(`/api/machines/machine-1/git-clone/${VALID_UUID}`, {
            method: 'DELETE'
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ success: true })
        expect(calls).toEqual([{ cloneId: VALID_UUID }])
    })
})
