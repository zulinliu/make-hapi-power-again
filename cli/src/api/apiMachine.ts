/**
 * WebSocket client for machine/runner communication with hapi-power-hub
 */

import { io, type Socket } from 'socket.io-client'
import { cp, mkdir, readFile, readdir, realpath, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, dirname, isAbsolute, join, relative, resolve as resolvePath } from 'node:path'
import { logger } from '@/ui/logger'
import { configuration } from '@/configuration'
import type { ClientToServerEvents, ServerToClientEvents, Update, UpdateMachineBody } from '@hapipower/protocol'
import type { FileReadResponse, MachineDirectoryEntry, MachineListDirectoryResponse, PathExistsResponse } from '@hapipower/protocol/apiTypes'
import { RPC_METHODS } from '@hapipower/protocol/rpcMethods'
import type { RunnerState, Machine, MachineMetadata } from './types'
import { RunnerStateSchema, MachineMetadataSchema } from './types'
import { backoff } from '@/utils/time'
import { getInvokedCwd } from '@/utils/invokedCwd'
import { RpcHandlerManager } from './rpc/RpcHandlerManager'
import { registerCommonHandlers } from '../modules/common/registerCommonHandlers'
import {
    listOpencodeModelsForCwd,
    type ListOpencodeModelsForCwdRequest,
    type ListOpencodeModelsForCwdResponse
} from '../modules/common/opencodeModels'
import type { SpawnSessionOptions, SpawnSessionResult } from '../modules/common/rpcTypes'
import { applyVersionedAck } from './versionedUpdate'
import { buildSocketIoExtraHeaderOptions } from './hubExtraHeaders'

type MachineRpcHandlers = {
    spawnSession: (options: SpawnSessionOptions) => Promise<SpawnSessionResult>
    stopSession: (sessionId: string) => boolean
    requestShutdown: () => void
}

interface PathExistsRequest {
    paths: string[]
}

interface ListMachineDirectoryRequest {
    path: string
    showHidden?: boolean
}

interface MachineReadFileRequest {
    path: string
}

interface MachineWriteFileRequest {
    path: string
    content: string
    expectedHash?: string | null
    forceOverwrite?: boolean
}

interface MachineDeleteFileRequest {
    path: string
    recursive?: boolean
}

interface MachineRenameFileRequest {
    oldPath: string
    newPath: string
}

interface MachineCopyFileRequest {
    sourcePath: string
    destinationPath: string
}

interface MachineMoveFileRequest {
    sourcePath: string
    destinationPath: string
}

interface MachineCreateDirectoryRequest {
    path: string
    recursive?: boolean
}

type MachineCommandResponse = {
    success: boolean
    hash?: string
    error?: string
}

type ResolvedWorkspacePath =
    | { success: true; path: string }
    | { success: false; error: string }

function normalizeWorkspaceRoots(paths?: string[]): string[] | undefined {
    if (!paths?.length) {
        return undefined
    }

    const normalized = Array.from(new Set(paths.map((path) => {
        try {
            return realpathSync(path)
        } catch {
            return resolvePath(path)
        }
    })))

    return normalized.length > 0 ? normalized : undefined
}

function workspaceRootsEqual(left?: string[], right?: string[]): boolean {
    const normalizedLeft = left ?? []
    const normalizedRight = right ?? []
    if (normalizedLeft.length !== normalizedRight.length) {
        return false
    }

    return normalizedLeft.every((value, index) => value === normalizedRight[index])
}

function formatWorkspaceRoots(paths?: string[]): string {
    return paths?.length ? paths.join(', ') : '(none)'
}

export class ApiMachineClient {
    private socket!: Socket<ServerToClientEvents, ClientToServerEvents>
    private keepAliveInterval: NodeJS.Timeout | null = null
    private rpcHandlerManager: RpcHandlerManager

    private readonly normalizedWorkspaceRoots: string[] | undefined

