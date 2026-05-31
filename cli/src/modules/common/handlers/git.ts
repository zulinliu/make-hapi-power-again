import { execFile, spawn, type ExecFileOptions } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import type { CommandResponse } from '@hapipower/protocol/apiTypes'
import { RPC_METHODS } from '@hapipower/protocol/rpcMethods'
import type { RpcHandlerManager } from '@/api/rpc/RpcHandlerManager'
import type { CloneProgressPayload } from '@hapipower/protocol/socket'
import { validatePath } from '../pathSecurity'
import { rpcError } from '../rpcResponses'

const execFileAsync = promisify(execFile)

interface GitStatusRequest {
    cwd?: string
    timeout?: number
}

interface GitDiffNumstatRequest {
    cwd?: string
    staged?: boolean
    timeout?: number
}

interface GitDiffFileRequest {
    cwd?: string
    filePath: string
    staged?: boolean
    timeout?: number
}

interface GitLogRequest {
    cwd?: string
    maxCount?: number
    skip?: number
    filePath?: string
    timeout?: number
}

interface GitBranchCreateRequest {
    cwd?: string
    name: string
    startPoint?: string
    timeout?: number
}

interface GitBranchSwitchRequest {
    cwd?: string
    name: string
    timeout?: number
}

interface GitBranchMergeRequest {
    cwd?: string
    name: string
    timeout?: number
}

interface GitBranchDeleteRequest {
    cwd?: string
    name: string
    force?: boolean
    timeout?: number
}

interface GitCommitRequest {
    cwd?: string
    message: string
    all?: boolean
    timeout?: number
}

interface GitAddRequest {
    cwd?: string
    paths: string[]
    timeout?: number
}

interface GitAutoCommitRequest {
    cwd?: string
    message: string
    paths?: string[]
    timeout?: number
}

interface GitCloneRequest {
    cwd?: string
    url: string
    targetDir?: string
    branch?: string
    cloneId?: string
    timeout?: number
}

interface GitRemoteListRequest {
    cwd?: string
    timeout?: number
}

interface GitRemoteAddRequest {
    cwd?: string
    name: string
    url: string
    timeout?: number
}

interface GitRemoteRemoveRequest {
    cwd?: string
    name: string
    timeout?: number
}

interface GitPushRequest {
    cwd?: string
    remote?: string
    branch?: string
    force?: boolean
    timeout?: number
}

interface GitPullRequest {
    cwd?: string
    remote?: string
    branch?: string
    timeout?: number
}

interface GitFetchRequest {
    cwd?: string
    remote?: string
    timeout?: number
}

type GitCommandResponse = CommandResponse

function validateCloneUrl(url: string): string | null {
    if (!url || typeof url !== 'string') return 'Clone URL required'
    if (url.startsWith('file://')) return 'file:// protocol is not allowed'
    if (!url.startsWith('https://') && !url.startsWith('ssh://') && !url.includes('@')) {
        return 'Only https://, ssh://, and git@ URLs are allowed'
    }
    return null
}

const CLONE_PROGRESS_RE = /(\d+)%\s*\((\d+)\/(\d+)\)/
const CLONE_PHASE_RE = /^(Receiving objects|Resolving deltas|Counting objects|Compressing objects)/i

function parseClonePhase(line: string): { phase: CloneProgressPayload['phase']; progress?: number; objectsReceived?: number; objectsTotal?: number } | null {
    if (!line) return null
    const phaseMatch = CLONE_PHASE_RE.exec(line)
    if (!phaseMatch) return null

    const phaseText = phaseMatch[1].toLowerCase()
    let phase: CloneProgressPayload['phase'] = 'writing'
    if (phaseText.includes('counting')) phase = 'counting'
    else if (phaseText.includes('compressing')) phase = 'compressing'
    else if (phaseText.includes('receiving') || phaseText.includes('writing')) phase = 'writing'
    else if (phaseText.includes('resolving')) phase = 'resolving'

    const progressMatch = CLONE_PROGRESS_RE.exec(line)
    if (progressMatch) {
        return {
            phase,
            progress: parseInt(progressMatch[1], 10),
            objectsReceived: parseInt(progressMatch[2], 10),
            objectsTotal: parseInt(progressMatch[3], 10)
        }
    }

    return { phase }
}

