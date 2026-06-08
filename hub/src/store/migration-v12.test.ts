import { describe, expect, it, setDefaultTimeout } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store } from './index'
import { removeTempDir } from '../test/removeTempDir'

setDefaultTimeout(90_000)

describe('Store V11→V12 migration: Model Nexus provider schema', () => {
    it('fresh DB has namespace-aware provider tables', () => {
        const store = new Store(':memory:')
        try {
            const db = getDb(store)
            const providerColumns = getTableColumns(db, 'providers')
            const assignmentColumns = getTableColumns(db, 'provider_assignments')

            expect(providerColumns).toContain('namespace')
            expect(providerColumns).toContain('protocol')
            expect(providerColumns).toContain('health_json')
            expect(providerColumns).toContain('model_cache_json')
            expect(providerColumns).toContain('model_cache_updated_at')
            expect(assignmentColumns).toContain('namespace')
            expect(assignmentColumns).toContain('model')
            expect(hasUniqueIndex(db, 'providers', ['namespace', 'name'])).toBe(true)
            expect(hasUniqueIndex(db, 'provider_assignments', ['namespace', 'provider_id', 'agent_flavor'])).toBe(true)
        } finally {
            store.close()
        }
    })

    it('migrates V11 provider rows and rebuilds UNIQUE(namespace, name)', () => {
        const dir = mkdtempSync(join(tmpdir(), 'hapi-migration-v12-test-'))
        const dbPath = join(dir, 'test.db')
        let store: Store | undefined
        try {
            const db = new Database(dbPath, { create: true, readwrite: true, strict: true })
            db.exec('PRAGMA journal_mode = WAL')
            db.exec('PRAGMA foreign_keys = ON')
            createV11Schema(db)
            db.exec("INSERT INTO providers (id, name, base_url, api_key_encrypted, notes, created_at, updated_at) VALUES ('p1', 'Gateway', 'https://api.example.com', 'key-1', '', 1, 1)")
            db.exec("INSERT INTO providers (id, name, base_url, api_key_encrypted, notes, created_at, updated_at) VALUES ('p2', 'Gateway', 'https://api2.example.com', 'key-2', '', 2, 2)")
            db.exec("INSERT INTO provider_assignments (provider_id, agent_flavor, is_default) VALUES ('p1', 'claude', 1)")
            db.exec("INSERT INTO provider_assignments (provider_id, agent_flavor, is_default) VALUES ('p2', 'codex', 0)")
            db.exec('PRAGMA user_version = 11')
            db.close()

            store = new Store(dbPath)
            const migratedDb = getDb(store)
            const rows = migratedDb.prepare('SELECT id, namespace, name, protocol FROM providers ORDER BY id').all() as Array<{
                id: string
                namespace: string
                name: string
                protocol: string
            }>
            const assignments = migratedDb.prepare('SELECT provider_id, namespace, agent_flavor, model FROM provider_assignments ORDER BY provider_id').all() as Array<{
                provider_id: string
                namespace: string
                agent_flavor: string
                model: string | null
            }>

            expect(rows).toEqual([
                { id: 'p1', namespace: 'default', name: 'Gateway', protocol: 'auto' },
                { id: 'p2', namespace: 'default', name: 'Gateway (p2)', protocol: 'auto' },
            ])
            expect(assignments).toEqual([
                { provider_id: 'p1', namespace: 'default', agent_flavor: 'claude', model: null },
                { provider_id: 'p2', namespace: 'default', agent_flavor: 'codex', model: null },
            ])
            expect(hasUniqueIndex(migratedDb, 'providers', ['namespace', 'name'])).toBe(true)
            expect(() => migratedDb.exec("INSERT INTO providers (id, namespace, name, base_url, api_key_encrypted, protocol, notes, created_at, updated_at) VALUES ('p3', 'default', 'Gateway', 'https://api3.example.com', 'key-3', 'auto', '', 3, 3)")).toThrow()
        } finally {
            store?.close()
            removeTempDir(dir)
        }
    })

    it('legacy user_version=0 with V11 provider tables runs full ladder into V12', () => {
        const dir = mkdtempSync(join(tmpdir(), 'hapi-legacy-v0-v12-'))
        const dbPath = join(dir, 'test.db')
        let store: Store | undefined
        try {
            const db = new Database(dbPath, { create: true, readwrite: true, strict: true })
            db.exec('PRAGMA journal_mode = WAL')
            db.exec('PRAGMA foreign_keys = ON')
            createV11Schema(db)
            db.exec("INSERT INTO providers (id, name, base_url, api_key_encrypted, notes, created_at, updated_at) VALUES ('p1', 'Gateway', 'https://api.example.com', 'key-1', '', 1, 1)")
            db.close()

            store = new Store(dbPath)
            const db2 = getDb(store)
            expect(getTableColumns(db2, 'providers')).toContain('namespace')
            expect(getTableColumns(db2, 'provider_assignments')).toContain('namespace')
            expect(hasUniqueIndex(db2, 'providers', ['namespace', 'name'])).toBe(true)
        } finally {
            store?.close()
            removeTempDir(dir)
        }
    })

    it('migrates with only one default assignment per namespace and flavor', () => {
        const dir = mkdtempSync(join(tmpdir(), 'hapi-v12-default-assignment-'))
        const dbPath = join(dir, 'test.db')
        let store: Store | undefined
        try {
            const db = new Database(dbPath, { create: true, readwrite: true, strict: true })
            db.exec('PRAGMA journal_mode = WAL')
            db.exec('PRAGMA foreign_keys = ON')
            createV11Schema(db)
            db.exec("INSERT INTO providers (id, name, base_url, api_key_encrypted, notes, created_at, updated_at) VALUES ('p1', 'Gateway A', 'https://api.example.com', 'key-1', '', 1, 1)")
            db.exec("INSERT INTO providers (id, name, base_url, api_key_encrypted, notes, created_at, updated_at) VALUES ('p2', 'Gateway B', 'https://api2.example.com', 'key-2', '', 2, 2)")
            db.exec("INSERT INTO provider_assignments (provider_id, agent_flavor, is_default) VALUES ('p1', 'claude', 1)")
            db.exec("INSERT INTO provider_assignments (provider_id, agent_flavor, is_default) VALUES ('p2', 'claude', 1)")
            db.exec('PRAGMA user_version = 11')
            db.close()

            store = new Store(dbPath)
            const migratedDb = getDb(store)
            const assignments = migratedDb.prepare(
                'SELECT provider_id, agent_flavor, is_default FROM provider_assignments ORDER BY provider_id'
            ).all() as Array<{ provider_id: string; agent_flavor: string; is_default: number }>

            expect(assignments).toEqual([
                { provider_id: 'p1', agent_flavor: 'claude', is_default: 1 },
                { provider_id: 'p2', agent_flavor: 'claude', is_default: 0 },
            ])
        } finally {
            store?.close()
            removeTempDir(dir)
        }
    })
})

