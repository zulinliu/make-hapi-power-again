import { describe, expect, it } from 'vitest'
import type { GitAtlasChange, GitAtlasDashboardResponse } from '@/types/api'
import {
    buildGitAtlasSyncRequest,
    getDefaultBasketPaths,
    getGitAtlasRecommendationKeys,
    isForcePushConfirmed,
    toggleBasketPath,
} from './git-atlas'

function change(overrides: Partial<GitAtlasChange>): GitAtlasChange {
    return {
        path: 'src/app.ts',
        status: 'modified',
        stage: 'unstaged',
        linesAdded: 1,
        linesRemoved: 0,
        binary: false,
        selectable: true,
        ...overrides,
    }
}

describe('Git Atlas helpers', () => {
    it('keeps conflicted and non-selectable files out of the default commit basket', () => {
        expect(getDefaultBasketPaths([
            change({ path: 'src/app.ts' }),
            change({ path: 'src/conflict.ts', status: 'conflicted', selectable: false }),
            change({ path: 'assets/logo.png', binary: true, selectable: true }),
        ])).toEqual(['src/app.ts', 'assets/logo.png'])
    })

    it('toggles basket paths without mutating the previous list', () => {
        const previous = ['src/app.ts']
        const added = toggleBasketPath(previous, 'README.md')
        const removed = toggleBasketPath(added, 'src/app.ts')

        expect(previous).toEqual(['src/app.ts'])
        expect(added).toEqual(['src/app.ts', 'README.md'])
        expect(removed).toEqual(['README.md'])
    })

    it('localizes recommendation labels through i18n keys instead of backend English text', () => {
        expect(getGitAtlasRecommendationKeys('push')).toEqual({
            label: 'gitAtlas.recommendation.push',
            description: 'gitAtlas.recommendation.pushDesc',
        })
        expect(getGitAtlasRecommendationKeys(undefined)).toEqual({
            label: 'gitAtlas.recommendation.clean',
            description: 'gitAtlas.recommendation.cleanDesc',
        })
    })

    it('requires the branch name as the force-push confirmation phrase', () => {
        expect(isForcePushConfirmed('feat/v0.18.0', '')).toBe(false)
        expect(isForcePushConfirmed('feat/v0.18.0', 'main')).toBe(false)
        expect(isForcePushConfirmed('feat/v0.18.0', 'feat/v0.18.0')).toBe(true)
    })

    it('builds sync requests from the dashboard remote and branch', () => {
        const dashboard: GitAtlasDashboardResponse = {
            success: true,
            repo: {
                isRepo: true,
                root: '/workspace/project',
                branch: 'feat/v0.18.0',
                upstream: 'origin/feat/v0.18.0',
                detached: false,
                ahead: 1,
                behind: 0,
                hasConflicts: false,
            },
            remotes: [{ name: 'origin', url: 'https://example.com/repo.git' }],
            sync: {
                remote: 'origin',
                branch: 'feat/v0.18.0',
                ahead: 1,
                behind: 0,
                canPull: false,
                canPush: true,
                requiresRemote: false,
                inFlight: false,
            },
        }

        expect(buildGitAtlasSyncRequest('push', dashboard, {
            force: true,
            confirmation: 'feat/v0.18.0',
        })).toEqual({
            action: 'push',
            remote: 'origin',
            branch: 'feat/v0.18.0',
            force: true,
            confirmation: 'feat/v0.18.0',
        })
    })
})