function runGitCloneStreaming(
    url: string,
    targetDir: string,
    branch: string | undefined,
    cloneId: string,
    rpcHandlerManager: RpcHandlerManager
): Promise<GitCommandResponse> {
    return new Promise((resolve) => {
        const args = ['clone', '--progress']
        if (branch) args.push('--branch', branch)
        args.push(url, targetDir)

        const child = spawn('git', args, {
            cwd: targetDir,
            timeout: 600_000
        })

        let stdout = ''
        let stderr = ''

        const emitProgress = (payload: Omit<CloneProgressPayload, 'cloneId' | 'sessionId'>) => {
            rpcHandlerManager.emitCloneProgress({ ...payload, cloneId, sessionId: '' })
        }

        child.stdout?.on('data', (chunk: Buffer) => {
            stdout += chunk.toString()
        })

        child.stderr?.on('data', (chunk: Buffer) => {
            const text = chunk.toString()
            stderr += text
            const parsed = parseClonePhase(text)
            if (parsed) {
                emitProgress({ ...parsed, message: text.trim() })
            }
        })

        child.on('close', (code) => {
            if (code === 0) {
                emitProgress({ phase: 'done', message: 'Clone completed successfully' })
                resolve({
                    success: true,
                    stdout,
                    stderr,
                    exitCode: 0
                })
            } else {
                emitProgress({ phase: 'error', message: `Clone failed with exit code ${code}` })
                resolve({
                    success: false,
                    error: `git clone failed (exit code ${code})`,
                    stdout,
                    stderr,
                    exitCode: code ?? 1
                })
            }
        })

        child.on('error', (err) => {
            emitProgress({ phase: 'error', message: err.message })
            resolve({
                success: false,
                error: err.message,
                stdout,
                stderr,
                exitCode: -1
            })
        })
    })
}

function resolveCwd(requestedCwd: string | undefined, workingDirectory: string): { cwd: string; error?: string } {
    const cwd = requestedCwd ?? workingDirectory
    const validation = validatePath(cwd, workingDirectory)
    if (!validation.valid) {
        return { cwd, error: validation.error ?? 'Invalid working directory' }
    }
    return { cwd }
}

function validateFilePath(filePath: string, workingDirectory: string): string | null {
    const validation = validatePath(filePath, workingDirectory)
    if (!validation.valid) {
        return validation.error ?? 'Invalid file path'
    }
    return null
}

async function runGitCommand(
    args: string[],
    cwd: string,
    timeout?: number
): Promise<GitCommandResponse> {
    try {
        const options: ExecFileOptions = {
            cwd,
            timeout: timeout ?? 10_000
        }
        const { stdout, stderr } = await execFileAsync('git', args, options)
        return {
            success: true,
            stdout: stdout ? stdout.toString() : '',
            stderr: stderr ? stderr.toString() : '',
            exitCode: 0
        }
    } catch (error) {
        const execError = error as NodeJS.ErrnoException & {
            stdout?: string
            stderr?: string
            code?: number | string
            killed?: boolean
        }

        if (execError.code === 'ETIMEDOUT' || execError.killed) {
            return rpcError('Command timed out', {
                stdout: execError.stdout ? execError.stdout.toString() : '',
                stderr: execError.stderr ? execError.stderr.toString() : '',
                exitCode: typeof execError.code === 'number' ? execError.code : -1
            })
        }

        return rpcError(execError.message || 'Command failed', {
            stdout: execError.stdout ? execError.stdout.toString() : '',
            stderr: execError.stderr ? execError.stderr.toString() : execError.message || 'Command failed',
            exitCode: typeof execError.code === 'number' ? execError.code : 1
        })
    }
}

