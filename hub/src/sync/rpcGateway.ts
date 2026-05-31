import type { AgentFlavor, CodexCollaborationMode, PermissionMode } from '@hapipower/protocol/types'
import { RPC_METHODS } from '@hapipower/protocol/rpcMethods'
import type {
    CodexModelSummary,
    CodexModelsResponse,
    CommandResponse,
    CursorModelSummary,
    CursorModelsResponse,
    DeleteUploadResponse,
    DirectoryEntry,
    FileReadResponse,
    GeneratedImageResponse,
    ListDirectoryResponse,
    OpencodeModelsResponse,
    OpencodeModelSummary,
    PathExistsResponse,
    SlashCommandsResponse,
    UploadFileResponse
} from '@hapipower/protocol/apiTypes'
import type { Server } from 'socket.io'
import type { RpcRegistry } from '../socket/rpcRegistry'

const DEFAULT_RPC_TIMEOUT_MS = 30_000
const MODEL_LIST_RPC_TIMEOUT_MS = 120_000

export type RpcCommandResponse = CommandResponse
export type RpcReadFileResponse = FileReadResponse
export type RpcGeneratedImageResponse = GeneratedImageResponse
export type RpcUploadFileResponse = UploadFileResponse
export type RpcDeleteUploadResponse = DeleteUploadResponse
export type RpcDirectoryEntry = DirectoryEntry
export type RpcListDirectoryResponse = ListDirectoryResponse
export type RpcPathExistsResponse = PathExistsResponse
export type RpcCodexModel = CodexModelSummary
export type RpcListCodexModelsResponse = CodexModelsResponse
export type RpcCursorModel = CursorModelSummary
export type RpcListCursorModelsResponse = CursorModelsResponse
export type RpcOpencodeModel = OpencodeModelSummary
export type RpcListOpencodeModelsResponse = OpencodeModelsResponse

export class RpcGateway {
    constructor(
        private readonly io: Server,
        private readonly rpcRegistry: RpcRegistry
    ) {
    }

    async approvePermission(
        sessionId: string,
        requestId: string,
        mode?: PermissionMode,
        allowTools?: string[],
        decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort',
        answers?: Record<string, string[]> | Record<string, { answers: string[] }>
    ): Promise<void> {
        await this.sessionRpc(sessionId, RPC_METHODS.Permission, {
            id: requestId,
            approved: true,
            mode,
            allowTools,
            decision,
            answers
        })
    }

    async denyPermission(
        sessionId: string,
        requestId: string,
        decision?: 'approved' | 'approved_for_session' | 'denied' | 'abort'
    ): Promise<void> {
        await this.sessionRpc(sessionId, RPC_METHODS.Permission, {
            id: requestId,
            approved: false,
            decision
        })
    }

    async abortSession(sessionId: string): Promise<void> {
        await this.sessionRpc(sessionId, RPC_METHODS.Abort, { reason: 'User aborted via Telegram Bot' })
    }

    async switchSession(sessionId: string, to: 'remote' | 'local'): Promise<void> {
        await this.sessionRpc(sessionId, RPC_METHODS.Switch, { to })
    }

    async requestSessionConfig(
        sessionId: string,
        config: {
            permissionMode?: PermissionMode
            model?: string | null
            modelReasoningEffort?: string | null
            effort?: string | null
            collaborationMode?: CodexCollaborationMode
        }
    ): Promise<unknown> {
        return await this.sessionRpc(sessionId, RPC_METHODS.SetSessionConfig, config)
    }

    async killSession(sessionId: string): Promise<void> {
        await this.sessionRpc(sessionId, RPC_METHODS.KillSession, {})
    }

    async handoffSessionToLocal(sessionId: string): Promise<void> {
        await this.sessionRpc(sessionId, RPC_METHODS.HandoffLocal, {})
    }

