import {
    type CreateProviderRequest,
    CreateProviderRequestSchema,
    type UpdateProviderRequest,
    UpdateProviderRequestSchema,
    type AssignProviderRequest,
    AssignProviderRequestSchema,
} from '@hapipower/protocol'
import { Hono } from 'hono'
import { randomUUID } from 'node:crypto'
import type { Store } from '../../store'
import type { WebAppEnv } from '../middleware/auth'
import { decryptAES256GCM, encryptAES256GCM, getEncryptionKey } from '../../utils/crypto'
import { ModelDiscoveryService } from '../../services/modelDiscovery'

function isValidBaseUrl(url: string): boolean {
    try {
        const parsed = new URL(url)
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
        const hostname = parsed.hostname
        if (!hostname) return false
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false
        if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)) return false
        return true
    } catch {
        return false
    }
}

export function createProviderRoutes(store: Store): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()
    const discoveryService = new ModelDiscoveryService()

    app.get('/providers', (c) => {
        const providers = store.providers.getAllWithAssignments()
        return c.json({ providers: providers.map(({ apiKeyEncrypted, ...rest }) => rest) })
    })

    app.get('/providers/:id', (c) => {
        const id = c.req.param('id')
        const provider = store.providers.getById(id)
        if (!provider) {
            return c.json({ error: 'Provider not found' }, 404)
        }
        const { apiKeyEncrypted, ...safe } = provider
        const assignments = store.providers.getAssignments(id)
        return c.json({ provider: { ...safe, assignments } })
    })

    app.post('/providers', async (c) => {
        const body = await c.req.json().catch(() => null)
        const parsed = CreateProviderRequestSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const req: CreateProviderRequest = parsed.data
        if (!isValidBaseUrl(req.baseUrl)) {
            return c.json({ error: 'Invalid base URL. Only public https:// URLs are allowed.' }, 400)
        }

        const now = Date.now()
        const id = randomUUID()
        const key = getEncryptionKey()
        const encryptedApiKey = encryptAES256GCM(req.apiKey, key)

        store.providers.create({
            id,
            name: req.name,
            baseUrl: req.baseUrl,
            apiKeyEncrypted: encryptedApiKey,
            notes: req.notes ?? '',
            createdAt: now,
            updatedAt: now,
        })

        const provider = store.providers.getById(id)
        const { apiKeyEncrypted, ...safe } = provider!
        return c.json({ provider: { ...safe, assignments: [] } }, 201)
    })

    app.put('/providers/:id', async (c) => {
        const id = c.req.param('id')
        const existing = store.providers.getById(id)
        if (!existing) {
            return c.json({ error: 'Provider not found' }, 404)
        }

        const body = await c.req.json().catch(() => null)
        const parsed = UpdateProviderRequestSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const req: UpdateProviderRequest = parsed.data
        if (req.baseUrl !== undefined && !isValidBaseUrl(req.baseUrl)) {
            return c.json({ error: 'Invalid base URL. Only public https:// URLs are allowed.' }, 400)
        }

        const key = getEncryptionKey()
        const fields: Record<string, string> = { updatedAt: String(Date.now()) }
        if (req.name !== undefined) fields.name = req.name
        if (req.baseUrl !== undefined) fields.baseUrl = req.baseUrl
        if (req.apiKey !== undefined) fields.apiKeyEncrypted = encryptAES256GCM(req.apiKey, key)
        if (req.notes !== undefined) fields.notes = req.notes

        store.providers.update(id, {
            name: req.name,
            baseUrl: req.baseUrl,
            apiKeyEncrypted: req.apiKey ? encryptAES256GCM(req.apiKey, key) : undefined,
            notes: req.notes,
        }, Date.now())

        const provider = store.providers.getById(id)
        const { apiKeyEncrypted, ...safe } = provider!
        const assignments = store.providers.getAssignments(id)
        return c.json({ provider: { ...safe, assignments } })
    })

    app.delete('/providers/:id', (c) => {
        const id = c.req.param('id')
        const deleted = store.providers.delete(id)
        if (!deleted) {
            return c.json({ error: 'Provider not found' }, 404)
        }
        return c.json({ ok: true })
    })

    app.post('/providers/:id/assign', async (c) => {
        const id = c.req.param('id')
        const provider = store.providers.getById(id)
        if (!provider) {
            return c.json({ error: 'Provider not found' }, 404)
        }

        const body = await c.req.json().catch(() => null)
        const parsed = AssignProviderRequestSchema.safeParse(body)
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        store.providers.assign(id, parsed.data.agentFlavor, parsed.data.isDefault)
        const assignments = store.providers.getAssignments(id)
        return c.json({ assignments })
    })

    app.delete('/providers/:id/assign/:flavor', (c) => {
        const id = c.req.param('id')
        const flavor = c.req.param('flavor')
        store.providers.unassign(id, flavor)
        return c.json({ ok: true })
    })

    app.post('/providers/:id/discover-models', async (c) => {
        const id = c.req.param('id')
        const provider = store.providers.getById(id)
        if (!provider) {
            return c.json({ error: 'Provider not found' }, 404)
        }
        const result = await discoveryService.discoverModels(id, provider.baseUrl, provider.apiKeyEncrypted)
        return c.json(result)
    })

    app.get('/providers/flavor/:flavor/models', async (c) => {
        const flavor = c.req.param('flavor')
        const assignments = store.providers.getAssignmentsForFlavor(flavor)
        const seen = new Set<string>()
        const models: Array<{ id: string; name: string; providerId: string; providerName: string }> = []

        for (const assignment of assignments) {
            const provider = store.providers.getById(assignment.providerId)
            if (!provider) continue
            try {
                const result = await discoveryService.discoverModels(provider.id, provider.baseUrl, provider.apiKeyEncrypted)
                if (!result.success || !result.models) continue
                for (const m of result.models) {
                    if (seen.has(m.id)) continue
                    seen.add(m.id)
                    models.push({ id: m.id, name: m.name, providerId: provider.id, providerName: provider.name })
                }
            } catch {
                // Skip providers with decryption or discovery failures
            }
        }

        return c.json({ models })
    })

    app.get('/providers/:id/api-key', (c) => {
        const id = c.req.param('id')
        const provider = store.providers.getById(id)
        if (!provider) {
            return c.json({ error: 'Provider not found' }, 404)
        }
        try {
            const key = getEncryptionKey()
            const apiKey = decryptAES256GCM(provider.apiKeyEncrypted, key)
            return c.json({ apiKey })
        } catch {
            return c.json({ error: 'Failed to decrypt API key' }, 500)
        }
    })

    return app
}