export function registerGitHandlers(rpcHandlerManager: RpcHandlerManager, workingDirectory: string): void {
    rpcHandlerManager.registerHandler<GitStatusRequest, GitCommandResponse>(RPC_METHODS.GitStatus, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) {
            return rpcError(resolved.error)
        }
        return await runGitCommand(
            ['status', '--porcelain=v2', '--branch', '--untracked-files=all'],
            resolved.cwd,
            data.timeout
        )
    })

    rpcHandlerManager.registerHandler<GitDiffNumstatRequest, GitCommandResponse>(RPC_METHODS.GitDiffNumstat, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) {
            return rpcError(resolved.error)
        }
        const args = data.staged
            ? ['diff', '--cached', '--numstat']
            : ['diff', '--numstat']
        return await runGitCommand(args, resolved.cwd, data.timeout)
    })

    rpcHandlerManager.registerHandler<GitDiffFileRequest, GitCommandResponse>(RPC_METHODS.GitDiffFile, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) {
            return rpcError(resolved.error)
        }
        const fileError = validateFilePath(data.filePath, workingDirectory)
        if (fileError) {
            return rpcError(fileError)
        }

        const args = data.staged
            ? ['diff', '--cached', '--no-ext-diff', '--', data.filePath]
            : ['diff', '--no-ext-diff', '--', data.filePath]
        return await runGitCommand(args, resolved.cwd, data.timeout)
    })

    // Git Log
    rpcHandlerManager.registerHandler<GitLogRequest, GitCommandResponse>(RPC_METHODS.GitLog, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        const args = ['log', '--oneline', '--graph', '--decorate']
        if (data.maxCount) args.push(`--max-count=${data.maxCount}`)
        if (data.skip) args.push(`--skip=${data.skip}`)
        if (data.filePath) {
            args.push('--', data.filePath)
        }
        return await runGitCommand(args, resolved.cwd, data.timeout)
    })

    // Git Branch List
    rpcHandlerManager.registerHandler<GitStatusRequest, GitCommandResponse>(RPC_METHODS.GitBranchList, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        return await runGitCommand(['branch', '-a', '-v'], resolved.cwd, data.timeout)
    })

    // Git Branch Create
    rpcHandlerManager.registerHandler<GitBranchCreateRequest, GitCommandResponse>(RPC_METHODS.GitBranchCreate, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.name || !/^[\w.\-\/]+$/.test(data.name)) {
            return rpcError('Invalid branch name')
        }
        const args = ['checkout', '-b', data.name]
        if (data.startPoint) args.push(data.startPoint)
        return await runGitCommand(args, resolved.cwd, data.timeout)
    })

    // Git Branch Switch
    rpcHandlerManager.registerHandler<GitBranchSwitchRequest, GitCommandResponse>(RPC_METHODS.GitBranchSwitch, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.name || !/^[\w.\-\/]+$/.test(data.name)) {
            return rpcError('Invalid branch name')
        }
        return await runGitCommand(['checkout', data.name], resolved.cwd, data.timeout)
    })

    // Git Branch Merge
    rpcHandlerManager.registerHandler<GitBranchMergeRequest, GitCommandResponse>(RPC_METHODS.GitBranchMerge, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.name || !/^[\w.\-\/]+$/.test(data.name)) {
            return rpcError('Invalid branch name')
        }
        return await runGitCommand(['merge', data.name], resolved.cwd, data.timeout)
    })

    // Git Branch Delete
    rpcHandlerManager.registerHandler<GitBranchDeleteRequest, GitCommandResponse>(RPC_METHODS.GitBranchDelete, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.name || !/^[\w.\-\/]+$/.test(data.name)) {
            return rpcError('Invalid branch name')
        }
        const args = ['branch', data.force ? '-D' : '-d', data.name]
        return await runGitCommand(args, resolved.cwd, data.timeout)
    })

    // Git Commit
    rpcHandlerManager.registerHandler<GitCommitRequest, GitCommandResponse>(RPC_METHODS.GitCommit, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.message) return rpcError('Commit message required')
        const args = ['commit', '-m', data.message]
        if (data.all) args.push('-a')
        return await runGitCommand(args, resolved.cwd, data.timeout)
    })

    // Git Add
    rpcHandlerManager.registerHandler<GitAddRequest, GitCommandResponse>(RPC_METHODS.GitAdd, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.paths?.length) return rpcError('No paths specified')
        // Validate paths don't start with - to prevent argument injection
        for (const p of data.paths) {
            if (p.startsWith('-')) return rpcError(`Invalid path: ${p}`)
        }
        return await runGitCommand(['add', '--', ...data.paths], resolved.cwd, data.timeout)
    })

    // Git Auto Commit (add + commit in one step, for GitInternalAPI)
    rpcHandlerManager.registerHandler<GitAutoCommitRequest, GitCommandResponse>(RPC_METHODS.GitAutoCommit, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.message) return rpcError('Commit message required')

        // Add specific paths or all tracked changes
        if (data.paths?.length) {
            // Validate paths don't start with - to prevent argument injection
            for (const p of data.paths) {
                if (p.startsWith('-')) return rpcError(`Invalid path: ${p}`)
            }
            const addResult = await runGitCommand(['add', '--', ...data.paths], resolved.cwd, data.timeout)
            if (!addResult.success) return addResult
        } else {
            const addResult = await runGitCommand(['add', '-u'], resolved.cwd, data.timeout)
            if (!addResult.success) return addResult
        }

        return await runGitCommand(['commit', '-m', data.message], resolved.cwd, data.timeout)
    })

    // Git Clone — streaming with progress
    rpcHandlerManager.registerHandler<GitCloneRequest, GitCommandResponse>(RPC_METHODS.GitClone, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.url) return rpcError('Clone URL required')

        const urlError = validateCloneUrl(data.url)
        if (urlError) return rpcError(urlError)

        const targetDir = data.targetDir
            ? require('path').resolve(resolved.cwd, data.targetDir)
            : resolved.cwd

        return await runGitCloneStreaming(
            data.url,
            targetDir,
            data.branch,
            data.cloneId ?? randomUUID(),
            rpcHandlerManager
        )
    })

    // Git Remote List
    rpcHandlerManager.registerHandler<GitRemoteListRequest, GitCommandResponse>(RPC_METHODS.GitRemoteList, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        return await runGitCommand(['remote', '-v'], resolved.cwd, data.timeout)
    })

    // Git Remote Add
    rpcHandlerManager.registerHandler<GitRemoteAddRequest, GitCommandResponse>(RPC_METHODS.GitRemoteAdd, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.name || !/^[\w.\-\/]+$/.test(data.name)) return rpcError('Invalid remote name')
        if (!data.url) return rpcError('Remote URL required')
        return await runGitCommand(['remote', 'add', data.name, data.url], resolved.cwd, data.timeout)
    })

    // Git Remote Remove
    rpcHandlerManager.registerHandler<GitRemoteRemoveRequest, GitCommandResponse>(RPC_METHODS.GitRemoteRemove, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.name || !/^[\w.\-\/]+$/.test(data.name)) return rpcError('Invalid remote name')
        return await runGitCommand(['remote', 'remove', data.name], resolved.cwd, data.timeout)
    })

    // Git Push
    rpcHandlerManager.registerHandler<GitPushRequest, GitCommandResponse>(RPC_METHODS.GitPush, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        const args = ['push']
        if (data.remote) args.push(data.remote)
        if (data.branch) args.push(data.branch)
        if (data.force) args.push('--force')
        return await runGitCommand(args, resolved.cwd, data.timeout ?? 120_000)
    })

    // Git Pull
    rpcHandlerManager.registerHandler<GitPullRequest, GitCommandResponse>(RPC_METHODS.GitPull, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        const args = ['pull']
        if (data.remote) args.push(data.remote)
        if (data.branch) args.push(data.branch)
        return await runGitCommand(args, resolved.cwd, data.timeout ?? 120_000)
    })

    // Git Fetch
    rpcHandlerManager.registerHandler<GitFetchRequest, GitCommandResponse>(RPC_METHODS.GitFetch, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        const args = ['fetch']
        if (data.remote) args.push(data.remote)
        return await runGitCommand(args, resolved.cwd, data.timeout ?? 120_000)
    })
}
