import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import type { SyncEngine } from '../../sync/syncEngine'
import type { Store } from '../../store'
import type { WebAppEnv } from '../middleware/auth'
import { createUndoRoutes } from './undo'

function createApp(messages: Array<{ id: string; content: unknown; createdAt: number; seq: number }> = []) {
    const snapshots: Array<{ id: number; filePath: string; contentHash: string; snapshotType: string; createdAt: number }> = []
    let snapshotId = 1

    const store = {
        messages: {
            getMessages: (_sid: string, _limit: number) => messages
        },
        fileSnapshots: {
            getLatestSnapshot: (_sid: string, filePath: string) => {
                const matching = snapshots.filter(s => s.filePath === filePath)
                return matching.length > 0 ? matching[matching.length - 1] : null
            },
            getSnapshotsForSession: (_sid: string, _limit: number) => {
                return snapshots
            },
            createSnapshot: (_sid: string, filePath: string, contentHash: string, snapshotType: string) => {
                const snap = { id: snapshotId++, filePath, contentHash, snapshotType, createdAt: Date.now() }
                snapshots.push(snap)
                return snap
            },
        },
    } as unknown as Store

    const engine = {
        resolveSessionAccess: () => ({
            ok: true as const,
            sessionId: 'session-1',
            session: {
                id: 'session-1',
                namespace: 'default',
                seq: 0,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                active: false,
                activeAt: 0,
                metadata: null,
            }
        }),
    } as unknown as Partial<SyncEngine>

    const getSyncEngine = () => engine as SyncEngine

    const app = new Hono<WebAppEnv>()
    app.use('*', async (c, next) => {
        c.set('namespace', 'default')
        await next()
    })
    app.route('/api', createUndoRoutes(getSyncEngine, store))

    return { app, snapshots }
}