    constructor(
        private readonly token: string,
        private readonly machine: Machine,
        private readonly workspaceRoots?: string[]
    ) {
        // Realpath roots once so all subsequent comparisons are against
        // canonical, symlink-resolved locations. Falls back to lexical
        // resolution if realpath fails so we still get protection.
        this.normalizedWorkspaceRoots = normalizeWorkspaceRoots(workspaceRoots)

        this.rpcHandlerManager = new RpcHandlerManager({
            scopePrefix: this.machine.id,
            logger: (msg, data) => logger.debug(msg, data)
        })

        registerCommonHandlers(this.rpcHandlerManager, getInvokedCwd())

        this.rpcHandlerManager.registerHandler<PathExistsRequest, PathExistsResponse>(RPC_METHODS.PathExists, async (params) => {
            const rawPaths = Array.isArray(params?.paths) ? params.paths : []
            const uniquePaths = Array.from(new Set(rawPaths.filter((path): path is string => typeof path === 'string')))
            const exists: Record<string, boolean> = {}

            await Promise.all(uniquePaths.map(async (path) => {
                const trimmed = path.trim()
                if (!trimmed) return
                try {
                    const stats = await stat(trimmed)
                    exists[trimmed] = stats.isDirectory()
                } catch {
                    exists[trimmed] = false
                }
            }))

            return { exists }
        })

        this.rpcHandlerManager.registerHandler<ListMachineDirectoryRequest, MachineListDirectoryResponse>(RPC_METHODS.ListMachineDirectory, async (params) => {
            const resolved = await this.resolveWorkspaceFilePath(params?.path)
            if (!resolved.success) return resolved

            try {
                const targetPath = resolved.path
                const dirStat = await stat(targetPath)
                if (!dirStat.isDirectory()) {
                    return { success: false, error: 'Path is not a directory' }
                }

                const dirEntries = await readdir(targetPath, { withFileTypes: true })
                const entries: MachineDirectoryEntry[] = []

                const showHidden = params.showHidden === true

                await Promise.all(dirEntries.map(async (entry) => {
                    if (!showHidden && entry.name.startsWith('.')) return

                    const fullPath = join(targetPath, entry.name)
                    let type: 'file' | 'directory' | 'other' = 'other'
                    let size: number | undefined
                    let modified: number | undefined
                    let isGitRepo = false

                    if (entry.isDirectory()) {
                        type = 'directory'
                        try {
                            const gitStat = await stat(join(fullPath, '.git'))
                            isGitRepo = gitStat.isDirectory() || gitStat.isFile()
                        } catch {
                            // not a git repo
                        }
                    } else if (entry.isFile()) {
                        type = 'file'
                    }

                    if (!entry.isSymbolicLink()) {
                        try {
                            const stats = await stat(fullPath)
                            size = stats.size
                            modified = stats.mtime.getTime()
                        } catch {
                            // ignore stat errors
                        }
                    }

                    entries.push({ name: entry.name, type, size, modified, isGitRepo })
                }))

                entries.sort((a, b) => {
                    if (a.type === 'directory' && b.type !== 'directory') return -1
                    if (a.type !== 'directory' && b.type === 'directory') return 1
                    return a.name.localeCompare(b.name)
                })

                return { success: true, entries }
            } catch (error) {
                return { success: false, error: error instanceof Error ? error.message : 'Failed to list directory' }
            }
        })

        this.registerWorkspaceFileHandlers()

        // OpenCode model discovery spawns an `opencode acp` subprocess scoped to the
        // requested cwd, so it must obey the same workspace-root containment as
        // `list-directory` and `spawn-happy-session`. Re-register the handler that
        // `registerCommonHandlers` installed unguarded with a guarded version that
        // resolves symlinks and rejects paths outside the configured root before
        // delegating to the lower-level probe. This intentionally overwrites the
        // earlier registration on the same scoped method name.
        this.rpcHandlerManager.registerHandler<ListOpencodeModelsForCwdRequest, ListOpencodeModelsForCwdResponse>(
            RPC_METHODS.ListOpencodeModelsForCwd,
            async (params) => {
                const rawCwd = typeof params?.cwd === 'string' ? params.cwd.trim() : ''
                if (!rawCwd) {
                    return { success: false, error: 'cwd is required' }
                }

                const resolvedCwd = await this.resolveForWorkspaceCheck(rawCwd)
                if (!this.isWithinWorkspaceRoots(resolvedCwd)) {
                    return { success: false, error: 'Path is outside workspace roots' }
                }

                return await listOpencodeModelsForCwd(resolvedCwd)
            }
        )
    }

    private isWithinWorkspaceRoots(absolutePath: string): boolean {
        if (!this.normalizedWorkspaceRoots?.length) return true
        return this.normalizedWorkspaceRoots.some((workspaceRoot) => {
            const rel = relative(workspaceRoot, absolutePath)
            return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
        })
    }

