import type { Database, Statement } from 'bun:sqlite'

export type StoredProvider = {
    id: string
    name: string
    baseUrl: string
    apiKeyEncrypted: string
    notes: string
    createdAt: number
    updatedAt: number
}

export type StoredProviderAssignment = {
    id: number
    providerId: string
    agentFlavor: string
    isDefault: boolean
}

type ProviderRow = {
    id: string
    name: string
    base_url: string
    api_key_encrypted: string
    notes: string
    created_at: number
    updated_at: number
}

type AssignmentRow = {
    id: number
    provider_id: string
    agent_flavor: string
    is_default: number
}

function toProvider(row: ProviderRow): StoredProvider {
    return {
        id: row.id,
        name: row.name,
        baseUrl: row.base_url,
        apiKeyEncrypted: row.api_key_encrypted,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

function toAssignment(row: AssignmentRow): StoredProviderAssignment {
    return {
        id: row.id,
        providerId: row.provider_id,
        agentFlavor: row.agent_flavor,
        isDefault: row.is_default === 1,
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
        this.stmtGetAll = db.prepare('SELECT * FROM providers ORDER BY created_at DESC')
        this.stmtGetById = db.prepare('SELECT * FROM providers WHERE id = ?')
        this.stmtInsert = db.prepare(
            'INSERT INTO providers (id, name, base_url, api_key_encrypted, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        this.stmtUpdate = db.prepare(
            'UPDATE providers SET name = COALESCE(?, name), base_url = COALESCE(?, base_url), api_key_encrypted = COALESCE(?, api_key_encrypted), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?'
        )
        this.stmtDelete = db.prepare('DELETE FROM providers WHERE id = ?')
        this.stmtGetAssignments = db.prepare('SELECT * FROM provider_assignments WHERE provider_id = ?')
        this.stmtInsertAssignment = db.prepare(
            'INSERT INTO provider_assignments (provider_id, agent_flavor, is_default) VALUES (?, ?, ?) ON CONFLICT(provider_id, agent_flavor) DO UPDATE SET is_default = excluded.is_default'
        )
        this.stmtDeleteAssignment = db.prepare(
            'DELETE FROM provider_assignments WHERE provider_id = ? AND agent_flavor = ?'
        )
        this.stmtGetDefaultForFlavor = db.prepare(
            'SELECT p.* FROM providers p JOIN provider_assignments pa ON p.id = pa.provider_id WHERE pa.agent_flavor = ? AND pa.is_default = 1 LIMIT 1'
        )
        this.stmtClearDefaultForFlavor = db.prepare(
            'UPDATE provider_assignments SET is_default = 0 WHERE agent_flavor = ? AND is_default = 1'
        )
    }

    getAll(): StoredProvider[] {
        return (this.stmtGetAll.all() as ProviderRow[]).map(toProvider)
    }

    getById(id: string): StoredProvider | null {
        const row = this.stmtGetById.get(id) as ProviderRow | null
        return row ? toProvider(row) : null
    }

    create(provider: StoredProvider): void {
        this.stmtInsert.run(
            provider.id,
            provider.name,
            provider.baseUrl,
            provider.apiKeyEncrypted,
            provider.notes,
            provider.createdAt,
            provider.updatedAt
        )
    }

    update(id: string, fields: Partial<Pick<StoredProvider, 'name' | 'baseUrl' | 'apiKeyEncrypted' | 'notes'>>, updatedAt: number): boolean {
        const result = this.stmtUpdate.run(
            fields.name ?? null,
            fields.baseUrl ?? null,
            fields.apiKeyEncrypted ?? null,
            fields.notes ?? null,
            updatedAt,
            id
        )
        return result.changes > 0
    }

    delete(id: string): boolean {
        const result = this.stmtDelete.run(id)
        return result.changes > 0
    }

    getAssignments(providerId: string): StoredProviderAssignment[] {
        return (this.stmtGetAssignments.all(providerId) as AssignmentRow[]).map(toAssignment)
    }

    assign(providerId: string, agentFlavor: string, isDefault: boolean): void {
        if (isDefault) {
            this.stmtClearDefaultForFlavor.run(agentFlavor)
        }
        this.stmtInsertAssignment.run(providerId, agentFlavor, isDefault ? 1 : 0)
    }

    unassign(providerId: string, agentFlavor: string): boolean {
        const result = this.stmtDeleteAssignment.run(providerId, agentFlavor)
        return result.changes > 0
    }

    getDefaultForFlavor(agentFlavor: string): StoredProvider | null {
        const row = this.stmtGetDefaultForFlavor.get(agentFlavor) as ProviderRow | null
        return row ? toProvider(row) : null
    }

    getAssignmentsForFlavor(agentFlavor: string): StoredProviderAssignment[] {
        const stmt = this.db.prepare('SELECT * FROM provider_assignments WHERE agent_flavor = ?')
        return (stmt.all(agentFlavor) as AssignmentRow[]).map(toAssignment)
    }

    getAllWithAssignments(): (StoredProvider & { assignments: StoredProviderAssignment[] })[] {
        const providers = this.getAll()
        return providers.map((p) => ({
            ...p,
            assignments: this.getAssignments(p.id),
        }))
    }
}
