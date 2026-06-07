import type { ApiClient } from '../api/client'

export interface CloneAuth {
    type: 'password' | 'token' | 'ssh'
    username?: string
    password?: string
}

export interface CloneRequest {
    url: string
    targetDir?: string
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

export async function startMachineClone(
    api: ApiClient,
    machineId: string,
    request: CloneRequest
): Promise<{ success: boolean; error?: string; stderr?: string; stdout?: string }> {
    return await api.gitCloneMachine(machineId, {
        url: request.url,
        targetDir: request.targetDir,
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
): Promise<{ success: boolean; error?: string; stderr?: string; stdout?: string }> {
    return await api.gitClone(sessionId, {
        url: request.url,
        targetDir: request.targetDir,
        branch: request.branch,
        depth: request.depth,
        cloneId: request.cloneId,
        auth: request.auth
    })
}
