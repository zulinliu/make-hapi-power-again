import { z } from 'zod'
import { AgentFlavorSchema } from './modes'

export const ProviderProtocolSchema = z.enum(['anthropic', 'openai', 'gemini', 'auto'])
export type ProviderProtocol = z.infer<typeof ProviderProtocolSchema>

export const ProviderHealthStatusSchema = z.enum(['unknown', 'checking', 'online', 'degraded', 'offline', 'blocked'])
export type ProviderHealthStatus = z.infer<typeof ProviderHealthStatusSchema>

export const ProviderCapabilitySchema = z.object({
    modelsEndpoint: z.boolean(),
    messagesEndpoint: z.boolean(),
    streaming: z.boolean().nullable(),
    tokenUsage: z.boolean().nullable(),
    contextWindow: z.number().int().positive().nullable(),
    toolUse: z.boolean().nullable(),
    imageInput: z.boolean().nullable(),
})
export type ProviderCapability = z.infer<typeof ProviderCapabilitySchema>

export const ProviderHealthSchema = z.object({
    status: ProviderHealthStatusSchema,
    latencyMs: z.number().int().nonnegative().nullable(),
    checkedAt: z.number().nullable(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    protocolDetected: ProviderProtocolSchema.nullable(),
    capabilities: ProviderCapabilitySchema,
})
export type ProviderHealth = z.infer<typeof ProviderHealthSchema>

export const ProviderSchema = z.object({
    id: z.string().uuid(),
    namespace: z.string().min(1),
    name: z.string().min(1).max(255),
    baseUrl: z.string().url().refine(
        (url) => url.startsWith('https://') || url.startsWith('http://'),
        { message: 'Only http:// and https:// URLs are allowed' }
    ),
    apiKeyEncrypted: z.string().min(1),
    protocol: ProviderProtocolSchema.default('auto'),
    defaultModel: z.string().max(255).nullable().default(null),
    health: ProviderHealthSchema,
    modelCache: z.array(z.object({
        id: z.string(),
        name: z.string(),
        ownedBy: z.string().optional(),
    })).default([]),
    modelCacheUpdatedAt: z.number().nullable().default(null),
    notes: z.string().max(1000).optional().default(''),
    createdAt: z.number(),
    updatedAt: z.number(),
})

export type Provider = z.infer<typeof ProviderSchema>

export type PublicProvider = Omit<Provider, 'apiKeyEncrypted'> & {
    apiKeyMasked: string
}

export const CreateProviderRequestSchema = z.object({
    name: z.string().min(1).max(255),
    baseUrl: z.string().url().refine(
        (url) => url.startsWith('https://') || url.startsWith('http://'),
        { message: 'Only http:// and https:// URLs are allowed' }
    ),
    apiKey: z.string().min(1).max(4096),
    protocol: ProviderProtocolSchema.optional().default('auto'),
    defaultModel: z.string().max(255).nullable().optional(),
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
    protocol: ProviderProtocolSchema.optional(),
    defaultModel: z.string().max(255).nullable().optional(),
    notes: z.string().max(1000).optional(),
})

export type UpdateProviderRequest = z.infer<typeof UpdateProviderRequestSchema>

export const ProviderAssignmentSchema = z.object({
    namespace: z.string().min(1),
    providerId: z.string().uuid(),
    agentFlavor: AgentFlavorSchema,
    isDefault: z.boolean().default(false),
    model: z.string().max(255).nullable().default(null),
})

export type ProviderAssignment = z.infer<typeof ProviderAssignmentSchema>

export const AssignProviderRequestSchema = z.object({
    agentFlavor: AgentFlavorSchema,
    isDefault: z.boolean().default(false),
    model: z.string().max(255).nullable().optional(),
})

export type AssignProviderRequest = z.infer<typeof AssignProviderRequestSchema>

export type ProviderWithAssignments = PublicProvider & {
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

export type SafeProviderDiagnostic = {
    hostLabel: string
    path: string
    statusCode: number | null
    latencyMs: number | null
    errorCode: string | null
    safeMessage: string | null
    capabilities: ProviderCapability
}

export type DiscoverModelsResponse = {
    success: boolean
    models?: DiscoveredModel[]
    error?: string
    diagnostic?: SafeProviderDiagnostic
    health?: ProviderHealth
}

export type ProviderOverviewResponse = {
    providers: ProviderWithAssignments[]
    summary: {
        total: number
        online: number
        degraded: number
        offline: number
        blocked: number
        unknown: number
        assignedAgents: number
    }
}

export const CheckProviderRequestSchema = z.object({
    force: z.boolean().optional().default(false),
})

export type CheckProviderRequest = z.infer<typeof CheckProviderRequestSchema>

export type CheckProviderResponse = {
    success: boolean
    provider: ProviderWithAssignments
    diagnostic: SafeProviderDiagnostic
}

export const RotateProviderKeyRequestSchema = z.object({
    apiKey: z.string().min(1).max(4096),
})

export type RotateProviderKeyRequest = z.infer<typeof RotateProviderKeyRequestSchema>

export const CreateProviderKeyRevealTokenRequestSchema = z.object({
    confirm: z.literal('reveal-provider-key'),
})

export type CreateProviderKeyRevealTokenRequest = z.infer<typeof CreateProviderKeyRevealTokenRequestSchema>

export type CreateProviderKeyRevealTokenResponse = {
    revealToken: string
    expiresAt: number
}

export const RevealProviderKeyRequestSchema = z.object({
    revealToken: z.string().min(16).max(128),
})

export type RevealProviderKeyRequest = z.infer<typeof RevealProviderKeyRequestSchema>

export type RevealProviderKeyResponse = {
    apiKey: string
}
