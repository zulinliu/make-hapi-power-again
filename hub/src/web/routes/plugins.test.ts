import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import type { SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { createPluginsRoutes } from './plugins'

function createApp(engineOverrides?: Partial<SyncEngine>) {
    const pluginList = async () => ({
        success: true,
        plugins: [
            { id: 'my-plugin', name: 'My Plugin', version: '1.0.0', enabled: true }
        ]
    })
    const pluginInstall = async (_sessionId: string, options: { pluginId: string }) => ({
        success: true,
        plugin: { id: options.pluginId, name: 'Installed Plugin', version: '1.0.0' }
    })
    const pluginUninstall = async () => ({
        success: true,
        message: 'Plugin uninstalled'
    })
    const pluginStorageGet = async (_sid: string, _pid: string, key: string) => ({
        success: true,
        key,
        value: `value-for-${key}`
    })
    const pluginStorageSet = async () => ({
        success: true
    })
    const pluginStorageDelete = async () => ({
        success: true
    })
    const pluginStorageList = async (_sid: string, _pid: string, prefix?: string) => ({
        success: true,
        entries: [
            { key: `${prefix ?? ''}test-key`, value: 'test-value' }
        ]
    })

    const engine = {
        resolveSessionAccess: () => ({ ok: true, sessionId: 'session-1', session: { id: 'session-1' } }),
        pluginList,
        pluginInstall,
        pluginUninstall,
        pluginStorageGet,
        pluginStorageSet,
        pluginStorageDelete,
        pluginStorageList,
        ...engineOverrides,
    } as Partial<SyncEngine>

    const getSyncEngine = () => engine as SyncEngine

    const app = new Hono<WebAppEnv>()
    app.use('*', async (c, next) => {
        c.set('namespace', 'default')
        await next()
    })
    app.route('/api', createPluginsRoutes(getSyncEngine))

    return { app, engine }
}

describe('plugins routes', () => {
    describe('GET /api/sessions/:id/plugins', () => {
        it('returns plugin list for a session', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.plugins).toHaveLength(1)
            expect(body.plugins[0].id).toBe('my-plugin')
        })

        it('returns 503 when sync engine is unavailable', async () => {
            const getSyncEngine = () => null
            const app = new Hono<WebAppEnv>()
            app.use('*', async (c, next) => {
                c.set('namespace', 'default')
                await next()
            })
            app.route('/api', createPluginsRoutes(getSyncEngine))

            const response = await app.request('/api/sessions/session-1/plugins')

            expect(response.status).toBe(503)
        })
    })

    describe('POST /api/sessions/:id/plugins/install', () => {
        it('installs a plugin', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/install', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ pluginId: 'new-plugin' })
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.plugin.id).toBe('new-plugin')
        })

        it('accepts sourceUrl and sourceType', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/install', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    pluginId: 'remote-plugin',
                    sourceUrl: 'https://example.com/plugin.tar.gz',
                    sourceType: 'url'
                })
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
        })

        it('rejects invalid plugin id', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/install', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ pluginId: 'INVALID ID!' })
            })

            expect(response.status).toBe(400)
            const body = await response.json()
            expect(body.error).toBe('Invalid request')
        })

        it('rejects missing plugin id', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/install', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({})
            })

            expect(response.status).toBe(400)
        })

        it('returns error on rpc failure', async () => {
            const { app } = createApp({
                pluginInstall: async () => { throw new Error('Install failed') }
            })

            const response = await app.request('/api/sessions/session-1/plugins/install', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ pluginId: 'fail-plugin' })
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(false)
            expect(body.error).toBe('Install failed')
        })
    })

    describe('DELETE /api/sessions/:id/plugins/:pluginId', () => {
        it('uninstalls a plugin', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/my-plugin', {
                method: 'DELETE'
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
        })

        it('rejects invalid plugin id', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/INVALID!', {
                method: 'DELETE'
            })

            expect(response.status).toBe(400)
            const body = await response.json()
            expect(body.error).toBe('Invalid plugin ID')
        })
    })

    describe('GET /api/sessions/:id/plugins/:pluginId/storage', () => {
        it('gets a specific key', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/my-plugin/storage?key=my-key')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.key).toBe('my-key')
            expect(body.value).toBe('value-for-my-key')
        })

        it('lists all keys when no key param', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/my-plugin/storage')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.entries).toHaveLength(1)
        })

        it('passes prefix for listing', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/my-plugin/storage?prefix=config.')

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
            expect(body.entries[0].key).toBe('config.test-key')
        })

        it('rejects invalid plugin id', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/BAD%20ID/storage?key=k')

            expect(response.status).toBe(400)
            const body = await response.json()
            expect(body.error).toBe('Invalid plugin ID')
        })
    })

    describe('PUT /api/sessions/:id/plugins/:pluginId/storage', () => {
        it('sets a storage key-value pair', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/my-plugin/storage', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ key: 'config.theme', value: 'dark' })
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
        })

        it('rejects missing key', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/my-plugin/storage', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ value: 'dark' })
            })

            expect(response.status).toBe(400)
        })

        it('rejects missing value', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/my-plugin/storage', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ key: 'config.theme' })
            })

            expect(response.status).toBe(400)
        })

        it('rejects invalid plugin id', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/BAD%20ID/storage', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ key: 'k', value: 'v' })
            })

            expect(response.status).toBe(400)
            const body = await response.json()
            expect(body.error).toBe('Invalid plugin ID')
        })
    })

    describe('DELETE /api/sessions/:id/plugins/:pluginId/storage', () => {
        it('deletes a storage key', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/my-plugin/storage?key=config.theme', {
                method: 'DELETE'
            })

            expect(response.status).toBe(200)
            const body = await response.json()
            expect(body.success).toBe(true)
        })

        it('rejects missing key parameter', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/my-plugin/storage', {
                method: 'DELETE'
            })

            expect(response.status).toBe(400)
            const body = await response.json()
            expect(body.error).toBe('Missing key parameter')
        })

        it('rejects invalid plugin id', async () => {
            const { app } = createApp()

            const response = await app.request('/api/sessions/session-1/plugins/BAD%20ID/storage?key=k', {
                method: 'DELETE'
            })

            expect(response.status).toBe(400)
            const body = await response.json()
            expect(body.error).toBe('Invalid plugin ID')
        })
    })
})
