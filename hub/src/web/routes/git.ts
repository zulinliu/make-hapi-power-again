import { Hono } from 'hono'
import { z } from 'zod'
import type { SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { requireSessionFromParam, requireSyncEngine } from './guards'
import { gitCloneGate, parseGitCloneCancelRequest, parseGitCloneRequest } from './gitCloneSafety'

const fileSearchSchema = z.object({
    query: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional()
})

const directorySchema = z.object({
    path: z.string().optional()
})

const filePathSchema = z.object({
    path: z.string().min(1)
})

const generatedImageSchema = z.object({
    imageId: z.string().min(1)
})

const gitSafeNameSchema = z.string()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z0-9._/-]+$/, 'Invalid git name')
    .refine((value) => !value.startsWith('-') && !value.includes('\0'), 'Invalid git name')

const gitSafeRefSchema = z.string()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z0-9._/@{}~^:-]+$/, 'Invalid git ref')
    .refine((value) => !value.startsWith('-') && !value.includes('\0') && !/\s/.test(value), 'Invalid git ref')

function hasAllowedGitRemoteUrlCredentials(url: string): boolean {
    if (url.startsWith('git@')) return /^git@[^:\s]+:.+/.test(url)

    try {
        const parsed = new URL(url)
        if (parsed.protocol === 'https:') {
            return parsed.username === '' && parsed.password === ''
        }
        if (parsed.protocol === 'ssh:') {
            return parsed.password === '' && (parsed.username === '' || parsed.username === 'git')
        }
        return false
    } catch {
        return false
    }
}

const gitRemoteUrlSchema = z.string()
    .trim()
    .min(1)
    .max(2048)
    .regex(/^(https:\/\/|ssh:\/\/|git@)/, 'Only https://, ssh://, and git@ URLs are allowed')
    .refine(hasAllowedGitRemoteUrlCredentials, 'URL must not contain embedded credentials')

const branchActionSchema = z.object({
    name: gitSafeRefSchema,
    action: z.enum(['switch', 'delete', 'merge']).optional()
})

const commitSchema = z.object({
    message: z.string().min(1).max(5000).regex(/^[^\0]*$/, 'Message contains null bytes'),
    paths: z.array(z.string().refine(p => !p.startsWith('-'), 'Path must not start with -')).optional()
})

const remoteAddSchema = z.object({
    name: gitSafeNameSchema,
    url: gitRemoteUrlSchema
})

const remoteRemoveSchema = z.object({
    name: gitSafeNameSchema
})

const gitPushSchema = z.object({
    remote: gitSafeNameSchema.optional(),
    branch: gitSafeRefSchema.optional(),
    force: z.boolean().optional()
}).strict()

const gitPullSchema = z.object({
    remote: gitSafeNameSchema.optional(),
    branch: gitSafeRefSchema.optional()
}).strict()

const gitFetchSchema = z.object({
    remote: gitSafeNameSchema.optional()
}).strict()

const writeFileSchema = z.object({
    path: z.string().min(1).regex(/^[^\0]*$/, 'Path contains null bytes'),
    content: z.string().max(5 * 1024 * 1024), // 5MB
    expectedHash: z.string().optional(),
    forceOverwrite: z.boolean().optional()
})

function parseBooleanParam(value: string | undefined): boolean | undefined {
    if (value === 'true') return true
    if (value === 'false') return false
    return undefined
}

async function runRpc<T>(fn: () => Promise<T>): Promise<T | { success: false; error: string }> {
    try {
        return await fn()
    } catch {
        console.error('[git-routes] Git operation failed')
        return { success: false, error: 'Git operation failed' }
    }
}

