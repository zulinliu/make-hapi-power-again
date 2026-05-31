import { z } from 'zod'
import { AgentFlavorSchema } from './modes'

export const ProviderSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    baseUrl: z.string().url().refine(
        (url) => url.startsWith('https://') || url.startsWith('http://'),
        { message: 'Only http:// and https:// URLs are allowed' }
    ),
    apiKeyEncrypted: z.string().min(1),
    notes: z.string().max(1000).optional().default(''),
    createdAt: z.number(),
    updatedAt: z.number(),
})

export type Provider = z.infer<typeof ProviderSchema>

export const CreateProviderRequestSchema = z.object({
    name: z.string().min(1).max(255),
    baseUrl: z.string().url().refine(
        (url) => url.startsWith('https://') || url.startsWith('http://'),
        { message: 'Only http:// and https:// URLs are allowed' }
    ),
    apiKey: z.string().min(1).max(4096),
    notes: z.string().max(1000).optional().default(''),
})

export type CreateProviderRequest = z.infer<typeof CreateProviderRequestSchema>

export const UpdateProviderRequestSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    baseUrl: z.string().url().refine(
        (url) => url.startsWith('https://') || url.startsWith('http://'),
        { message: 'Only http:// and https:// URLs are allowed' }
    ).optional(),
    apiKey: z.string().min(1).max(4096).optional(),
    notes: z.string().max(1000).optional(),
})

export type UpdateProviderRequest = z.infer<typeof UpdateProviderRequestSchema>

export const ProviderAssignmentSchema = z.object({
    providerId: z.string().uuid(),
    agentFlavor: AgentFlavorSchema,
    isDefault: z.boolean().default(false),
})

export type ProviderAssignment = z.infer<typeof ProviderAssignmentSchema>

export const AssignProviderRequestSchema = z.object({
    agentFlavor: AgentFlavorSchema,
    isDefault: z.boolean().default(false),
})

export type AssignProviderRequest = z.infer<typeof AssignProviderRequestSchema>

export type ProviderWithAssignments = Provider & {
    assignments: ProviderAssignment[]
}

export type ProvidersListResponse = {
    providers: ProviderWithAssignments[]
}

export type DiscoverModelsRequest = Record<string, never>

export type DiscoveredModel = {
    id: string
    name: string
    ownedBy?: string
}

export type DiscoverModelsResponse = {
    success: boolean
    models?: DiscoveredModel[]
    error?: string
}