    private async pathExists(path: string): Promise<boolean> {
        try {
            await stat(path)
            return true
        } catch (error) {
            const nodeError = error as NodeJS.ErrnoException
            if (nodeError.code === 'ENOENT') return false
            throw error
        }
    }

    private async resolveWorkspaceFilePath(rawPath: unknown): Promise<ResolvedWorkspacePath> {
        if (!this.normalizedWorkspaceRoots?.length) {
            return { success: false, error: 'Workspace browsing is not enabled for this machine' }
        }

        const path = typeof rawPath === 'string' ? rawPath.trim() : ''
        if (!path) {
            return { success: false, error: 'Path is required' }
        }
        if (path.includes('\0')) {
            return { success: false, error: 'Path must not contain null bytes' }
        }
        if (!isAbsolute(path)) {
            return { success: false, error: 'Path must be absolute' }
        }

        const targetPath = await this.resolveForWorkspaceCheck(path)
        if (!this.isWithinWorkspaceRoots(targetPath)) {
            return { success: false, error: 'Path is outside workspace roots' }
        }

        return { success: true, path: targetPath }
    }

    private registerWorkspaceFileHandlers(): void {
        this.rpcHandlerManager.registerHandler<MachineReadFileRequest, FileReadResponse>(RPC_METHODS.ReadFile, async (params) => {
            const resolved = await this.resolveWorkspaceFilePath(params?.path)
            if (!resolved.success) return resolved

            try {
                const fileStat = await stat(resolved.path)
                if (fileStat.isDirectory()) {
                    return { success: false, error: 'Path is a directory' }
                }

                const buffer = await readFile(resolved.path)
                const hash = createHash('sha256').update(buffer).digest('hex')
                return {
                    success: true,
                    content: buffer.toString('base64'),
                    hash,
                    size: fileStat.size,
                    modified: fileStat.mtime.getTime()
                }
            } catch (error) {
                return { success: false, error: error instanceof Error ? error.message : 'Failed to read file' }
            }
        })

        this.rpcHandlerManager.registerHandler<MachineWriteFileRequest, MachineCommandResponse>(RPC_METHODS.WriteFile, async (params) => {
            const resolved = await this.resolveWorkspaceFilePath(params?.path)
            if (!resolved.success) return resolved

            try {
                if (params.forceOverwrite) {
                    // Explicit overwrite requested.
                } else if (params.expectedHash !== null && params.expectedHash !== undefined) {
                    try {
                        const existingBuffer = await readFile(resolved.path)
                        const existingHash = createHash('sha256').update(existingBuffer).digest('hex')
                        if (existingHash !== params.expectedHash) {
                            return { success: false, error: `File hash mismatch. Expected: ${params.expectedHash}, Actual: ${existingHash}` }
                        }
                    } catch (error) {
                        const nodeError = error as NodeJS.ErrnoException
                        if (nodeError.code !== 'ENOENT') throw error
                        return { success: false, error: 'File does not exist but hash was provided' }
                    }
                } else if (await this.pathExists(resolved.path)) {
                    return { success: false, error: 'File already exists but was expected to be new' }
                }

                const buffer = Buffer.from(typeof params.content === 'string' ? params.content : '', 'base64')
                await writeFile(resolved.path, buffer)
                const hash = createHash('sha256').update(buffer).digest('hex')
                return { success: true, hash }
            } catch (error) {
                return { success: false, error: error instanceof Error ? error.message : 'Failed to write file' }
            }
        })

        this.rpcHandlerManager.registerHandler<MachineDeleteFileRequest, MachineCommandResponse>(RPC_METHODS.DeleteFile, async (params) => {
            const resolved = await this.resolveWorkspaceFilePath(params?.path)
            if (!resolved.success) return resolved

            try {
                const targetStat = await stat(resolved.path)
                if (targetStat.isDirectory()) {
                    if (params.recursive) {
                        await rm(resolved.path, { recursive: true, force: false })
                    } else {
                        await rmdir(resolved.path)
                    }
                } else {
                    await rm(resolved.path, { force: false })
                }
                return { success: true }
            } catch (error) {
                return { success: false, error: error instanceof Error ? error.message : 'Failed to delete file' }
            }
        })

        this.rpcHandlerManager.registerHandler<MachineRenameFileRequest, MachineCommandResponse>(RPC_METHODS.RenameFile, async (params) => {
            const source = await this.resolveWorkspaceFilePath(params?.oldPath)
            if (!source.success) return source
            const destination = await this.resolveWorkspaceFilePath(params?.newPath)
            if (!destination.success) return destination

            try {
                if (!(await this.pathExists(source.path))) {
                    return { success: false, error: 'Source path does not exist' }
                }
                if (await this.pathExists(destination.path)) {
                    return { success: false, error: 'Destination path already exists' }
                }
                await mkdir(dirname(destination.path), { recursive: true })
                await rename(source.path, destination.path)
                return { success: true }
            } catch (error) {
                return { success: false, error: error instanceof Error ? error.message : 'Failed to rename file' }
            }
        })

        this.rpcHandlerManager.registerHandler<MachineCopyFileRequest, MachineCommandResponse>(RPC_METHODS.CopyFile, async (params) => {
            const source = await this.resolveWorkspaceFilePath(params?.sourcePath)
            if (!source.success) return source
            const destination = await this.resolveWorkspaceFilePath(params?.destinationPath)
            if (!destination.success) return destination

            try {
                if (!(await this.pathExists(source.path))) {
                    return { success: false, error: 'Source path does not exist' }
                }
                if (await this.pathExists(destination.path)) {
                    return { success: false, error: 'Destination path already exists' }
                }
                const sourceStat = await stat(source.path)
                await mkdir(dirname(destination.path), { recursive: true })
                await cp(source.path, destination.path, { recursive: sourceStat.isDirectory() })
                return { success: true }
            } catch (error) {
                return { success: false, error: error instanceof Error ? error.message : 'Failed to copy file' }
            }
        })

        this.rpcHandlerManager.registerHandler<MachineMoveFileRequest, MachineCommandResponse>(RPC_METHODS.MoveFile, async (params) => {
            const source = await this.resolveWorkspaceFilePath(params?.sourcePath)
            if (!source.success) return source
            const destination = await this.resolveWorkspaceFilePath(params?.destinationPath)
            if (!destination.success) return destination

            try {
                if (!(await this.pathExists(source.path))) {
                    return { success: false, error: 'Source path does not exist' }
                }
                if (await this.pathExists(destination.path)) {
                    return { success: false, error: 'Destination path already exists' }
                }
                await mkdir(dirname(destination.path), { recursive: true })
                await rename(source.path, destination.path)
                return { success: true }
            } catch (error) {
                return { success: false, error: error instanceof Error ? error.message : 'Failed to move file' }
            }
        })

        this.rpcHandlerManager.registerHandler<MachineCreateDirectoryRequest, MachineCommandResponse>(RPC_METHODS.CreateDirectory, async (params) => {
            const resolved = await this.resolveWorkspaceFilePath(params?.path)
            if (!resolved.success) return resolved

            try {
                if (await this.pathExists(resolved.path)) {
                    return { success: false, error: 'Directory already exists' }
                }
                await mkdir(resolved.path, { recursive: params.recursive !== false })
                return { success: true }
            } catch (error) {
                return { success: false, error: error instanceof Error ? error.message : 'Failed to create directory' }
            }
        })
    }

