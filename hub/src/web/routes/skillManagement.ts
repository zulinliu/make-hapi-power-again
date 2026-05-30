import { Hono } from 'hono'
import { z } from 'zod'
import type { SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { requireSessionFromParam, requireSyncEngine } from './guards'

const skillInstallSchema = z.object({
    name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid skill name'),
    repo: z.string().min(1).regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, 'Invalid repo format (expected owner/repo)'),
    path: z.string().optional(),
})

const skillNameSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid skill name')

function runRpc<T>(fn: () => Promise<T>): Promise<T | { success: false; error: string }> {
    return fn().catch((error) => ({ success: false as const, error: error instanceof Error ? error.message : String(error) }))
}

export function createSkillManagementRoutes(getSyncEngine: () => SyncEngine | null): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    // Search skills.sh
    app.get('/sessions/:id/skills/search', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const query = c.req.query('q') ?? ''
        if (!query || query.length < 2) {
            return c.json({ success: true, results: [], total: 0 })
        }

        const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 50)
        const result = await runRpc(() => engine.skillSearch(sessionResult.sessionId, query, limit))
        return c.json(result)
    })

    // Install skill
    app.post('/sessions/:id/skills/install', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const parsed = skillInstallSchema.safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.skillInstall(sessionResult.sessionId, parsed.data))
        return c.json(result)
    })

    // Uninstall skill
    app.delete('/sessions/:id/skills/:name', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const name = c.req.param('name')
        if (!skillNameSchema.safeParse(name).success) {
            return c.json({ error: 'Invalid skill name' }, 400)
        }

        const result = await runRpc(() => engine.skillUninstall(sessionResult.sessionId, name))
        return c.json(result)
    })

    return app
}
