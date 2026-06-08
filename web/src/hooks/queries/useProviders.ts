import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import type { ProviderWithAssignments, DiscoverModelsResponse, ProviderOverviewResponse } from '@hapipower/protocol'
import { queryKeys } from '@/lib/query-keys'

const emptyOverview: ProviderOverviewResponse = {
    providers: [],
    summary: {
        total: 0,
        online: 0,
        degraded: 0,
        offline: 0,
        blocked: 0,
        unknown: 0,
        assignedAgents: 0,
    },
}

export function useProviderOverview(api: ApiClient | null, enabled = true): {
    overview: ProviderOverviewResponse
    isLoading: boolean
    error: string | null
    refetch: () => Promise<unknown>
} {
    const query = useQuery({
        queryKey: queryKeys.providerOverview,
        queryFn: async () => {
            if (!api) throw new Error('API unavailable')
            return await api.getProviderOverview()
        },
        enabled: Boolean(api && enabled),
    })

    return {
        overview: query.data ?? emptyOverview,
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load providers' : null,
        refetch: query.refetch,
    }
}

export function useProviders(api: ApiClient | null, enabled = true): {
    providers: ProviderWithAssignments[]
    isLoading: boolean
    error: string | null
    refetch: () => Promise<unknown>
} {
    const query = useQuery({
        queryKey: queryKeys.providerOverview,
        queryFn: async () => {
            if (!api) throw new Error('API unavailable')
            return await api.getProviderOverview()
        },
        enabled: Boolean(api && enabled),
    })

    return {
        providers: query.data?.providers ?? [],
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load providers' : null,
        refetch: query.refetch,
    }
}

export function useProviderModels(api: ApiClient | null, providerId: string | null, enabled = true) {
    const query = useQuery({
        queryKey: queryKeys.providerModels(providerId ?? ''),
        queryFn: async (): Promise<DiscoverModelsResponse> => {
            if (!api || !providerId) throw new Error('API unavailable')
            return await api.discoverModels(providerId)
        },
        enabled: Boolean(api && providerId && enabled),
    })

    return {
        models: query.data?.models ?? [],
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error.message : query.data?.error ?? null,
        refetch: query.refetch,
    }
}