    /**
     * Canonicalize a path for workspace-root containment checks. Resolves
     * symlinks via realpath so a symlink such as `/safe/out -> /etc` cannot
     * be used to escape the configured root with a lexical-only check.
     *
     * If the path doesn't exist (e.g. a session is being spawned in a
     * directory we'll create), walks up to the nearest existing ancestor
     * and realpaths *that*, joining the missing tail back on. This way the
     * check still runs against the real on-disk location once any
     * intermediate symlink in the parent chain has been resolved.
     */
    private async resolveForWorkspaceCheck(path: string): Promise<string> {
        const absolute = resolvePath(path)
        try {
            return await realpath(absolute)
        } catch {
            const missing: string[] = []
            let cursor = absolute
            while (cursor !== dirname(cursor)) {
                missing.unshift(basename(cursor))
                cursor = dirname(cursor)
                try {
                    return join(await realpath(cursor), ...missing)
                } catch {
                    // keep walking to the nearest existing parent
                }
            }
            return absolute
        }
    }

    setRPCHandlers({ spawnSession, stopSession, requestShutdown }: MachineRpcHandlers): void {
        this.rpcHandlerManager.registerHandler(RPC_METHODS.SpawnHappySession, async (params: any) => {
            const { directory, sessionId, resumeSessionId, machineId, approvedNewDirectoryCreation, agent, model, effort, modelReasoningEffort, yolo, permissionMode, token, sessionType, worktreeName } = params || {}

            if (!directory) {
                throw new Error('Directory is required')
            }

            const resolvedDirectory = await this.resolveForWorkspaceCheck(directory)
            if (!this.isWithinWorkspaceRoots(resolvedDirectory)) {
                return { type: 'error', errorMessage: 'Directory is outside this machine\'s workspace roots' }
            }

            const result = await spawnSession({
                directory,
                sessionId,
                resumeSessionId,
                machineId,
                approvedNewDirectoryCreation,
                agent,
                model,
                effort,
                modelReasoningEffort,
                yolo,
                permissionMode,
                token,
                sessionType,
                worktreeName
            })

            switch (result.type) {
                case 'success':
                    return { type: 'success', sessionId: result.sessionId }
                case 'requestToApproveDirectoryCreation':
                    return { type: 'requestToApproveDirectoryCreation', directory: result.directory }
                case 'error':
                    return { type: 'error', errorMessage: result.errorMessage }
            }
        })

        this.rpcHandlerManager.registerHandler(RPC_METHODS.StopSession, (params: any) => {
            const { sessionId } = params || {}
            if (!sessionId) {
                throw new Error('Session ID is required')
            }

            const success = stopSession(sessionId)
            if (!success) {
                throw new Error('Session not found or failed to stop')
            }

            return { message: 'Session stopped' }
        })

        this.rpcHandlerManager.registerHandler(RPC_METHODS.StopRunner, () => {
            setTimeout(() => requestShutdown(), 100)
            return { message: 'Runner stop request acknowledged' }
        })
    }

