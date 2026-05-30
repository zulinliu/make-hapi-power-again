import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import type { SyncEngine } from '../../sync/syncEngine'
import type { Store } from '../../store'
import type { WebAppEnv } from '../middleware/auth'
import { createTimelineRoutes } from './timeline'

function createApp(messages: Array<{ id: string; content: unknown; createdAt: number; seq: number }> = []) {
    const snapshotsByType: Array<{ id: number; filePath: string; contentHash: string; snapshotType: string; createdAt: number }> = []
    let snapshotIdCounter = 1

    const store = {
        messages: {
            getMessages: (_sid: string, _limit: number) => messages
        },
        fileSnapshots: {
            createSnapshot: (_sid: string, filePath: string, contentHash: string, snapshotType: string) => {
                const snap = { id: snapshotIdCounter++, filePath, contentHash, snapshotType, createdAt: Date.now() }
                snapshotsByType.push(snap)
                return snap
            },
            getSnapshotsByType: (_sid: string, type: string) => {
                return snapshotsByType.filter(s => s.snapshotType === type)
            },
        },
    } as unknown as Store

    const engine = {
        resolveSessionAccess: () => ({ ok: true, sessionId: 'session-1', session: { id: 'session-1' } }),
    } as Partial<SyncEngine>

    const getSyncEngine = () => engine as SyncEngine

    const app = new Hono<WebAppEnv>()
    app.use('*', async (c, next) => {
        c.set('namespace', 'default')
        await next()
    })
    app.route('/api', createTimelineRoutes(getSyncEngine, store))

    return { app }
}

