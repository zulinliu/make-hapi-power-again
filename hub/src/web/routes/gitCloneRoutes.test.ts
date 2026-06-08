import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import type { GitAtlasDashboardResponse } from '@hapipower/protocol/apiTypes'
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

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((innerResolve) => {
        resolve = innerResolve
    })
    return { promise, resolve }
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
            body: JSON.stringify({
                remote: 'origin',
                branch: 'feat/v0.17.3',
                force: true,
                confirmation: 'feat/v0.17.3'
            })
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

    it('requires server-side confirmation for force push, branch delete, and remote delete', async () => {
        const session = createSession()
        const calls: string[] = []
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({ ok: true, sessionId, session: { ...session, namespace } }),
            gitPush: async () => {
                calls.push('push')
                return { success: true }
            },
            deleteGitBranch: async () => {
                calls.push('branch')
                return { success: true }
            },
            removeGitRemote: async () => {
                calls.push('remote')
                return { success: true }
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const push = await app.request('/api/sessions/session-1/git-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remote: 'origin', branch: 'main', force: true, confirmation: 'wrong' })
        })
        const branch = await app.request('/api/sessions/session-1/git-branches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'feature/work', action: 'delete' })
        })
        const remote = await app.request('/api/sessions/session-1/git-remotes/origin', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmation: 'wrong' })
        })

        expect(push.status).toBe(400)
        expect(branch.status).toBe(400)
        expect(remote.status).toBe(400)
        expect(calls).toEqual([])
    })

    it('returns a structured Git Atlas dashboard with sanitized remotes', async () => {
        const session = createSession()
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({ ok: true, sessionId, session: { ...session, namespace } }),
            getGitStatus: async () => ({
                success: true,
                stdout: [
                    '# branch.oid abcdef1234567890',
                    '# branch.head feat/v0.18.0',
                    '# branch.upstream origin/feat/v0.18.0',
                    '# branch.ab +2 -1',
                    '1 .M N... 100644 100644 100644 abc abc web/src/App.tsx',
                    '1 A. N... 000000 100644 100644 000 abc hub/src/new.ts',
                    '2 R. N... 100644 100644 100644 abc def R100 shared/src/new-name.ts\tshared/src/old-name.ts',
                    '? shared/src/new.ts'
                ].join('\n')
            }),
            getGitDiffNumstat: async (_sessionId: string, options: { staged?: boolean }) => ({
                success: true,
                stdout: options.staged ? '5\t0\thub/src/new.ts\n' : '10\t2\tweb/src/App.tsx\n1\t1\tshared/src/new-name.ts\n'
            }),
            getGitRemoteList: async () => ({
                success: true,
                stdout: 'origin\thttps://test-user:placeholder-value@git.internal.example.com/project/repo.git (fetch)\n'
            }),
            getGitLog: async () => ({
                success: true,
                stdout: '* abc1234 (HEAD -> feat/v0.18.0) 最近提交\n'
            })
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const response = await app.request('/api/sessions/session-1/git-dashboard')
        const body = await response.json() as GitAtlasDashboardResponse

        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.repo?.branch).toBe('feat/v0.18.0')
        expect(body.repo?.ahead).toBe(2)
        expect(body.repo?.behind).toBe(1)
        expect(body.summary?.totalChanges).toBe(4)
        expect(body.summary?.linesAdded).toBe(16)
        expect(body.summary?.linesRemoved).toBe(3)
        expect(body.remotes?.[0]?.url).toBe('https://***@git.internal.example.com/project/repo.git')
        expect(body.recommendation?.kind).toBe('review')
        expect(body.changes?.map((change: { path: string }) => change.path)).toEqual([
            'web/src/App.tsx',
            'hub/src/new.ts',
            'shared/src/new-name.ts',
            'shared/src/new.ts'
        ])
        expect(body.changes?.find((change: { path: string }) => change.path === 'shared/src/new-name.ts')).toMatchObject({
            oldPath: 'shared/src/old-name.ts',
            status: 'renamed'
        })
    })

    it('fails the Git Atlas dashboard when helper RPCs fail', async () => {
        const session = createSession()
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({ ok: true, sessionId, session: { ...session, namespace } }),
            getGitStatus: async () => ({
                success: true,
                stdout: '# branch.head feat/v0.18.0\n# branch.ab +0 -0\n'
            }),
            getGitDiffNumstat: async () => ({
                success: false,
                stderr: 'fatal: https://test-user:placeholder-value@git.internal.example.com/repo.git failed'
            }),
            getGitRemoteList: async () => ({ success: true, stdout: '' }),
            getGitLog: async () => ({ success: true, stdout: '' })
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const response = await app.request('/api/sessions/session-1/git-dashboard')
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body).toEqual({
            success: false,
            error: 'fatal: https://***@git.internal.example.com/repo.git failed'
        })
    })

    it('forwards Commit Basket selected paths to the commit RPC', async () => {
        const session = createSession()
        const calls: unknown[] = []
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({ ok: true, sessionId, session: { ...session, namespace } }),
            createGitCommit: async (_sessionId: string, options: unknown) => {
                calls.push(options)
                return { success: true, stdout: '[main abc1234] 提交选中文件' }
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const response = await app.request('/api/sessions/session-1/git-commit-basket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: '提交选中文件',
                paths: ['web/src/App.tsx', 'hub/src/routes.ts']
            })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            success: true,
            stdout: '[main abc1234] 提交选中文件',
            committedPaths: ['web/src/App.tsx', 'hub/src/routes.ts']
        })
        expect(calls).toEqual([{
            cwd: '/workspace/project',
            message: '提交选中文件',
            paths: ['web/src/App.tsx', 'hub/src/routes.ts']
        }])
    })

    it('rejects non-literal Commit Basket pathspecs before RPC dispatch', async () => {
        const session = createSession()
        let called = false
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({ ok: true, sessionId, session: { ...session, namespace } }),
            createGitCommit: async () => {
                called = true
                return { success: true }
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const globResponse = await app.request('/api/sessions/session-1/git-commit-basket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: '提交选中文件', paths: ['*.txt'] })
        })
        const magicResponse = await app.request('/api/sessions/session-1/git-commit-basket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: '提交选中文件', paths: [':(top)**'] })
        })

        expect(globResponse.status).toBe(400)
        expect(magicResponse.status).toBe(400)
        expect(called).toBe(false)
    })

    it('uses an in-flight lock for Git sync actions', async () => {
        const session = createSession()
        const pending = deferred<{ success: true; stdout: string }>()
        let calls = 0
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({ ok: true, sessionId, session: { ...session, namespace } }),
            gitFetch: async () => {
                calls++
                return await pending.promise
            }
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const first = app.request('/api/sessions/session-1/git-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'fetch', remote: 'origin' })
        })
        const second = await app.request('/api/sessions/session-1/git-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'fetch', remote: 'origin' })
        })

        expect(second.status).toBe(409)
        expect(await second.json()).toEqual({ success: false, error: 'Git sync already in progress' })
        pending.resolve({ success: true, stdout: 'done' })
        expect(await (await first).json()).toEqual({
            success: true,
            stdout: 'done',
            stderr: '',
            action: 'fetch',
            remote: 'origin'
        })
        expect(calls).toBe(1)
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

    it('sanitizes legacy git remote and sync endpoint command responses', async () => {
        const session = createSession()
        const engine = {
            resolveSessionAccess: (sessionId: string, namespace: string) => ({ ok: true, sessionId, session: { ...session, namespace } }),
            getGitRemoteList: async () => ({
                success: true,
                stdout: 'origin\thttps://test-user:placeholder-value@git.internal.example.com/project/repo.git (fetch)\n'
            }),
            gitPush: async () => ({
                success: false,
                error: 'fatal: https://test-user:placeholder-value@git.internal.example.com/project/repo.git rejected',
                stderr: 'fatal: https://test-user:placeholder-value@git.internal.example.com/project/repo.git rejected'
            }),
            gitPull: async () => ({
                success: false,
                stderr: 'fatal: https://test-user:placeholder-value@git.internal.example.com/project/repo.git rejected'
            }),
            gitFetch: async () => ({
                success: true,
                stdout: 'From https://test-user:placeholder-value@git.internal.example.com/project/repo.git'
            })
        } as Partial<SyncEngine>
        const app = createApp(engine)

        const remotes = await app.request('/api/sessions/session-1/git-remotes')
        const push = await app.request('/api/sessions/session-1/git-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remote: 'origin', branch: 'main' })
        })
        const pull = await app.request('/api/sessions/session-1/git-pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remote: 'origin', branch: 'main' })
        })
        const fetch = await app.request('/api/sessions/session-1/git-fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remote: 'origin' })
        })

        expect(await remotes.json()).toEqual({
            success: true,
            stdout: 'origin\thttps://***@git.internal.example.com/project/repo.git (fetch)\n'
        })
        expect(await push.json()).toEqual({
            success: false,
            error: 'fatal: https://***@git.internal.example.com/project/repo.git rejected',
            stderr: 'fatal: https://***@git.internal.example.com/project/repo.git rejected'
        })
        expect(await pull.json()).toEqual({
            success: false,
            stderr: 'fatal: https://***@git.internal.example.com/project/repo.git rejected'
        })
        expect(await fetch.json()).toEqual({
            success: true,
            stdout: 'From https://***@git.internal.example.com/project/repo.git'
        })
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
