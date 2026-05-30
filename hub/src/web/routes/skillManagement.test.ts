import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import type { SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { createSkillManagementRoutes } from './skillManagement'

function createApp(engineOverrides?: Partial<SyncEngine>) {
    const skillSearch = async (_sid: string, query: string, _limit?: number) => ({
        success: true,
        results: [
            { name: `skill-${query}`, description: `A skill matching ${query}`, repo: 'org/repo' }
        ],
        total: 1
    })
    const skillInstall = async (_sid: string, options: { name: string; repo: string }) => ({
        success: true,
        skill: { name: options.name, repo: options.repo, installedAt: Date.now() }
    })
    const skillUninstall = async (_sid: string, name: string) => ({
        success: true,
        message: `Skill ${name} uninstalled`
    })

    const engine = {
        resolveSessionAccess: () => ({ ok: true, sessionId: 'session-1', session: { id: 'session-1' } }),
        skillSearch,
        skillInstall,
        skillUninstall,
        ...engineOverrides,
    } as Partial<SyncEngine>

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
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/search?q=test')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.results).toHaveLength(1)
            expect(body.total).toBe(1)
        })

        it('returns empty results for short queries', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/search?q=a')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.results).toEqual([])
            expect(body.total).toBe(0)
        })

        it('returns empty results when query is missing', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/search')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.results).toEqual([])
            expect(body.total).toBe(0)
        })

        it('respects limit parameter', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/search?q=test&limit=10')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
        })

        it('clamps limit to 1-50 range', async () => {
            const { app } = createApp()

            // limit=0 should be clamped to 1
            const response = await app.request('/api/sessions/session-1/skills/search?q=test&limit=0')
            expect(response.status).toBe(200)
        })

        it('returns error on rpc failure', async () => {
            const { app } = createApp({
                skillSearch: async () => { throw new Error('Search failed') }
            })

            const response = await app.request('/api/sessions/session-1/skills/search?q=test')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(false)
            expect(body.error).toBe('Search failed')
        })

        it('returns 503 when sync engine is unavailable', async () => {
            const getSyncEngine = () => null
            const app = new Hono<WebAppEnv>()
            app.use('*', async (c, next) => {
                c.set('namespace', 'default')
                await next()
            })
            app.route('/api', createSkillManagementRoutes(getSyncEngine))

            const response = await app.request('/api/sessions/session-1/skills/search?q=test')
            expect(response.status).toBe(503)
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
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.skill.name).toBe('my-skill')
            expect(body.skill.repo).toBe('org/my-skill-repo')
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
            const body = await response.json()
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
            const body = await response.json()
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
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.message).toContain('my-skill')
        })

        it('rejects invalid skill name', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/skills/bad%20skill%20name!', {
                method: 'DELETE'
            })

            expect(response.status).toBe(400)
            const body = await response.json()
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
            const body = await response.json()
            expect(body.success).toBe(false)
            expect(body.error).toBe('Uninstall failed')
        })
    })
})
