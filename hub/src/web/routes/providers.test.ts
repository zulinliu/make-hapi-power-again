import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Hono } from 'hono'
import { eventBus, type ProviderKeyRevealTokenCreatedEvent, type ProviderOverviewResponse, type ProviderWithAssignments } from '@hapipower/protocol'
import { Store } from '../../store'
import type { WebAppEnv } from '../middleware/auth'
import { createProviderRoutes } from './providers'
import { ModelDiscoveryService, type ProviderHttpTransport } from '../../services/modelDiscovery'

type ProviderResponse = { provider: ProviderWithAssignments }

const TEST_ENCRYPTION_KEY = '1'.repeat(64)

describe('providers routes', () => {
    let store: Store
    let namespace: string
    let app: Hono<WebAppEnv>
    let originalFetch: typeof globalThis.fetch
    let originalEncryptionKey: string | undefined
    let originalConsoleInfo: typeof console.info

    beforeEach(() => {
        originalFetch = globalThis.fetch
        originalEncryptionKey = process.env.HAPI_POWER_PROVIDER_ENCRYPTION_KEY
        originalConsoleInfo = console.info
        process.env.HAPI_POWER_PROVIDER_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
        console.info = () => {}
        namespace = 'alpha'
        store = new Store(':memory:')
        app = new Hono<WebAppEnv>()
        app.use('*', async (c, next) => {
            c.set('namespace', namespace)
            await next()
        })
        app.route('/api', createProviderRoutes(store, new ModelDiscoveryService(createFetchTransport())))
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
        eventBus.removeAllListeners('provider:key-reveal-token-created')
        console.info = originalConsoleInfo
        if (originalEncryptionKey === undefined) {
            delete process.env.HAPI_POWER_PROVIDER_ENCRYPTION_KEY
        } else {
            process.env.HAPI_POWER_PROVIDER_ENCRYPTION_KEY = originalEncryptionKey
        }
        store.close()
    })

    it('按 namespace 隔离 provider 列表、详情和同名创建', async () => {
        const alpha = await createProvider('Gateway', 'alpha-key')

        namespace = 'beta'
        const beta = await createProvider('Gateway', 'beta-key')
        await assignProvider(beta.provider.id, 'claude')

        namespace = 'alpha'
        await assignProvider(alpha.provider.id, 'codex')
        const alphaOverview = await getOverview()
        expect(alphaOverview.summary.total).toBe(1)
        expect(alphaOverview.summary.assignedAgents).toBe(1)
        expect(alphaOverview.providers[0]?.id).toBe(alpha.provider.id)
        expect(alphaOverview.providers[0]?.apiKeyMasked).toBe('••••-key')

        const betaDetailFromAlpha = await app.request(`/api/providers/${beta.provider.id}`)
        expect(betaDetailFromAlpha.status).toBe(404)

        namespace = 'beta'
        const betaOverview = await getOverview()
        expect(betaOverview.summary.total).toBe(1)
        expect(betaOverview.providers[0]?.id).toBe(beta.provider.id)
        expect(betaOverview.providers[0]?.assignments[0]?.agentFlavor).toBe('claude')
    })

    it('创建 provider 时拒绝 SSRF 风险 URL', async () => {
        const response = await app.request('/api/providers', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: 'Localhost Gateway',
                baseUrl: 'http://127.0.0.1:3016',
                apiKey: 'test-key',
            }),
        })

        expect(response.status).toBe(400)
        expect(await response.json()).toMatchObject({
            code: 'private-ip-blocked',
        })
    })

    it('创建和更新 provider 时拒绝非标准端口', async () => {
        const createResponse = await app.request('/api/providers', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: 'Port Gateway',
                baseUrl: 'https://93.184.216.34:8443',
                apiKey: 'test-key',
            }),
        })
        expect(createResponse.status).toBe(400)
        expect(await createResponse.json()).toMatchObject({ code: 'non-standard-port' })

        const created = await createProvider('Standard Port Gateway', 'test-key')
        const updateResponse = await app.request(`/api/providers/${created.provider.id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ baseUrl: 'https://93.184.216.34:8443' }),
        })
        expect(updateResponse.status).toBe(400)
        expect(await updateResponse.json()).toMatchObject({ code: 'non-standard-port' })
    })

    it('创建和更新 provider 时拒绝敏感 query 且响应不泄露 secret', async () => {
        const createResponse = await app.request('/api/providers', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: 'Query Gateway',
                baseUrl: 'https://93.184.216.34/v1?token=secret-token',
                apiKey: 'test-key',
            }),
        })
        const createText = await createResponse.text()
        expect(createResponse.status).toBe(400)
        expect(JSON.parse(createText)).toMatchObject({ code: 'query-secret-blocked' })
        expect(createText).not.toContain('secret-token')

        const created = await createProvider('Query Update Gateway', 'test-key')
        const updateResponse = await app.request(`/api/providers/${created.provider.id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ baseUrl: 'https://93.184.216.34/v1?apiKey=secret-token' }),
        })
        const updateText = await updateResponse.text()
        expect(updateResponse.status).toBe(400)
        expect(JSON.parse(updateText)).toMatchObject({ code: 'query-secret-blocked' })
        expect(updateText).not.toContain('secret-token')
    })

    it('check 会更新 health 与 model cache，并返回安全诊断', async () => {
        const created = await createProvider('Public Gateway', 'test-key')
        globalThis.fetch = mock(async () => {
            return new Response(
                JSON.stringify({ data: [{ id: 'gpt-example', name: 'GPT Example', owned_by: 'example' }] }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )
        }) as unknown as typeof fetch

        const response = await app.request(`/api/providers/${created.provider.id}/check`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ force: true }),
        })

        expect(response.status).toBe(200)
        const body = await response.json() as {
            success: boolean
            provider: ProviderWithAssignments
            diagnostic: { hostLabel: string; path: string; statusCode: number | null; capabilities: { modelsEndpoint: boolean } }
        }
        expect(body.success).toBe(true)
        expect(body.provider.health.status).toBe('online')
        expect(body.provider.health.protocolDetected).toBe('openai')
        expect(body.provider.modelCache).toEqual([{ id: 'gpt-example', name: 'GPT Example', ownedBy: 'example' }])
        expect(body.diagnostic.hostLabel).toBe('[ip-redacted]')
        expect(body.diagnostic.path).toBe('/v1/models')
        expect(body.diagnostic.statusCode).toBe(200)
        expect(body.diagnostic.capabilities.modelsEndpoint).toBe(true)
    })

    it('discover 缓存命中后 check 仍返回完整诊断，force 会重新探测', async () => {
        const created = await createProvider('Cached Gateway', 'test-key')
        let callCount = 0
        globalThis.fetch = mock(async () => {
            callCount++
            return new Response(
                JSON.stringify({ data: [{ id: `cached-${callCount}`, name: `Cached ${callCount}` }] }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )
        }) as unknown as typeof fetch

        const discover = await app.request(`/api/providers/${created.provider.id}/discover-models`, { method: 'POST' })
        expect(discover.status).toBe(200)
        expect(callCount).toBe(1)

        const directCached = await app.request(`/api/providers/${created.provider.id}/discover-models`, { method: 'POST' })
        expect(directCached.status).toBe(200)
        expect(callCount).toBe(1)

        const check = await app.request(`/api/providers/${created.provider.id}/check`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ force: true }),
        })
        expect(check.status).toBe(200)
        const body = await check.json() as { provider: ProviderWithAssignments; diagnostic: { statusCode: number | null } }
        expect(body.provider.modelCache[0]?.id).toBe('cached-2')
        expect(body.diagnostic.statusCode).toBe(200)
        expect(callCount).toBe(2)
    })

    it('provider baseUrl/apiKey/protocol 更新后 discovery cache 会失效', async () => {
        const created = await createProvider('Invalidation Gateway', 'first-key')
        let callCount = 0
        globalThis.fetch = mock(async () => {
            callCount++
            return new Response(
                JSON.stringify({ data: [{ id: `model-${callCount}`, name: `Model ${callCount}` }] }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )
        }) as unknown as typeof fetch

        const firstDiscover = await app.request(`/api/providers/${created.provider.id}/discover-models`, { method: 'POST' })
        expect(firstDiscover.status).toBe(200)
        expect(callCount).toBe(1)

        const update = await app.request(`/api/providers/${created.provider.id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ apiKey: 'second-key', protocol: 'openai' }),
        })
        expect(update.status).toBe(200)

        const secondDiscover = await app.request(`/api/providers/${created.provider.id}/discover-models`, { method: 'POST' })
        expect(secondDiscover.status).toBe(200)
        const body = await secondDiscover.json() as { models: Array<{ id: string }> }
        expect(body.models[0]?.id).toBe('model-2')
        expect(callCount).toBe(2)
    })

    it('失败 check 只更新 health，不清空 last-known-good model cache', async () => {
        const created = await createProvider('LKG Gateway', 'test-key')
        globalThis.fetch = mock(async () => {
            return new Response(
                JSON.stringify({ data: [{ id: 'stable-model', name: 'Stable Model' }] }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )
        }) as unknown as typeof fetch

        const firstCheck = await app.request(`/api/providers/${created.provider.id}/check`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ force: true }),
        })
        expect(firstCheck.status).toBe(200)

        globalThis.fetch = mock(async () => {
            return new Response('Authorization: Bearer leaked-token', { status: 500 })
        }) as unknown as typeof fetch

        const failedCheck = await app.request(`/api/providers/${created.provider.id}/check`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ force: true }),
        })
        const failedText = await failedCheck.text()
        expect(failedCheck.status).toBe(200)
        expect(failedText).not.toContain('leaked-token')
        const body = JSON.parse(failedText) as { success: boolean; provider: ProviderWithAssignments; diagnostic: { errorCode: string | null } }
        expect(body.success).toBe(false)
        expect(body.provider.health.status).toBe('offline')
        expect(body.provider.modelCache).toEqual([{ id: 'stable-model', name: 'Stable Model', ownedBy: undefined }])
        expect(body.diagnostic.errorCode).toBe('http-500')
    })

    it('reveal key 必须二次确认且 token 只能消费一次，旧 GET 接口返回 410', async () => {
        const created = await createProvider('Reveal Gateway', 'secret-key-1234')
        const auditEvents: ProviderKeyRevealTokenCreatedEvent[] = []
        eventBus.on('provider:key-reveal-token-created', event => auditEvents.push(event))

        const legacy = await app.request(`/api/providers/${created.provider.id}/api-key`)
        expect(legacy.status).toBe(410)

        const invalid = await app.request(`/api/providers/${created.provider.id}/reveal-key-token`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm: 'wrong-confirmation' }),
        })
        expect(invalid.status).toBe(400)

        const response = await app.request(`/api/providers/${created.provider.id}/reveal-key-token`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm: 'reveal-provider-key' }),
        })
        expect(response.status).toBe(200)
        const body = await response.json() as { revealToken: string; expiresAt: number }
        expect(body.revealToken).toHaveLength(32)
        expect(body.expiresAt).toBeGreaterThan(Date.now())
        expect(auditEvents).toHaveLength(1)
        expect(auditEvents[0]).toEqual({
            namespace,
            providerId: created.provider.id,
            userId: null,
            createdAt: expect.any(Number),
            expiresAt: body.expiresAt,
        })
        const auditJson = JSON.stringify(auditEvents[0])
        expect(auditJson).not.toContain('secret-key-1234')
        expect(auditJson).not.toContain(body.revealToken)

        const reveal = await app.request(`/api/providers/${created.provider.id}/reveal-key`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ revealToken: body.revealToken }),
        })
        expect(reveal.status).toBe(200)
        expect(await reveal.json()).toEqual({ apiKey: 'secret-key-1234' })

        const replay = await app.request(`/api/providers/${created.provider.id}/reveal-key`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ revealToken: body.revealToken }),
        })
        expect(replay.status).toBe(403)
    })

    it('跨 namespace 无法 check 或 reveal 其他 namespace 的 provider', async () => {
        const created = await createProvider('Alpha Gateway', 'alpha-secret')

        namespace = 'beta'
        const check = await app.request(`/api/providers/${created.provider.id}/check`, { method: 'POST' })
        expect(check.status).toBe(404)

        const reveal = await app.request(`/api/providers/${created.provider.id}/reveal-key-token`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ confirm: 'reveal-provider-key' }),
        })
        expect(reveal.status).toBe(404)
    })

    it('同 namespace provider 重名创建和重命名返回 409', async () => {
        const first = await createProvider('Duplicate Gateway', 'first-key')
        await createProvider('Other Gateway', 'second-key')

        const duplicateCreate = await app.request('/api/providers', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name: 'Duplicate Gateway',
                baseUrl: 'https://93.184.216.34',
                apiKey: 'third-key',
            }),
        })
        expect(duplicateCreate.status).toBe(409)

        const duplicateUpdate = await app.request(`/api/providers/${first.provider.id}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'Other Gateway' }),
        })
        expect(duplicateUpdate.status).toBe(409)
    })

    it('flavor models 只返回默认 assignment 的供应商缓存模型', async () => {
        const oldProvider = await createProvider('Old Route Gateway', 'old-key')
        const newProvider = await createProvider('New Route Gateway', 'new-key')

        await assignProvider(oldProvider.provider.id, 'claude')
        await assignProvider(newProvider.provider.id, 'claude')

        store.providers.updateHealthAndModelCache(oldProvider.provider.id, namespace, oldProvider.provider.health, [
            { id: 'old-model', name: 'Old Model' },
        ], Date.now())
        store.providers.updateHealthAndModelCache(newProvider.provider.id, namespace, newProvider.provider.health, [
            { id: 'new-model', name: 'New Model' },
        ], Date.now())

        const response = await app.request('/api/providers/flavor/claude/models')
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            models: [{
                id: 'new-model',
                name: 'New Model',
                providerId: newProvider.provider.id,
                providerName: 'New Route Gateway',
            }],
        })
    })

    async function createProvider(name: string, apiKey: string): Promise<ProviderResponse> {
        const response = await app.request('/api/providers', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                name,
                baseUrl: 'https://93.184.216.34',
                apiKey,
                protocol: 'auto',
                defaultModel: 'model-default',
            }),
        })
        expect(response.status).toBe(201)
        return await response.json() as ProviderResponse
    }

    async function assignProvider(providerId: string, agentFlavor: string): Promise<void> {
        const response = await app.request(`/api/providers/${providerId}/assign`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ agentFlavor, isDefault: true, model: 'model-default' }),
        })
        expect(response.status).toBe(200)
    }

    async function getOverview(): Promise<ProviderOverviewResponse> {
        const response = await app.request('/api/providers/overview')
        expect(response.status).toBe(200)
        return await response.json() as ProviderOverviewResponse
    }

    function createFetchTransport(): ProviderHttpTransport {
        return async (url, options) => {
            const response = await globalThis.fetch(url.toString(), {
                method: 'GET',
                headers: options.headers,
                redirect: 'manual',
            })
            return {
                status: response.status,
                headers: {
                    get: name => response.headers.get(name),
                },
                readText: async maxBytes => {
                    const text = await response.text()
                    if (new TextEncoder().encode(text).byteLength > maxBytes) {
                        throw new Error('Provider response exceeded the maximum diagnostic size.')
                    }
                    return text
                },
            }
        }
    }
})
