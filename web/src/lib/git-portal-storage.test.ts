import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addHistory, getFavorites, getHistory, parseRepoUrl, toggleFavorite, type CloneHistoryEntry } from './git-portal-storage'

const STORAGE_KEY = 'git-portal'

function validEntry(overrides: Partial<CloneHistoryEntry> = {}): CloneHistoryEntry {
    return {
        id: 'entry-1',
        url: 'https://github.com/zulinliu/make-hapi-power-again.git',
        platform: 'github',
        repoName: 'make-hapi-power-again',
        owner: 'zulinliu',
        targetDir: '/workspace',
        isFavorite: false,
        lastClonedAt: '2026-06-07T00:00:00.000Z',
        cloneCount: 1,
        ...overrides
    }
}

describe('git-portal-storage', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.unstubAllGlobals()
    })

    it('treats non-array localStorage payloads as empty history', () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries: [validEntry()] }))

        expect(getHistory()).toEqual([])
        expect(getFavorites()).toEqual([])
    })

    it('filters malformed entries before sorting or returning favorites', () => {
        const favorite = validEntry({ id: 'favorite', isFavorite: true })
        localStorage.setItem(STORAGE_KEY, JSON.stringify([
            favorite,
            { ...validEntry({ id: 'bad-date' }), lastClonedAt: 'not-a-date' },
            { ...validEntry({ id: 'bad-count' }), cloneCount: '1' },
            null
        ]))

        expect(getHistory()).toEqual([favorite])
        expect(getFavorites()).toEqual([favorite])
    })

    it('recovers from malformed storage when adding a new clone history item', () => {
        const randomUUID = vi.fn(() => 'new-entry-id')
        vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID })
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ malformed: true }))

        const added = addHistory({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            platform: 'github',
            repoName: 'make-hapi-power-again',
            owner: 'zulinliu',
            targetDir: '/workspace',
            branch: 'main'
        })

        expect(added.id).toBe('new-entry-id')
        expect(added.cloneCount).toBe(1)
        expect(getHistory()).toHaveLength(1)
    })

    it('adds clone history when randomUUID is unavailable on HTTP LAN origins', () => {
        const getRandomValues = vi.fn((bytes: Uint8Array) => {
            for (let i = 0; i < bytes.length; i += 1) bytes[i] = i
            return bytes
        })
        vi.stubGlobal('crypto', { getRandomValues })

        const added = addHistory({
            url: 'https://github.com/zulinliu/zentao-workflow-skills',
            platform: 'github',
            repoName: 'zentao-workflow-skills',
            owner: 'zulinliu',
            targetDir: '/home/liuzl/agent/temp_test'
        })

        expect(getRandomValues).toHaveBeenCalledOnce()
        expect(added.id).toMatch(/^[0-9a-f-]{36}$/i)
        expect(getHistory()[0]?.repoName).toBe('zentao-workflow-skills')
    })

    it('does not toggle favorites for malformed entries that happen to have an id', () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([
            { id: 'bad-entry', isFavorite: false },
            validEntry({ id: 'good-entry' })
        ]))

        expect(toggleFavorite('bad-entry')).toBe(false)
        expect(toggleFavorite('good-entry')).toBe(true)
    })

    it('parses GitLab subgroup repository URLs using the last path segment as repoName', () => {
        expect(parseRepoUrl('https://gitlab.com/group/subgroup/repo.git')).toEqual({
            platform: 'gitlab',
            owner: 'group/subgroup',
            repoName: 'repo'
        })

        expect(parseRepoUrl('git@gitlab.com:group/subgroup/repo.git')).toEqual({
            platform: 'gitlab',
            owner: 'group/subgroup',
            repoName: 'repo'
        })
    })
})
