import type { Database, Statement } from 'bun:sqlite'
import type {
    AgentFlavor,
    DiscoveredModel,
    ProviderCapability,
    ProviderHealth,
    ProviderHealthStatus,
    ProviderProtocol,
} from '@hapipower/protocol'
import { AgentFlavorSchema } from '@hapipower/protocol'
import { getDefaultProviderCapabilities } from '../services/providerSecurity'

export type StoredProvider = {
    id: string
    namespace: string
    name: string
    baseUrl: string
    apiKeyEncrypted: string
    protocol: ProviderProtocol
    defaultModel: string | null
    health: ProviderHealth
    modelCache: DiscoveredModel[]
    modelCacheUpdatedAt: number | null
    notes: string
    createdAt: number
    updatedAt: number
}

export type StoredProviderAssignment = {
    id: number
    namespace: string
    providerId: string
    agentFlavor: AgentFlavor
    isDefault: boolean
    model: string | null
}

type ProviderRow = {
    id: string
    namespace: string
    name: string
    base_url: string
    api_key_encrypted: string
    protocol: string
    default_model: string | null
    health_json: string | null
    model_cache_json: string | null
    model_cache_updated_at: number | null
    notes: string
    created_at: number
    updated_at: number
}

type AssignmentRow = {
    id: number
    namespace: string
    provider_id: string
    agent_flavor: string
    is_default: number
    model: string | null
}

