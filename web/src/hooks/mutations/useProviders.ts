import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import { queryKeys } from '@/lib/query-keys'

type CreateProviderInput = {
    name: string
    baseUrl: string
    apiKey: string
    notes?: string
}

type UpdateProviderInput = {
    id: string
    name?: string
    baseUrl?: string
    apiKey?: string
    notes?: string
}

export function useCreateProvider(api: ApiClient | null) {
    const queryClient = useQueryClient()
    const mutation = useMutation({
        mutationFn: async (input: CreateProviderInput) => {
            if (!api) throw new Error('API unavailable')
            return await api.createProvider(input)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.providers })
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
            queryClient.invalidateQueries({ queryKey: queryKeys.providers })
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
            queryClient.invalidateQueries({ queryKey: queryKeys.providers })
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
            queryClient.invalidateQueries({ queryKey: queryKeys.providers })
        },
    })
    return { unassignProvider: mutation.mutateAsync, isPending: mutation.isPending }
}

export function useAssignProvider(api: ApiClient | null) {
    const queryClient = useQueryClient()
    const mutation = useMutation({
        mutationFn: async ({ providerId, agentFlavor, isDefault }: { providerId: string; agentFlavor: string; isDefault: boolean }) => {
            if (!api) throw new Error('API unavailable')
            await api.assignProvider(providerId, agentFlavor, isDefault)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.providers })
        },
    })
    return { assignProvider: mutation.mutateAsync, isPending: mutation.isPending, error: mutation.error instanceof Error ? mutation.error.message : null }
}
