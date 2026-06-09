import { Hono } from 'hono'
import { z } from 'zod'
import type {
    CommandResponse,
    GitAtlasChange,
    GitAtlasChangeStage,
    GitAtlasChangeStatus,
    GitAtlasCommitSummary,
    GitAtlasDashboardResponse,
    GitAtlasGroup,
    GitAtlasRemote,
    GitSyncAction
} from '@hapipower/protocol/apiTypes'
import type { SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { requireSessionFromParam, requireSyncEngine } from './guards'
import { gitCloneGate, parseGitCloneCancelRequest, parseGitCloneRequest } from './gitCloneSafety'

const gitSyncLocks = new Set<string>()
const GIT_DIFF_PREVIEW_LIMIT_BYTES = 256 * 1024

const fileSearchSchema = z.object({
    query: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional()
})

const directorySchema = z.object({
    path: z.string().optional()
})

const filePathSchema = z.object({
    path: z.string().min(1)
})

const generatedImageSchema = z.object({
    imageId: z.string().min(1)
})

const gitSafeNameSchema = z.string()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z0-9._/-]+$/, 'Invalid git name')
    .refine((value) => !value.startsWith('-') && !value.includes('\0'), 'Invalid git name')

const gitSafeRefSchema = z.string()
    .min(1)
    .max(255)
    .regex(/^[A-Za-z0-9._/@{}~^:-]+$/, 'Invalid git ref')
    .refine((value) => !value.startsWith('-') && !value.includes('\0') && !/\s/.test(value), 'Invalid git ref')

const gitPathSchema = z.string()
    .min(1)
    .max(4096)
    .regex(/^[^\0]*$/, 'Path contains null bytes')
    .refine((value) => !value.startsWith('-'), 'Path must not start with -')
    .refine((value) => !value.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(value), 'Path must be workspace-relative')
    .refine((value) => !value.startsWith(':(') && !/[*?[\]{}]/.test(value), 'Path must be literal')
    .refine((value) => !value.split(/[\\/]+/).some((part) => part === '..'), 'Path must not traverse directories')

function hasAllowedGitRemoteUrlCredentials(url: string): boolean {
    if (url.startsWith('git@')) return /^git@[^:\s]+:.+/.test(url)

    try {
        const parsed = new URL(url)
        if (parsed.protocol === 'https:') {
            return parsed.username === '' && parsed.password === ''
        }
        if (parsed.protocol === 'ssh:') {
            return parsed.password === '' && (parsed.username === '' || parsed.username === 'git')
        }
        return false
    } catch {
        return false
    }
}

const gitRemoteUrlSchema = z.string()
    .trim()
    .min(1)
    .max(2048)
    .regex(/^(https:\/\/|ssh:\/\/|git@)/, 'Only https://, ssh://, and git@ URLs are allowed')
    .refine(hasAllowedGitRemoteUrlCredentials, 'URL must not contain embedded credentials')

const branchActionSchema = z.object({
    name: gitSafeRefSchema,
    action: z.enum(['switch', 'delete', 'merge']).optional(),
    confirmation: z.string().max(255).optional()
})

const commitSchema = z.object({
    message: z.string().min(1).max(5000).regex(/^[^\0]*$/, 'Message contains null bytes'),
    paths: z.array(gitPathSchema).max(500).optional()
})

const commitBasketSchema = z.object({
    message: z.string().min(1).max(5000).regex(/^[^\0]*$/, 'Message contains null bytes'),
    paths: z.array(gitPathSchema).min(1).max(500)
}).strict()

const remoteAddSchema = z.object({
    name: gitSafeNameSchema,
    url: gitRemoteUrlSchema
})

const remoteRemoveSchema = z.object({
    name: gitSafeNameSchema,
    confirmation: z.string().max(255).optional()
})

const gitPushSchema = z.object({
    remote: gitSafeNameSchema.optional(),
    branch: gitSafeRefSchema.optional(),
    force: z.boolean().optional(),
    confirmation: z.string().max(255).optional()
}).strict()

const gitPullSchema = z.object({
    remote: gitSafeNameSchema.optional(),
    branch: gitSafeRefSchema.optional()
}).strict()

const gitFetchSchema = z.object({
    remote: gitSafeNameSchema.optional()
}).strict()

const gitSyncSchema = z.object({
    action: z.enum(['fetch', 'pull', 'push']),
    remote: gitSafeNameSchema.optional(),
    branch: gitSafeRefSchema.optional(),
    force: z.boolean().optional(),
    confirmation: z.string().max(255).optional()
}).strict()