export function createGitRoutes(getSyncEngine: () => SyncEngine | null): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.get('/sessions/:id/git-status', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const result = await runRpc(() => engine.getGitStatus(sessionResult.sessionId, sessionPath))
        return c.json(result)
    })

    app.get('/sessions/:id/git-diff-numstat', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const staged = parseBooleanParam(c.req.query('staged'))
        const result = await runRpc(() => engine.getGitDiffNumstat(sessionResult.sessionId, { cwd: sessionPath, staged }))
        return c.json(result)
    })

    app.get('/sessions/:id/git-diff-file', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const parsed = filePathSchema.safeParse(c.req.query())
        if (!parsed.success) {
            return c.json({ error: 'Invalid file path' }, 400)
        }

        const staged = parseBooleanParam(c.req.query('staged'))
        const result = await runRpc(() => engine.getGitDiffFile(sessionResult.sessionId, {
            cwd: sessionPath,
            filePath: parsed.data.path,
            staged
        }))
        return c.json(result)
    })

    app.get('/sessions/:id/git-log', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const maxCount = Math.min(Math.max(parseInt(c.req.query('maxCount') ?? '50', 10) || 50, 1), 500)
        const result = await runRpc(() => engine.getGitLog(sessionResult.sessionId, { cwd: sessionPath, maxCount }))
        return c.json(result)
    })

    app.get('/sessions/:id/git-branches', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const result = await runRpc(() => engine.getGitBranchList(sessionResult.sessionId, sessionPath))
        return c.json(result)
    })

    app.post('/sessions/:id/git-branches', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const parsed = branchActionSchema.safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const { name, action } = parsed.data

        if (action === 'switch') {
            const result = await runRpc(() => engine.switchGitBranch(sessionResult.sessionId, { cwd: sessionPath, name }))
            return c.json(result)
        }

        if (action === 'delete') {
            const result = await runRpc(() => engine.deleteGitBranch(sessionResult.sessionId, { cwd: sessionPath, name }))
            return c.json(result)
        }

        if (action === 'merge') {
            const result = await runRpc(() => engine.mergeGitBranch(sessionResult.sessionId, { cwd: sessionPath, name }))
            return c.json(result)
        }

        const result = await runRpc(() => engine.createGitBranch(sessionResult.sessionId, { cwd: sessionPath, name }))
        return c.json(result)
    })

    app.post('/sessions/:id/git-commit', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const parsed = commitSchema.safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.createGitCommit(sessionResult.sessionId, {
            cwd: sessionPath,
            message: parsed.data.message,
            paths: parsed.data.paths
        }))
        return c.json(result)
    })

    // Git Clone
    app.post('/sessions/:id/git-clone', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const parsed = parseGitCloneRequest(await c.req.json().catch(() => null))
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error }, 400)

        const gate = gitCloneGate.start(`session:${sessionResult.sessionId}`, parsed.data.cloneId)
        if (!gate.ok) {
            return c.json({ success: false, error: gate.error }, gate.status)
        }

        try {
            const result = await runRpc(() => engine.gitClone(sessionResult.sessionId, {
                cwd: sessionPath,
                url: parsed.data.url,
                targetDir: parsed.data.targetDir,
                targetName: parsed.data.targetName,
                destinationPath: parsed.data.destinationPath,
                branch: parsed.data.branch,
                depth: parsed.data.depth,
                cloneId: parsed.data.cloneId,
                auth: parsed.data.auth
            }))
            return c.json(result)
        } finally {
            gate.release()
        }
    })

    app.delete('/sessions/:id/git-clone/:cloneId?', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const parsed = parseGitCloneCancelRequest(c.req.param('cloneId'), await c.req.json().catch(() => null))
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error }, 400)

        const result = await runRpc(() => engine.cancelGitClone(sessionResult.sessionId, parsed.data))
        return c.json(result)
    })

    // Git Remotes — List
    app.get('/sessions/:id/git-remotes', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const result = await runRpc(() => engine.getGitRemoteList(sessionResult.sessionId, sessionPath))
        return c.json(result)
    })

    // Git Remotes — Add
    app.post('/sessions/:id/git-remotes', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const parsed = remoteAddSchema.safeParse(await c.req.json())
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)

        const result = await runRpc(() => engine.addGitRemote(sessionResult.sessionId, {
            cwd: sessionPath,
            name: parsed.data.name,
            url: parsed.data.url
        }))
        return c.json(result)
    })

    // Git Remotes — Delete
    app.delete('/sessions/:id/git-remotes/:name', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const parsed = remoteRemoveSchema.safeParse(c.req.param())
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)

        const result = await runRpc(() => engine.removeGitRemote(sessionResult.sessionId, {
            cwd: sessionPath,
            name: parsed.data.name
        }))
        return c.json(result)
    })

    // Git Push
    app.post('/sessions/:id/git-push', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const parsed = gitPushSchema.safeParse(await c.req.json())
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)

        const result = await runRpc(() => engine.gitPush(sessionResult.sessionId, {
            cwd: sessionPath,
            remote: parsed.data.remote,
            branch: parsed.data.branch,
            force: parsed.data.force === true
        }))
        return c.json(result)
    })

    // Git Pull
    app.post('/sessions/:id/git-pull', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const parsed = gitPullSchema.safeParse(await c.req.json())
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)

        const result = await runRpc(() => engine.gitPull(sessionResult.sessionId, {
            cwd: sessionPath,
            remote: parsed.data.remote,
            branch: parsed.data.branch
        }))
        return c.json(result)
    })

    // Git Fetch
    app.post('/sessions/:id/git-fetch', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const parsed = gitFetchSchema.safeParse(await c.req.json())
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)

        const result = await runRpc(() => engine.gitFetch(sessionResult.sessionId, {
            cwd: sessionPath,
            remote: parsed.data.remote
        }))
        return c.json(result)
    })

    app.get('/sessions/:id/file', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const parsed = filePathSchema.safeParse(c.req.query())
        if (!parsed.success) {
            return c.json({ error: 'Invalid file path' }, 400)
        }

        const result = await runRpc(() => engine.readSessionFile(sessionResult.sessionId, parsed.data.path))
        return c.json(result)
    })

    app.put('/sessions/:id/file', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const parsed = writeFileSchema.safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.writeSessionFile(sessionResult.sessionId, parsed.data))
        return c.json(result)
    })

    app.get('/sessions/:id/generated-images/:imageId', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const parsed = generatedImageSchema.safeParse(c.req.param())
        if (!parsed.success) {
            return c.json({ error: 'Invalid generated image id' }, 400)
        }

        const result = await runRpc(() => engine.readGeneratedImage(sessionResult.sessionId, parsed.data.imageId))
        if (!result.success || !result.content) {
            return c.json({ success: false, error: result.error ?? 'Generated image not found' }, 404)
        }

        const bytes = Uint8Array.from(Buffer.from(result.content, 'base64'))
        return c.body(bytes, 200, {
            'Content-Type': result.mimeType ?? 'application/octet-stream',
            'Content-Disposition': `inline; filename="${encodeURIComponent(result.fileName ?? 'generated-image')}"`,
            'Cache-Control': 'no-store'
        })
    })

    app.get('/sessions/:id/files', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const parsed = fileSearchSchema.safeParse(c.req.query())
        if (!parsed.success) {
            return c.json({ error: 'Invalid query' }, 400)
        }

        const query = parsed.data.query?.trim() ?? ''
        const limit = parsed.data.limit ?? 200
        const args = ['--files']
        if (query) {
            args.push('--iglob', `*${query}*`)
        }

        const result = await runRpc(() => engine.runRipgrep(sessionResult.sessionId, args, sessionPath))
        if (!result.success) {
            return c.json({ success: false, error: result.error ?? 'Failed to list files' })
        }

        const stdout = result.stdout ?? ''
        const files = stdout
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .slice(0, limit)
            .map((fullPath) => {
                const parts = fullPath.split('/')
                const fileName = parts[parts.length - 1] || fullPath
                const filePath = parts.slice(0, -1).join('/')
                return {
                    fileName,
                    filePath,
                    fullPath,
                    fileType: 'file' as const
                }
            })

        return c.json({ success: true, files })
    })

    app.get('/sessions/:id/directory', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const parsed = directorySchema.safeParse(c.req.query())
        if (!parsed.success) {
            return c.json({ error: 'Invalid query' }, 400)
        }

        const path = parsed.data.path ?? ''
        const result = await runRpc(() => engine.listDirectory(sessionResult.sessionId, path))
        return c.json(result)
    })

    // --- File CRUD operations ---

    app.delete('/sessions/:id/file', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const parsed = z.object({
            path: z.string().min(1),
            recursive: z.boolean().optional()
        }).safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.deleteSessionFile(sessionResult.sessionId, parsed.data.path, parsed.data.recursive))
        return c.json(result)
    })

    app.post('/sessions/:id/rename', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const parsed = z.object({
            oldPath: z.string().min(1),
            newPath: z.string().min(1)
        }).safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.renameSessionFile(sessionResult.sessionId, parsed.data.oldPath, parsed.data.newPath))
        return c.json(result)
    })

    app.post('/sessions/:id/copy', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const parsed = z.object({
            sourcePath: z.string().min(1),
            destinationPath: z.string().min(1)
        }).safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.copySessionFile(sessionResult.sessionId, parsed.data.sourcePath, parsed.data.destinationPath))
        return c.json(result)
    })

    app.post('/sessions/:id/move', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const parsed = z.object({
            sourcePath: z.string().min(1),
            destinationPath: z.string().min(1)
        }).safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.moveSessionFile(sessionResult.sessionId, parsed.data.sourcePath, parsed.data.destinationPath))
        return c.json(result)
    })

    app.post('/sessions/:id/mkdir', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const parsed = z.object({
            path: z.string().min(1),
            recursive: z.boolean().optional()
        }).safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.createDirectory(sessionResult.sessionId, parsed.data.path, parsed.data.recursive))
        return c.json(result)
    })

    return app
}
