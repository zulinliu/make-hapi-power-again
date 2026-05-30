import { Hono } from 'hono'
import { z } from 'zod'
import type { Store } from '../../store'
import type { WebAppEnv } from '../middleware/auth'
import { requireSessionFromParam, requireSyncEngine } from './guards'
import type { SyncEngine } from '../../sync/syncEngine'

const undoScopeSchema = z.enum(['session', 'step', 'file'])
const undoTargetSchema = z.object({
    scope: undoScopeSchema,
    stepSeq: z.number().int().min(0).optional(),
    filePath: z.string().min(1).optional(),
    expectedMaxSeq: z.number().int().min(0).optional(),
})

interface UndoPreview {
    scope: 'session' | 'step' | 'file'
    affectedFiles: Array<{
        filePath: string
        changeType: 'created' | 'modified' | 'deleted'
        canRevert: boolean
        reason?: string
    }>
    totalSnapshots: number
    currentMaxSeq: number
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function extractFileChangesFromMessages(
    messages: Array<{ id: string; content: unknown; createdAt: number; seq: number }>,
    scope: 'session' | 'step' | 'file',
    options?: { stepSeq?: number; filePath?: string }
): Map<string, { filePath: string; changeType: 'created' | 'modified' | 'deleted'; seq: number }> {
    const changes = new Map<string, { filePath: string; changeType: 'created' | 'modified' | 'deleted'; seq: number }>()

    for (const msg of messages) {
        const content = msg.content
        if (!isRecord(content)) continue
        const role = typeof content.role === 'string' ? content.role : undefined
        const type = typeof content.type === 'string' ? content.type : undefined

        if (role !== 'assistant' || type !== 'tool_use') continue

        if (scope === 'step' && options?.stepSeq !== undefined && msg.seq > options.stepSeq) continue

        const toolName = typeof content.name === 'string' ? content.name : ''
        const toolInput = isRecord(content.input) ? content.input : {}

        if (toolName === 'writeFile' || toolName === 'editFile') {
            const filePath = typeof toolInput.path === 'string' ? toolInput.path : ''
            if (!filePath) continue

            if (scope === 'file' && options?.filePath && filePath !== options.filePath) continue

            const existing = changes.get(filePath)
            if (existing) {
                changes.set(filePath, { ...existing, changeType: 'modified', seq: msg.seq })
            } else {
                changes.set(filePath, { filePath, changeType: 'created', seq: msg.seq })
            }
        }

        if (toolName === 'deleteFile') {
            const filePath = typeof toolInput.path === 'string' ? toolInput.path : ''
            if (!filePath) continue
            if (scope === 'file' && options?.filePath && filePath !== options.filePath) continue
            changes.set(filePath, { filePath, changeType: 'deleted', seq: msg.seq })
        }
    }

    return changes
}

export function createUndoRoutes(
    getSyncEngine: () => SyncEngine | null,
    store: Store
): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    // Preview undo impact
    app.post('/sessions/:id/undo/preview', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const body = await c.req.json()
        const parsed = undoTargetSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const { scope, stepSeq, filePath } = parsed.data
        const messages = store.messages.getMessages(sessionResult.sessionId, 200)
        const changes = extractFileChangesFromMessages(
            messages as Array<{ id: string; content: unknown; createdAt: number; seq: number }>,
            scope,
            { stepSeq, filePath }
        )

        const affectedFiles: UndoPreview['affectedFiles'] = []
        for (const [path, change] of changes) {
            const latestSnapshot = store.fileSnapshots.getLatestSnapshot(sessionResult.sessionId, path)
            affectedFiles.push({
                filePath: path,
                changeType: change.changeType,
                canRevert: change.changeType === 'modified' ? latestSnapshot !== null : change.changeType === 'created',
                reason: change.changeType === 'modified' && !latestSnapshot ? '无快照可恢复' : undefined,
            })
        }

        const totalSnapshots = store.fileSnapshots.getSnapshotsForSession(sessionResult.sessionId, 1000).length

        const maxSeqMsg = messages.length > 0 ? messages[messages.length - 1] : null
        const currentMaxSeq = maxSeqMsg && 'seq' in maxSeqMsg ? (maxSeqMsg as { seq: number }).seq : 0

        return c.json({
            success: true,
            preview: {
                scope,
                affectedFiles,
                totalSnapshots,
                currentMaxSeq,
            } satisfies UndoPreview,
        })
    })

    // Execute undo — marks affected files as reverted via snapshot metadata
    app.post('/sessions/:id/undo/execute', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const body = await c.req.json()
        const parsed = undoTargetSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const { scope, stepSeq, filePath, expectedMaxSeq } = parsed.data
        const messages = store.messages.getMessages(sessionResult.sessionId, 200)

        // Validate seq to detect stale preview
        if (expectedMaxSeq !== undefined) {
            const maxSeqMsg = messages.length > 0 ? messages[messages.length - 1] : null
            const currentMaxSeq = maxSeqMsg && 'seq' in maxSeqMsg ? (maxSeqMsg as { seq: number }).seq : 0
            if (currentMaxSeq > expectedMaxSeq) {
                return c.json({ error: '会话在预览后已有新消息，请重新预览' }, 409)
            }
        }

        const changes = extractFileChangesFromMessages(
            messages as Array<{ id: string; content: unknown; createdAt: number; seq: number }>,
            scope,
            { stepSeq, filePath }
        )

        const revertedFiles: string[] = []
        const skippedFiles: string[] = []

        for (const [path, change] of changes) {
            if (change.changeType === 'created') {
                // For created files, mark as undo checkpoint
                store.fileSnapshots.createSnapshot(
                    sessionResult.sessionId,
                    path,
                    'undo-created',
                    'undo',
                    'default'
                )
                revertedFiles.push(path)
            } else if (change.changeType === 'modified') {
                const latestSnapshot = store.fileSnapshots.getLatestSnapshot(sessionResult.sessionId, path)
                if (latestSnapshot) {
                    store.fileSnapshots.createSnapshot(
                        sessionResult.sessionId,
                        path,
                        `undo-from:${latestSnapshot.contentHash}`,
                        'undo',
                        'default'
                    )
                    revertedFiles.push(path)
                } else {
                    skippedFiles.push(path)
                }
            } else if (change.changeType === 'deleted') {
                store.fileSnapshots.createSnapshot(
                    sessionResult.sessionId,
                    path,
                    'undo-deleted',
                    'undo',
                    'default'
                )
                revertedFiles.push(path)
            }
        }

        return c.json({
            success: true,
            result: {
                scope,
                revertedFiles,
                skippedFiles,
                revertedAt: Date.now(),
                status: 'marked_for_restore' as const,
                message: '文件已标记为待恢复。实际恢复需由代理执行。',
            },
        })
    })

    // Get file snapshots for a session
    app.get('/sessions/:id/snapshots', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const limitSchema = z.coerce.number().int().min(1).max(200).default(50)
        const limit = limitSchema.parse(c.req.query('limit') ?? '50')

        const snapshots = store.fileSnapshots.getSnapshotsForSession(sessionResult.sessionId, limit)

        return c.json({
            success: true,
            snapshots: snapshots.map(s => ({
                id: s.id,
                filePath: s.filePath,
                contentHash: s.contentHash,
                snapshotType: s.snapshotType,
                createdAt: s.createdAt,
            })),
        })
    })

    return app
}
