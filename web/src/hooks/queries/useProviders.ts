import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import type { ProviderWithAssignments, DiscoverModelsResponse } from '@hapipower/protocol'
import { queryKeys } from '@/lib/query-keys'

export function useProviders(api: ApiClient | null, enabled = true): {
    providers: ProviderWithAssignments[]
    isLoading: boolean
    error: string | null
    refetch: () => Promise<unknown>
} {
    const query = useQuery({
        queryKey: queryKeys.providers,
        queryFn: async () => {
            if (!api) throw new Error('API unavailable')
            return await api.getProviders()
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
