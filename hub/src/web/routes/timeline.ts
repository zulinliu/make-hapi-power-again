import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from 'bun:sqlite'
import type { Store } from '../../store'
import type { WebAppEnv } from '../middleware/auth'
import { requireSessionFromParam, requireSyncEngine } from './guards'
import type { SyncEngine } from '../../sync/syncEngine'
import { createHash } from 'crypto'

type TimelineEntryType = 'tool_use' | 'file_change' | 'message' | 'summary' | 'checkpoint' | 'error'

interface TimelineEntry {
    id: string
    type: TimelineEntryType
    timestamp: number
    seq: number
    data: Record<string, unknown>
}

interface SessionSummary {
    id: string
    sessionId: string
    content: string
    createdAt: number
    seq: number
    isAuto: boolean
}

interface SessionCheckpoint {
    id: string
    sessionId: string
    label: string
    fileCount: number
    createdAt: number
    snapshotIds: number[]
    truncated?: boolean
}

const timelineFilterSchema = z.enum(['all', 'tool_use', 'file_change', 'message', 'summary', 'checkpoint', 'error']).optional()
const summaryContentSchema = z.string().min(1).max(5000)

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function extractTimelineFromMessages(messages: Array<{ id: string; content: unknown; createdAt: number; seq: number }>): TimelineEntry[] {
    const entries: TimelineEntry[] = []

    for (const msg of messages) {
        const content = msg.content
        if (!isRecord(content)) continue

        const role = typeof content.role === 'string' ? content.role : undefined
        const type = typeof content.type === 'string' ? content.type : undefined

        if (role === 'user' && type === 'text') {
            const text = typeof content.content === 'string' ? content.content : ''
            if (text) {
                entries.push({
                    id: msg.id,
                    type: 'message',
                    timestamp: msg.createdAt,
                    seq: msg.seq,
                    data: { role: 'user', text: text.slice(0, 500) },
                })
            }
        }

        if (role === 'assistant' && type === 'text') {
            const text = typeof content.content === 'string' ? content.content : ''
            if (text) {
                entries.push({
                    id: msg.id,
                    type: 'message',
                    timestamp: msg.createdAt,
                    seq: msg.seq,
                    data: { role: 'assistant', text: text.slice(0, 500) },
                })
            }
        }

        if (role === 'assistant' && type === 'tool_use') {
            const toolName = typeof content.name === 'string' ? content.name : ''
            const toolInput = isRecord(content.input) ? content.input : {}
            const isFileChange = ['writeFile', 'editFile', 'deleteFile'].includes(toolName)

            entries.push({
                id: msg.id,
                type: isFileChange ? 'file_change' : 'tool_use',
                timestamp: msg.createdAt,
                seq: msg.seq,
                data: { toolName, input: Object.fromEntries(Object.entries(toolInput).slice(0, 10)) },
            })
        }

        if (role === 'assistant' && type === 'tool_result') {
            const isError = content.is_error === true
            entries.push({
                id: msg.id,
                type: isError ? 'error' : 'tool_use',
                timestamp: msg.createdAt,
                seq: msg.seq,
                data: {
                    toolUseId: typeof content.tool_use_id === 'string' ? content.tool_use_id : '',
                    isError,
                    output: typeof content.content === 'string' ? content.content.slice(0, 500) : '',
                },
            })
        }

        if (role === 'assistant' && type === 'summary') {
            const text = typeof content.content === 'string' ? content.content : ''
            entries.push({
                id: msg.id,
                type: 'summary',
                timestamp: msg.createdAt,
                seq: msg.seq,
                data: { text, isAuto: content.auto === true },
            })
        }

        const usage = isRecord(content.usage) ? content.usage : undefined
        if (usage && typeof usage.input_tokens === 'number') {
            entries.push({
                id: `${msg.id}:usage`,
                type: 'checkpoint',
                timestamp: msg.createdAt,
                seq: msg.seq,
                data: {
                    inputTokens: usage.input_tokens,
                    outputTokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : 0,
                    contextTokens: typeof usage.context_tokens === 'number' ? usage.context_tokens : 0,
                },
            })
        }
    }

    return entries
}

function extractSummaries(messages: Array<{ id: string; content: unknown; createdAt: number; seq: number }>): SessionSummary[] {
    const summaries: SessionSummary[] = []

    for (const msg of messages) {
        const content = msg.content
        if (!isRecord(content)) continue
        const role = typeof content.role === 'string' ? content.role : undefined
        const type = typeof content.type === 'string' ? content.type : undefined

        if (role === 'assistant' && type === 'summary') {
            summaries.push({
                id: msg.id,
                sessionId: '',
                content: typeof content.content === 'string' ? content.content : '',
                createdAt: msg.createdAt,
                seq: msg.seq,
                isAuto: content.auto === true,
            })
        }

        if (role === 'assistant' && type === 'text') {
            const text = typeof content.content === 'string' ? content.content : ''
            if (text.length > 100 && text.length < 3000) {
                summaries.push({
                    id: `${msg.id}:auto`,
                    sessionId: '',
                    content: text,
                    createdAt: msg.createdAt,
                    seq: msg.seq,
                    isAuto: true,
                })
            }
        }
    }

    return summaries
}

