import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import { queryKeys } from '@/lib/query-keys'

type FlavorModel = {
    id: string
    name: string
    providerId: string
    providerName: string
}

export function useFlavorModels(api: ApiClient | null, flavor: string | null | undefined, enabled = true): {
    models: FlavorModel[]
    isLoading: boolean
    error: string | null
} {
    const query = useQuery({
        queryKey: queryKeys.flavorModels(flavor ?? ''),
        queryFn: async () => {
            if (!api || !flavor) throw new Error('API unavailable')
            return await api.getFlavorModels(flavor)
        },
        enabled: Boolean(api && flavor && enabled),
        staleTime: 5 * 60 * 1000,
        retry: false,
    })

    return {
        models: query.data?.models ?? [],
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load models' : null,
    }
}
