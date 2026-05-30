import { Hono } from 'hono'
import { z } from 'zod'
import type { SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { requireSessionFromParam, requireSyncEngine } from './guards'

const pluginIdSchema = z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/, 'Invalid plugin ID')
const storageKeySchema = z.string().min(1).max(256).regex(/^[^\0]*$/, 'Key contains null bytes')

const pluginInstallSchema = z.object({
    pluginId: pluginIdSchema,
    sourceUrl: z.string().url().optional(),
    sourceType: z.enum(['registry', 'blob', 'url']).optional(),
})

const storageSetSchema = z.object({
    key: storageKeySchema,
    value: z.string().max(256 * 1024), // 256KB per value
})

function runRpc<T>(fn: () => Promise<T>): Promise<T | { success: false; error: string }> {
    return fn().catch((error) => ({ success: false as const, error: error instanceof Error ? error.message : String(error) }))
}

export function createPluginsRoutes(getSyncEngine: () => SyncEngine | null): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    // List all plugins for a session
    app.get('/sessions/:id/plugins', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const result = await runRpc(() => engine.pluginList(sessionResult.sessionId))
        return c.json(result)
    })

    // Install plugin
    app.post('/sessions/:id/plugins/install', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const parsed = pluginInstallSchema.safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.pluginInstall(sessionResult.sessionId, parsed.data))
        return c.json(result)
    })

    // Uninstall plugin
    app.delete('/sessions/:id/plugins/:pluginId', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const pluginId = c.req.param('pluginId')
        if (!pluginIdSchema.safeParse(pluginId).success) {
            return c.json({ error: 'Invalid plugin ID' }, 400)
        }

        const result = await runRpc(() => engine.pluginUninstall(sessionResult.sessionId, pluginId))
        return c.json(result)
    })

    // Storage: Get
    app.get('/sessions/:id/plugins/:pluginId/storage', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const pluginId = c.req.param('pluginId')
        if (!pluginIdSchema.safeParse(pluginId).success) {
            return c.json({ error: 'Invalid plugin ID' }, 400)
        }
        const key = c.req.query('key')
        if (!key) {
            const prefix = c.req.query('prefix') ?? ''
            const result = await runRpc(() => engine.pluginStorageList(sessionResult.sessionId, pluginId, prefix))
            return c.json(result)
        }

        const result = await runRpc(() => engine.pluginStorageGet(sessionResult.sessionId, pluginId, key))
        return c.json(result)
    })

    // Storage: Set
    app.put('/sessions/:id/plugins/:pluginId/storage', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const pluginId = c.req.param('pluginId')
        if (!pluginIdSchema.safeParse(pluginId).success) {
            return c.json({ error: 'Invalid plugin ID' }, 400)
        }
        const parsed = storageSetSchema.safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.pluginStorageSet(sessionResult.sessionId, pluginId, parsed.data.key, parsed.data.value))
        return c.json(result)
    })

    // Storage: Delete
    app.delete('/sessions/:id/plugins/:pluginId/storage', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const pluginId = c.req.param('pluginId')
        if (!pluginIdSchema.safeParse(pluginId).success) {
            return c.json({ error: 'Invalid plugin ID' }, 400)
        }
        const key = c.req.query('key')
        if (!key) {
            return c.json({ error: 'Missing key parameter' }, 400)
        }

        const result = await runRpc(() => engine.pluginStorageDelete(sessionResult.sessionId, pluginId, key))
        return c.json(result)
    })

    return app
}
