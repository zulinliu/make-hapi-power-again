const STORAGE_KEY = 'git-portal'

export type GitPlatform = 'github' | 'gitlab' | 'bitbucket' | 'other'
export type GitUrlScheme = 'https' | 'ssh' | 'scp' | null

export interface CloneHistoryEntry {
    id: string
    url: string
    platform: GitPlatform
    repoName: string
    owner: string
    targetDir: string
    branch?: string
    isFavorite: boolean
    lastClonedAt: string
    cloneCount: number
}

type StoredCloneHistoryEntry = CloneHistoryEntry & Record<string, unknown>

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isGitPlatform(value: unknown): value is GitPlatform {
    return value === 'github' || value === 'gitlab' || value === 'bitbucket' || value === 'other'
}

function readString(value: unknown): string | null {
    return typeof value === 'string' ? value : null
}

function readOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined
}

function toHistoryEntry(value: unknown): CloneHistoryEntry | null {
    if (!isPlainObject(value)) return null

    const id = readString(value.id)
    const url = readString(value.url)
    const repoName = readString(value.repoName)
    const owner = readString(value.owner)
    const targetDir = readString(value.targetDir)
    const lastClonedAt = readString(value.lastClonedAt)
    const cloneCount = typeof value.cloneCount === 'number' && Number.isFinite(value.cloneCount)
        ? Math.max(1, Math.floor(value.cloneCount))
        : null

    if (!id || !url || !repoName || !owner || targetDir === null || !lastClonedAt || Number.isNaN(new Date(lastClonedAt).getTime()) || cloneCount === null) {
        return null
    }
    if (!isGitPlatform(value.platform)) {
        return null
    }
    if (Number.isNaN(new Date(lastClonedAt).getTime())) {
        return null
    }

    const platform = value.platform
    const entry: CloneHistoryEntry = {
        id,
        url,
        platform,
        repoName,
        owner,
        targetDir,
        isFavorite: value.isFavorite === true,
        lastClonedAt,
        cloneCount
    }
    const branch = readOptionalString((value as StoredCloneHistoryEntry).branch)
    if (branch) entry.branch = branch
    return entry
}

function loadEntries(): CloneHistoryEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.map(toHistoryEntry).filter((entry): entry is CloneHistoryEntry => entry !== null)
    } catch {
        return []
    }
}

function saveEntries(entries: CloneHistoryEntry[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
        // localStorage quota exceeded: keep favorites first, then most recent non-favorites.
        const favorites = entries.filter(e => e.isFavorite)
        const nonFavorites = entries
            .filter(e => !e.isFavorite)
            .sort((a, b) => new Date(b.lastClonedAt).getTime() - new Date(a.lastClonedAt).getTime())
            .slice(0, 15)
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites, ...nonFavorites]))
        } catch {
            // Best effort only.
        }
    }
}

export function getHistory(limit = 20): CloneHistoryEntry[] {
    return loadEntries()
        .sort((a, b) => new Date(b.lastClonedAt).getTime() - new Date(a.lastClonedAt).getTime())
        .slice(0, limit)
}

export function getFavorites(): CloneHistoryEntry[] {
    return loadEntries().filter(e => e.isFavorite)
}

export function addHistory(entry: Omit<CloneHistoryEntry, 'id' | 'lastClonedAt' | 'cloneCount' | 'isFavorite'>): CloneHistoryEntry {
    const now = new Date().toISOString()
    const entries = loadEntries()
    const existing = entries.find(e => e.url === entry.url)

    if (existing) {
        const updated: CloneHistoryEntry = {
            ...existing,
            targetDir: entry.targetDir,
            cloneCount: existing.cloneCount + 1,
            lastClonedAt: now
        }
        if (entry.branch) {
            updated.branch = entry.branch
        }
        const nextEntries = entries.map(e => e.id === existing.id ? updated : e)
        saveEntries(nextEntries)
        return updated
    }

    const newEntry: CloneHistoryEntry = {
        ...entry,
        id: crypto.randomUUID(),
        isFavorite: false,
        lastClonedAt: now,
        cloneCount: 1
    }
    const nextEntries = [...entries, newEntry]

    // Keep max 20 entries. Favorites are exempt from eviction.
    const favorites = nextEntries.filter(e => e.isFavorite)
    const nonFavorites = nextEntries
        .filter(e => !e.isFavorite)
        .sort((a, b) => new Date(b.lastClonedAt).getTime() - new Date(a.lastClonedAt).getTime())
        .slice(0, Math.max(0, 20 - favorites.length))
    saveEntries([...favorites, ...nonFavorites])
    return newEntry
}

export function toggleFavorite(entryId: string): boolean {
    const entries = loadEntries()
    const entry = entries.find(e => e.id === entryId)
    if (!entry) return false
    const nextFavorite = !entry.isFavorite
    saveEntries(entries.map(e => e.id === entryId ? { ...e, isFavorite: nextFavorite } : e))
    return nextFavorite
}

export function removeHistory(entryId: string): void {
    saveEntries(loadEntries().filter(e => e.id !== entryId))
}

export function clearHistory(): void {
    saveEntries(loadEntries().filter(e => e.isFavorite))
}

export function getGitUrlScheme(url: string): GitUrlScheme {
    const trimmed = url.trim()
    if (trimmed.startsWith('https://')) return 'https'
    if (trimmed.startsWith('ssh://')) return 'ssh'
    if (/^git@[^:\s]+:[^\s]+$/.test(trimmed)) return 'scp'
    return null
}

export function detectPlatform(url: string): GitPlatform {
    const lower = url.toLowerCase()
    if (lower.includes('github.com') || lower.includes('github:')) return 'github'
    if (lower.includes('gitlab.com') || lower.includes('gitlab.')) return 'gitlab'
    if (lower.includes('bitbucket.org') || lower.includes('bitbucket.')) return 'bitbucket'
    return 'other'
}

function stripGitSuffix(value: string): string {
    return value.replace(/\.git$/i, '')
}

function repoPathToParts(path: string): string[] {
    return path.split('/').map(part => part.trim()).filter(Boolean)
}

function repoPartsToInfo(platform: GitPlatform, parts: string[]): { platform: GitPlatform; owner: string; repoName: string } | null {
    if (parts.length < 2) return null

    const repoName = stripGitSuffix(parts[parts.length - 1] ?? '')
    if (!repoName) return null

    return {
        platform,
        owner: parts.slice(0, -1).join('/'),
        repoName
    }
}

export function parseRepoUrl(url: string): { platform: GitPlatform; owner: string; repoName: string } | null {
    const trimmed = url.trim()
    const platform = detectPlatform(trimmed)

    try {
        const parsed = new URL(trimmed)
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'ssh:') return null
        if (parsed.protocol === 'https:' && (parsed.username || parsed.password)) return null
        if (parsed.protocol === 'ssh:' && parsed.password) return null
        return repoPartsToInfo(platform, repoPathToParts(parsed.pathname))
    } catch {
        // Continue with scp-like SSH syntax.
    }

    const sshMatch = trimmed.match(/^git@[^:\s]+:([^\s]+)$/)
    if (sshMatch) {
        return repoPartsToInfo(platform, repoPathToParts(sshMatch[1] ?? ''))
    }

    return null
}

export function sanitizeGitUrl(url: string): string {
    return url.replace(/:\/\/[^@/]+@/, '://***@')
}
