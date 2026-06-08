import type {
    GitAtlasChange,
    GitAtlasDashboardResponse,
    GitAtlasRecommendation,
    GitSyncRequest,
} from '@/types/api'

export type GitAtlasRecommendationKind = NonNullable<GitAtlasRecommendation['kind']>

export type GitAtlasSyncAction = 'fetch' | 'pull' | 'push'

const RECOMMENDATION_KEYS: Record<GitAtlasRecommendationKind, { label: string; description: string }> = {
    clone: {
        label: 'gitAtlas.recommendation.clone',
        description: 'gitAtlas.recommendation.cloneDesc',
    },
    'resolve-conflicts': {
        label: 'gitAtlas.recommendation.resolveConflicts',
        description: 'gitAtlas.recommendation.resolveConflictsDesc',
    },
    review: {
        label: 'gitAtlas.recommendation.review',
        description: 'gitAtlas.recommendation.reviewDesc',
    },
    commit: {
        label: 'gitAtlas.recommendation.commit',
        description: 'gitAtlas.recommendation.commitDesc',
    },
    pull: {
        label: 'gitAtlas.recommendation.pull',
        description: 'gitAtlas.recommendation.pullDesc',
    },
    push: {
        label: 'gitAtlas.recommendation.push',
        description: 'gitAtlas.recommendation.pushDesc',
    },
    clean: {
        label: 'gitAtlas.recommendation.clean',
        description: 'gitAtlas.recommendation.cleanDesc',
    },
}

export function getGitAtlasRecommendationKeys(kind: GitAtlasRecommendationKind | undefined): { label: string; description: string } {
    return RECOMMENDATION_KEYS[kind ?? 'clean']
}

export function getDefaultBasketPaths(changes: GitAtlasChange[]): string[] {
    return changes
        .filter(change => change.selectable)
        .filter(change => change.status !== 'conflicted')
        .map(change => change.path)
}

export function toggleBasketPath(paths: readonly string[], path: string): string[] {
    return paths.includes(path)
        ? paths.filter(item => item !== path)
        : [...paths, path]
}

export function getPrimaryRemote(dashboard: GitAtlasDashboardResponse | null): string {
    return dashboard?.sync?.remote ?? dashboard?.remotes?.[0]?.name ?? ''
}

export function getPrimaryBranch(dashboard: GitAtlasDashboardResponse | null): string {
    return dashboard?.sync?.branch ?? dashboard?.repo?.branch ?? ''
}

export function buildGitAtlasSyncRequest(
    action: GitAtlasSyncAction,
    dashboard: GitAtlasDashboardResponse | null,
    options?: { force?: boolean; confirmation?: string }
): GitSyncRequest {
    const remote = getPrimaryRemote(dashboard)
    const branch = getPrimaryBranch(dashboard)
    return {
        action,
        remote: remote || undefined,
        branch: branch || undefined,
        force: options?.force === true ? true : undefined,
        confirmation: options?.confirmation || undefined,
    }
}

export function isForcePushConfirmed(branch: string, confirmation: string): boolean {
    return branch.length > 0 && confirmation === branch
}

export function getChangeStatusKey(change: GitAtlasChange): string {
    return `gitAtlas.status.${change.status}`
}
