import {
    type AssignProviderRequest,
    AssignProviderRequestSchema,
    CheckProviderRequestSchema,
    CreateProviderKeyRevealTokenRequestSchema,
    type CreateProviderRequest,
    CreateProviderRequestSchema,
    type DiscoveredModel,
    type ProviderHealth,
    type ProviderOverviewResponse,
    type ProviderWithAssignments,
    RevealProviderKeyRequestSchema,
    RotateProviderKeyRequestSchema,
    type UpdateProviderRequest,
    UpdateProviderRequestSchema,
    eventBus,
} from '@hapipower/protocol'
import { Hono } from 'hono'
import { randomBytes, randomUUID } from 'node:crypto'
import type { Store } from '../../store'
import type { StoredProvider } from '../../store/providerStore'
import type { WebAppEnv } from '../middleware/auth'
import { decryptAES256GCM, encryptAES256GCM, getEncryptionKey } from '../../utils/crypto'
import { ModelDiscoveryService } from '../../services/modelDiscovery'
import {
    getDefaultProviderCapabilities,
    getProviderSecurityOptionsFromEnv,
    validateProviderBaseUrl,
} from '../../services/providerSecurity'

const REVEAL_TTL_MS = 60_000
type RevealGrant = {
    namespace: string
    providerId: string
    expiresAt: number
}

function buildDefaultHealth(): ProviderHealth {
    return {
        status: 'unknown',
        latencyMs: null,
        checkedAt: null,
        errorCode: null,
        errorMessage: null,
        protocolDetected: null,
        capabilities: getDefaultProviderCapabilities(),
    }
}

function maskProviderKey(encrypted: string): string {
    try {
        const key = getEncryptionKey()
        const apiKey = decryptAES256GCM(encrypted, key)
        const last4 = apiKey.slice(-4)
        return last4 ? `••••${last4}` : '••••'
    } catch {
        return '••••'
    }
}

function toPublicProvider(provider: StoredProvider, assignments: ProviderWithAssignments['assignments'] = []): ProviderWithAssignments {
    const { apiKeyEncrypted: _apiKeyEncrypted, ...safe } = provider
    return {
        ...safe,
        apiKeyMasked: maskProviderKey(provider.apiKeyEncrypted),
        assignments,
    }
}

function getProviderWithAssignments(store: Store, id: string, namespace: string): ProviderWithAssignments | null {
    const provider = store.providers.getById(id, namespace)
    if (!provider) return null
    return toPublicProvider(provider, store.providers.getAssignments(id, namespace))
}

function buildOverview(store: Store, namespace: string): ProviderOverviewResponse {
    const providers = store.providers.getAllWithAssignments(namespace).map(provider => toPublicProvider(provider, provider.assignments))
    const assignedAgents = new Set<string>()
    for (const provider of providers) {
        for (const assignment of provider.assignments) {
            if (assignment.isDefault) {
                assignedAgents.add(assignment.agentFlavor)
            }
        }
    }

    return {
        providers,
        summary: {
            total: providers.length,
            online: providers.filter(provider => provider.health.status === 'online').length,
            degraded: providers.filter(provider => provider.health.status === 'degraded').length,
            offline: providers.filter(provider => provider.health.status === 'offline').length,
            blocked: providers.filter(provider => provider.health.status === 'blocked').length,
            unknown: providers.filter(provider => provider.health.status === 'unknown' || provider.health.status === 'checking').length,
            assignedAgents: assignedAgents.size,
        },
    }
}

function applyDiscoveryResult(
    store: Store,
    namespace: string,
    providerId: string,
    health: ProviderHealth | undefined,
    models: DiscoveredModel[] | undefined
): ProviderWithAssignments | null {
    if (health) {
        if (models !== undefined) {
            store.providers.updateHealthAndModelCache(providerId, namespace, health, models, Date.now())
        } else {
            store.providers.updateHealth(providerId, namespace, health, Date.now())
        }
    }
    return getProviderWithAssignments(store, providerId, namespace)
}

function providerNameExists(store: Store, namespace: string, name: string, excludeId?: string): boolean {
    return store.providers.getAll(namespace).some(provider => provider.name === name && provider.id !== excludeId)
}

