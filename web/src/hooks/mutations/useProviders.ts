import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import { queryKeys } from '@/lib/query-keys'
import type { ProviderProtocol } from '@hapipower/protocol'

type CreateProviderInput = {
    name: string
    baseUrl: string
    apiKey: string
    protocol?: ProviderProtocol
    defaultModel?: string | null
    notes?: string
}

type UpdateProviderInput = {
    id: string
    name?: string
    baseUrl?: string
    apiKey?: string
    protocol?: ProviderProtocol
    defaultModel?: string | null
    notes?: string
}

function invalidateProviderQueries(queryClient: ReturnType<typeof useQueryClient>) {
    queryClient.invalidateQueries({ queryKey: queryKeys.providers })
    queryClient.invalidateQueries({ queryKey: queryKeys.providerOverview })
    queryClient.invalidateQueries({ queryKey: queryKeys.providerModelsRoot })
    queryClient.invalidateQueries({ queryKey: queryKeys.flavorModelsRoot })
}

export function useCreateProvider(api: ApiClient | null) {
    const queryClient = useQueryClient()
    const mutation = useMutation({
        mutationFn: async (input: CreateProviderInput) => {
            if (!api) throw new Error('API unavailable')
            return await api.createProvider(input)
        },
        onSuccess: () => {
            invalidateProviderQueries(queryClient)
        },
    })
    return { createProvider: mutation.mutateAsync, isPending: mutation.isPending, error: mutation.error instanceof Error ? mutation.error.message : null }
}

export function useUpdateProvider(api: ApiClient | null) {
    const queryClient = useQueryClient()
    const mutation = useMutation({
        mutationFn: async (input: UpdateProviderInput) => {
            if (!api) throw new Error('API unavailable')
            return await api.updateProvider(input.id, input)
        },
        onSuccess: () => {
            invalidateProviderQueries(queryClient)
        },
    })
    return { updateProvider: mutation.mutateAsync, isPending: mutation.isPending, error: mutation.error instanceof Error ? mutation.error.message : null }
}

export function useDeleteProvider(api: ApiClient | null) {
    const queryClient = useQueryClient()
    const mutation = useMutation({
        mutationFn: async (id: string) => {
            if (!api) throw new Error('API unavailable')
            await api.deleteProvider(id)
        },
        onSuccess: () => {
            invalidateProviderQueries(queryClient)
        },
    })
    return { deleteProvider: mutation.mutateAsync, isPending: mutation.isPending, error: mutation.error instanceof Error ? mutation.error.message : null }
}

export function useUnassignProvider(api: ApiClient | null) {
    const queryClient = useQueryClient()
    const mutation = useMutation({
        mutationFn: async ({ providerId, flavor }: { providerId: string; flavor: string }) => {
            if (!api) throw new Error('API unavailable')
            await api.unassignProvider(providerId, flavor)
        },
        onSuccess: () => {
            invalidateProviderQueries(queryClient)
        },
    })
    return { unassignProvider: mutation.mutateAsync, isPending: mutation.isPending }
}

export function useAssignProvider(api: ApiClient | null) {
    const queryClient = useQueryClient()
    const mutation = useMutation({
        mutationFn: async ({ providerId, agentFlavor, isDefault, model }: { providerId: string; agentFlavor: string; isDefault: boolean; model?: string | null }) => {
            if (!api) throw new Error('API unavailable')
            await api.assignProvider(providerId, agentFlavor, isDefault, model)
        },
        onSuccess: () => {
            invalidateProviderQueries(queryClient)
        },
    })
    return { assignProvider: mutation.mutateAsync, isPending: mutation.isPending, error: mutation.error instanceof Error ? mutation.error.message : null }
}

export function useCheckProvider(api: ApiClient | null) {
    const queryClient = useQueryClient()
    const mutation = useMutation({
        mutationFn: async (providerId: string) => {
            if (!api) throw new Error('API unavailable')
            return await api.checkProvider(providerId)
        },
        onSuccess: () => {
            invalidateProviderQueries(queryClient)
        },
    })
    return { checkProvider: mutation.mutateAsync, isPending: mutation.isPending, error: mutation.error instanceof Error ? mutation.error.message : null }
}

export function useDiscoverProviderModels(api: ApiClient | null) {
    const queryClient = useQueryClient()
    const mutation = useMutation({
        mutationFn: async (providerId: string) => {
            if (!api) throw new Error('API unavailable')
            return await api.discoverModels(providerId)
        },
        onSuccess: () => {
            invalidateProviderQueries(queryClient)
        },
    })
    return { discoverProviderModels: mutation.mutateAsync, isPending: mutation.isPending, error: mutation.error instanceof Error ? mutation.error.message : null }
}

export function useRotateProviderKey(api: ApiClient | null) {
    const queryClient = useQueryClient()
    const mutation = useMutation({
        mutationFn: async ({ providerId, apiKey }: { providerId: string; apiKey: string }) => {
            if (!api) throw new Error('API unavailable')
            return await api.rotateProviderKey(providerId, apiKey)
        },
        onSuccess: () => {
            invalidateProviderQueries(queryClient)
        },
    })
    return { rotateProviderKey: mutation.mutateAsync, isPending: mutation.isPending, error: mutation.error instanceof Error ? mutation.error.message : null }
}

export function useRevealProviderKey(api: ApiClient | null) {
    const mutation = useMutation({
        mutationFn: async (providerId: string) => {
            if (!api) throw new Error('API unavailable')
            return await api.revealProviderKey(providerId)
        },
    })
    return { revealProviderKey: mutation.mutateAsync, isPending: mutation.isPending, error: mutation.error instanceof Error ? mutation.error.message : null }
}