describe('timeline routes', () => {
    describe('GET /api/sessions/:id/timeline', () => {
        it('returns empty entries when no messages', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/timeline')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.entries).toEqual([])
            expect(body.truncated).toBe(false)
        })

        it('extracts user messages', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: { role: 'user', type: 'text', content: 'Hello world' },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/timeline')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.entries).toHaveLength(1)
            expect(body.entries[0].type).toBe('message')
            expect(body.entries[0].data.role).toBe('user')
            expect(body.entries[0].data.text).toBe('Hello world')
        })

        it('extracts assistant text messages', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: { role: 'assistant', type: 'text', content: 'I will help you' },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/timeline')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.entries).toHaveLength(1)
            expect(body.entries[0].data.role).toBe('assistant')
        })

        it('extracts tool_use as tool_use type', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'bash',
                        input: { command: 'ls -la' }
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/timeline')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.entries).toHaveLength(1)
            expect(body.entries[0].type).toBe('tool_use')
            expect(body.entries[0].data.toolName).toBe('bash')
        })

        it('classifies file change tools as file_change type', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/app.ts', content: 'code' }
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/timeline')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.entries[0].type).toBe('file_change')
        })

        it('extracts tool_result with error as error type', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_result',
                        tool_use_id: 'tool-1',
                        is_error: true,
                        content: 'Command failed'
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/timeline')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.entries[0].type).toBe('error')
            expect(body.entries[0].data.isError).toBe(true)
        })

        it('extracts tool_result without error as tool_use type', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_result',
                        tool_use_id: 'tool-1',
                        is_error: false,
                        content: 'Success'
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/timeline')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.entries[0].type).toBe('tool_use')
            expect(body.entries[0].data.isError).toBe(false)
        })

        it('extracts summary entries', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'summary',
                        content: 'Summary of conversation',
                        auto: true
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/timeline')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.entries).toHaveLength(1)
            expect(body.entries[0].type).toBe('summary')
            expect(body.entries[0].data.isAuto).toBe(true)
        })

        it('extracts usage as checkpoint entries', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'text',
                        content: 'hi',
                        usage: { input_tokens: 5000, output_tokens: 1000, context_tokens: 10000 }
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/timeline')

            expect(response.status).toBe(200)
            const body = await response.json()
            // Should have both message and checkpoint entries
            const checkpoints = body.entries.filter((e: { type: string }) => e.type === 'checkpoint')
            expect(checkpoints).toHaveLength(1)
            expect(checkpoints[0].data.inputTokens).toBe(5000)
            expect(checkpoints[0].data.contextTokens).toBe(10000)
        })

        it('filters by type parameter', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: { role: 'user', type: 'text', content: 'Hello' },
                    createdAt: 1000,
                    seq: 1
                },
                {
                    id: 'msg-2',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'bash',
                        input: { command: 'ls' }
                    },
                    createdAt: 2000,
                    seq: 2
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/timeline?type=tool_use')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.entries).toHaveLength(1)
            expect(body.entries[0].type).toBe('tool_use')
        })

        it('returns all entries with type=all', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: { role: 'user', type: 'text', content: 'Hello' },
                    createdAt: 1000,
                    seq: 1
                },
                {
                    id: 'msg-2',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'bash',
                        input: { command: 'ls' }
                    },
                    createdAt: 2000,
                    seq: 2
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/timeline?type=all')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.entries).toHaveLength(2)
        })

        it('sets truncated flag when 200 messages', async () => {
            const messages = Array.from({ length: 200 }, (_, i) => ({
                id: `msg-${i}`,
                content: { role: 'user', type: 'text', content: `msg ${i}` },
                createdAt: i * 1000,
                seq: i
            }))
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/timeline')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.truncated).toBe(true)
        })

        it('returns 503 when sync engine is unavailable', async () => {
            const store = {
                messages: { getMessages: () => [] },
                fileSnapshots: {},
            } as unknown as Store
            const getSyncEngine = () => null
            const app = new Hono<WebAppEnv>()
            app.use('*', async (c, next) => {
                c.set('namespace', 'default')
                await next()
            })
            app.route('/api', createTimelineRoutes(getSyncEngine, store))

            const response = await app.request('/api/sessions/session-1/timeline')
            expect(response.status).toBe(503)
        })
    })

    describe('GET /api/sessions/:id/summaries', () => {
        it('returns explicit summary entries', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: { role: 'assistant', type: 'summary', content: 'Summary text', auto: false },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/summaries')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.summaries).toHaveLength(1)
            expect(body.summaries[0].content).toBe('Summary text')
            expect(body.summaries[0].isAuto).toBe(false)
        })

        it('auto-extracts long assistant text as summaries', async () => {
            const longText = 'a'.repeat(200)
            const messages = [
                {
                    id: 'msg-1',
                    content: { role: 'assistant', type: 'text', content: longText },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/summaries')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.summaries).toHaveLength(1)
            expect(body.summaries[0].isAuto).toBe(true)
        })

        it('skips short assistant text from auto-summaries', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: { role: 'assistant', type: 'text', content: 'Short text' },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/summaries')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.summaries).toHaveLength(0)
        })

        it('returns empty summaries when no messages', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/summaries')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.summaries).toEqual([])
        })
    })

    describe('POST /api/sessions/:id/checkpoints', () => {
        it('creates a checkpoint with default label', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/checkpoints', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({})
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.checkpoint.id).toMatch(/^cp-/)
            expect(body.checkpoint.fileCount).toBe(0)
            expect(body.checkpoint.label).toContain('检查点')
        })

        it('creates a checkpoint with custom label', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/checkpoints', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ label: 'Before refactor' })
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.checkpoint.label).toBe('Before refactor')
        })

        it('captures file state from writeFile messages', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/app.ts', content: 'console.log("hello")' }
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/checkpoints', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ label: 'Test checkpoint' })
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.checkpoint.fileCount).toBe(1)
            expect(body.checkpoint.snapshotIds).toHaveLength(1)
        })

        it('applies editFile on top of writeFile', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/app.ts', content: 'hello world' }
                    },
                    createdAt: 1000,
                    seq: 1
                },
                {
                    id: 'msg-2',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'editFile',
                        input: { path: 'src/app.ts', old_string: 'hello', new_string: 'goodbye' }
                    },
                    createdAt: 2000,
                    seq: 2
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/checkpoints', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({})
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.checkpoint.fileCount).toBe(1)
        })

        it('rejects invalid label', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/checkpoints', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ label: '' })
            })

            expect(response.status).toBe(400)
        })
    })

    describe('GET /api/sessions/:id/checkpoints', () => {
        it('returns empty checkpoints when none created', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/checkpoints')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.checkpoints).toEqual([])
        })

        it('returns created checkpoints', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/app.ts', content: 'code' }
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            // Create a checkpoint first
            await app.request('/api/sessions/session-1/checkpoints', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ label: 'My checkpoint' })
            })

            // Now list them
            const response = await app.request('/api/sessions/session-1/checkpoints')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.checkpoints).toHaveLength(1)
            expect(body.checkpoints[0].fileCount).toBe(1)
        })
    })
})