    async updateMachineMetadata(handler: (metadata: MachineMetadata | null) => MachineMetadata): Promise<void> {
        await backoff(async () => {
            const updated = handler(this.machine.metadata)

            const answer = await this.socket.emitWithAck('machine-update-metadata', {
                machineId: this.machine.id,
                metadata: updated,
                expectedVersion: this.machine.metadataVersion
            }) as unknown

            applyVersionedAck(answer, {
                valueKey: 'metadata',
                parseValue: (value) => {
                    const parsed = MachineMetadataSchema.safeParse(value)
                    return parsed.success ? parsed.data : null
                },
                applyValue: (value) => {
                    this.machine.metadata = value
                },
                applyVersion: (version) => {
                    this.machine.metadataVersion = version
                },
                logInvalidValue: (context, version) => {
                    const suffix = context === 'success' ? 'ack' : 'version-mismatch ack'
                    logger.debug(`[API MACHINE] Ignoring invalid metadata value from ${suffix}`, { version })
                },
                invalidResponseMessage: 'Invalid machine-update-metadata response',
                errorMessage: 'Machine metadata update failed',
                versionMismatchMessage: 'Metadata version mismatch'
            })
        })
    }

    async updateRunnerState(handler: (state: RunnerState | null) => RunnerState): Promise<void> {
        await backoff(async () => {
            const updated = handler(this.machine.runnerState)

            const answer = await this.socket.emitWithAck('machine-update-state', {
                machineId: this.machine.id,
                runnerState: updated,
                expectedVersion: this.machine.runnerStateVersion
            }) as unknown

            applyVersionedAck(answer, {
                valueKey: 'runnerState',
                parseValue: (value) => {
                    const parsed = RunnerStateSchema.safeParse(value)
                    return parsed.success ? parsed.data : null
                },
                applyValue: (value) => {
                    this.machine.runnerState = value
                },
                applyVersion: (version) => {
                    this.machine.runnerStateVersion = version
                },
                logInvalidValue: (context, version) => {
                    const suffix = context === 'success' ? 'ack' : 'version-mismatch ack'
                    logger.debug(`[API MACHINE] Ignoring invalid runnerState value from ${suffix}`, { version })
                },
                invalidResponseMessage: 'Invalid machine-update-state response',
                errorMessage: 'Machine state update failed',
                versionMismatchMessage: 'Runner state version mismatch'
            })
        })
    }

