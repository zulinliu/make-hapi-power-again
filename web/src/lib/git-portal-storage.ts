const STORAGE_KEY = 'git-portal'

export type GitPlatform = 'github' | 'gitlab' | 'bitbucket' | 'other'

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

function loadEntries(): CloneHistoryEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        return JSON.parse(raw) as CloneHistoryEntry[]
    } catch {
        return []
    }
}

function saveEntries(entries: CloneHistoryEntry[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
        // localStorage quota exceeded — drop oldest non-favorite
        const trimmed = entries.filter(e => e.isFavorite).concat(
            entries.filter(e => !e.isFavorite).slice(-15)
        )
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)) } catch { /* ignore */ }
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
    const entries = loadEntries()
    const existing = entries.find(e => e.url === entry.url)
    if (existing) {
        existing.cloneCount++
        existing.lastClonedAt = new Date().toISOString()
        existing.targetDir = entry.targetDir
        if (entry.branch) existing.branch = entry.branch
        saveEntries(entries)
        return existing
    }

    const newEntry: CloneHistoryEntry = {
        ...entry,
        id: crypto.randomUUID(),
        isFavorite: false,
        lastClonedAt: new Date().toISOString(),
        cloneCount: 1
    }
    entries.push(newEntry)

    // Keep max 20 entries (favorites exempt from eviction)
    const favorites = entries.filter(e => e.isFavorite)
    const nonFavorites = entries.filter(e => !e.isFavorite)
        .sort((a, b) => new Date(b.lastClonedAt).getTime() - new Date(a.lastClonedAt).getTime())
        .slice(0, 20 - favorites.length)
    saveEntries([...favorites, ...nonFavorites])
    return newEntry
}

export function toggleFavorite(entryId: string): boolean {
    const entries = loadEntries()
    const entry = entries.find(e => e.id === entryId)
    if (!entry) return false
    entry.isFavorite = !entry.isFavorite
    saveEntries(entries)
    return entry.isFavorite
}

export function removeHistory(entryId: string): void {
    const entries = loadEntries().filter(e => e.id !== entryId)
    saveEntries(entries)
}

export function clearHistory(): void {
    const entries = loadEntries().filter(e => e.isFavorite)
    saveEntries(entries)
}

export function detectPlatform(url: string): GitPlatform {
    const lower = url.toLowerCase()
    if (lower.includes('github.com') || lower.includes('github:')) return 'github'
    if (lower.includes('gitlab.com') || lower.includes('gitlab.')) return 'gitlab'
    if (lower.includes('bitbucket.org') || lower.includes('bitbucket.')) return 'bitbucket'
    return 'other'
}

export function parseRepoUrl(url: string): { platform: GitPlatform; owner: string; repoName: string } | null {
    const platform = detectPlatform(url)

    // https://host/owner/repo(.git)?
    const httpsMatch = url.match(/https?:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/)
    if (httpsMatch) {
        return { platform, owner: httpsMatch[1], repoName: httpsMatch[2] }
    }

    // git@host:owner/repo(.git)?
    const sshMatch = url.match(/git@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/)
    if (sshMatch) {
        return { platform, owner: sshMatch[1], repoName: sshMatch[2] }
    }

    // ssh://host/owner/repo(.git)?
    const sshUrlMatch = url.match(/ssh:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?$/)
    if (sshUrlMatch) {
        return { platform, owner: sshUrlMatch[1], repoName: sshUrlMatch[2] }
    }

    return null
}

export function sanitizeGitUrl(url: string): string {
    return url.replace(/:\/\/[^@]+@/, '://***@')
}