    async spawnSession(
        machineId: string,
        directory: string,
        agent: AgentFlavor = 'claude',
        model?: string,
        modelReasoningEffort?: string,
        yolo?: boolean,
        sessionType?: 'simple' | 'worktree',
        worktreeName?: string,
        resumeSessionId?: string,
        effort?: string,
        permissionMode?: PermissionMode
    ): Promise<{ type: 'success'; sessionId: string } | { type: 'error'; message: string }> {
        try {
            const result = await this.machineRpc(
                machineId,
                RPC_METHODS.SpawnHappySession,
                { type: 'spawn-in-directory', directory, agent, model, modelReasoningEffort, yolo, sessionType, worktreeName, resumeSessionId, effort, permissionMode }
            )
            if (result && typeof result === 'object') {
                const obj = result as Record<string, unknown>
                if (obj.type === 'success' && typeof obj.sessionId === 'string') {
                    return { type: 'success', sessionId: obj.sessionId }
                }
                if (obj.type === 'error' && typeof obj.errorMessage === 'string') {
                    return { type: 'error', message: obj.errorMessage }
                }
                if (obj.type === 'requestToApproveDirectoryCreation' && typeof obj.directory === 'string') {
                    return { type: 'error', message: `Directory creation requires approval: ${obj.directory}` }
                }
                if (typeof obj.error === 'string') {
                    return { type: 'error', message: obj.error }
                }
                if (obj.type !== 'success' && typeof obj.message === 'string') {
                    return { type: 'error', message: obj.message }
                }
            }
            const details = typeof result === 'string'
                ? result
                : (() => {
                    try {
                        return JSON.stringify(result)
                    } catch {
                        return String(result)
                    }
                })()
            return { type: 'error', message: `Unexpected spawn result: ${details}` }
        } catch (error) {
            return { type: 'error', message: error instanceof Error ? error.message : String(error) }
        }
    }

    async listMachineDirectory(machineId: string, path: string): Promise<RpcListDirectoryResponse> {
        const result = await this.machineRpc(machineId, RPC_METHODS.ListMachineDirectory, { path }) as RpcListDirectoryResponse | unknown
        if (!result || typeof result !== 'object') {
            return { success: false, error: 'Unexpected list-directory result' }
        }
        return result as RpcListDirectoryResponse
    }

    async checkPathsExist(machineId: string, paths: string[]): Promise<Record<string, boolean>> {
        const result = await this.machineRpc(machineId, RPC_METHODS.PathExists, { paths }) as RpcPathExistsResponse | unknown
        if (!result || typeof result !== 'object') {
            throw new Error('Unexpected path-exists result')
        }

        const existsValue = (result as RpcPathExistsResponse).exists
        if (!existsValue || typeof existsValue !== 'object') {
            throw new Error('Unexpected path-exists result')
        }

        const exists: Record<string, boolean> = {}
        for (const [key, value] of Object.entries(existsValue)) {
            exists[key] = value === true
        }
        return exists
    }