    connect(): void {
        this.socket = io(`${configuration.apiUrl}/cli`, {
            transports: ['websocket'],
            auth: {
                token: this.token,
                clientType: 'machine-scoped' as const,
                machineId: this.machine.id
            },
            path: '/socket.io/',
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            ...buildSocketIoExtraHeaderOptions()
        })

        this.socket.on('connect', () => {
            logger.debug('[API MACHINE] Connected to bot')
            this.rpcHandlerManager.onSocketConnect(this.socket)
            this.updateRunnerState((state) => ({
                ...(state ?? {}),
                status: 'running',
                pid: process.pid,
                httpPort: this.machine.runnerState?.httpPort,
                startedAt: Date.now()
            })).catch((error) => {
                logger.debug('[API MACHINE] Failed to update runner state on connect', error)
            })

            const hubWorkspaceRoots = this.machine.metadata?.workspaceRoots
            const desiredWorkspaceRoots = this.workspaceRoots
            if (!workspaceRootsEqual(desiredWorkspaceRoots, hubWorkspaceRoots)) {
                if (desiredWorkspaceRoots?.length) {
                    console.log(`[HapiPower] Syncing workspace roots to hub: ${formatWorkspaceRoots(desiredWorkspaceRoots)} (current hub value: ${formatWorkspaceRoots(hubWorkspaceRoots)})`)
                } else {
                    console.log(`[HapiPower] Clearing workspace roots on hub (was: ${formatWorkspaceRoots(hubWorkspaceRoots)})`)
                }
                this.updateMachineMetadata((current) => {
                    const base = current ?? this.machine.metadata
                    if (!base) {
                        return { workspaceRoots: desiredWorkspaceRoots } as MachineMetadata
                    }
                    if (desiredWorkspaceRoots?.length) {
                        return { ...base, workspaceRoots: desiredWorkspaceRoots }
                    }
                    const { workspaceRoots: _workspaceRoots, ...rest } = base
                    return rest as MachineMetadata
                }).then(() => {
                    console.log(`[HapiPower] Workspace roots synced: ${formatWorkspaceRoots(this.machine.metadata?.workspaceRoots)}`)
                }).catch((error) => {
                    console.error('[HapiPower] Failed to sync workspace roots:', error instanceof Error ? error.message : error)
                })
            } else if (desiredWorkspaceRoots?.length) {
                console.log(`[HapiPower] Workspace roots already up to date on hub: ${formatWorkspaceRoots(desiredWorkspaceRoots)}`)
            }

            this.startKeepAlive()
        })

        this.socket.on('disconnect', () => {
            logger.debug('[API MACHINE] Disconnected from bot')
            this.rpcHandlerManager.onSocketDisconnect()
            this.stopKeepAlive()
        })

        this.socket.on('rpc-request', async (data: { method: string; params: string }, callback: (response: string) => void) => {
            callback(await this.rpcHandlerManager.handleRequest(data))
        })

        this.socket.on('update', (data: Update) => {
            if (data.body.t !== 'update-machine') {
                return
            }

            const update = data.body as UpdateMachineBody
            if (update.machineId !== this.machine.id) {
                return
            }

            if (update.metadata) {
                const parsed = MachineMetadataSchema.safeParse(update.metadata.value)
                if (parsed.success) {
                    this.machine.metadata = parsed.data
                } else {
                    logger.debug('[API MACHINE] Ignoring invalid metadata update', { version: update.metadata.version })
                }
                this.machine.metadataVersion = update.metadata.version
            }

            if (update.runnerState) {
                const next = update.runnerState.value
                if (next == null) {
                    this.machine.runnerState = null
                } else {
                    const parsed = RunnerStateSchema.safeParse(next)
                    if (parsed.success) {
                        this.machine.runnerState = parsed.data
                    } else {
                        logger.debug('[API MACHINE] Ignoring invalid runnerState update', { version: update.runnerState.version })
                    }
                }
                this.machine.runnerStateVersion = update.runnerState.version
            }
        })

        this.socket.on('connect_error', (error) => {
            logger.debug(`[API MACHINE] Connection error: ${error.message}`)
        })

        this.socket.on('error', (payload) => {
            logger.debug('[API MACHINE] Socket error:', payload)
        })
    }

    private startKeepAlive(): void {
        this.stopKeepAlive()
        this.keepAliveInterval = setInterval(() => {
            this.socket.emit('machine-alive', {
                machineId: this.machine.id,
                time: Date.now()
            })
        }, 20_000)
    }

    private stopKeepAlive(): void {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval)
            this.keepAliveInterval = null
        }
    }

    shutdown(): void {
        this.stopKeepAlive()
        if (this.socket) {
            this.socket.close()
        }
    }
}
