import { z } from 'zod'
import {
    AttachmentMetadataSchema,
    CodexCollaborationModeSchema,
    DecryptedMessageSchema,
    GitCloneAuthSchema,
    GitCloneCancelRequestSchema,
    GitCloneRequestSchema,
    MachineSchema,
    MessageDeliveryModeSchema,
    PermissionModeSchema,
    SessionSchema
} from './schemas'
import { AgentFlavorSchema } from './modes'
import type {
    DecryptedMessage,
    GitCloneAuth,
    GitCloneCancelRequest,
    GitCloneRequest,
    Machine,
    Session
} from './schemas'
import type { SessionSummary } from './sessionSummary'

export const CreateOrLoadSessionRequestSchema = z.object({
    tag: z.string().min(1),
    metadata: z.unknown(),
    agentState: z.unknown().nullable().optional(),
    model: z.string().optional(),
    modelReasoningEffort: z.string().optional(),
    effort: z.string().optional()
})

export type CreateOrLoadSessionRequest = z.infer<typeof CreateOrLoadSessionRequestSchema>

export const CreateOrLoadMachineRequestSchema = z.object({
    id: z.string().min(1),
    metadata: z.unknown(),
    runnerState: z.unknown().nullable().optional()
})

export type CreateOrLoadMachineRequest = z.infer<typeof CreateOrLoadMachineRequestSchema>

export const CliMessagesResponseSchema = z.object({
    messages: z.array(z.object({
        id: z.string(),
        seq: z.number(),
        createdAt: z.number(),
        localId: z.string().nullable().optional(),
        content: z.unknown()
    }))
})

export type CliMessagesResponse = z.infer<typeof CliMessagesResponseSchema>

export const CreateSessionResponseSchema = z.object({
    session: SessionSchema
})

export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>

export const CreateMachineResponseSchema = z.object({
    machine: MachineSchema
})

export type CreateMachineResponse = z.infer<typeof CreateMachineResponseSchema>

export const GetSessionResponseSchema = CreateSessionResponseSchema
export type GetSessionResponse = CreateSessionResponse

export type AuthResponse = {
    token: string
    user: {
        id: number
        username?: string
        firstName?: string
        lastName?: string
    }
}

export type SessionsResponse = { sessions: SessionSummary[] }
export type SessionResponse = { session: Session }
export type MessagesResponse = {
    messages: DecryptedMessage[]
    page: {
        limit: number
        nextBeforeSeq: number | null
        nextBeforeAt: number | null
        hasMore: boolean
    }
}

export type MachinesResponse = { machines: Machine[] }

export const SessionLoomLanguageSchema = z.enum(['en', 'zh-CN'])
export type SessionLoomLanguage = z.infer<typeof SessionLoomLanguageSchema>

export const SessionLoomExportFormatSchema = z.enum(['markdown'])
export type SessionLoomExportFormat = z.infer<typeof SessionLoomExportFormatSchema>

export const SessionLoomTemplateSchema = z.enum([
    'raw',
    'design',
    'prd',
    'decisions',
    'retrospective',
    'drift-check',
    'lesson-card'
])
export type SessionLoomTemplate = z.infer<typeof SessionLoomTemplateSchema>

export const SessionLoomFiltersSchema = z.object({
    redactSecrets: z.boolean().optional().default(true),
    includeSystemEvents: z.boolean().optional().default(false),
    includeToolDetails: z.boolean().optional().default(false)
}).strict()
export type SessionLoomFilters = z.infer<typeof SessionLoomFiltersSchema>

export const SessionLoomExportPreviewRequestSchema = z.object({
    language: SessionLoomLanguageSchema.optional().default('zh-CN'),
    format: SessionLoomExportFormatSchema.optional().default('markdown'),
    template: SessionLoomTemplateSchema.optional().default('raw'),
    filters: SessionLoomFiltersSchema.optional().default({
        redactSecrets: true,
        includeSystemEvents: false,
        includeToolDetails: false
    })
}).strict()
export type SessionLoomExportPreviewRequest = z.infer<typeof SessionLoomExportPreviewRequestSchema>

export const SessionLoomExportRequestSchema = SessionLoomExportPreviewRequestSchema.extend({
    fileName: z.string().trim().min(1).max(128).optional()
}).strict()
export type SessionLoomExportRequest = z.infer<typeof SessionLoomExportRequestSchema>