const writeFileSchema = z.object({
    path: z.string().min(1).regex(/^[^\0]*$/, 'Path contains null bytes'),
    content: z.string().max(5 * 1024 * 1024), // 5MB
    expectedHash: z.string().optional(),
    forceOverwrite: z.boolean().optional()
})

function parseBooleanParam(value: string | undefined): boolean | undefined {
    if (value === 'true') return true
    if (value === 'false') return false
    return undefined
}

async function runRpc<T>(fn: () => Promise<T>): Promise<T | { success: false; error: string }> {
    try {
        return await fn()
    } catch {
        console.error('[git-routes] Git operation failed')
        return { success: false, error: 'Git operation failed' }
    }
}

function sanitizeGitUrl(value: string): string {
    return value.replace(/:\/\/[^@\s]+@/g, '://***@')
}

function sanitizeGitCommandResult(result: unknown): unknown {
    if (typeof result !== 'object' || result === null) return result
    const record = result as Record<string, unknown>
    return {
        ...record,
        ...(typeof record.stdout === 'string' ? { stdout: sanitizeGitUrl(record.stdout) } : {}),
        ...(typeof record.stderr === 'string' ? { stderr: sanitizeGitUrl(record.stderr) } : {}),
        ...(typeof record.error === 'string' ? { error: sanitizeGitUrl(record.error) } : {})
    }
}

function isCommandSuccess(result: unknown): result is CommandResponse & { success: true } {
    return typeof result === 'object' && result !== null && (result as CommandResponse).success === true
}

function commandStdout(result: unknown): string {
    if (!isCommandSuccess(result)) return ''
    return result.stdout ?? ''
}

function commandError(result: unknown): string {
    if (typeof result !== 'object' || result === null) return 'Git operation failed'
    const command = result as CommandResponse
    return command.error ?? command.stderr ?? 'Git operation failed'
}

type ParsedStatusEntry = {
    path: string
    oldPath?: string
    index: string
    workingDir: string
    conflicted: boolean
}

type ParsedStatus = {
    branch: string | null
    upstream: string | null
    detached: boolean
    ahead: number
    behind: number
    entries: ParsedStatusEntry[]
}

type ParsedNumstat = {
    insertions: number
    deletions: number
    binary: boolean
}

const ORDINARY_CHANGE_REGEX = /^1 (.)(.) .{4} \d{6} \d{6} \d{6} [0-9a-f]+ [0-9a-f]+ (.+)$/
const RENAME_COPY_REGEX = /^2 (.)(.) .{4} \d{6} \d{6} \d{6} [0-9a-f]+ [0-9a-f]+ [RC]\d{1,3} (.+)\t(.+)$/
const UNMERGED_REGEX = /^u .. .{4} \d{6} \d{6} \d{6} \d{6} [0-9a-f]+ [0-9a-f]+ [0-9a-f]+ (.+)$/
const NUMSTAT_REGEX = /^(\d+|-)\t(\d+|-)\t(.+)$/

function parseGitStatus(stdout: string): ParsedStatus {
    const parsed: ParsedStatus = {
        branch: null,
        upstream: null,
        detached: false,
        ahead: 0,
        behind: 0,
        entries: []
    }

    for (const line of stdout.split(/\r?\n/)) {
        if (!line) continue
        if (line.startsWith('# branch.head ')) {
            const head = line.slice('# branch.head '.length)
            parsed.detached = head === '(detached)'
            parsed.branch = head === '(detached)' || head === '(initial)' ? null : head
            continue
        }
        if (line.startsWith('# branch.upstream ')) {
            parsed.upstream = line.slice('# branch.upstream '.length) || null
            continue
        }
        if (line.startsWith('# branch.ab ')) {
            const match = /^# branch\.ab \+(\d+) -(\d+)$/.exec(line)
            if (match) {
                parsed.ahead = Number.parseInt(match[1], 10)
                parsed.behind = Number.parseInt(match[2], 10)
            }
            continue
        }
        if (line.startsWith('1 ')) {
            const match = ORDINARY_CHANGE_REGEX.exec(line)
            if (match) {
                parsed.entries.push({
                    index: match[1],
                    workingDir: match[2],
                    path: match[3],
                    conflicted: false
                })
            }
            continue
        }
        if (line.startsWith('2 ')) {
            const match = RENAME_COPY_REGEX.exec(line)
            if (match) {
                parsed.entries.push({
                    index: match[1],
                    workingDir: match[2],
                    path: match[3],
                    oldPath: match[4],
                    conflicted: false
                })
            }
            continue
        }
        if (line.startsWith('u ')) {
            const match = UNMERGED_REGEX.exec(line)
            if (match) {
                parsed.entries.push({
                    index: 'U',
                    workingDir: 'U',
                    path: match[1],
                    conflicted: true
                })
            }
            continue
        }
        if (line.startsWith('? ')) {
            parsed.entries.push({
                index: '?',
                workingDir: '?',
                path: line.slice(2),
                conflicted: false
            })
        }
    }

    return parsed
}