function toProvider(row: ProviderRow): StoredProvider {
    return {
        id: row.id,
        namespace: row.namespace,
        name: row.name,
        baseUrl: row.base_url,
        apiKeyEncrypted: row.api_key_encrypted,
        protocol: parseProtocol(row.protocol),
        defaultModel: row.default_model,
        health: parseHealth(row.health_json),
        modelCache: parseModelCache(row.model_cache_json),
        modelCacheUpdatedAt: row.model_cache_updated_at,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function toAssignment(row: AssignmentRow): StoredProviderAssignment {
    return {
        id: row.id,
        namespace: row.namespace,
        providerId: row.provider_id,
        agentFlavor: parseAgentFlavor(row.agent_flavor),
        isDefault: row.is_default === 1,
        model: row.model,
    }
}

function parseAgentFlavor(value: string): AgentFlavor {
    const parsed = AgentFlavorSchema.safeParse(value)
    return parsed.success ? parsed.data : 'claude'
}

function parseProtocol(value: string): ProviderProtocol {
    if (value === 'anthropic' || value === 'openai' || value === 'gemini' || value === 'auto') {
        return value
    }
    return 'auto'
}

function defaultHealth(): ProviderHealth {
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

function parseHealth(raw: string | null): ProviderHealth {
    if (!raw) return defaultHealth()
    try {
        const parsed = JSON.parse(raw) as Partial<ProviderHealth>
        return {
            status: parseHealthStatus(parsed.status),
            latencyMs: typeof parsed.latencyMs === 'number' ? parsed.latencyMs : null,
            checkedAt: typeof parsed.checkedAt === 'number' ? parsed.checkedAt : null,
            errorCode: typeof parsed.errorCode === 'string' ? parsed.errorCode : null,
            errorMessage: typeof parsed.errorMessage === 'string' ? parsed.errorMessage : null,
            protocolDetected: parsed.protocolDetected ? parseProtocol(parsed.protocolDetected) : null,
            capabilities: parseCapabilities(parsed.capabilities),
        }
    } catch {
        return defaultHealth()
    }
}

function parseHealthStatus(value: unknown): ProviderHealthStatus {
    if (value === 'checking' || value === 'online' || value === 'degraded' || value === 'offline' || value === 'blocked') {
        return value
    }
    return 'unknown'
}

function parseCapabilities(value: unknown): ProviderCapability {
    if (!value || typeof value !== 'object') {
        return getDefaultProviderCapabilities()
    }
    const raw = value as Partial<ProviderCapability>
    return {
        modelsEndpoint: raw.modelsEndpoint === true,
        messagesEndpoint: raw.messagesEndpoint === true,
        streaming: typeof raw.streaming === 'boolean' ? raw.streaming : null,
        tokenUsage: typeof raw.tokenUsage === 'boolean' ? raw.tokenUsage : null,
        contextWindow: typeof raw.contextWindow === 'number' ? raw.contextWindow : null,
        toolUse: typeof raw.toolUse === 'boolean' ? raw.toolUse : null,
        imageInput: typeof raw.imageInput === 'boolean' ? raw.imageInput : null,
    }
}

function parseModelCache(raw: string | null): DiscoveredModel[] {
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw) as unknown
        if (!Array.isArray(parsed)) return []
        return parsed.flatMap((entry): DiscoveredModel[] => {
            if (!entry || typeof entry !== 'object') return []
            const model = entry as Record<string, unknown>
            const id = typeof model.id === 'string' ? model.id : null
            const name = typeof model.name === 'string' ? model.name : id
            if (!id || !name) return []
            return [{
                id,
                name,
                ...(typeof model.ownedBy === 'string' ? { ownedBy: model.ownedBy } : {}),
            }]
        })
    } catch {
        return []
    }
}

export class ProviderStore {
    private readonly db: Database
    private readonly stmtGetAll: Statement
    private readonly stmtGetById: Statement
    private readonly stmtInsert: Statement
    private readonly stmtUpdate: Statement
    private readonly stmtDelete: Statement
    private readonly stmtGetAssignments: Statement
    private readonly stmtInsertAssignment: Statement
    private readonly stmtDeleteAssignment: Statement
    private readonly stmtGetDefaultForFlavor: Statement
    private readonly stmtClearDefaultForFlavor: Statement

    constructor(db: Database) {
        this.db = db
        this.stmtGetAll = db.prepare('SELECT * FROM providers WHERE namespace = ? ORDER BY created_at DESC')
        this.stmtGetById = db.prepare('SELECT * FROM providers WHERE id = ? AND namespace = ?')
        this.stmtInsert = db.prepare(
            `INSERT INTO providers (
                id, namespace, name, base_url, api_key_encrypted, protocol, default_model,
                health_json, model_cache_json, model_cache_updated_at, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        this.stmtUpdate = db.prepare(
            `UPDATE providers SET
                name = COALESCE(?, name),
                base_url = COALESCE(?, base_url),
                api_key_encrypted = COALESCE(?, api_key_encrypted),
                protocol = COALESCE(?, protocol),
                default_model = CASE WHEN ? = 1 THEN ? ELSE default_model END,
                notes = COALESCE(?, notes),
                updated_at = ?
            WHERE id = ? AND namespace = ?`
        )
        this.stmtDelete = db.prepare('DELETE FROM providers WHERE id = ? AND namespace = ?')
        this.stmtGetAssignments = db.prepare('SELECT * FROM provider_assignments WHERE provider_id = ? AND namespace = ?')
        this.stmtInsertAssignment = db.prepare(
            `INSERT INTO provider_assignments (namespace, provider_id, agent_flavor, is_default, model)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(namespace, provider_id, agent_flavor)
             DO UPDATE SET is_default = excluded.is_default, model = excluded.model`
        )
        this.stmtDeleteAssignment = db.prepare(
            'DELETE FROM provider_assignments WHERE provider_id = ? AND agent_flavor = ? AND namespace = ?'
        )
        this.stmtGetDefaultForFlavor = db.prepare(
            `SELECT p.* FROM providers p
             JOIN provider_assignments pa ON p.id = pa.provider_id AND p.namespace = pa.namespace
             WHERE pa.agent_flavor = ? AND pa.namespace = ? AND pa.is_default = 1 LIMIT 1`
        )
        this.stmtClearDefaultForFlavor = db.prepare(
            'UPDATE provider_assignments SET is_default = 0 WHERE agent_flavor = ? AND namespace = ? AND is_default = 1'
        )
    }

    getAll(namespace: string): StoredProvider[] {
        return (this.stmtGetAll.all(namespace) as ProviderRow[]).map(toProvider)
    }

    getById(id: string, namespace: string): StoredProvider | null {
        const row = this.stmtGetById.get(id, namespace) as ProviderRow | null
        return row ? toProvider(row) : null
    }

    create(provider: StoredProvider): void {
        this.stmtInsert.run(
            provider.id,
            provider.namespace,
            provider.name,
            provider.baseUrl,
            provider.apiKeyEncrypted,
            provider.protocol,
            provider.defaultModel,
            JSON.stringify(provider.health),
            JSON.stringify(provider.modelCache),
            provider.modelCacheUpdatedAt,
            provider.notes,
            provider.createdAt,
            provider.updatedAt
        )
    }

    update(
        id: string,
        namespace: string,
        fields: Partial<Pick<StoredProvider, 'name' | 'baseUrl' | 'apiKeyEncrypted' | 'protocol' | 'defaultModel' | 'notes'>>,
        updatedAt: number
    ): boolean {
        const result = this.stmtUpdate.run(
            fields.name ?? null,
            fields.baseUrl ?? null,
            fields.apiKeyEncrypted ?? null,
            fields.protocol ?? null,
            Object.prototype.hasOwnProperty.call(fields, 'defaultModel') ? 1 : 0,
            fields.defaultModel ?? null,
            fields.notes ?? null,
            updatedAt,
            id,
            namespace
        )
        return result.changes > 0
    }

    delete(id: string, namespace: string): boolean {
        const result = this.stmtDelete.run(id, namespace)
        return result.changes > 0
    }

    getAssignments(providerId: string, namespace: string): StoredProviderAssignment[] {
        return (this.stmtGetAssignments.all(providerId, namespace) as AssignmentRow[]).map(toAssignment)
    }

    assign(providerId: string, namespace: string, agentFlavor: string, isDefault: boolean, model: string | null = null): void {
        if (isDefault) {
            this.stmtClearDefaultForFlavor.run(agentFlavor, namespace)
        }
        this.stmtInsertAssignment.run(namespace, providerId, agentFlavor, isDefault ? 1 : 0, model)
    }

    unassign(providerId: string, namespace: string, agentFlavor: string): boolean {
        const result = this.stmtDeleteAssignment.run(providerId, agentFlavor, namespace)
        return result.changes > 0
    }

    getDefaultForFlavor(agentFlavor: string, namespace: string): StoredProvider | null {
        const row = this.stmtGetDefaultForFlavor.get(agentFlavor, namespace) as ProviderRow | null
        return row ? toProvider(row) : null
    }

    getAssignmentsForFlavor(agentFlavor: string, namespace: string): StoredProviderAssignment[] {
        const stmt = this.db.prepare('SELECT * FROM provider_assignments WHERE agent_flavor = ? AND namespace = ?')
        return (stmt.all(agentFlavor, namespace) as AssignmentRow[]).map(toAssignment)
    }

    updateHealthAndModelCache(
        id: string,
        namespace: string,
        health: ProviderHealth,
        modelCache: DiscoveredModel[],
        updatedAt: number
    ): boolean {
        const result = this.db.prepare(
            `UPDATE providers
             SET health_json = ?, model_cache_json = ?, model_cache_updated_at = ?, updated_at = ?
             WHERE id = ? AND namespace = ?`
        ).run(JSON.stringify(health), JSON.stringify(modelCache), updatedAt, updatedAt, id, namespace)
        return result.changes > 0
    }

    updateHealth(id: string, namespace: string, health: ProviderHealth, updatedAt: number): boolean {
        const result = this.db.prepare(
            `UPDATE providers
             SET health_json = ?, updated_at = ?
             WHERE id = ? AND namespace = ?`
        ).run(JSON.stringify(health), updatedAt, id, namespace)
        return result.changes > 0
    }

    getAllWithAssignments(namespace: string): (StoredProvider & { assignments: StoredProviderAssignment[] })[] {
        const providers = this.getAll(namespace)
        return providers.map((p) => ({
            ...p,
            assignments: this.getAssignments(p.id, namespace),
        }))
    }
}