    async getGitStatus(sessionId: string, cwd?: string): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitStatus, { cwd }) as RpcCommandResponse
    }

    async getGitDiffNumstat(sessionId: string, options: { cwd?: string; staged?: boolean }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitDiffNumstat, options) as RpcCommandResponse
    }

    async getGitDiffFile(sessionId: string, options: { cwd?: string; filePath: string; staged?: boolean }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitDiffFile, options) as RpcCommandResponse
    }

    async getGitLog(sessionId: string, options: { cwd?: string; maxCount?: number }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitLog, options) as RpcCommandResponse
    }

    async getGitBranchList(sessionId: string, cwd?: string): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitBranchList, { cwd }) as RpcCommandResponse
    }

    async createGitBranch(sessionId: string, options: { cwd?: string; name: string }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitBranchCreate, options) as RpcCommandResponse
    }

    async switchGitBranch(sessionId: string, options: { cwd?: string; name: string }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitBranchSwitch, options) as RpcCommandResponse
    }

    async deleteGitBranch(sessionId: string, options: { cwd?: string; name: string }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitBranchDelete, options) as RpcCommandResponse
    }

    async mergeGitBranch(sessionId: string, options: { cwd?: string; name: string }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitBranchMerge, options, 120_000) as RpcCommandResponse
    }

    async createGitCommit(sessionId: string, options: { cwd?: string; message: string; paths?: string[] }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitCommit, options) as RpcCommandResponse
    }

    async gitClone(sessionId: string, options: { cwd?: string; url: string; targetDir?: string; branch?: string; cloneId?: string }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitClone, { ...options }, 600_000) as RpcCommandResponse
    }

    async getGitRemoteList(sessionId: string, cwd?: string): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitRemoteList, { cwd }) as RpcCommandResponse
    }

    async addGitRemote(sessionId: string, options: { cwd?: string; name: string; url: string }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitRemoteAdd, options) as RpcCommandResponse
    }

    async removeGitRemote(sessionId: string, options: { cwd?: string; name: string }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitRemoteRemove, options) as RpcCommandResponse
    }

    async gitPush(sessionId: string, options: { cwd?: string; remote?: string; branch?: string; force?: boolean }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitPush, options, 120_000) as RpcCommandResponse
    }

    async gitPull(sessionId: string, options: { cwd?: string; remote?: string; branch?: string }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitPull, options, 120_000) as RpcCommandResponse
    }

    async gitFetch(sessionId: string, options: { cwd?: string; remote?: string }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.GitFetch, options, 120_000) as RpcCommandResponse
    }

    async readSessionFile(sessionId: string, path: string): Promise<RpcReadFileResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.ReadFile, { path }) as RpcReadFileResponse
    }

    async writeSessionFile(sessionId: string, options: { path: string; content: string; expectedHash?: string }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.WriteFile, options) as RpcCommandResponse
    }

    async readGeneratedImage(sessionId: string, imageId: string): Promise<RpcGeneratedImageResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.ReadGeneratedImage, { id: imageId }) as RpcGeneratedImageResponse
    }

    async listDirectory(sessionId: string, path: string): Promise<RpcListDirectoryResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.ListDirectory, { path }) as RpcListDirectoryResponse
    }

    async uploadFile(sessionId: string, filename: string, content: string, mimeType: string): Promise<RpcUploadFileResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.UploadFile, { sessionId, filename, content, mimeType }) as RpcUploadFileResponse
    }

    async deleteUploadFile(sessionId: string, path: string): Promise<RpcDeleteUploadResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.DeleteUpload, { sessionId, path }) as RpcDeleteUploadResponse
    }

    async runRipgrep(sessionId: string, args: string[], cwd?: string): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.Ripgrep, { args, cwd }) as RpcCommandResponse
    }

    async listSlashCommands(sessionId: string, agent: string): Promise<SlashCommandsResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.ListSlashCommands, { agent }) as SlashCommandsResponse
    }

    async listSkills(sessionId: string, flavor?: string): Promise<{
        success: boolean
        skills?: Array<{ name: string; description?: string }>
        error?: string
    }> {
        return await this.sessionRpc(sessionId, RPC_METHODS.ListSkills, { flavor }) as {
            success: boolean
            skills?: Array<{ name: string; description?: string }>
            error?: string
        }
    }

    // Plugin management
    async pluginList(sessionId: string): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.PluginList, {}) as RpcCommandResponse
    }

    async pluginInstall(sessionId: string, options: { pluginId: string; sourceUrl?: string; sourceType?: string; archivePath?: string }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.PluginInstall, options) as RpcCommandResponse
    }

    async pluginUninstall(sessionId: string, pluginId: string): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.PluginUninstall, { pluginId }) as RpcCommandResponse
    }

    async pluginStorageGet(sessionId: string, pluginId: string, key: string): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.PluginStorageGet, { pluginId, key }) as RpcCommandResponse
    }

    async pluginStorageSet(sessionId: string, pluginId: string, key: string, value: string): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.PluginStorageSet, { pluginId, key, value }) as RpcCommandResponse
    }

    async pluginStorageDelete(sessionId: string, pluginId: string, key: string): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.PluginStorageDelete, { pluginId, key }) as RpcCommandResponse
    }

    async pluginStorageList(sessionId: string, pluginId: string, prefix?: string): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.PluginStorageList, { pluginId, prefix }) as RpcCommandResponse
    }

    // Skill management
    async skillSearch(sessionId: string, query: string, limit?: number): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.SkillSearch, { query, limit }) as RpcCommandResponse
    }

    async skillInstall(sessionId: string, options: { name: string; repo: string; path?: string }): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.SkillInstall, options) as RpcCommandResponse
    }

    async skillUninstall(sessionId: string, name: string): Promise<RpcCommandResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.SkillUninstall, { name }) as RpcCommandResponse
    }

    async listCodexModelsForSession(sessionId: string): Promise<RpcListCodexModelsResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.ListCodexModels, {}, MODEL_LIST_RPC_TIMEOUT_MS) as RpcListCodexModelsResponse
    }

    async listCodexModelsForMachine(machineId: string): Promise<RpcListCodexModelsResponse> {
        return await this.machineRpc(machineId, RPC_METHODS.ListCodexModels, {}, MODEL_LIST_RPC_TIMEOUT_MS) as RpcListCodexModelsResponse
    }

    async listCursorModelsForSession(sessionId: string): Promise<RpcListCursorModelsResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.ListCursorModels, {}, MODEL_LIST_RPC_TIMEOUT_MS) as RpcListCursorModelsResponse
    }

    async listCursorModelsForMachine(machineId: string): Promise<RpcListCursorModelsResponse> {
        return await this.machineRpc(machineId, RPC_METHODS.ListCursorModels, {}, MODEL_LIST_RPC_TIMEOUT_MS) as RpcListCursorModelsResponse
    }

    async listOpencodeModelsForSession(sessionId: string): Promise<RpcListOpencodeModelsResponse> {
        return await this.sessionRpc(sessionId, RPC_METHODS.ListOpencodeModels, {}) as RpcListOpencodeModelsResponse
    }

    async listOpencodeModelsForCwd(machineId: string, cwd: string): Promise<RpcListOpencodeModelsResponse> {
        return await this.machineRpc(machineId, RPC_METHODS.ListOpencodeModelsForCwd, { cwd }) as RpcListOpencodeModelsResponse
    }

    private async sessionRpc(
        sessionId: string,
        method: string,
        params: unknown,
        timeoutMs: number = DEFAULT_RPC_TIMEOUT_MS
    ): Promise<unknown> {
        return await this.rpcCall(`${sessionId}:${method}`, params, timeoutMs)
    }

    private async machineRpc(
        machineId: string,
        method: string,
        params: unknown,
        timeoutMs: number = DEFAULT_RPC_TIMEOUT_MS
    ): Promise<unknown> {
        return await this.rpcCall(`${machineId}:${method}`, params, timeoutMs)
    }

    private async rpcCall(method: string, params: unknown, timeoutMs: number = DEFAULT_RPC_TIMEOUT_MS): Promise<unknown> {
        const socketId = this.rpcRegistry.getSocketIdForMethod(method)
        if (!socketId) {
            throw new Error(`RPC handler not registered: ${method}`)
        }

        const socket = this.io.of('/cli').sockets.get(socketId)
        if (!socket) {
            throw new Error(`RPC socket disconnected: ${method}`)
        }

        const response = await socket.timeout(timeoutMs).emitWithAck('rpc-request', {
            method,
            params: JSON.stringify(params)
        }) as unknown

        if (typeof response !== 'string') {
            return response
        }

        try {
            return JSON.parse(response) as unknown
        } catch {
            return response
        }
    }
}