function normalizeNumstatPath(rawPath: string): string[] {
    const trimmed = rawPath.trim()
    if (trimmed.includes('{') && trimmed.includes('=>') && trimmed.includes('}')) {
        const newPath = trimmed.replace(/\{([^{}]+?)\s*=>\s*([^{}]+?)\}/g, (_match, _oldPart: string, newPart: string) => newPart.trim())
        const oldPath = trimmed.replace(/\{([^{}]+?)\s*=>\s*([^{}]+?)\}/g, (_match, oldPart: string) => oldPart.trim())
        return Array.from(new Set([newPath, oldPath].filter((value) => value.length > 0)))
    }
    if (trimmed.includes('=>')) {
        return trimmed.split(/\s*=>\s*/).map((part) => part.trim()).filter((part) => part.length > 0)
    }
    return [trimmed]
}

function parseNumstat(stdout: string): Map<string, ParsedNumstat> {
    const map = new Map<string, ParsedNumstat>()
    for (const line of stdout.split(/\r?\n/)) {
        if (!line) continue
        const match = NUMSTAT_REGEX.exec(line)
        if (!match) continue
        const binary = match[1] === '-' || match[2] === '-'
        const stat = {
            insertions: binary ? 0 : Number.parseInt(match[1], 10),
            deletions: binary ? 0 : Number.parseInt(match[2], 10),
            binary
        }
        for (const path of normalizeNumstatPath(match[3])) {
            map.set(path, stat)
        }
    }
    return map
}

function statusFromEntry(entry: ParsedStatusEntry): GitAtlasChangeStatus {
    if (entry.conflicted) return 'conflicted'
    if (entry.index === '?' || entry.workingDir === '?') return 'untracked'
    const code = entry.index !== '.' && entry.index !== ' ' ? entry.index : entry.workingDir
    switch (code) {
        case 'A':
            return 'added'
        case 'D':
            return 'deleted'
        case 'R':
        case 'C':
            return 'renamed'
        case 'U':
            return 'conflicted'
        default:
            return 'modified'
    }
}

function stageFromEntry(entry: ParsedStatusEntry): GitAtlasChangeStage {
    if (entry.index === '?' || entry.workingDir === '?') return 'untracked'
    const hasIndex = entry.index !== '.' && entry.index !== ' '
    const hasWorktree = entry.workingDir !== '.' && entry.workingDir !== ' '
    if (hasIndex && hasWorktree) return 'mixed'
    if (hasIndex) return 'staged'
    return 'unstaged'
}

function buildGitAtlasChanges(
    status: ParsedStatus,
    unstagedStats: Map<string, ParsedNumstat>,
    stagedStats: Map<string, ParsedNumstat>
): GitAtlasChange[] {
    return status.entries.map((entry) => {
        const unstaged = unstagedStats.get(entry.path)
        const staged = stagedStats.get(entry.path)
        return {
            path: entry.path,
            oldPath: entry.oldPath,
            status: statusFromEntry(entry),
            stage: stageFromEntry(entry),
            linesAdded: (unstaged?.insertions ?? 0) + (staged?.insertions ?? 0),
            linesRemoved: (unstaged?.deletions ?? 0) + (staged?.deletions ?? 0),
            binary: Boolean(unstaged?.binary || staged?.binary),
            selectable: !entry.conflicted
        }
    })
}

function groupChanges(changes: GitAtlasChange[]): GitAtlasGroup[] {
    const definitions: Array<{ id: string; label: string; kind: GitAtlasGroup['kind']; filter: (change: GitAtlasChange) => boolean }> = [
        { id: 'conflicted', label: 'Conflicts', kind: 'conflicted', filter: (change) => change.status === 'conflicted' },
        { id: 'staged', label: 'Staged', kind: 'staged', filter: (change) => change.stage === 'staged' || change.stage === 'mixed' },
        { id: 'unstaged', label: 'Unstaged', kind: 'unstaged', filter: (change) => change.stage === 'unstaged' },
        { id: 'untracked', label: 'Untracked', kind: 'untracked', filter: (change) => change.stage === 'untracked' }
    ]

    return definitions
        .map((definition) => {
            const paths = changes.filter(definition.filter).map((change) => change.path)
            return {
                id: definition.id,
                label: definition.label,
                kind: definition.kind,
                total: paths.length,
                paths
            }
        })
        .filter((group) => group.total > 0)
}

