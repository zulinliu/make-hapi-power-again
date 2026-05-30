import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from 'bun:sqlite'
import type { Store } from '../../store'
import type { WebAppEnv } from '../middleware/auth'
import { requireSessionFromParam, requireSyncEngine } from './guards'
import type { SyncEngine } from '../../sync/syncEngine'
import { createHash } from 'crypto'

const reviewActionSchema = z.enum(['approved', 'rejected'])
const changeIdSchema = z.string().regex(/^[a-f0-9]{12}$/, 'Invalid change ID format')
const statusFilterSchema = z.enum(['pending', 'approved', 'rejected']).optional()

interface FileChange {
    id: string
    filePath: string
    changeType: 'created' | 'modified' | 'deleted'
    beforeContent: string | null
    afterContent: string | null
    reviewStatus: 'pending' | 'approved' | 'rejected'
    reviewedAt: number | null
    timestamp: number
    messageId: string
}

interface ChangeGroup {
    id: string
    changes: FileChange[]
    summary: string
    agentDescription: string | null
    createdAt: number
}

// Persisted review store backed by SQLite
class ReviewStore {
    constructor(private readonly db: Database) {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS change_reviews (
                session_id TEXT NOT NULL,
                change_id TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
                reviewed_at INTEGER,
                PRIMARY KEY (session_id, change_id)
            )
        `)
    }

    getReview(sessionId: string, changeId: string): { status: 'pending' | 'approved' | 'rejected'; reviewedAt: number | null } | null {
        const row = this.db.prepare(
            'SELECT status, reviewed_at FROM change_reviews WHERE session_id = ? AND change_id = ?'
        ).get(sessionId, changeId) as { status: string; reviewed_at: number | null } | undefined
        if (!row) return null
        return { status: row.status as 'pending' | 'approved' | 'rejected', reviewedAt: row.reviewed_at }
    }

    setReview(sessionId: string, changeId: string, status: 'approved' | 'rejected', reviewedAt: number): void {
        this.db.prepare(
            `INSERT INTO change_reviews (session_id, change_id, status, reviewed_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(session_id, change_id) DO UPDATE SET status = excluded.status, reviewed_at = excluded.reviewed_at`
        ).run(sessionId, changeId, status, reviewedAt)
    }

    getAllReviews(sessionId: string): Map<string, { status: 'pending' | 'approved' | 'rejected'; reviewedAt: number | null }> {
        const rows = this.db.prepare(
            'SELECT change_id, status, reviewed_at FROM change_reviews WHERE session_id = ?'
        ).all(sessionId) as Array<{ change_id: string; status: string; reviewed_at: number | null }>
        const map = new Map<string, { status: 'pending' | 'approved' | 'rejected'; reviewedAt: number | null }>()
        for (const row of rows) {
            map.set(row.change_id, { status: row.status as 'pending' | 'approved' | 'rejected', reviewedAt: row.reviewed_at })
        }
        return map
    }
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function extractChangesFromMessages(messages: Array<{ id: string; content: unknown; createdAt: number; seq: number }>): ChangeGroup[] {
    const groups: ChangeGroup[] = []
    let currentGroup: Map<string, FileChange> = new Map()
    let currentGroupId = ''
    let currentGroupTime = 0
    let currentAgentDescription: string | null = null

    for (const msg of messages) {
        const content = msg.content
        if (!isRecord(content)) continue

        const role = typeof content.role === 'string' ? content.role : undefined
        const type = typeof content.type === 'string' ? content.type : undefined

        if (role === 'assistant' && type === 'text') {
            if (currentGroup.size > 0) {
                groups.push({
                    id: currentGroupId,
                    changes: Array.from(currentGroup.values()),
                    summary: summarizeChanges(Array.from(currentGroup.values())),
                    agentDescription: currentAgentDescription,
                    createdAt: currentGroupTime,
                })
            }
            currentGroup = new Map()
            currentGroupId = msg.id
            currentGroupTime = msg.createdAt
            currentAgentDescription = typeof content.content === 'string' ? content.content.slice(0, 200) : null
            continue
        }

        if (role === 'assistant' && type === 'tool_use') {
            const toolName = typeof content.name === 'string' ? content.name : ''
            const toolInput = isRecord(content.input) ? content.input : undefined

            if (toolName === 'writeFile' && toolInput) {
                const filePath = typeof toolInput.path === 'string' ? toolInput.path : ''
                if (!filePath) continue

                const contentStr = typeof toolInput.content === 'string' ? toolInput.content : ''
                const decoded = contentStr ? Buffer.from(contentStr, 'base64').toString('utf-8') : ''

                const existing = currentGroup.get(filePath)
                if (existing) {
                    currentGroup.set(filePath, {
                        ...existing,
                        afterContent: decoded,
                        changeType: 'modified',
                        timestamp: msg.createdAt,
                        messageId: msg.id,
                    })
                } else {
                    currentGroup.set(filePath, {
                        id: createHash('md5').update(`${msg.id}:${filePath}`).digest('hex').slice(0, 12),
                        filePath,
                        changeType: 'created',
                        beforeContent: null,
                        afterContent: decoded,
                        reviewStatus: 'pending',
                        reviewedAt: null,
                        timestamp: msg.createdAt,
                        messageId: msg.id,
                    })
                }
            }

            if (toolName === 'editFile' && toolInput) {
                const filePath = typeof toolInput.path === 'string' ? toolInput.path : ''
                if (!filePath) continue

                const oldStr = typeof toolInput.old_string === 'string' ? toolInput.old_string : undefined
                const newStr = typeof toolInput.new_string === 'string' ? toolInput.new_string : undefined

                const existing = currentGroup.get(filePath)
                if (existing) {
                    // Best-effort edit accumulation: replace first occurrence.
                    // For multiple edits to the same file in one turn, the last
                    // edit's content becomes the final state — this is sufficient
                    // for review UI display purposes.
                    let updatedContent = existing.afterContent
                    if (updatedContent && oldStr && newStr) {
                        updatedContent = updatedContent.replace(oldStr, newStr)
                    }
                    currentGroup.set(filePath, {
                        ...existing,
                        afterContent: updatedContent,
                        changeType: 'modified',
                        timestamp: msg.createdAt,
                        messageId: msg.id,
                    })
                } else {
                    currentGroup.set(filePath, {
                        id: createHash('md5').update(`${msg.id}:${filePath}`).digest('hex').slice(0, 12),
                        filePath,
                        changeType: 'modified',
                        beforeContent: oldStr ?? null,
                        afterContent: newStr ?? null,
                        reviewStatus: 'pending',
                        reviewedAt: null,
                        timestamp: msg.createdAt,
                        messageId: msg.id,
                    })
                }
            }
        }
    }

    if (currentGroup.size > 0) {
        groups.push({
            id: currentGroupId,
            changes: Array.from(currentGroup.values()),
            summary: summarizeChanges(Array.from(currentGroup.values())),
            agentDescription: currentAgentDescription,
            createdAt: currentGroupTime,
        })
    }

    return groups.reverse()
}

function summarizeChanges(changes: FileChange[]): string {
    const created = changes.filter(c => c.changeType === 'created').length
    const modified = changes.filter(c => c.changeType === 'modified').length
    const deleted = changes.filter(c => c.changeType === 'deleted').length
    const parts: string[] = []
    if (created > 0) parts.push(`新建 ${created} 个文件`)
    if (modified > 0) parts.push(`修改 ${modified} 个文件`)
    if (deleted > 0) parts.push(`删除 ${deleted} 个文件`)
    return parts.join('，') || '无变更'
}

export function createChangeTrackingRoutes(
    getSyncEngine: () => SyncEngine | null,
    store: Store
): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()
    const reviewDb = new ReviewStore((store as unknown as { db: Database }).db)

    // List changes for a session
    app.get('/sessions/:id/changes', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        // getMessages is capped at 200; indicate truncation if needed
        const messages = store.messages.getMessages(sessionResult.sessionId, 200)
        const groups = extractChangesFromMessages(messages as Array<{ id: string; content: unknown; createdAt: number; seq: number }>)

        // Apply persisted review status
        const sessionReviews = reviewDb.getAllReviews(sessionResult.sessionId)
        for (const group of groups) {
            for (const change of group.changes) {
                const review = sessionReviews.get(change.id)
                if (review) {
                    change.reviewStatus = review.status
                    change.reviewedAt = review.reviewedAt
                }
            }
        }

        const statusFilter = statusFilterSchema.parse(c.req.query('status'))
        if (statusFilter) {
            for (const group of groups) {
                group.changes = group.changes.filter(c => c.reviewStatus === statusFilter)
            }
        }

        return c.json({ success: true, groups, truncated: messages.length >= 200 })
    })

    // Review a single change
    app.post('/sessions/:id/changes/:changeId/review', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const changeId = c.req.param('changeId')
        if (!changeIdSchema.safeParse(changeId).success) {
            return c.json({ error: 'Invalid change ID' }, 400)
        }

        const body = await c.req.json()
        const parsed = z.object({ action: reviewActionSchema }).safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        reviewDb.setReview(sessionResult.sessionId, changeId, parsed.data.action, Date.now())

        return c.json({ success: true, changeId, status: parsed.data.action })
    })

    // Bulk review
    app.post('/sessions/:id/changes/bulk-review', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const body = await c.req.json()
        const parsed = z.object({
            changeIds: z.array(changeIdSchema).max(100),
            action: reviewActionSchema,
        }).safeParse(body)

        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const now = Date.now()
        for (const changeId of parsed.data.changeIds) {
            reviewDb.setReview(sessionResult.sessionId, changeId, parsed.data.action, now)
        }

        return c.json({ success: true, reviewedCount: parsed.data.changeIds.length, status: parsed.data.action })
    })

    // Context status
    app.get('/sessions/:id/context', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const messages = store.messages.getMessages(sessionResult.sessionId, 200)
        let inputTokens = 0
        let outputTokens = 0
        let contextTokens = 0
        let contextWindow = 200000

        for (const msg of messages) {
            const content = msg.content
            if (!isRecord(content)) continue
            const usage = isRecord(content.usage) ? content.usage : undefined
            if (usage) {
                if (typeof usage.input_tokens === 'number') inputTokens = usage.input_tokens
                if (typeof usage.output_tokens === 'number') outputTokens = usage.output_tokens
                if (typeof usage.context_tokens === 'number') contextTokens = usage.context_tokens
                if (typeof usage.context_window === 'number') contextWindow = usage.context_window
            }
        }

        const usageRatio = contextTokens / contextWindow
        const status = usageRatio >= 0.9 ? 'critical' : usageRatio >= 0.7 ? 'warning' : 'normal'

        return c.json({
            success: true,
            context: {
                sessionId: sessionResult.sessionId,
                usedTokens: contextTokens,
                contextWindow,
                messageCount: messages.length,
                status,
                inputTokens,
                outputTokens,
            }
        })
    })

    return app
}
