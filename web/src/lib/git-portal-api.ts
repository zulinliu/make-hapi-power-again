import type { ApiClient } from '../api/client'

export type CloneAuth =
    | { type: 'password'; username?: string; password: string }
    | { type: 'token'; username?: string; password: string }
    | { type: 'ssh' }

export interface CloneRequest {
    url: string
    /** Parent directory where the repository directory will be created. */
    targetDir?: string
    /** Repository directory name. If omitted, the backend derives it from the URL. */
    targetName?: string
    /** Explicit final destination path. Mutually exclusive with targetDir and targetName. */
    destinationPath?: string
    branch?: string
    depth?: number
    cloneId: string
    auth?: CloneAuth
}

export interface CloneProgressEvent {
    cloneId: string
    sessionId?: string
    machineId?: string
    phase: string
    progress?: number
    message?: string
    objectsReceived?: number
    objectsTotal?: number
    bytesReceived?: number
    bytesTotal?: number
}

export type ClonePhase =
    | 'input'
    | 'connecting'
    | 'transferring'
    | 'unpacking'
    | 'done'
    | 'error'

export interface RepoInfo {
    name: string
    branch: string
    sizeBytes: number
    fileCount: number
}

export type GitPortalCommandResult = {
    success: boolean
    error?: string
    stderr?: string
    stdout?: string
}

export function mapProgressPhase(phase: string): ClonePhase {
    switch (phase) {
        case 'counting':
        case 'compressing':
            return 'connecting'
        case 'writing':
            return 'transferring'
        case 'resolving':
            return 'unpacking'
        case 'done':
            return 'done'
        case 'error':
            return 'error'
        default:
            return 'connecting'
    }
}

export function getCloneErrorMessage(result: GitPortalCommandResult): string {
    return result.error ?? result.stderr ?? result.stdout ?? 'Clone failed'
}

export async function startMachineClone(
    api: ApiClient,
    machineId: string,
    request: CloneRequest
): Promise<GitPortalCommandResult> {
    return await api.gitCloneMachine(machineId, {
        url: request.url,
        targetDir: request.targetDir,
        targetName: request.targetName,
        destinationPath: request.destinationPath,
        branch: request.branch,
        depth: request.depth,
        cloneId: request.cloneId,
        auth: request.auth
    })
}

export async function startSessionClone(
    api: ApiClient,
    sessionId: string,
    request: CloneRequest
): Promise<GitPortalCommandResult> {
    return await api.gitClone(sessionId, {
        url: request.url,
        targetDir: request.targetDir,
        targetName: request.targetName,
        destinationPath: request.destinationPath,
        branch: request.branch,
        depth: request.depth,
        cloneId: request.cloneId,
        auth: request.auth
    })
}

export async function cancelMachineClone(
    api: ApiClient,
    machineId: string,
    cloneId: string
): Promise<GitPortalCommandResult> {
    return await api.cancelGitCloneMachine(machineId, cloneId)
}

export async function cancelSessionClone(
    api: ApiClient,
    sessionId: string,
    cloneId: string
): Promise<GitPortalCommandResult> {
    return await api.cancelGitClone(sessionId, cloneId)
}