function parseRemotes(stdout: string): GitAtlasRemote[] {
    const remotes = new Map<string, GitAtlasRemote>()
    for (const line of stdout.split(/\r?\n/)) {
        const match = /^(\S+)\s+(\S+)\s+\(fetch\)$/.exec(line)
        if (!match) continue
        remotes.set(match[1], {
            name: match[1],
            url: sanitizeGitUrl(match[2])
        })
    }
    return Array.from(remotes.values())
}

function parseRecentCommits(stdout: string): GitAtlasCommitSummary[] {
    return stdout.split(/\r?\n/)
        .map((line) => line.replace(/^[\s*|\\/]+/, '').trim())
        .filter((line) => line.length > 0)
        .map((line): GitAtlasCommitSummary | null => {
            const match = /^([0-9a-f]{7,40})\s+(?:\(([^)]*)\)\s+)?(.+)$/.exec(line)
            if (!match) return null
            const commit: GitAtlasCommitSummary = {
                hash: match[1],
                message: match[3]
            }
            if (match[2]) {
                return { ...commit, refs: match[2] }
            }
            return commit
        })
        .filter((commit): commit is GitAtlasCommitSummary => commit !== null)
        .slice(0, 8)
}

function createRecommendation(
    repo: GitAtlasDashboardResponse['repo'],
    summary: NonNullable<GitAtlasDashboardResponse['summary']>,
    remotes: GitAtlasRemote[]
): NonNullable<GitAtlasDashboardResponse['recommendation']> {
    if (!repo?.isRepo) {
        return {
            kind: 'clone',
            label: 'Clone repository',
            description: 'No Git repository was detected in this session path.'
        }
    }
    if (repo.hasConflicts) {
        return {
            kind: 'resolve-conflicts',
            label: 'Resolve conflicts',
            description: 'Resolve conflicted files before committing or syncing.'
        }
    }
    if (summary.totalChanges > 0) {
        return {
            kind: 'review',
            label: 'Review changes',
            description: `Review ${summary.totalChanges} changed file${summary.totalChanges === 1 ? '' : 's'} before committing.`
        }
    }
    if (repo.behind > 0) {
        return {
            kind: 'pull',
            label: 'Pull remote changes',
            description: `${repo.behind} remote commit${repo.behind === 1 ? '' : 's'} can be pulled.`
        }
    }
    if (repo.ahead > 0) {
        return {
            kind: 'push',
            label: 'Push local commits',
            description: `${repo.ahead} local commit${repo.ahead === 1 ? '' : 's'} can be pushed.`
        }
    }
    if (remotes.length === 0) {
        return {
            kind: 'clean',
            label: 'Add remote',
            description: 'The working tree is clean, but no remote is configured.'
        }
    }
    return {
        kind: 'clean',
        label: 'Working tree clean',
        description: 'No local changes need attention.'
    }
}

function buildSummary(changes: GitAtlasChange[]): NonNullable<GitAtlasDashboardResponse['summary']> {
    return {
        totalChanges: changes.length,
        staged: changes.filter((change) => change.stage === 'staged' || change.stage === 'mixed').length,
        unstaged: changes.filter((change) => change.stage === 'unstaged' || change.stage === 'mixed').length,
        untracked: changes.filter((change) => change.stage === 'untracked').length,
        conflicted: changes.filter((change) => change.status === 'conflicted').length,
        linesAdded: changes.reduce((sum, change) => sum + change.linesAdded, 0),
        linesRemoved: changes.reduce((sum, change) => sum + change.linesRemoved, 0)
    }
}

function ensureForcePushConfirmation(branch: string | undefined, confirmation: string | undefined): string | null {
    if (!branch) return 'Force push requires an explicit branch'
    if (confirmation !== branch) return 'Force push requires branch name confirmation'
    return null
}

async function runWithGitSyncLock<T>(
    sessionId: string,
    fn: () => Promise<T>
): Promise<T | { success: false; error: string; status: 409 }> {
    const key = `session:${sessionId}`
    if (gitSyncLocks.has(key)) {
        return { success: false, error: 'Git sync already in progress', status: 409 }
    }
    gitSyncLocks.add(key)
    try {
        return await fn()
    } finally {
        gitSyncLocks.delete(key)
    }
}