export const SessionLoomSynthesisRequestSchema = z.object({
    language: SessionLoomLanguageSchema.optional().default('zh-CN'),
    template: SessionLoomTemplateSchema.optional().default('decisions'),
    filters: SessionLoomFiltersSchema.optional().default({
        redactSecrets: true,
        includeSystemEvents: false,
        includeToolDetails: false
    }),
    useExternalModel: z.boolean().optional().default(false),
    explicitConfirmation: z.boolean().optional().default(false)
}).strict()
export type SessionLoomSynthesisRequest = z.infer<typeof SessionLoomSynthesisRequestSchema>

export type SessionLoomOutlineKind = 'user' | 'assistant' | 'system' | 'tool' | 'decision'

export type SessionLoomOutlineItem = {
    id: string
    targetMessageId: string
    kind: SessionLoomOutlineKind
    label: string
    createdAt: number
    depth: number
}

export type SessionLoomOutlineResponse = {
    success: boolean
    sessionId: string
    title: string
    generatedAt: number
    items: SessionLoomOutlineItem[]
    stats: {
        totalMessages: number
        outlineItems: number
        firstMessageAt: number | null
        lastMessageAt: number | null
    }
}

export type SessionLoomExportStats = {
    messageCount: number
    outlineCount: number
    userMessages: number
    assistantMessages: number
    systemEvents: number
    redactions: number
    filteredToolDetails: number
}

export type SessionLoomExportPreviewResponse = {
    success: boolean
    sessionId: string
    generatedAt: number
    markdown: string
    title: string
    stats: SessionLoomExportStats
    filters: SessionLoomFilters
    warnings: string[]
}

export type SessionLoomExportAsset = {
    exportId: string
    sessionId: string
    title: string
    fileName: string
    format: SessionLoomExportFormat
    template: SessionLoomTemplate
    createdAt: number
    expiresAt: number
    sizeBytes: number
    checksum: string
    stats: SessionLoomExportStats
}

export type SessionLoomExportResponse = {
    success: boolean
    asset: SessionLoomExportAsset
    markdown: string
}

export type SessionLoomExportListResponse = {
    success: boolean
    assets: SessionLoomExportAsset[]
}

export type SessionLoomSynthesisResponse = {
    success: boolean
    sessionId: string
    generatedAt: number
    template: SessionLoomTemplate
    provider: 'local'
    summary: string
    markdown: string
    filters: SessionLoomFilters
    stats: SessionLoomExportStats
}

export type SpawnResponse =
    | { type: 'success'; sessionId: string }
    | { type: 'error'; message: string }

export const SessionPermissionModeRequestSchema = z.object({
    mode: PermissionModeSchema
})

export type SessionPermissionModeRequest = z.infer<typeof SessionPermissionModeRequestSchema>

export const ResumeSessionRequestSchema = z.object({
    permissionMode: PermissionModeSchema.optional()
})

export type ResumeSessionRequest = z.infer<typeof ResumeSessionRequestSchema>

export const SessionCollaborationModeRequestSchema = z.object({
    mode: CodexCollaborationModeSchema
})

export type SessionCollaborationModeRequest = z.infer<typeof SessionCollaborationModeRequestSchema>

export const SessionModelRequestSchema = z.object({
    model: z.string().trim().min(1).nullable(),
    providerId: z.string().uuid().optional(),
})

export type SessionModelRequest = z.infer<typeof SessionModelRequestSchema>

export const SessionModelReasoningEffortRequestSchema = z.object({
    modelReasoningEffort: z.string().trim().min(1).nullable()
})

export type SessionModelReasoningEffortRequest = z.infer<typeof SessionModelReasoningEffortRequestSchema>

export const SessionEffortRequestSchema = z.object({
    effort: z.string().trim().min(1).nullable()
})

export type SessionEffortRequest = z.infer<typeof SessionEffortRequestSchema>

export const RenameSessionRequestSchema = z.object({
    name: z.string().min(1).max(255)
})

export type RenameSessionRequest = z.infer<typeof RenameSessionRequestSchema>

export const UploadFileRequestSchema = z.object({
    filename: z.string().min(1).max(255),
    content: z.string().min(1),
    mimeType: z.string().min(1).max(255)
})

export type UploadFileRequest = z.infer<typeof UploadFileRequestSchema>