export function createTimelineRoutes(
    getSyncEngine: () => SyncEngine | null,
    store: Store
): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.get('/sessions/:id/timeline', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const messages = store.messages.getMessages(sessionResult.sessionId, 200)
        let entries = extractTimelineFromMessages(messages as Array<{ id: string; content: unknown; createdAt: number; seq: number }>)

        const filter = timelineFilterSchema.parse(c.req.query('type'))
        if (filter && filter !== 'all') {
            entries = entries.filter(e => e.type === filter)
        }

        return c.json({ success: true, entries, truncated: messages.length >= 200 })
    })

    app.get('/sessions/:id/summaries', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const messages = store.messages.getMessages(sessionResult.sessionId, 200)
        const summaries = extractSummaries(messages as Array<{ id: string; content: unknown; createdAt: number; seq: number }>)

        return c.json({ success: true, summaries })
    })

    app.post('/sessions/:id/checkpoints', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const body = await c.req.json()
        const parsed = z.object({ label: z.string().min(1).max(200).optional() }).safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const messages = store.messages.getMessages(sessionResult.sessionId, 200)
        const fileState = new Map<string, string>()

        for (const msg of messages) {
            const content = msg.content
            if (!isRecord(content)) continue
            const role = typeof content.role === 'string' ? content.role : undefined
            const type = typeof content.type === 'string' ? content.type : undefined
            if (role !== 'assistant' || type !== 'tool_use') continue

            const toolName = typeof content.name === 'string' ? content.name : ''
            const toolInput = isRecord(content.input) ? content.input : {}

            if (toolName === 'writeFile') {
                const filePath = typeof toolInput.path === 'string' ? toolInput.path : ''
                const contentStr = typeof toolInput.content === 'string' ? toolInput.content : ''
                if (filePath && contentStr) {
                    fileState.set(filePath, contentStr)
                }
            }

            if (toolName === 'editFile') {
                const filePath = typeof toolInput.path === 'string' ? toolInput.path : ''
                const oldStr = typeof toolInput.old_string === 'string' ? toolInput.old_string : ''
                const newStr = typeof toolInput.new_string === 'string' ? toolInput.new_string : ''
                if (filePath && oldStr && newStr) {
                    const existing = fileState.get(filePath) ?? ''
                    fileState.set(filePath, existing.replace(oldStr, newStr))
                }
            }
        }

        const now = Date.now()
        const label = parsed.data.label ?? `检查点 ${new Date(now).toLocaleString()}`
        const snapshotIds: number[] = []
        const entries = Array.from(fileState.entries()).slice(0, 50)

        for (const [filePath, content] of entries) {
            const contentHash = createContentHash(content)
            const snapshot = store.fileSnapshots.createSnapshot(
                sessionResult.sessionId,
                filePath,
                contentHash,
                'checkpoint',
                'default'
            )
            snapshotIds.push(snapshot.id)
        }

        return c.json({
            success: true,
            checkpoint: {
                id: `cp-${Date.now()}`,
                sessionId: sessionResult.sessionId,
                label,
                fileCount: entries.length,
                createdAt: now,
                snapshotIds,
                truncated: fileState.size > 50,
            } satisfies SessionCheckpoint,
        })
    })

    app.get('/sessions/:id/checkpoints', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const snapshots = store.fileSnapshots.getSnapshotsByType(
            sessionResult.sessionId,
            'checkpoint'
        )

        const grouped = new Map<string, { label: string; fileCount: number; createdAt: number; snapshotIds: number[] }>()
        for (const snap of snapshots) {
            const groupKey = `${snap.snapshotType}:${snap.createdAt}`
            if (!grouped.has(groupKey)) {
                grouped.set(groupKey, { label: `检查点 ${new Date(snap.createdAt).toLocaleString()}`, fileCount: 0, createdAt: snap.createdAt, snapshotIds: [] })
            }
            const group = grouped.get(groupKey)!
            group.fileCount++
            group.snapshotIds.push(snap.id)
        }

        const checkpoints: SessionCheckpoint[] = Array.from(grouped.entries()).map(([key, val]) => ({
            id: `cp-${key}`,
            sessionId: sessionResult.sessionId,
            label: val.label,
            fileCount: val.fileCount,
            createdAt: val.createdAt,
            snapshotIds: val.snapshotIds,
        }))

        return c.json({ success: true, checkpoints })
    })

    return app
}

function createContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16)
}
