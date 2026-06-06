import { Hono } from 'hono'
import { z } from 'zod'
import type { SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { requireSessionFromParam, requireSyncEngine } from './guards'

const skillNameSchema = z.string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid skill name')

const skillRepoSchema = z.string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, 'Invalid repo format')

const skillInstallSchema = z.object({
    name: skillNameSchema,
    repo: skillRepoSchema,
    path: z.string().min(1).max(500).optional(),
})

function runRpc<T>(fn: () => Promise<T>): Promise<T | { success: false; error: string }> {
    return fn().catch((error) => ({ success: false as const, error: error instanceof Error ? error.message : String(error) }))
}

export function createSkillManagementRoutes(getSyncEngine: () => SyncEngine | null): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    // Search skills.sh — Hub proxies directly, no CLI agent required
    app.get('/sessions/:id/skills/search', async (c) => {
        const query = c.req.query('q') ?? ''
        if (!query || query.length < 2) {
            return c.json({ success: true, results: [], total: 0 })
        }

        const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), 50)
        try {
            const resp = await fetch(`https://skills.sh/api/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
                signal: AbortSignal.timeout(10_000),
            })
            if (!resp.ok) {
                return c.json({ success: false, error: `skills.sh returned ${resp.status}` })
            }
            const data = await resp.json() as {
                skills?: Array<{ id: string; skillId: string; name: string; installs?: number; source: string }>
                count?: number
            }
            const raw = data.skills ?? []
            const results = raw
                .filter(s => /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(s.source))
                .map(s => ({
                    name: s.skillId,
                    description: `${s.source}/${s.skillId}`,
                    repo: s.source,
                    stars: s.installs,
                }))
            return c.json({ success: true, results, total: results.length })
        } catch (err) {
            return c.json({ success: false, error: err instanceof Error ? err.message : 'Search failed' })
        }
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
