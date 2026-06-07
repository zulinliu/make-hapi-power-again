import {
    MachineListDirectoryRequestSchema,
    MachinePathsExistsRequestSchema,
    SpawnSessionRequestSchema
} from '@hapipower/protocol'
import { Hono } from 'hono'
import { z } from 'zod'
import type { SyncEngine } from '../../sync/syncEngine'
import type { Store } from '../../store'
import type { WebAppEnv } from '../middleware/auth'
import { requireMachine } from './guards'
import { decryptAES256GCM, getEncryptionKey } from '../../utils/crypto'

const machineFileQuerySchema = z.object({
    path: z.string().min(1)
})

const machineFileSearchSchema = z.object({
    path: z.string().min(1),
    query: z.string().optional(),
    mode: z.enum(['name', 'content']).optional().default('name'),
    limit: z.coerce.number().int().min(1).max(200).optional().default(100),
    showHidden: z.enum(['true', 'false']).optional()
})

const machineWriteFileSchema = z.object({
    path: z.string().min(1),
    content: z.string(),
    expectedHash: z.string().optional(),
    forceOverwrite: z.boolean().optional()
})

const machineDeleteFileSchema = z.object({
    path: z.string().min(1),
    recursive: z.boolean().optional()
})

const machineRenameFileSchema = z.object({
    oldPath: z.string().min(1),
    newPath: z.string().min(1)
})

const machineCopyMoveFileSchema = z.object({
    sourcePath: z.string().min(1),
    destinationPath: z.string().min(1)
})

const machineCreateDirectorySchema = z.object({
    path: z.string().min(1),
    recursive: z.boolean().optional()
})

type MachineFileSearchItem = {
    fileName: string
    filePath: string
    fullPath: string
    fileType: 'file' | 'folder'
}

function joinMachinePath(dirPath: string, name: string): string {
    const normalized = dirPath.replace(/[\\/]+$/, '')
    if (!normalized) return name
    return normalized === '/' ? `/${name}` : `${normalized}/${name}`
}

function splitMachinePath(path: string): { fileName: string; filePath: string } {
    const normalized = path.replace(/\\/g, '/')
    const index = normalized.lastIndexOf('/')
    if (index === -1) {
        return { fileName: path, filePath: '' }
    }
    return {
        fileName: normalized.slice(index + 1) || path,
        filePath: normalized.slice(0, index)
    }
}

async function searchMachineFiles(
    engine: SyncEngine,
    machineId: string,
    options: { path: string; query: string; mode: 'name' | 'content'; limit: number; showHidden: boolean }
): Promise<{ success: true; files: MachineFileSearchItem[] } | { success: false; error: string }> {
    const query = options.query.trim().toLowerCase()
    if (!query) return { success: true, files: [] }

    const files: MachineFileSearchItem[] = []
    const queue: string[] = [options.path]
    const visited = new Set<string>()
    const maxVisited = 3000
    const maxContentBytes = 1_000_000

    while (queue.length > 0 && files.length < options.limit && visited.size < maxVisited) {
        const current = queue.shift()
        if (!current || visited.has(current)) continue
        visited.add(current)

        const listing = await engine.listMachineDirectory(machineId, current, options.showHidden)
        if (!listing.success) {
            if (visited.size === 1) {
                return { success: false, error: listing.error ?? 'Failed to search files' }
            }
            continue
        }

        for (const entry of listing.entries ?? []) {
            if (files.length >= options.limit) break
            if (entry.type !== 'file' && entry.type !== 'directory') continue
            if (!options.showHidden && entry.name.startsWith('.')) continue

            const fullPath = joinMachinePath(current, entry.name)
            const { fileName, filePath } = splitMachinePath(fullPath)
            const fileType = entry.type === 'directory' ? 'folder' : 'file'

            if (options.mode === 'name' && entry.name.toLowerCase().includes(query)) {
                files.push({ fileName, filePath, fullPath, fileType })
            }

            if (entry.type === 'directory') {
                queue.push(fullPath)
                continue
            }

            if (options.mode === 'content') {
                if ((entry.size ?? 0) > maxContentBytes) continue
                const read = await engine.readMachineFile(machineId, fullPath)
                if (!read.success || !read.content) continue
                const content = Buffer.from(read.content, 'base64').toString('utf8').toLowerCase()
                if (content.includes(query)) {
                    files.push({ fileName, filePath, fullPath, fileType })
                }
            }
        }
    }

    return { success: true, files }
}