function getDb(store: Store): Database {
    return (store as unknown as { db: Database }).db
}

function getTableColumns(db: Database, tableName: string): string[] {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
    return rows.map(row => row.name)
}

function hasUniqueIndex(db: Database, tableName: string, columns: string[]): boolean {
    const indexes = db.prepare(`PRAGMA index_list(${tableName})`).all() as Array<{ name: string; unique: number }>
    return indexes.some(index => {
        if (index.unique !== 1) return false
        const info = db.prepare(`PRAGMA index_info(${index.name})`).all() as Array<{ name: string }>
        return info.map(row => row.name).join(',') === columns.join(',')
    })
}

function createV11Schema(db: Database): void {
    db.exec(`
        CREATE TABLE sessions (
            id TEXT PRIMARY KEY,
            tag TEXT,
            namespace TEXT NOT NULL DEFAULT 'default',
            machine_id TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            metadata TEXT,
            metadata_version INTEGER DEFAULT 1,
            agent_state TEXT,
            agent_state_version INTEGER DEFAULT 1,
            model TEXT,
            model_reasoning_effort TEXT,
            effort TEXT,
            todos TEXT,
            todos_updated_at INTEGER,
            team_state TEXT,
            team_state_updated_at INTEGER,
            active INTEGER DEFAULT 0,
            active_at INTEGER,
            seq INTEGER DEFAULT 0
        );
        CREATE INDEX idx_sessions_tag ON sessions(tag);
        CREATE INDEX idx_sessions_tag_namespace ON sessions(tag, namespace);

        CREATE TABLE machines (
            id TEXT PRIMARY KEY,
            namespace TEXT NOT NULL DEFAULT 'default',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            metadata TEXT,
            metadata_version INTEGER DEFAULT 1,
            runner_state TEXT,
            runner_state_version INTEGER DEFAULT 1,
            active INTEGER DEFAULT 0,
            active_at INTEGER,
            seq INTEGER DEFAULT 0
        );
        CREATE INDEX idx_machines_namespace ON machines(namespace);

        CREATE TABLE messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            seq INTEGER NOT NULL,
            local_id TEXT,
            invoked_at INTEGER,
            scheduled_at INTEGER,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_messages_session ON messages(session_id, seq);
        CREATE UNIQUE INDEX idx_messages_local_id ON messages(session_id, local_id) WHERE local_id IS NOT NULL;
        CREATE INDEX idx_messages_session_position
            ON messages(session_id, COALESCE(invoked_at, created_at) DESC, seq DESC);
        CREATE INDEX idx_messages_scheduled_pending
            ON messages(scheduled_at)
            WHERE scheduled_at IS NOT NULL AND invoked_at IS NULL;

        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            platform_user_id TEXT NOT NULL,
            namespace TEXT NOT NULL DEFAULT 'default',
            created_at INTEGER NOT NULL,
            UNIQUE(platform, platform_user_id)
        );
        CREATE INDEX idx_users_platform ON users(platform);
        CREATE INDEX idx_users_platform_namespace ON users(platform, namespace);

        CREATE TABLE push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            namespace TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            UNIQUE(namespace, endpoint)
        );
        CREATE INDEX idx_push_subscriptions_namespace ON push_subscriptions(namespace);

        CREATE TABLE plugins (
            id TEXT PRIMARY KEY,
            namespace TEXT NOT NULL DEFAULT 'default',
            name TEXT NOT NULL,
            version TEXT NOT NULL,
            description TEXT,
            enabled INTEGER DEFAULT 1,
            config TEXT,
            source_url TEXT,
            source_type TEXT DEFAULT 'blob',
            permissions TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            UNIQUE(namespace, name)
        );
        CREATE INDEX idx_plugins_namespace ON plugins(namespace);

        CREATE TABLE file_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            namespace TEXT NOT NULL DEFAULT 'default',
            file_path TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            snapshot_type TEXT NOT NULL DEFAULT 'auto',
            created_at INTEGER NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_file_snapshots_session ON file_snapshots(session_id, file_path);
        CREATE INDEX idx_file_snapshots_hash ON file_snapshots(content_hash);

        CREATE TABLE providers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            base_url TEXT NOT NULL,
            api_key_encrypted TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE provider_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_id TEXT NOT NULL,
            agent_flavor TEXT NOT NULL,
            is_default INTEGER NOT NULL DEFAULT 0,
            UNIQUE(provider_id, agent_flavor),
            FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_provider_assignments_provider ON provider_assignments(provider_id);
        CREATE INDEX idx_provider_assignments_flavor ON provider_assignments(agent_flavor);
    `)
}