export const DeleteUploadRequestSchema = z.object({
    path: z.string().min(1)
})

export type DeleteUploadRequest = z.infer<typeof DeleteUploadRequestSchema>

export const MessagesQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
    beforeSeq: z.coerce.number().int().min(1).optional(),
    beforeAt: z.coerce.number().int().min(0).optional(),
}).refine((data) => (data.beforeAt === undefined) === (data.beforeSeq === undefined), {
    message: 'beforeAt and beforeSeq must be provided together',
    path: ['beforeAt'],
})

export type MessagesQuery = z.infer<typeof MessagesQuerySchema>

export const SendMessageRequestSchema = z.object({
    text: z.string(),
    localId: z.string().min(1).optional(),
    attachments: z.array(AttachmentMetadataSchema).optional(),
    scheduledAt: z.number().int().positive().nullable().optional(),
    deliveryMode: MessageDeliveryModeSchema.optional().default('queue')
}).refine(
    (data) => data.scheduledAt == null || typeof data.localId === 'string',
    { message: 'scheduledAt requires localId', path: ['localId'] }
).refine(
    (data) => data.scheduledAt == null || data.scheduledAt <= Date.now() + 7 * 24 * 60 * 60 * 1000,
    { message: 'scheduledAt must be within 7 days from now', path: ['scheduledAt'] }
).refine(
    (data) => data.scheduledAt == null || !data.attachments?.length,
    { message: 'scheduled messages with attachments are not supported', path: ['attachments'] }
).refine(
    (data) => data.deliveryMode !== 'guide' || data.scheduledAt == null,
    { message: 'guide messages cannot be scheduled', path: ['deliveryMode'] }
).refine(
    (data) => data.deliveryMode !== 'guide' || !data.attachments?.length,
    { message: 'guide messages with attachments are not supported', path: ['deliveryMode'] }
).refine(
    (data) => data.deliveryMode !== 'guide' || typeof data.localId === 'string',
    { message: 'guide messages require localId', path: ['localId'] }
)

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>

export const SpawnSessionRequestSchema = z.object({
    directory: z.string().min(1),
    agent: AgentFlavorSchema.optional(),
    model: z.string().optional(),
    effort: z.string().optional(),
    modelReasoningEffort: z.string().optional(),
    yolo: z.boolean().optional(),
    sessionType: z.enum(['simple', 'worktree']).optional(),
    worktreeName: z.string().optional(),
    providerId: z.string().uuid().optional()
})

export type SpawnSessionRequest = z.infer<typeof SpawnSessionRequestSchema>

export const MachineListDirectoryRequestSchema = z.object({
    path: z.string().min(1),
    showHidden: z.boolean().optional()
})

export type MachineListDirectoryRequest = z.infer<typeof MachineListDirectoryRequestSchema>

export const MachinePathsExistsRequestSchema = z.object({
    paths: z.array(z.string().min(1)).max(1000)
})

export type MachinePathsExistsRequest = z.infer<typeof MachinePathsExistsRequestSchema>

export { GitCloneAuthSchema, GitCloneCancelRequestSchema, GitCloneRequestSchema }
export type { GitCloneAuth, GitCloneCancelRequest, GitCloneRequest }

export const AuthRequestSchema = z.union([
    z.object({ initData: z.string() }),
    z.object({ accessToken: z.string() })
])

export type AuthRequest = z.infer<typeof AuthRequestSchema>

export type CommandResponse = {
    success: boolean
    stdout?: string
    stderr?: string
    exitCode?: number
    error?: string
}

export type GitCommandResponse = CommandResponse

export type GitAtlasChangeStatus =
    | 'modified'
    | 'added'
    | 'deleted'
    | 'renamed'
    | 'untracked'
    | 'conflicted'

export type GitAtlasChangeStage = 'staged' | 'unstaged' | 'mixed' | 'untracked'

export type GitAtlasChange = {
    path: string
    oldPath?: string
    status: GitAtlasChangeStatus
    stage: GitAtlasChangeStage
    linesAdded: number
    linesRemoved: number
    binary: boolean
    selectable: boolean
}

export type GitAtlasGroup = {
    id: string
    label: string
    kind: 'conflicted' | 'staged' | 'unstaged' | 'untracked'
    total: number
    paths: string[]
}

