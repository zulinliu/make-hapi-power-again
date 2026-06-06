import { afterEach, describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import type { SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { createSkillManagementRoutes } from './skillManagement'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

function mockSkillsSearchResponse(skills: Array<{ skillId: string; source: string; installs?: number }> = [
    { skillId: 'skill-test', source: 'org/repo', installs: 12 }
]) {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ skills }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
    })) as unknown as typeof fetch
}

function mockSkillsSearchFailure(status = 500) {
    globalThis.fetch = mock(async () => new Response('failed', { status })) as unknown as typeof fetch
}


type SkillRouteBody = {
    success?: boolean
    results?: unknown[]
    total?: number
    error?: string
    skill?: {
        name?: string
        repo?: string
    }
    message?: string
}

async function readSkillRouteBody(response: Response): Promise<SkillRouteBody> {
    return await response.json() as SkillRouteBody
}

function createApp(engineOverrides?: Partial<SyncEngine>) {
    const skillInstall = async (_sid: string, options: { name: string; repo: string }) => ({
        success: true,
        skill: { name: options.name, repo: options.repo, installedAt: Date.now() }
    })
    const skillUninstall = async (_sid: string, name: string) => ({
        success: true,
        message: `Skill ${name} uninstalled`
    })

    const engine = {
        resolveSessionAccess: () => ({ ok: true as const, sessionId: 'session-1', session: { id: 'session-1', namespace: 'default', seq: 0, createdAt: Date.now(), updatedAt: Date.now(), active: false, activeAt: 0, metadata: null } }),
        skillInstall,
        skillUninstall,
        ...engineOverrides,
    } as unknown as Partial<SyncEngine>

    const getSyncEngine = () => engine as SyncEngine

    const app = new Hono<WebAppEnv>()
    app.use('*', async (c, next) => {
        c.set('namespace', 'default')
        await next()
    })
    app.route('/api', createSkillManagementRoutes(getSyncEngine))

    return { app, engine }
}

describe('skill management routes', () => {
    describe('GET /api/sessions/:id/skills/search', () => {
        it('searches skills with a query', async () => {
            mockSkillsSearchResponse()
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/search?q=test')

            expect(response.status).toBe(200)
            const body = await readSkillRouteBody(response)
            expect(body.success).toBe(true)
            expect(body.results).toHaveLength(1)
            expect(body.total).toBe(1)
        })

        it('returns empty results for short queries', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/search?q=a')

            expect(response.status).toBe(200)
            const body = await readSkillRouteBody(response)
            expect(body.success).toBe(true)
            expect(body.results).toEqual([])
            expect(body.total).toBe(0)
        })

        it('returns empty results when query is missing', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/search')

            expect(response.status).toBe(200)
            const body = await readSkillRouteBody(response)
            expect(body.success).toBe(true)
            expect(body.results).toEqual([])
            expect(body.total).toBe(0)
        })

        it('respects limit parameter', async () => {
            mockSkillsSearchResponse()
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/search?q=test&limit=10')

            expect(response.status).toBe(200)
            const body = await readSkillRouteBody(response)
            expect(body.success).toBe(true)
        })

        it('clamps limit to 1-50 range', async () => {
            mockSkillsSearchResponse()
            const { app } = createApp()

            // limit=0 should be clamped to 1
            const response = await app.request('/api/sessions/session-1/skills/search?q=test&limit=0')
            expect(response.status).toBe(200)
        })

        it('returns error when skills.sh fails', async () => {
            mockSkillsSearchFailure(503)
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/search?q=test')

            expect(response.status).toBe(200)
            const body = await readSkillRouteBody(response)
            expect(body.success).toBe(false)
            expect(body.error).toBe('skills.sh returned 503')
        })

        it('does not require a sync engine for marketplace search', async () => {
            mockSkillsSearchResponse()
            const getSyncEngine = () => null
            const app = new Hono<WebAppEnv>()
            app.use('*', async (c, next) => {
                c.set('namespace', 'default')
                await next()
            })
            app.route('/api', createSkillManagementRoutes(getSyncEngine))

            const response = await app.request('/api/sessions/session-1/skills/search?q=test')
            expect(response.status).toBe(200)
            const body = await readSkillRouteBody(response)
            expect(body.success).toBe(true)
            expect(body.results).toHaveLength(1)
        })
    })

    describe('POST /api/sessions/:id/skills/install', () => {
        it('installs a skill', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/install', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'my-skill', repo: 'org/my-skill-repo' })
            })

            expect(response.status).toBe(200)
            const body = await readSkillRouteBody(response)
            expect(body.success).toBe(true)
            expect(body.skill).toBeDefined()
            expect(body.skill?.name).toBe('my-skill')
            expect(body.skill?.repo).toBe('org/my-skill-repo')
        })

        it('accepts optional path parameter', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/install', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'my-skill', repo: 'org/repo', path: 'skills/my-skill' })
            })

            expect(response.status).toBe(200)
        })

        it('rejects invalid skill name', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/install', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'bad skill name!', repo: 'org/repo' })
            })

            expect(response.status).toBe(400)
            const body = await readSkillRouteBody(response)
            expect(body.error).toBe('Invalid request')
        })

        it('rejects invalid repo format', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/install', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'my-skill', repo: 'not-a-repo-format' })
            })

            expect(response.status).toBe(400)
        })

        it('rejects missing name', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/install', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ repo: 'org/repo' })
            })

            expect(response.status).toBe(400)
        })

        it('rejects missing repo', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/install', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'my-skill' })
            })

            expect(response.status).toBe(400)
        })

        it('returns error on rpc failure', async () => {
            const { app } = createApp({
                skillInstall: async () => { throw new Error('Install failed') }
            })

            const response = await app.request('/api/sessions/session-1/skills/install', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name: 'my-skill', repo: 'org/repo' })
            })

            expect(response.status).toBe(200)
            const body = await readSkillRouteBody(response)
            expect(body.success).toBe(false)
            expect(body.error).toBe('Install failed')
        })
    })

    describe('DELETE /api/sessions/:id/skills/:name', () => {
        it('uninstalls a skill', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/my-skill', {
                method: 'DELETE'
            })

            expect(response.status).toBe(200)
            const body = await readSkillRouteBody(response)
            expect(body.success).toBe(true)
            expect(body.message).toContain('my-skill')
        })

        it('rejects invalid skill name', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/bad%20skill%20name!', {
                method: 'DELETE'
            })

            expect(response.status).toBe(400)
            const body = await readSkillRouteBody(response)
            expect(body.error).toBe('Invalid skill name')
        })

        it('returns error on rpc failure', async () => {
            const { app } = createApp({
                skillUninstall: async () => { throw new Error('Uninstall failed') }
            })

            const response = await app.request('/api/sessions/session-1/skills/my-skill', {
                method: 'DELETE'
            })

            expect(response.status).toBe(200)
            const body = await readSkillRouteBody(response)
            expect(body.success).toBe(false)
            expect(body.error).toBe('Uninstall failed')
        })
    })
})