export function createMachinesRoutes(getSyncEngine: () => SyncEngine | null, store: Store): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.get('/machines', (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not connected' }, 503)
        }

        const namespace = c.get('namespace')
        const machines = engine.getOnlineMachinesByNamespace(namespace)
        return c.json({ machines })
    })

    app.post('/machines/:id/spawn', async (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not connected' }, 503)
        }

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) {
            return machine
        }

        const body = await c.req.json().catch(() => null)
        const parsed = SpawnSessionRequestSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        const result = await engine.spawnSession(
            machineId,
            parsed.data.directory,
            parsed.data.agent,
            parsed.data.model,
            parsed.data.modelReasoningEffort,
            parsed.data.yolo,
            parsed.data.sessionType,
            parsed.data.worktreeName,
            undefined,
            parsed.data.effort
        )

        if (result.type === 'success' && parsed.data.providerId) {
            try {
                const provider = store.providers.getById(parsed.data.providerId)
                if (provider) {
                    const key = getEncryptionKey()
                    const apiKey = decryptAES256GCM(provider.apiKeyEncrypted, key)
                    await engine.applySessionConfig(result.sessionId, {
                        model: parsed.data.model,
                        providerBaseUrl: provider.baseUrl,
                        providerApiKey: apiKey,
                    })
                }
            } catch {
                // Provider config is best-effort; session already created
            }
        }

        return c.json(result)
    })

    app.post('/machines/:id/list-directory', async (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not connected' }, 503)
        }

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) {
            return machine
        }

        const body = await c.req.json().catch(() => null)
        const parsed = MachineListDirectoryRequestSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        try {
            const result = await engine.listMachineDirectory(machineId, parsed.data.path, parsed.data.showHidden)
            return c.json(result)
        } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : 'Failed to list directory' }, 500)
        }
    })

    app.get('/machines/:id/files', async (c) => {
        const engine = getSyncEngine()
        if (!engine) return c.json({ error: 'Not connected' }, 503)

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) return machine

        const parsed = machineFileSearchSchema.safeParse(c.req.query())
        if (!parsed.success) {
            return c.json({ error: 'Invalid query', details: parsed.error.flatten() }, 400)
        }

        try {
            const result = await searchMachineFiles(engine, machineId, {
                path: parsed.data.path,
                query: parsed.data.query ?? '',
                mode: parsed.data.mode,
                limit: parsed.data.limit,
                showHidden: parsed.data.showHidden === 'true'
            })
            return c.json(result)
        } catch (error) {
            return c.json({ error: 'File operation failed' }, 500)
        }
    })

    app.get('/machines/:id/file', async (c) => {
        const engine = getSyncEngine()
        if (!engine) return c.json({ error: 'Not connected' }, 503)

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) return machine

        const parsed = machineFileQuerySchema.safeParse(c.req.query())
        if (!parsed.success) {
            return c.json({ error: 'Invalid query' }, 400)
        }

        try {
            return c.json(await engine.readMachineFile(machineId, parsed.data.path))
        } catch (error) {
            return c.json({ error: 'File operation failed' }, 500)
        }
    })

    app.put('/machines/:id/file', async (c) => {
        const engine = getSyncEngine()
        if (!engine) return c.json({ error: 'Not connected' }, 503)

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) return machine

        const parsed = machineWriteFileSchema.safeParse(await c.req.json().catch(() => null))
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        try {
            return c.json(await engine.writeMachineFile(machineId, parsed.data))
        } catch (error) {
            return c.json({ error: 'File operation failed' }, 500)
        }
    })

    app.delete('/machines/:id/file', async (c) => {
        const engine = getSyncEngine()
        if (!engine) return c.json({ error: 'Not connected' }, 503)

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) return machine

        const parsed = machineDeleteFileSchema.safeParse(await c.req.json().catch(() => null))
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        try {
            return c.json(await engine.deleteMachineFile(machineId, parsed.data.path, parsed.data.recursive))
        } catch (error) {
            return c.json({ error: 'File operation failed' }, 500)
        }
    })

    app.post('/machines/:id/rename', async (c) => {
        const engine = getSyncEngine()
        if (!engine) return c.json({ error: 'Not connected' }, 503)

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) return machine

        const parsed = machineRenameFileSchema.safeParse(await c.req.json().catch(() => null))
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        try {
            return c.json(await engine.renameMachineFile(machineId, parsed.data.oldPath, parsed.data.newPath))
        } catch (error) {
            return c.json({ error: 'File operation failed' }, 500)
        }
    })

    app.post('/machines/:id/copy', async (c) => {
        const engine = getSyncEngine()
        if (!engine) return c.json({ error: 'Not connected' }, 503)

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) return machine

        const parsed = machineCopyMoveFileSchema.safeParse(await c.req.json().catch(() => null))
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        try {
            return c.json(await engine.copyMachineFile(machineId, parsed.data.sourcePath, parsed.data.destinationPath))
        } catch (error) {
            return c.json({ error: 'File operation failed' }, 500)
        }
    })

    app.post('/machines/:id/move', async (c) => {
        const engine = getSyncEngine()
        if (!engine) return c.json({ error: 'Not connected' }, 503)

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) return machine

        const parsed = machineCopyMoveFileSchema.safeParse(await c.req.json().catch(() => null))
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        try {
            return c.json(await engine.moveMachineFile(machineId, parsed.data.sourcePath, parsed.data.destinationPath))
        } catch (error) {
            return c.json({ error: 'File operation failed' }, 500)
        }
    })

    app.post('/machines/:id/mkdir', async (c) => {
        const engine = getSyncEngine()
        if (!engine) return c.json({ error: 'Not connected' }, 503)

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) return machine

        const parsed = machineCreateDirectorySchema.safeParse(await c.req.json().catch(() => null))
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        try {
            return c.json(await engine.createMachineDirectory(machineId, parsed.data.path, parsed.data.recursive))
        } catch (error) {
            return c.json({ error: 'File operation failed' }, 500)
        }
    })

    app.post('/machines/:id/paths/exists', async (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not connected' }, 503)
        }

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) {
            return machine
        }

        const body = await c.req.json().catch(() => null)
        const parsed = MachinePathsExistsRequestSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        const uniquePaths = Array.from(new Set(parsed.data.paths.map((path) => path.trim()).filter(Boolean)))
        if (uniquePaths.length === 0) {
            return c.json({ exists: {} })
        }

        try {
            const exists = await engine.checkPathsExist(machineId, uniquePaths)
            return c.json({ exists })
        } catch (error) {
            return c.json({ error: error instanceof Error ? error.message : 'Failed to check paths' }, 500)
        }
    })

    app.get('/machines/:id/codex-models', async (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ success: false, error: 'Not connected' }, 503)
        }

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) {
            return machine
        }

        try {
            const result = await engine.listCodexModelsForMachine(machineId)
            return c.json(result)
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to list Codex models'
            }, 500)
        }
    })

    app.get('/machines/:id/opencode-models', async (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ success: false, error: 'Not connected' }, 503)
        }

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) {
            return machine
        }

        const cwd = (c.req.query('cwd') ?? '').trim()
        if (!cwd) {
            return c.json({ success: false, error: 'cwd query parameter is required' }, 400)
        }

        try {
            const result = await engine.listOpencodeModelsForCwd(machineId, cwd)
            return c.json(result)
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to list OpenCode models'
            }, 500)
        }
    })

    app.get('/machines/:id/cursor-models', async (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ success: false, error: 'Not connected' }, 503)
        }

        const machineId = c.req.param('id')
        const machine = requireMachine(c, engine, machineId)
        if (machine instanceof Response) {
            return machine
        }

        try {
            const result = await engine.listCursorModelsForMachine(machineId)
            return c.json(result)
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to list Cursor models'
            }, 500)
        }
    })

    return app
}