export type GitAtlasRemote = {
    name: string
    url: string
}

export type GitAtlasCommitSummary = {
    hash: string
    message: string
    refs?: string
}

export type GitAtlasRecommendation = {
    kind: 'clone' | 'resolve-conflicts' | 'review' | 'commit' | 'pull' | 'push' | 'clean'
    label: string
    description: string
}

export type GitAtlasDashboardResponse = {
    success: boolean
    repo?: {
        isRepo: boolean
        root: string | null
        branch: string | null
        upstream: string | null
        detached: boolean
        ahead: number
        behind: number
        hasConflicts: boolean
    }
    summary?: {
        totalChanges: number
        staged: number
        unstaged: number
        untracked: number
        conflicted: number
        linesAdded: number
        linesRemoved: number
    }
    recommendation?: GitAtlasRecommendation
    changes?: GitAtlasChange[]
    groups?: GitAtlasGroup[]
    remotes?: GitAtlasRemote[]
    recentCommits?: GitAtlasCommitSummary[]
    sync?: {
        remote: string | null
        branch: string | null
        ahead: number
        behind: number
        canPull: boolean
        canPush: boolean
        requiresRemote: boolean
        inFlight: boolean
    }
    error?: string
}

export type GitAtlasDiffResponse = {
    success: boolean
    path?: string
    staged?: boolean
    diff?: string
    binary?: boolean
    tooLarge?: boolean
    truncated?: boolean
    error?: string
}

export type GitCommitBasketRequest = {
    message: string
    paths: string[]
}

export type GitCommitBasketResponse = CommandResponse & {
    committedPaths?: string[]
}

export type GitSyncAction = 'fetch' | 'pull' | 'push'

export type GitSyncRequest = {
    action: GitSyncAction
    remote?: string
    branch?: string
    force?: boolean
    confirmation?: string
}

export type GitSyncResponse = CommandResponse & {
    action?: GitSyncAction
    remote?: string
    branch?: string
}

export type GitCloneResponse = CommandResponse & {
    clonedPath?: string
    repoInfo?: {
        name: string
        branch: string
        sizeBytes: number
    }
}

export type FileReadResponse = {
    success: boolean
    content?: string
    hash?: string
    size?: number
    modified?: number
    error?: string
}

export type GeneratedImageResponse = {
    success: boolean
    content?: string
    mimeType?: string
    fileName?: string
    error?: string
}

export type UploadFileResponse = {
    success: boolean
    path?: string
    error?: string
}

export type DeleteUploadResponse = {
    success: boolean
    error?: string
}

export type DirectoryEntry = {
    name: string
    type: 'file' | 'directory' | 'other'
    size?: number
    modified?: number
}

export type ListDirectoryResponse = {
    success: boolean
    entries?: DirectoryEntry[]
    error?: string
}

export type RpcListDirectoryResponse = ListDirectoryResponse

export type MachineDirectoryEntry = DirectoryEntry & {
    isGitRepo?: boolean
}

export type MachineListDirectoryResponse = {
    success: boolean
    entries?: MachineDirectoryEntry[]
    error?: string
}

export type PathExistsResponse = {
    exists: Record<string, boolean>
}

export type MachinePathsExistsResponse = PathExistsResponse

export type CodexModelSummary = {
    id: string
    displayName: string
    isDefault: boolean
    defaultReasoningEffort?: string | null
    supportedReasoningEfforts?: string[]
}

export type CodexModelsResponse = {
    success: boolean
    models?: CodexModelSummary[]
    error?: string
}

export type ListCodexModelsResponse = CodexModelsResponse

export type OpencodeModelSummary = {
    modelId: string
    name?: string
}

export type OpencodeModelsResponse = {
    success: boolean
    availableModels?: OpencodeModelSummary[]
    currentModelId?: string | null
    error?: string
}

export type ListOpencodeModelsResponse = OpencodeModelsResponse

export type CursorModelSummary = OpencodeModelSummary

export type CursorModelsResponse = OpencodeModelsResponse

export type ListCursorModelsResponse = CursorModelsResponse

export type SlashCommand = {
    name: string
    description?: string
    source: 'builtin' | 'user' | 'plugin' | 'project'
    content?: string
    pluginName?: string
}

export type SlashCommandsResponse = {
    success: boolean
    commands?: SlashCommand[]
    error?: string
}