export function createProviderRoutes(store: Store, discoveryService = new ModelDiscoveryService()): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()
    const revealGrants = new Map<string, RevealGrant>()

    function getProviderSecurityOptions() {
        return getProviderSecurityOptionsFromEnv()
    }

    function pruneRevealGrants(now = Date.now()): void {
        for (const [token, grant] of revealGrants.entries()) {
            if (grant.expiresAt <= now) {
                revealGrants.delete(token)
            }
        }
    }

    app.get('/providers', (c) => {
        const namespace = c.get('namespace')
        return c.json({ providers: buildOverview(store, namespace).providers })
    })

    app.get('/providers/overview', (c) => {
        const namespace = c.get('namespace')
        return c.json(buildOverview(store, namespace))
    })

    app.get('/providers/:id', (c) => {
        const namespace = c.get('namespace')
        const id = c.req.param('id')
        const provider = getProviderWithAssignments(store, id, namespace)
        if (!provider) {
            return c.json({ error: 'Provider not found' }, 404)
        }
        return c.json({ provider })
    })

    app.post('/providers', async (c) => {
        const namespace = c.get('namespace')
        const body = await c.req.json().catch(() => null)
        const parsed = CreateProviderRequestSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const req: CreateProviderRequest = parsed.data
        const validation = await validateProviderBaseUrl(req.baseUrl, getProviderSecurityOptions())
        if (!validation.ok) {
            return c.json({ error: validation.message, code: validation.code }, 400)
        }
        if (providerNameExists(store, namespace, req.name)) {
            return c.json({ error: 'Provider name already exists', code: 'provider-name-conflict' }, 409)
        }

        const now = Date.now()
        const id = randomUUID()
        const key = getEncryptionKey()
        const encryptedApiKey = encryptAES256GCM(req.apiKey, key)

        store.providers.create({
            id,
            namespace,
            name: req.name,
            baseUrl: req.baseUrl,
            apiKeyEncrypted: encryptedApiKey,
            protocol: req.protocol,
            defaultModel: req.defaultModel ?? null,
            health: buildDefaultHealth(),
            modelCache: [],
            modelCacheUpdatedAt: null,
            notes: req.notes ?? '',
            createdAt: now,
            updatedAt: now,
        })

        const provider = getProviderWithAssignments(store, id, namespace)
        return c.json({ provider }, 201)
    })

    app.put('/providers/:id', async (c) => {
        const namespace = c.get('namespace')
        const id = c.req.param('id')
        const existing = store.providers.getById(id, namespace)
        if (!existing) {
            return c.json({ error: 'Provider not found' }, 404)
        }

        const body = await c.req.json().catch(() => null)
        const parsed = UpdateProviderRequestSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const req: UpdateProviderRequest = parsed.data
        if (req.name !== undefined && providerNameExists(store, namespace, req.name, id)) {
            return c.json({ error: 'Provider name already exists', code: 'provider-name-conflict' }, 409)
        }
        if (req.baseUrl !== undefined) {
            const validation = await validateProviderBaseUrl(req.baseUrl, getProviderSecurityOptions())
            if (!validation.ok) {
                return c.json({ error: validation.message, code: validation.code }, 400)
            }
        }

        const key = getEncryptionKey()
        const affectsDiscoveryCache = req.baseUrl !== undefined || req.apiKey !== undefined || req.protocol !== undefined
        store.providers.update(id, namespace, {
            name: req.name,
            baseUrl: req.baseUrl,
            apiKeyEncrypted: req.apiKey ? encryptAES256GCM(req.apiKey, key) : undefined,
            protocol: req.protocol,
            ...(Object.prototype.hasOwnProperty.call(req, 'defaultModel') ? { defaultModel: req.defaultModel ?? null } : {}),
            notes: req.notes,
        }, Date.now())
        if (affectsDiscoveryCache) {
            discoveryService.clearCache()
        }

        const provider = getProviderWithAssignments(store, id, namespace)
        return c.json({ provider })
    })

    app.delete('/providers/:id', (c) => {
        const namespace = c.get('namespace')
        const id = c.req.param('id')
        const deleted = store.providers.delete(id, namespace)
        if (!deleted) {
            return c.json({ error: 'Provider not found' }, 404)
        }
        return c.json({ ok: true })
    })

    app.post('/providers/:id/assign', async (c) => {
        const namespace = c.get('namespace')
        const id = c.req.param('id')
        const provider = store.providers.getById(id, namespace)
        if (!provider) {
            return c.json({ error: 'Provider not found' }, 404)
        }

        const body = await c.req.json().catch(() => null)
        const parsed = AssignProviderRequestSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const req: AssignProviderRequest = parsed.data
        store.providers.assign(id, namespace, req.agentFlavor, req.isDefault, req.model ?? null)
        const assignments = store.providers.getAssignments(id, namespace)
        return c.json({ assignments, provider: toPublicProvider(provider, assignments) })
    })

    app.delete('/providers/:id/assign/:flavor', (c) => {
        const namespace = c.get('namespace')
        const id = c.req.param('id')
        const flavor = c.req.param('flavor')
        store.providers.unassign(id, namespace, flavor)
        return c.json({ ok: true })
    })

    app.post('/providers/:id/discover-models', async (c) => {
        const namespace = c.get('namespace')
        const id = c.req.param('id')
        const provider = store.providers.getById(id, namespace)
        if (!provider) {
            return c.json({ error: 'Provider not found' }, 404)
        }
        const result = await discoveryService.discoverModels(id, provider.baseUrl, provider.apiKeyEncrypted, {
            namespace,
            protocol: provider.protocol,
            security: getProviderSecurityOptions(),
        })
        applyDiscoveryResult(store, namespace, id, result.health, result.models)
        return c.json(result)
    })

    app.post('/providers/:id/check', async (c) => {
        const namespace = c.get('namespace')
        const id = c.req.param('id')
        const provider = store.providers.getById(id, namespace)
        if (!provider) {
            return c.json({ error: 'Provider not found' }, 404)
        }

        const body = await c.req.json().catch(() => ({}))
        const parsed = CheckProviderRequestSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await discoveryService.discoverModels(id, provider.baseUrl, provider.apiKeyEncrypted, {
            namespace,
            protocol: provider.protocol,
            force: parsed.data.force,
            security: getProviderSecurityOptions(),
        })
        const updated = applyDiscoveryResult(store, namespace, id, result.health, result.models)
        if (!updated || !result.diagnostic) {
            return c.json({ error: 'Provider check failed' }, 500)
        }
        return c.json({ success: result.success, provider: updated, diagnostic: result.diagnostic })
    })

    app.post('/providers/:id/rotate-key', async (c) => {
        const namespace = c.get('namespace')
        const id = c.req.param('id')
        const provider = store.providers.getById(id, namespace)
        if (!provider) {
            return c.json({ error: 'Provider not found' }, 404)
        }

        const body = await c.req.json().catch(() => null)
        const parsed = RotateProviderKeyRequestSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const key = getEncryptionKey()
        store.providers.update(id, namespace, {
            apiKeyEncrypted: encryptAES256GCM(parsed.data.apiKey, key),
        }, Date.now())
        discoveryService.clearCache()
        const updated = getProviderWithAssignments(store, id, namespace)
        return c.json({ provider: updated })
    })

    app.post('/providers/:id/reveal-key-token', async (c) => {
        const namespace = c.get('namespace')
        const id = c.req.param('id')
        const provider = store.providers.getById(id, namespace)
        if (!provider) {
            return c.json({ error: 'Provider not found' }, 404)
        }

        const body = await c.req.json().catch(() => null)
        const parsed = CreateProviderKeyRevealTokenRequestSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        pruneRevealGrants()
        const createdAt = Date.now()
        const expiresAt = createdAt + REVEAL_TTL_MS
        const revealToken = randomBytes(16).toString('hex')
        revealGrants.set(revealToken, { namespace, providerId: id, expiresAt })
        const auditEvent = {
            namespace,
            providerId: id,
            userId: c.get('userId') ?? null,
            createdAt,
            expiresAt,
        }
        eventBus.emit('provider:key-reveal-token-created', auditEvent)
        console.info('provider-key-reveal', auditEvent)
        return c.json({ revealToken, expiresAt })
    })

    app.post('/providers/:id/reveal-key', async (c) => {
        const namespace = c.get('namespace')
        const id = c.req.param('id')
        const provider = store.providers.getById(id, namespace)
        if (!provider) {
            return c.json({ error: 'Provider not found' }, 404)
        }

        const body = await c.req.json().catch(() => null)
        const parsed = RevealProviderKeyRequestSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        pruneRevealGrants()
        const grant = revealGrants.get(parsed.data.revealToken)
        if (!grant || grant.namespace !== namespace || grant.providerId !== id || grant.expiresAt <= Date.now()) {
            return c.json({ error: 'Reveal token is invalid or expired' }, 403)
        }

        revealGrants.delete(parsed.data.revealToken)
        const key = getEncryptionKey()
        const apiKey = decryptAES256GCM(provider.apiKeyEncrypted, key)
        return c.json({ apiKey })
    })

    app.get('/providers/:id/api-key', (c) => {
        return c.json({ error: 'Use POST /api/providers/:id/reveal-key-token with explicit confirmation.' }, 410)
    })

    app.get('/providers/flavor/:flavor/models', async (c) => {
        const namespace = c.get('namespace')
        const flavor = c.req.param('flavor')
        const assignments = store.providers.getAssignmentsForFlavor(flavor, namespace).filter(assignment => assignment.isDefault)
        const seen = new Set<string>()
        const models: Array<{ id: string; name: string; providerId: string; providerName: string }> = []

        for (const assignment of assignments) {
            const provider = store.providers.getById(assignment.providerId, namespace)
            if (!provider) continue

            const cachedModels = provider.modelCache.length > 0
                ? provider.modelCache
                : (await discoveryService.discoverModels(provider.id, provider.baseUrl, provider.apiKeyEncrypted, {
                    namespace,
                    protocol: provider.protocol,
                    security: getProviderSecurityOptions(),
                })).models ?? []

            for (const model of cachedModels) {
                const key = `${provider.id}:${model.id}`
                if (seen.has(key)) continue
                seen.add(key)
                models.push({ id: model.id, name: model.name, providerId: provider.id, providerName: provider.name })
            }
        }

        return c.json({ models })
    })

    return app
}