export function createGitRoutes(getSyncEngine: () => SyncEngine | null): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.get('/sessions/:id/git-dashboard', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const statusResult = await runRpc(() => engine.getGitStatus(sessionResult.sessionId, sessionPath))
        if (!isCommandSuccess(statusResult)) {
            const error = sanitizeGitUrl(commandError(statusResult))
            if (/not a git repository/i.test(error)) {
                const summary = buildSummary([])
                const response: GitAtlasDashboardResponse = {
                    success: true,
                    repo: {
                        isRepo: false,
                        root: null,
                        branch: null,
                        upstream: null,
                        detached: false,
                        ahead: 0,
                        behind: 0,
                        hasConflicts: false
                    },
                    summary,
                    recommendation: createRecommendation({ isRepo: false, root: null, branch: null, upstream: null, detached: false, ahead: 0, behind: 0, hasConflicts: false }, summary, []),
                    changes: [],
                    groups: [],
                    remotes: [],
                    recentCommits: [],
                    sync: {
                        remote: null,
                        branch: null,
                        ahead: 0,
                        behind: 0,
                        canPull: false,
                        canPush: false,
                        requiresRemote: true,
                        inFlight: gitSyncLocks.has(`session:${sessionResult.sessionId}`)
                    }
                }
                return c.json(response)
            }
            return c.json({ success: false, error })
        }

        const [unstagedResult, stagedResult, remotesResult, logResult] = await Promise.all([
            runRpc(() => engine.getGitDiffNumstat(sessionResult.sessionId, { cwd: sessionPath, staged: false })),
            runRpc(() => engine.getGitDiffNumstat(sessionResult.sessionId, { cwd: sessionPath, staged: true })),
            runRpc(() => engine.getGitRemoteList(sessionResult.sessionId, sessionPath)),
            runRpc(() => engine.getGitLog(sessionResult.sessionId, { cwd: sessionPath, maxCount: 8 }))
        ])
        for (const result of [unstagedResult, stagedResult, remotesResult, logResult]) {
            if (!isCommandSuccess(result)) {
                return c.json({ success: false, error: sanitizeGitUrl(commandError(result)) })
            }
        }

        const status = parseGitStatus(commandStdout(statusResult))
        const changes = buildGitAtlasChanges(
            status,
            parseNumstat(commandStdout(unstagedResult)),
            parseNumstat(commandStdout(stagedResult))
        )
        const summary = buildSummary(changes)
        const remotes = parseRemotes(commandStdout(remotesResult))
        const repo = {
            isRepo: true,
            root: sessionPath,
            branch: status.branch,
            upstream: status.upstream,
            detached: status.detached,
            ahead: status.ahead,
            behind: status.behind,
            hasConflicts: summary.conflicted > 0
        }

        const response: GitAtlasDashboardResponse = {
            success: true,
            repo,
            summary,
            recommendation: createRecommendation(repo, summary, remotes),
            changes,
            groups: groupChanges(changes),
            remotes,
            recentCommits: parseRecentCommits(commandStdout(logResult)),
            sync: {
                remote: remotes[0]?.name ?? null,
                branch: status.branch,
                ahead: status.ahead,
                behind: status.behind,
                canPull: remotes.length > 0 && status.behind > 0,
                canPush: remotes.length > 0 && status.ahead > 0,
                requiresRemote: remotes.length === 0,
                inFlight: gitSyncLocks.has(`session:${sessionResult.sessionId}`)
            }
        }

        return c.json(response)
    })

    app.get('/sessions/:id/git-diff', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const parsed = z.object({
            path: gitPathSchema,
            staged: z.enum(['true', 'false']).optional()
        }).safeParse(c.req.query())
        if (!parsed.success) {
            return c.json({ error: 'Invalid file path', details: parsed.error.flatten() }, 400)
        }

        const staged = parsed.data.staged === 'true'
        const result = await runRpc(() => engine.getGitDiffFile(sessionResult.sessionId, {
            cwd: sessionPath,
            filePath: parsed.data.path,
            staged
        }))
        if (!isCommandSuccess(result)) {
            return c.json({ success: false, error: sanitizeGitUrl(commandError(result)) })
        }

        const diff = result.stdout ?? ''
        const size = Buffer.byteLength(diff, 'utf8')
        const binary = /Binary files .+ differ/i.test(diff)
        const truncated = size > GIT_DIFF_PREVIEW_LIMIT_BYTES
        return c.json({
            success: true,
            path: parsed.data.path,
            staged,
            diff: truncated ? diff.slice(0, GIT_DIFF_PREVIEW_LIMIT_BYTES) : diff,
            binary,
            tooLarge: truncated,
            truncated
        })
    })

    app.get('/sessions/:id/git-status', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const result = await runRpc(() => engine.getGitStatus(sessionResult.sessionId, sessionPath))
        return c.json(result)
    })

    app.get('/sessions/:id/git-diff-numstat', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const staged = parseBooleanParam(c.req.query('staged'))
        const result = await runRpc(() => engine.getGitDiffNumstat(sessionResult.sessionId, { cwd: sessionPath, staged }))
        return c.json(result)
    })

    app.get('/sessions/:id/git-diff-file', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const parsed = filePathSchema.safeParse(c.req.query())
        if (!parsed.success) {
            return c.json({ error: 'Invalid file path' }, 400)
        }

        const staged = parseBooleanParam(c.req.query('staged'))
        const result = await runRpc(() => engine.getGitDiffFile(sessionResult.sessionId, {
            cwd: sessionPath,
            filePath: parsed.data.path,
            staged
        }))
        return c.json(result)
    })

    app.get('/sessions/:id/git-log', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const maxCount = Math.min(Math.max(parseInt(c.req.query('maxCount') ?? '50', 10) || 50, 1), 500)
        const result = await runRpc(() => engine.getGitLog(sessionResult.sessionId, { cwd: sessionPath, maxCount }))
        return c.json(result)
    })

    app.get('/sessions/:id/git-branches', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const result = await runRpc(() => engine.getGitBranchList(sessionResult.sessionId, sessionPath))
        return c.json(result)
    })

    app.post('/sessions/:id/git-branches', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const parsed = branchActionSchema.safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const { name, action } = parsed.data

        if (action === 'switch') {
            const result = await runRpc(() => engine.switchGitBranch(sessionResult.sessionId, { cwd: sessionPath, name }))
            return c.json(result)
        }

        if (action === 'delete') {
            if (parsed.data.confirmation !== name) {
                return c.json({ error: 'Branch delete requires branch name confirmation' }, 400)
            }
            const result = await runRpc(() => engine.deleteGitBranch(sessionResult.sessionId, { cwd: sessionPath, name }))
            return c.json(result)
        }

        if (action === 'merge') {
            const result = await runRpc(() => engine.mergeGitBranch(sessionResult.sessionId, { cwd: sessionPath, name }))
            return c.json(result)
        }

        const result = await runRpc(() => engine.createGitBranch(sessionResult.sessionId, { cwd: sessionPath, name }))
        return c.json(result)
    })

    app.post('/sessions/:id/git-commit', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const parsed = commitSchema.safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.createGitCommit(sessionResult.sessionId, {
            cwd: sessionPath,
            message: parsed.data.message,
            paths: parsed.data.paths
        }))
        return c.json(result)
    })

    app.post('/sessions/:id/git-commit-basket', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const parsed = commitBasketSchema.safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.createGitCommit(sessionResult.sessionId, {
            cwd: sessionPath,
            message: parsed.data.message,
            paths: parsed.data.paths
        }))
        if (!isCommandSuccess(result)) {
            return c.json({ success: false, error: sanitizeGitUrl(commandError(result)), stdout: '', stderr: '' })
        }
        return c.json({ ...result, committedPaths: parsed.data.paths })
    })

    // Git Clone
    app.post('/sessions/:id/git-clone', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const parsed = parseGitCloneRequest(await c.req.json().catch(() => null))
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error }, 400)

        const gate = gitCloneGate.start(`session:${sessionResult.sessionId}`, parsed.data.cloneId)
        if (!gate.ok) {
            return c.json({ success: false, error: gate.error }, gate.status)
        }

        try {
            const result = await runRpc(() => engine.gitClone(sessionResult.sessionId, {
                cwd: sessionPath,
                url: parsed.data.url,
                targetDir: parsed.data.targetDir,
                targetName: parsed.data.targetName,
                destinationPath: parsed.data.destinationPath,
                branch: parsed.data.branch,
                depth: parsed.data.depth,
                cloneId: parsed.data.cloneId,
                auth: parsed.data.auth
            }))
            return c.json(result)
        } finally {
            gate.release()
        }
    })

    app.delete('/sessions/:id/git-clone/:cloneId?', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const parsed = parseGitCloneCancelRequest(c.req.param('cloneId'), await c.req.json().catch(() => null))
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error }, 400)

        const result = await runRpc(() => engine.cancelGitClone(sessionResult.sessionId, parsed.data))
        return c.json(result)
    })

    // Git Remotes — List
    app.get('/sessions/:id/git-remotes', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const result = await runRpc(() => engine.getGitRemoteList(sessionResult.sessionId, sessionPath))
        return c.json(sanitizeGitCommandResult(result))
    })

    // Git Remotes — Add
    app.post('/sessions/:id/git-remotes', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const parsed = remoteAddSchema.safeParse(await c.req.json())
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)

        const result = await runRpc(() => engine.addGitRemote(sessionResult.sessionId, {
            cwd: sessionPath,
            name: parsed.data.name,
            url: parsed.data.url
        }))
        return c.json(sanitizeGitCommandResult(result))
    })

    // Git Remotes — Delete
    app.delete('/sessions/:id/git-remotes/:name', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const body = await c.req.json().catch(() => ({})) as unknown
        const parsed = remoteRemoveSchema.safeParse({
            ...(typeof body === 'object' && body !== null ? body : {}),
            name: c.req.param('name')
        })
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        if (parsed.data.confirmation !== parsed.data.name) {
            return c.json({ error: 'Remote delete requires remote name confirmation' }, 400)
        }

        const result = await runRpc(() => engine.removeGitRemote(sessionResult.sessionId, {
            cwd: sessionPath,
            name: parsed.data.name
        }))
        return c.json(sanitizeGitCommandResult(result))
    })

    // Git Push
    app.post('/sessions/:id/git-push', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const parsed = gitPushSchema.safeParse(await c.req.json())
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        if (parsed.data.force) {
            const confirmError = ensureForcePushConfirmation(parsed.data.branch, parsed.data.confirmation)
            if (confirmError) return c.json({ error: confirmError }, 400)
        }

        const result = await runWithGitSyncLock(sessionResult.sessionId, async () => await runRpc(() => engine.gitPush(sessionResult.sessionId, {
            cwd: sessionPath,
            remote: parsed.data.remote,
            branch: parsed.data.branch,
            force: parsed.data.force === true
        })))
        if ('status' in result) return c.json({ success: false, error: result.error }, result.status)
        return c.json(sanitizeGitCommandResult(result))
    })

    // Git Pull
    app.post('/sessions/:id/git-pull', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const parsed = gitPullSchema.safeParse(await c.req.json())
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)

        const result = await runWithGitSyncLock(sessionResult.sessionId, async () => await runRpc(() => engine.gitPull(sessionResult.sessionId, {
            cwd: sessionPath,
            remote: parsed.data.remote,
            branch: parsed.data.branch
        })))
        if ('status' in result) return c.json({ success: false, error: result.error }, result.status)
        return c.json(sanitizeGitCommandResult(result))
    })

    // Git Fetch
    app.post('/sessions/:id/git-fetch', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const parsed = gitFetchSchema.safeParse(await c.req.json())
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)

        const result = await runWithGitSyncLock(sessionResult.sessionId, async () => await runRpc(() => engine.gitFetch(sessionResult.sessionId, {
            cwd: sessionPath,
            remote: parsed.data.remote
        })))
        if ('status' in result) return c.json({ success: false, error: result.error }, result.status)
        return c.json(sanitizeGitCommandResult(result))
    })

    app.post('/sessions/:id/git-sync', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) return c.json({ success: false, error: 'Session path not available' })

        const parsed = gitSyncSchema.safeParse(await c.req.json())
        if (!parsed.success) return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        if (parsed.data.action === 'push' && parsed.data.force) {
            const confirmError = ensureForcePushConfirmation(parsed.data.branch, parsed.data.confirmation)
            if (confirmError) return c.json({ error: confirmError }, 400)
        }

        const action: GitSyncAction = parsed.data.action
        const result = await runWithGitSyncLock(sessionResult.sessionId, async () => {
            if (action === 'fetch') {
                return await runRpc(() => engine.gitFetch(sessionResult.sessionId, {
                    cwd: sessionPath,
                    remote: parsed.data.remote
                }))
            }
            if (action === 'pull') {
                return await runRpc(() => engine.gitPull(sessionResult.sessionId, {
                    cwd: sessionPath,
                    remote: parsed.data.remote,
                    branch: parsed.data.branch
                }))
            }
            return await runRpc(() => engine.gitPush(sessionResult.sessionId, {
                cwd: sessionPath,
                remote: parsed.data.remote,
                branch: parsed.data.branch,
                force: parsed.data.force === true
            }))
        })
        if ('status' in result) return c.json({ success: false, error: result.error }, result.status)
        if (!isCommandSuccess(result)) {
            return c.json({ success: false, error: sanitizeGitUrl(commandError(result)), action })
        }
        return c.json({
            ...result,
            stdout: sanitizeGitUrl(result.stdout ?? ''),
            stderr: sanitizeGitUrl(result.stderr ?? ''),
            action,
            remote: parsed.data.remote,
            branch: parsed.data.branch
        })
    })

    app.get('/sessions/:id/file', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const parsed = filePathSchema.safeParse(c.req.query())
        if (!parsed.success) {
            return c.json({ error: 'Invalid file path' }, 400)
        }

        const result = await runRpc(() => engine.readSessionFile(sessionResult.sessionId, parsed.data.path))
        return c.json(result)
    })

    app.put('/sessions/:id/file', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const parsed = writeFileSchema.safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.writeSessionFile(sessionResult.sessionId, parsed.data))
        return c.json(result)
    })

    app.get('/sessions/:id/generated-images/:imageId', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const parsed = generatedImageSchema.safeParse(c.req.param())
        if (!parsed.success) {
            return c.json({ error: 'Invalid generated image id' }, 400)
        }

        const result = await runRpc(() => engine.readGeneratedImage(sessionResult.sessionId, parsed.data.imageId))
        if (!result.success || !result.content) {
            return c.json({ success: false, error: result.error ?? 'Generated image not found' }, 404)
        }

        const bytes = Uint8Array.from(Buffer.from(result.content, 'base64'))
        return c.body(bytes, 200, {
            'Content-Type': result.mimeType ?? 'application/octet-stream',
            'Content-Disposition': `inline; filename="${encodeURIComponent(result.fileName ?? 'generated-image')}"`,
            'Cache-Control': 'no-store'
        })
    })

    app.get('/sessions/:id/files', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const parsed = fileSearchSchema.safeParse(c.req.query())
        if (!parsed.success) {
            return c.json({ error: 'Invalid query' }, 400)
        }

        const query = parsed.data.query?.trim() ?? ''
        const limit = parsed.data.limit ?? 200
        const args = ['--files']
        if (query) {
            args.push('--iglob', `*${query}*`)
        }

        const result = await runRpc(() => engine.runRipgrep(sessionResult.sessionId, args, sessionPath))
        if (!result.success) {
            return c.json({ success: false, error: result.error ?? 'Failed to list files' })
        }

        const stdout = result.stdout ?? ''
        const files = stdout
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .slice(0, limit)
            .map((fullPath) => {
                const parts = fullPath.split('/')
                const fileName = parts[parts.length - 1] || fullPath
                const filePath = parts.slice(0, -1).join('/')
                return {
                    fileName,
                    filePath,
                    fullPath,
                    fileType: 'file' as const
                }
            })

        return c.json({ success: true, files })
    })

    app.get('/sessions/:id/directory', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) {
            return engine
        }

        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) {
            return sessionResult
        }

        const sessionPath = sessionResult.session.metadata?.path
        if (!sessionPath) {
            return c.json({ success: false, error: 'Session path not available' })
        }

        const parsed = directorySchema.safeParse(c.req.query())
        if (!parsed.success) {
            return c.json({ error: 'Invalid query' }, 400)
        }

        const path = parsed.data.path ?? ''
        const result = await runRpc(() => engine.listDirectory(sessionResult.sessionId, path))
        return c.json(result)
    })

    // --- File CRUD operations ---

    app.delete('/sessions/:id/file', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const parsed = z.object({
            path: z.string().min(1),
            recursive: z.boolean().optional()
        }).safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.deleteSessionFile(sessionResult.sessionId, parsed.data.path, parsed.data.recursive))
        return c.json(result)
    })

    app.post('/sessions/:id/rename', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const parsed = z.object({
            oldPath: z.string().min(1),
            newPath: z.string().min(1)
        }).safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.renameSessionFile(sessionResult.sessionId, parsed.data.oldPath, parsed.data.newPath))
        return c.json(result)
    })

    app.post('/sessions/:id/copy', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const parsed = z.object({
            sourcePath: z.string().min(1),
            destinationPath: z.string().min(1)
        }).safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.copySessionFile(sessionResult.sessionId, parsed.data.sourcePath, parsed.data.destinationPath))
        return c.json(result)
    })

    app.post('/sessions/:id/move', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const parsed = z.object({
            sourcePath: z.string().min(1),
            destinationPath: z.string().min(1)
        }).safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.moveSessionFile(sessionResult.sessionId, parsed.data.sourcePath, parsed.data.destinationPath))
        return c.json(result)
    })

    app.post('/sessions/:id/mkdir', async (c) => {
        const engine = requireSyncEngine(c, getSyncEngine)
        if (engine instanceof Response) return engine
        const sessionResult = requireSessionFromParam(c, engine)
        if (sessionResult instanceof Response) return sessionResult

        const parsed = z.object({
            path: z.string().min(1),
            recursive: z.boolean().optional()
        }).safeParse(await c.req.json())
        if (!parsed.success) {
            return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
        }

        const result = await runRpc(() => engine.createDirectory(sessionResult.sessionId, parsed.data.path, parsed.data.recursive))
        return c.json(result)
    })

    return app
}
