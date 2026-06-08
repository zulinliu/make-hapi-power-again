import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import type { Session, SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { createGitRoutes } from './git'

const VALID_UUID = '11111111-1111-4111-8111-111111111111'

function createSession(overrides?: Partial<Session>): Session {
    const now = Date.now()
    return {
        id: 'session-1',
        namespace: 'default',
        seq: 1,
        createdAt: now,
        updatedAt: now,
        active: true,
        activeAt: now,
        metadata: {
            path: '/workspace/project',
            host: 'test-host'
        },
        metadataVersion: 1,
        agentState: null,
        agentStateVersion: 1,
        thinking: false,
        thinkingAt: now,
        model: null,
        modelReasoningEffort: null,
        effort: null,
        ...overrides
    }
}

function createApp(engine: Partial<SyncEngine>): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()
    app.use('*', async (c, next) => {
        c.set('namespace', 'default')
        await next()
    })
    app.route('/api', createGitRoutes(() => engine as SyncEngine))
    return app
}

describe('git clone session routes', () => {
    it('forwards parent targetDir, targetName and cloneId to session RPC', async () => {
        const session = createSession()
        const calls: unknown[] = []
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({ ok: true, sessionId, session: { ...session, namespace } }),
            gitClone: async (_sessionId: string, options: unknown) => {
                calls.push(options)
                return { success: true }
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const response = await app.request('/api/sessions/session-1/git-clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: 'https://github.com/acme/repo.git',
                targetDir: '/workspace/project',
                targetName: 'repo',
                cloneId: VALID_UUID
            })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ success: true })
        expect(calls).toEqual([{
            cwd: '/workspace/project',
            url: 'https://github.com/acme/repo.git',
            targetDir: '/workspace/project',
            targetName: 'repo',
            destinationPath: undefined,
            branch: undefined,
            depth: undefined,
            cloneId: VALID_UUID,
            auth: undefined
        }])
    })

    it('rejects clone requests without cloneId before RPC dispatch', async () => {
        const session = createSession()
        let called = false
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({ ok: true, sessionId, session: { ...session, namespace } }),
            gitClone: async () => {
                called = true
                return { success: true }
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const response = await app.request('/api/sessions/session-1/git-clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: 'https://github.com/acme/repo.git',
                targetDir: '/workspace/project'
            })
        })

        expect(response.status).toBe(400)
        expect(called).toBe(false)
    })

    it('routes clone cancellation to session RPC', async () => {
        const session = createSession()
        const calls: unknown[] = []
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({ ok: true, sessionId, session: { ...session, namespace } }),
            cancelGitClone: async (_sessionId: string, request: unknown) => {
                calls.push(request)
                return { success: true }
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const response = await app.request(`/api/sessions/session-1/git-clone/${VALID_UUID}`, {
            method: 'DELETE'
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ success: true })
        expect(calls).toEqual([{ cloneId: VALID_UUID }])
    })
})


describe('git session route security validation', () => {
    it('rejects push, pull, and fetch argument injection before RPC dispatch', async () => {
        const session = createSession()
        const calls: string[] = []
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({ ok: true, sessionId, session: { ...session, namespace } }),
            gitPush: async () => {
                calls.push('push')
                return { success: true }
            },
            gitPull: async () => {
                calls.push('pull')
                return { success: true }
            },
            gitFetch: async () => {
                calls.push('fetch')
                return { success: true }
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const push = await app.request('/api/sessions/session-1/git-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remote: '--upload-pack=/tmp/pwn', branch: 'main' })
        })
        const pull = await app.request('/api/sessions/session-1/git-pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remote: 'origin', branch: '--force' })
        })
        const fetch = await app.request('/api/sessions/session-1/git-fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remote: '--exec=evil' })
        })

        expect(push.status).toBe(400)
        expect(pull.status).toBe(400)
        expect(fetch.status).toBe(400)
        expect(calls).toEqual([])
    })

    it('forwards validated push, pull, and fetch payloads', async () => {
        const session = createSession()
        const calls: unknown[] = []
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({ ok: true, sessionId, session: { ...session, namespace } }),
            gitPush: async (_sessionId: string, options: unknown) => {
                calls.push({ method: 'push', options })
                return { success: true }
            },
            gitPull: async (_sessionId: string, options: unknown) => {
                calls.push({ method: 'pull', options })
                return { success: true }
            },
            gitFetch: async (_sessionId: string, options: unknown) => {
                calls.push({ method: 'fetch', options })
                return { success: true }
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        await app.request('/api/sessions/session-1/git-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remote: 'origin', branch: 'feat/v0.17.3', force: true })
        })
        await app.request('/api/sessions/session-1/git-pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remote: 'origin', branch: 'main' })
        })
        await app.request('/api/sessions/session-1/git-fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remote: 'origin' })
        })

        expect(calls).toEqual([
            { method: 'push', options: { cwd: '/workspace/project', remote: 'origin', branch: 'feat/v0.17.3', force: true } },
            { method: 'pull', options: { cwd: '/workspace/project', remote: 'origin', branch: 'main' } },
            { method: 'fetch', options: { cwd: '/workspace/project', remote: 'origin' } }
        ])
    })

    it('rejects unsafe remote add URLs before RPC dispatch', async () => {
        const session = createSession()
        let called = false
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({ ok: true, sessionId, session: { ...session, namespace } }),
            addGitRemote: async () => {
                called = true
                return { success: true }
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const fileResponse = await app.request('/api/sessions/session-1/git-remotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'origin', url: 'file:///tmp/repo.git' })
        })
        const credentialsResponse = await app.request('/api/sessions/session-1/git-remotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'origin', url: 'https://user:pass@example.com/repo.git' })
        })

        expect(fileResponse.status).toBe(400)
        expect(credentialsResponse.status).toBe(400)
        expect(called).toBe(false)
    })

    it('sanitizes thrown RPC errors from git routes', async () => {
        const session = createSession()
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({ ok: true, sessionId, session: { ...session, namespace } }),
            gitFetch: async () => {
                throw new Error('/secret/internal/path leaked')
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const response = await app.request('/api/sessions/session-1/git-fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remote: 'origin' })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ success: false, error: 'Git operation failed' })
    })
})
