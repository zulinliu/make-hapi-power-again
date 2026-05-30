import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import type { SyncEngine } from '../../sync/syncEngine'
import type { Store } from '../../store'
import type { WebAppEnv } from '../middleware/auth'
import { createChangeTrackingRoutes } from './changeTracking'

function createApp(messages: Array<{ id: string; content: unknown; createdAt: number; seq: number }> = []) {
    const store = {
        messages: {
            getMessages: (_sid: string, _limit: number) => messages
        },
    } as unknown as Store

    // changeTracking accesses the raw db for ReviewStore
    // We need to use a real in-memory SQLite for that part
    const { Database } = require('bun:sqlite')
    const db = new Database(':memory:')
    ;(store as unknown as { db: unknown }).db = db

    const engine = {
        resolveSessionAccess: () => ({ ok: true, sessionId: 'session-1', session: { id: 'session-1' } }),
    } as Partial<SyncEngine>

    const getSyncEngine = () => engine as SyncEngine

    const app = new Hono<WebAppEnv>()
    app.use('*', async (c, next) => {
        c.set('namespace', 'default')
        await next()
    })
    app.route('/api', createChangeTrackingRoutes(getSyncEngine, store))

    return { app, db }
}

describe('change tracking routes', () => {
    describe('GET /api/sessions/:id/changes', () => {
        it('returns empty groups when no messages', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/changes')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.groups).toEqual([])
            expect(body.truncated).toBe(false)
        })

        it('extracts writeFile changes as created', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: { role: 'assistant', type: 'text', content: 'I will create a file' },
                    createdAt: 1000,
                    seq: 1
                },
                {
                    id: 'msg-2',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/hello.ts', content: Buffer.from('console.log("hello")').toString('base64') }
                    },
                    createdAt: 2000,
                    seq: 2
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/changes')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.groups).toHaveLength(1)
            expect(body.groups[0].changes).toHaveLength(1)
            expect(body.groups[0].changes[0].filePath).toBe('src/hello.ts')
            expect(body.groups[0].changes[0].changeType).toBe('created')
            expect(body.groups[0].changes[0].afterContent).toBe('console.log("hello")')
            expect(body.groups[0].summary).toContain('新建')
        })

        it('extracts editFile changes as modified', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: { role: 'assistant', type: 'text', content: 'Editing a file' },
                    createdAt: 1000,
                    seq: 1
                },
                {
                    id: 'msg-2',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'editFile',
                        input: { path: 'src/app.ts', old_string: 'foo', new_string: 'bar' }
                    },
                    createdAt: 2000,
                    seq: 2
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/changes')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.groups).toHaveLength(1)
            expect(body.groups[0].changes[0].changeType).toBe('modified')
            expect(body.groups[0].changes[0].beforeContent).toBe('foo')
            expect(body.groups[0].changes[0].afterContent).toBe('bar')
        })

        it('accumulates multiple writes to the same file', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: { role: 'assistant', type: 'text', content: 'Creating' },
                    createdAt: 1000,
                    seq: 1
                },
                {
                    id: 'msg-2',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/app.ts', content: Buffer.from('v1').toString('base64') }
                    },
                    createdAt: 2000,
                    seq: 2
                },
                {
                    id: 'msg-3',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'editFile',
                        input: { path: 'src/app.ts', old_string: 'v1', new_string: 'v2' }
                    },
                    createdAt: 3000,
                    seq: 3
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/changes')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.groups).toHaveLength(1)
            // Same file should be tracked once, but as modified
            const change = body.groups[0].changes[0]
            expect(change.filePath).toBe('src/app.ts')
            expect(change.changeType).toBe('modified')
        })

        it('sets truncated flag when 200 messages returned', async () => {
            const messages = Array.from({ length: 200 }, (_, i) => ({
                id: `msg-${i}`,
                content: { role: 'assistant', type: 'text', content: 'hi' },
                createdAt: i * 1000,
                seq: i
            }))
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/changes')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.truncated).toBe(true)
        })

        it('filters changes by status', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: { role: 'assistant', type: 'text', content: 'Creating' },
                    createdAt: 1000,
                    seq: 1
                },
                {
                    id: 'msg-2',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/hello.ts', content: Buffer.from('code').toString('base64') }
                    },
                    createdAt: 2000,
                    seq: 2
                }
            ]
            const { app } = createApp(messages)

            // All are pending, filter for approved should return empty
            const response = await app.request('/api/sessions/session-1/changes?status=approved')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.groups[0].changes).toHaveLength(0)
        })

        it('returns 503 when sync engine is unavailable', async () => {
            const store = {
                messages: { getMessages: () => [] },
            } as unknown as Store
            const { Database } = require('bun:sqlite')
            const db = new Database(':memory:')
            ;(store as unknown as { db: unknown }).db = db

            const getSyncEngine = () => null
            const app = new Hono<WebAppEnv>()
            app.use('*', async (c, next) => {
                c.set('namespace', 'default')
                await next()
            })
            app.route('/api', createChangeTrackingRoutes(getSyncEngine, store))

            const response = await app.request('/api/sessions/session-1/changes')
            expect(response.status).toBe(503)
            db.close()
        })
    })

    describe('POST /api/sessions/:id/changes/:changeId/review', () => {
        it('approves a change', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/changes/abc123456789/review', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'approved' })
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.changeId).toBe('abc123456789')
            expect(body.status).toBe('approved')
        })

        it('rejects a change', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/changes/abc123456789/review', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'rejected' })
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.status).toBe('rejected')
        })

        it('rejects invalid change id format', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/changes/invalid-id/review', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'approved' })
            })

            expect(response.status).toBe(400)
            const body = await response.json()
            expect(body.error).toBe('Invalid change ID')
        })

        it('rejects invalid action', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/changes/abc123456789/review', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'maybe' })
            })

            expect(response.status).toBe(400)
        })

        it('persists review status across requests', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: { role: 'assistant', type: 'text', content: 'Creating' },
                    createdAt: 1000,
                    seq: 1
                },
                {
                    id: 'msg-2',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/hello.ts', content: Buffer.from('code').toString('base64') }
                    },
                    createdAt: 2000,
                    seq: 2
                }
            ]
            const { app } = createApp(messages)

            // First, get the changes to find the actual change id
            const listResponse = await app.request('/api/sessions/session-1/changes')
            const listBody = await listResponse.json()
            const changeId = listBody.groups[0].changes[0].id

            // Approve the change
            await app.request(`/api/sessions/session-1/changes/${changeId}/review`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'approved' })
            })

            // Now list changes and verify it's approved
            const updatedResponse = await app.request('/api/sessions/session-1/changes')
            const updatedBody = await updatedResponse.json()
            expect(updatedBody.groups[0].changes[0].reviewStatus).toBe('approved')
        })
    })

    describe('POST /api/sessions/:id/changes/bulk-review', () => {
        it('bulk approves changes', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/changes/bulk-review', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    changeIds: ['abc123456789', 'def123456789'],
                    action: 'approved'
                })
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.reviewedCount).toBe(2)
            expect(body.status).toBe('approved')
        })

        it('accepts empty change ids array', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/changes/bulk-review', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    changeIds: [],
                    action: 'approved'
                })
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.reviewedCount).toBe(0)
        })

        it('rejects too many change ids', async () => {
            const { app } = createApp([])

            const changeIds = Array.from({ length: 101 }, (_, i) => `abc${String(i).padStart(9, '0')}`)

            const response = await app.request('/api/sessions/session-1/changes/bulk-review', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ changeIds, action: 'approved' })
            })

            expect(response.status).toBe(400)
        })

        it('rejects invalid action', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/changes/bulk-review', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    changeIds: ['abc123456789'],
                    action: 'invalid'
                })
            })

            expect(response.status).toBe(400)
        })
    })

    describe('GET /api/sessions/:id/context', () => {
        it('returns normal context status for low usage', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'text',
                        usage: { input_tokens: 1000, output_tokens: 500, context_tokens: 50000, context_window: 200000 }
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/context')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.context.status).toBe('normal')
            expect(body.context.usedTokens).toBe(50000)
            expect(body.context.contextWindow).toBe(200000)
            expect(body.context.messageCount).toBe(1)
        })

        it('returns warning status for 70%+ usage', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'text',
                        usage: { input_tokens: 100000, output_tokens: 50000, context_tokens: 150000, context_window: 200000 }
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/context')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.context.status).toBe('warning')
        })

        it('returns critical status for 90%+ usage', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'text',
                        usage: { input_tokens: 180000, output_tokens: 50000, context_tokens: 190000, context_window: 200000 }
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/context')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.context.status).toBe('critical')
        })

        it('returns defaults when no usage data', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/context')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.context.usedTokens).toBe(0)
            expect(body.context.contextWindow).toBe(200000)
            expect(body.context.status).toBe('normal')
        })
    })
})