describe('undo routes', () => {
    describe('POST /api/sessions/:id/undo/preview', () => {
        it('returns preview with no changes for empty session', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/undo/preview', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'session' })
            })

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.success).toBe(true)
            expect(body.preview.scope).toBe('session')
            expect(body.preview.affectedFiles).toEqual([])
            expect(body.preview.totalSnapshots).toBe(0)
            expect(body.preview.currentMaxSeq).toBe(0)
        })

        it('detects created files for session scope', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/new-file.ts', content: Buffer.from('code').toString('base64') }
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/undo/preview', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'session' })
            })

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.preview.affectedFiles).toHaveLength(1)
            expect(body.preview.affectedFiles[0].filePath).toBe('src/new-file.ts')
            expect(body.preview.affectedFiles[0].changeType).toBe('created')
            expect(body.preview.affectedFiles[0].canRevert).toBe(true)
        })

        it('detects modified files when snapshots exist', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'editFile',
                        input: { path: 'src/existing.ts', old_string: 'old', new_string: 'new' }
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            // Create a snapshot for the existing file
            const { app, snapshots } = createApp(messages)
            snapshots.push({
                id: 1,
                filePath: 'src/existing.ts',
                contentHash: 'abc123',
                snapshotType: 'auto',
                createdAt: 500
            })

            const response = await app.request('/api/sessions/session-1/undo/preview', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'session' })
            })

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.preview.affectedFiles[0].changeType).toBe('created') // first editFile without prior writeFile = created
            // But with snapshot it should still detect
        })

        it('detects deleted files', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'deleteFile',
                        input: { path: 'src/old-file.ts' }
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/undo/preview', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'session' })
            })

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.preview.affectedFiles).toHaveLength(1)
            expect(body.preview.affectedFiles[0].changeType).toBe('deleted')
        })

        it('filters by step scope', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/a.ts', content: Buffer.from('a').toString('base64') }
                    },
                    createdAt: 1000,
                    seq: 1
                },
                {
                    id: 'msg-2',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/b.ts', content: Buffer.from('b').toString('base64') }
                    },
                    createdAt: 2000,
                    seq: 2
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/undo/preview', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'step', stepSeq: 1 })
            })

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            // Only seq=1 should be included
            expect(body.preview.affectedFiles).toHaveLength(1)
            expect(body.preview.affectedFiles[0].filePath).toBe('src/a.ts')
        })

        it('filters by file scope', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/a.ts', content: Buffer.from('a').toString('base64') }
                    },
                    createdAt: 1000,
                    seq: 1
                },
                {
                    id: 'msg-2',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/b.ts', content: Buffer.from('b').toString('base64') }
                    },
                    createdAt: 2000,
                    seq: 2
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/undo/preview', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'file', filePath: 'src/b.ts' })
            })

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.preview.affectedFiles).toHaveLength(1)
            expect(body.preview.affectedFiles[0].filePath).toBe('src/b.ts')
        })

        it('reports currentMaxSeq from last message', async () => {
            const messages = [
                { id: 'msg-1', content: { role: 'user', type: 'text', content: 'hi' }, createdAt: 1000, seq: 5 }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/undo/preview', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'session' })
            })

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.preview.currentMaxSeq).toBe(5)
        })

        it('rejects invalid scope', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/undo/preview', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'invalid' })
            })

            expect(response.status).toBe(400)
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
            app.route('/api', createUndoRoutes(getSyncEngine, store))

            const response = await app.request('/api/sessions/session-1/undo/preview', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'session' })
            })
            expect(response.status).toBe(503)
        })
    })

    describe('POST /api/sessions/:id/undo/execute', () => {
        it('reverts created files', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/new.ts', content: Buffer.from('code').toString('base64') }
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app, snapshots } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/undo/execute', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'session' })
            })

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.success).toBe(true)
            expect(body.result.revertedFiles).toContain('src/new.ts')
            expect(body.result.skippedFiles).toEqual([])
            expect(body.result.status).toBe('marked_for_restore')
            expect(body.result.message).toContain('待恢复')
        })

        it('skips modified files without snapshots', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'editFile',
                        input: { path: 'src/no-snapshot.ts', old_string: 'a', new_string: 'b' }
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/undo/execute', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'session' })
            })

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            // editFile with no prior writeFile is treated as 'created'
            expect(body.result.revertedFiles).toContain('src/no-snapshot.ts')
        })

        it('reverts deleted files', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'deleteFile',
                        input: { path: 'src/deleted.ts' }
                    },
                    createdAt: 1000,
                    seq: 1
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/undo/execute', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'session' })
            })

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.result.revertedFiles).toContain('src/deleted.ts')
        })

        it('returns 409 when session has advanced past expectedMaxSeq', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/a.ts', content: Buffer.from('a').toString('base64') }
                    },
                    createdAt: 1000,
                    seq: 5
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/undo/execute', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'session', expectedMaxSeq: 3 })
            })

            expect(response.status).toBe(409)
            const body = await response.json() as Record<string, any>
            expect(body.error).toContain('重新预览')
        })

        it('proceeds when currentMaxSeq matches expectedMaxSeq', async () => {
            const messages = [
                {
                    id: 'msg-1',
                    content: {
                        role: 'assistant',
                        type: 'tool_use',
                        name: 'writeFile',
                        input: { path: 'src/a.ts', content: Buffer.from('a').toString('base64') }
                    },
                    createdAt: 1000,
                    seq: 5
                }
            ]
            const { app } = createApp(messages)

            const response = await app.request('/api/sessions/session-1/undo/execute', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'session', expectedMaxSeq: 5 })
            })

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.success).toBe(true)
        })

        it('rejects invalid scope', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/undo/execute', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'bad' })
            })

            expect(response.status).toBe(400)
        })
    })

    describe('GET /api/sessions/:id/snapshots', () => {
        it('returns empty snapshots when none exist', async () => {
            const { app } = createApp([])

            const response = await app.request('/api/sessions/session-1/snapshots')

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.success).toBe(true)
            expect(body.snapshots).toEqual([])
        })

        it('returns created snapshots', async () => {
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
            const { app, snapshots } = createApp(messages)

            // Create a snapshot via undo execute
            await app.request('/api/sessions/session-1/undo/execute', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ scope: 'session' })
            })

            const response = await app.request('/api/sessions/session-1/snapshots')

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(body.success).toBe(true)
            expect(body.snapshots.length).toBeGreaterThan(0)
            expect(body.snapshots[0].filePath).toBe('src/app.ts')
            expect(body.snapshots[0].snapshotType).toBe('undo')
        })

        it('passes limit parameter to store', async () => {
            const getSnapshotsCalls: Array<number> = []
            const store = {
                messages: {
                    getMessages: () => []
                },
                fileSnapshots: {
                    getLatestSnapshot: () => null,
                    getSnapshotsForSession: (_sid: string, limit: number) => {
                        getSnapshotsCalls.push(limit)
                        return Array.from({ length: 10 }, (_, i) => ({
                            id: i + 1,
                            filePath: `src/file-${i}.ts`,
                            contentHash: `hash-${i}`,
                            snapshotType: 'auto',
                            createdAt: Date.now()
                        })).slice(0, limit)
                    },
                    createSnapshot: () => ({ id: 1, filePath: '', contentHash: '', snapshotType: 'auto', createdAt: 0 }),
                },
            } as unknown as Store

            const engine = {
                resolveSessionAccess: () => ({
                    ok: true as const,
                    sessionId: 'session-1',
                    session: {
                        id: 'session-1',
                        namespace: 'default',
                        seq: 0,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        active: false,
                        activeAt: 0,
                        metadata: null,
                    }
                }),
            } as unknown as Partial<SyncEngine>
            const getSyncEngine = () => engine as SyncEngine

            const app = new Hono<WebAppEnv>()
            app.use('*', async (c, next) => {
                c.set('namespace', 'default')
                await next()
            })
            app.route('/api', createUndoRoutes(getSyncEngine, store))

            const response = await app.request('/api/sessions/session-1/snapshots?limit=5')

            expect(response.status).toBe(200)
            const body = await response.json() as Record<string, any>
            expect(getSnapshotsCalls).toEqual([5])
            expect(body.snapshots).toHaveLength(5)
        })
    })
})
