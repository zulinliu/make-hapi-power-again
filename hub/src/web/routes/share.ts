import { Hono } from 'hono'
import { z } from 'zod'
import type { Database } from 'bun:sqlite'
import type { Store } from '../../store'
import type { WebAppEnv } from '../middleware/auth'
import { requireSessionFromParam, requireSyncEngine } from './guards'
import type { SyncEngine } from '../../sync/syncEngine'
import { randomBytes, randomUUID } from 'node:crypto'

interface ShareRecord {
    id: string
    sessionId: string
    namespace: string
    scope: 'full' | 'changes' | 'terminal' | 'readonly'
    snapshot: string
    password: string | null
    maxViews: number | null
    expiresAt: number | null
    createdAt: number
    createdBy: number
    accessCount: number
    lastAccessedAt: number | null
}

class ShareStore {
    constructor(private readonly db: Database) {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS session_shares (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                namespace TEXT NOT NULL,
                scope TEXT NOT NULL DEFAULT 'readonly',
                snapshot TEXT NOT NULL DEFAULT '{}',
                password TEXT,
                max_views INTEGER,
                expires_at INTEGER,
                created_at INTEGER NOT NULL,
                created_by INTEGER NOT NULL,
                access_count INTEGER NOT NULL DEFAULT 0,
                last_accessed_at INTEGER
            )
        `)
        // Migrate: add password and max_views columns if missing
        try { this.db.exec('ALTER TABLE session_shares ADD COLUMN password TEXT') } catch {}
        try { this.db.exec('ALTER TABLE session_shares ADD COLUMN max_views INTEGER') } catch {}
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_shares_session ON session_shares(session_id)`)
    }

    createShare(sessionId: string, namespace: string, scope: string, snapshot: string, password: string | null, maxViews: number | null, expiresIn: number | null, createdBy: number): ShareRecord {
        const id = randomBytes(32).toString('hex')
        const now = Date.now()
        const expiresAt = expiresIn ? now + expiresIn : null
        const hashedPassword = password ? Bun.password.hashSync(password) : null
        this.db.prepare(`
            INSERT INTO session_shares (id, session_id, namespace, scope, snapshot, password, max_views, expires_at, created_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, sessionId, namespace, scope, snapshot, hashedPassword, maxViews, expiresAt, now, createdBy)

        return this.getShare(id)!
    }

    getShare(id: string): ShareRecord | null {
        const row = this.db.prepare('SELECT * FROM session_shares WHERE id = ?').get(id) as DbShareRow | undefined
        return row ? toShareRecord(row) : null
    }

    getSharesForSession(sessionId: string): ShareRecord[] {
        const rows = this.db.prepare('SELECT * FROM session_shares WHERE session_id = ? ORDER BY created_at DESC').all(sessionId) as DbShareRow[]
        return rows.map(toShareRecord)
    }

    recordAccess(id: string): void {
        this.db.prepare(`
            UPDATE session_shares SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?
        `).run(Date.now(), id)
    }

    deleteShare(id: string): boolean {
        const result = this.db.prepare('DELETE FROM session_shares WHERE id = ?').run(id)
        return result.changes > 0
    }

    deleteExpiredShares(): number {
        const now = Date.now()
        const result = this.db.prepare('DELETE FROM session_shares WHERE expires_at IS NOT NULL AND expires_at < ?').run(now)
        return result.changes
    }
}

type DbShareRow = {
    id: string
    session_id: string
    namespace: string
    scope: string
    snapshot: string
    password: string | null
    max_views: number | null
    expires_at: number | null
    created_at: number
    created_by: number
    access_count: number
    last_accessed_at: number | null
}

function toShareRecord(row: DbShareRow): ShareRecord {
    return {
        id: row.id,
        sessionId: row.session_id,
        namespace: row.namespace,
        scope: row.scope as ShareRecord['scope'],
        snapshot: row.snapshot,
        password: row.password,
        maxViews: row.max_views,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        createdBy: row.created_by,
        accessCount: row.access_count,
        lastAccessedAt: row.last_accessed_at,
    }
}

const shareScopeSchema = z.enum(['full', 'changes', 'terminal', 'readonly'])
const createShareSchema = z.object({
    scope: shareScopeSchema,
    expiresIn: z.number().int().min(60000).max(86400000 * 30).nullable().optional(),
    password: z.string().min(4).max(64).nullable().optional(),
    maxViews: z.number().int().min(1).max(10000).nullable().optional(),
})

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function createShareRoutes(
    getSyncEngine: () => SyncEngine | null,
    store: Store
): { protected: Hono<WebAppEnv>; public: Hono } {
    const db = (store as unknown as { db: Database }).db
    const shareStore = new ShareStore(db)

    // Clean expired shares on startup
    shareStore.deleteExpiredShares()

    const protectedRoutes = new Hono<WebAppEnv>()

    // Create share link
    protectedRoutes.post('/sessions/:id/shares', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const body = await c.req.json()
        const parsed = createShareSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const { scope, expiresIn, password, maxViews } = parsed.data
        const namespace = c.get('namespace')
        const userId = c.get('userId')

        // Build snapshot based on scope
        let snapshot: Record<string, unknown> = {}

        if (scope === 'changes' || scope === 'full') {
            const messages = store.messages.getMessages(sessionResult.sessionId, 200)
            const changes: Array<{ filePath: string; changeType: string; afterContent: string }> = []
            const fileState = new Map<string, { filePath: string; changeType: string; afterContent: string }>()

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
                    if (filePath) {
                        const decoded = contentStr ? Buffer.from(contentStr, 'base64').toString('utf-8') : ''
                        fileState.set(filePath, { filePath, changeType: 'created', afterContent: decoded })
                    }
                }
            }
            changes.push(...fileState.values())
            snapshot = { changes, truncated: messages.length >= 200 }
        }

        const share = shareStore.createShare(
            sessionResult.sessionId,
            namespace,
            scope,
            JSON.stringify(snapshot),
            password ?? null,
            maxViews ?? null,
            expiresIn ?? null,
            userId
        )

        return c.json({ success: true, share: { ...share, url: `/s/${share.id}` } })
    })

    // List shares for session
    protectedRoutes.get('/sessions/:id/shares', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const shares = shareStore.getSharesForSession(sessionResult.sessionId)
        return c.json({ success: true, shares })
    })

    // Delete share (owner only)
    protectedRoutes.delete('/shares/:shareId', async (c) => {
        const shareId = c.req.param('shareId')
        const userId = c.get('userId')
        const share = shareStore.getShare(shareId)
        if (!share) {
            return c.json({ error: 'Share not found' }, 404)
        }
        if (share.createdBy !== userId) {
            return c.json({ error: 'Not authorized to delete this share' }, 403)
        }
        shareStore.deleteShare(shareId)
        return c.json({ success: true })
    })

    // Public routes (no auth required)
    const publicRoutes = new Hono()

    // Access shared session
    publicRoutes.post('/s/:shareId/access', async (c) => {
        const shareId = c.req.param('shareId')
        const share = shareStore.getShare(shareId)

        if (!share) {
            return c.json({ error: 'Share link not found' }, 404)
        }

        if (share.expiresAt && share.expiresAt < Date.now()) {
            shareStore.deleteShare(shareId)
            return c.json({ error: 'Share link has expired' }, 410)
        }

        if (share.maxViews !== null && share.accessCount >= share.maxViews) {
            return c.json({ error: 'Share link has reached its view limit' }, 410)
        }

        // Password check
        if (share.password) {
            const body = await c.req.json<{ password?: string }>().catch(() => ({}))
            const providedPassword = typeof body.password === 'string' ? body.password : ''
            if (!Bun.password.verifySync(providedPassword, share.password)) {
                return c.json({ error: 'Incorrect password', requiresPassword: true }, 401)
            }
        }

        shareStore.recordAccess(shareId)

        const snapshot = JSON.parse(share.snapshot) as Record<string, unknown>

        return c.json({
            success: true,
            share: {
                id: share.id,
                scope: share.scope,
                createdAt: share.createdAt,
                expiresAt: share.expiresAt,
            },
            snapshot,
        })
    })

    // Check if share requires password (GET, no auth)
    publicRoutes.get('/s/:shareId', async (c) => {
        const shareId = c.req.param('shareId')
        const share = shareStore.getShare(shareId)

        if (!share) {
            return c.json({ error: 'Share link not found' }, 404)
        }

        if (share.expiresAt && share.expiresAt < Date.now()) {
            shareStore.deleteShare(shareId)
            return c.json({ error: 'Share link has expired' }, 410)
        }

        if (share.maxViews !== null && share.accessCount >= share.maxViews) {
            return c.json({ error: 'Share link has reached its view limit' }, 410)
        }

        // If no password, allow direct GET access (backward compatible)
        if (!share.password) {
            shareStore.recordAccess(shareId)
            const snapshot = JSON.parse(share.snapshot) as Record<string, unknown>
            return c.json({
                success: true,
                share: {
                    id: share.id,
                    scope: share.scope,
                    createdAt: share.createdAt,
                    expiresAt: share.expiresAt,
                },
                snapshot,
            })
        }

        // Password-protected: return metadata only
        return c.json({
            success: false,
            requiresPassword: true,
            share: {
                id: share.id,
                scope: share.scope,
                createdAt: share.createdAt,
                expiresAt: share.expiresAt,
            },
        })
    })

    return { protected: protectedRoutes, public: publicRoutes }
}
