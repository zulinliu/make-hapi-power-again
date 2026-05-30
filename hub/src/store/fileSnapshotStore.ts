import type { Database } from 'bun:sqlite'

// FileSnapshotStore provides CRUD for the file_snapshots table.
// Currently registered in Store but not yet wired to routes — planned for
// undo/checkpoint features in a later iteration. The table and store are
// ready so that the schema migration and data layer don't need to change
// when those features are built.

export type StoredFileSnapshot = {
    id: number
    sessionId: string
    namespace: string
    filePath: string
    contentHash: string
    snapshotType: string
    createdAt: number
}

type DbSnapshotRow = {
    id: number
    session_id: string
    namespace: string
    file_path: string
    content_hash: string
    snapshot_type: string
    created_at: number
}

function toStoredFileSnapshot(row: DbSnapshotRow): StoredFileSnapshot {
    return {
        id: row.id,
        sessionId: row.session_id,
        namespace: row.namespace,
        filePath: row.file_path,
        contentHash: row.content_hash,
        snapshotType: row.snapshot_type,
        createdAt: row.created_at,
    }
}

export class FileSnapshotStore {
    private readonly db: Database

    constructor(db: Database) {
        this.db = db
    }

    createSnapshot(sessionId: string, filePath: string, contentHash: string, snapshotType: string = 'auto', namespace: string = 'default'): StoredFileSnapshot {
        const now = Date.now()
        const stmt = this.db.prepare(
            `INSERT INTO file_snapshots (session_id, namespace, file_path, content_hash, snapshot_type, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
        )
        stmt.run(sessionId, namespace, filePath, contentHash, snapshotType, now)
        const row = this.db.prepare('SELECT * FROM file_snapshots WHERE session_id = ? AND file_path = ? AND created_at = ?').get(sessionId, filePath, now) as DbSnapshotRow
        return toStoredFileSnapshot(row)
    }

    getLatestSnapshot(sessionId: string, filePath: string): StoredFileSnapshot | null {
        const row = this.db.prepare(
            `SELECT * FROM file_snapshots
             WHERE session_id = ? AND file_path = ?
             ORDER BY created_at DESC LIMIT 1`
        ).get(sessionId, filePath) as DbSnapshotRow | undefined
        return row ? toStoredFileSnapshot(row) : null
    }

    getSnapshotsForSession(sessionId: string, limit: number = 100): StoredFileSnapshot[] {
        const rows = this.db.prepare(
            `SELECT * FROM file_snapshots
             WHERE session_id = ?
             ORDER BY created_at DESC LIMIT ?`
        ).all(sessionId, limit) as DbSnapshotRow[]
        return rows.map(toStoredFileSnapshot)
    }

    getSnapshotsByType(sessionId: string, snapshotType: string, limit: number = 100): StoredFileSnapshot[] {
        const rows = this.db.prepare(
            `SELECT * FROM file_snapshots
             WHERE session_id = ? AND snapshot_type = ?
             ORDER BY created_at DESC LIMIT ?`
        ).all(sessionId, snapshotType, limit) as DbSnapshotRow[]
        return rows.map(toStoredFileSnapshot)
    }

    deleteSnapshotsForSession(sessionId: string): number {
        const result = this.db.prepare('DELETE FROM file_snapshots WHERE session_id = ?').run(sessionId)
        return result.changes
    }
}
