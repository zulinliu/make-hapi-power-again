import { execFile, spawn, type ChildProcess, type ExecFileOptions } from 'child_process'
import { lookup } from 'node:dns/promises'
import { existsSync, mkdtempSync, realpathSync, rmSync, statSync, writeFileSync } from 'fs'
import { statfs } from 'node:fs/promises'
import { isIP } from 'net'
import { tmpdir } from 'os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path'
import { promisify } from 'util'
import type { CommandResponse } from '@hapipower/protocol/apiTypes'
import { RPC_METHODS } from '@hapipower/protocol/rpcMethods'
import { CloneIdSchema, GitCloneCancelRequestSchema, GitCloneRequestSchema, GitCloneTargetNameSchema, type GitCloneAuth, type GitCloneRequest } from '@hapipower/protocol/schemas'
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
    paths?: string[]
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

type GitCloneRpcRequest = GitCloneRequest & {
    cwd?: string
    timeout?: number
}

type GitCloneCancelRpcRequest = {
    cloneId: string
}

type CloneScope = {
    sessionId?: string
    machineId?: string
}

type PreparedCloneDestination = {
    cwd: string
    targetName: string
    destinationPath: string
}

type ValidatedCloneUrl = {
    url: string
    gitConfigArgs: string[]
    sshCommand?: string
}

type ActiveClone = {
    child: ChildProcess
    scope: CloneScope
    tempDir?: string
    cancelled: boolean
    forceFinish?: (error: string) => void
}

const activeClones: Map<string, ActiveClone> = new Map()
const cancelledCloneKeys: Map<string, ReturnType<typeof setTimeout>> = new Map()
const GIT_NULL_DEVICE = process.platform === 'win32' ? 'NUL' : '/dev/null'
const DISABLED_GIT_HOOKS_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null'
const GIT_HTTP_LOW_SPEED_LIMIT = '1'
const GIT_HTTP_LOW_SPEED_TIME = '120'
const DEFAULT_GIT_CLONE_STALL_TIMEOUT_MS = 120_000
const CANCELLED_CLONE_TOMBSTONE_MS = 10 * 60_000
const DEFAULT_CLONE_FORCE_KILL_GRACE_MS = 5_000
const SAFE_GIT_NETWORK_CONFIG_ARGS = [
    '-c',
    'protocol.file.allow=never',
    '-c',
    'protocol.ext.allow=never',
    '-c',
    `core.hooksPath=${DISABLED_GIT_HOOKS_PATH}`,
    '-c',
    'credential.helper=',
    '-c',
    'http.proxy=',
    '-c',
    'https.proxy=',
    '-c',
    `http.lowSpeedLimit=${GIT_HTTP_LOW_SPEED_LIMIT}`,
    '-c',
    `http.lowSpeedTime=${GIT_HTTP_LOW_SPEED_TIME}`
]
const SAFE_GIT_CONFIG_ENV_KEYS = [
    'PATH',
    'HOME',
    'USER',
    'LOGNAME',
    'SHELL',
    'TMPDIR',
    'TEMP',
    'TMP',
    'SSH_AUTH_SOCK',
    'SystemRoot',
    'WINDIR',
    'ComSpec',
    'PATHEXT',
    'USERPROFILE',
    'HOMEDRIVE',
    'HOMEPATH'
]

export type GitClonePathValidator = (path: string) => string | null | Promise<string | null>

function getActiveCloneKey(cloneId: string, scope: CloneScope): string {
    if (scope.sessionId) return `session:${scope.sessionId}:${cloneId}`
    if (scope.machineId) return `machine:${scope.machineId}:${cloneId}`
    return `unknown:${cloneId}`
}

function markCloneCancelled(activeKey: string): void {
    const existing = cancelledCloneKeys.get(activeKey)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
        cancelledCloneKeys.delete(activeKey)
    }, CANCELLED_CLONE_TOMBSTONE_MS)
    timer.unref()
    cancelledCloneKeys.set(activeKey, timer)
}

function consumeCloneCancelled(activeKey: string): boolean {
    const timer = cancelledCloneKeys.get(activeKey)
    if (!timer) return false
    clearTimeout(timer)
    cancelledCloneKeys.delete(activeKey)
    return true
}

function getGitCloneStallTimeoutMs(): number {
    const parsed = Number.parseInt(process.env.HAPI_POWER_GIT_CLONE_STALL_TIMEOUT_MS ?? '', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GIT_CLONE_STALL_TIMEOUT_MS
}

function getCloneForceKillGraceMs(): number {
    const parsed = Number.parseInt(process.env.HAPI_POWER_GIT_CLONE_FORCE_KILL_GRACE_MS ?? '', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CLONE_FORCE_KILL_GRACE_MS
}

function createGitConfigReadEnv(): Record<string, string> {
    const env: Record<string, string> = {}
    for (const key of SAFE_GIT_CONFIG_ENV_KEYS) {
        const value = process.env[key]
        if (value !== undefined) {
            env[key] = value
        }
    }

    env.LANG = 'C'
    env.LC_ALL = 'C'
    env.GIT_CONFIG_NOSYSTEM = '1'
    env.GIT_CONFIG_SYSTEM = GIT_NULL_DEVICE
    env.GIT_CONFIG_COUNT = '0'

    return env
}

function isSupportedGitProxyUrl(value: string): boolean {
    if (value.length > 2048 || /[\0\r\n]/.test(value)) return false
    try {
        const parsed = new URL(value)
        return ['http:', 'https:', 'socks4:', 'socks4a:', 'socks5:', 'socks5h:'].includes(parsed.protocol)
            && Boolean(parsed.hostname)
    } catch {
        return false
    }
}

async function readGitHttpProxyForUrl(url: string): Promise<string | undefined> {
    if (process.env.HAPI_POWER_GIT_INHERIT_PROXY_CONFIG === '0') return undefined

    try {
        const { stdout } = await execFileAsync('git', ['config', '--global', '--get-urlmatch', 'http.proxy', url], {
            timeout: 1_000,
            env: createGitConfigReadEnv()
        })
        const proxy = stringifyExecOutput(stdout).trim().split(/\r?\n/)[0]?.trim()
        if (proxy && isSupportedGitProxyUrl(proxy)) {
            return proxy
        }
    } catch {
        // Missing or invalid proxy config should not block clone.
    }

    return undefined
}

function terminateCloneProcess(child: ChildProcess, signal: NodeJS.Signals): void {
    if (process.platform === 'win32' && child.pid) {
        try {
            const taskkillArgs = ['/pid', String(child.pid), '/T']
            if (signal === 'SIGKILL') taskkillArgs.push('/F')
            spawn('taskkill', taskkillArgs, { stdio: 'ignore', windowsHide: true })
            return
        } catch {
            // Fall back to the direct child if taskkill cannot be started.
        }
    }
    if (process.platform !== 'win32' && child.pid) {
        try {
            process.kill(-child.pid, signal)
            return
        } catch {
            // The process group may already be gone; fall back to the direct child.
        }
    }
    child.kill(signal)
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
type GitCommandOptions = {
    env?: Record<string, string>
}

function extractSshLikeHostname(url: string): string | null {
    if (url.startsWith('git@')) {
        const withoutUser = url.slice('git@'.length)
        const separator = withoutUser.indexOf(':')
        const host = separator >= 0 ? withoutUser.slice(0, separator) : withoutUser
        return host.trim() || null
    }

    if (!url.startsWith('ssh://')) {
        return null
    }

    try {
        const parsed = new URL(url)
        return parsed.hostname || null
    } catch {
        return null
    }
}

function isPrivateIPv4(ip: string): boolean {
    const parts = ip.split('.').map((part) => Number.parseInt(part, 10))
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return true
    }

    const [a, b] = parts
    return a === 0
        || a === 10
        || a === 127
        || (a === 100 && b >= 64 && b <= 127)
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168)
        || (a === 198 && (b === 18 || b === 19))
        || a >= 224
}

function parseDottedIPv4(value: string): string | null {
    const parts = value.split('.')
    if (parts.length !== 4) return null

    const octets = parts.map((part) => {
        if (!/^\d+$/.test(part)) return null
        const parsed = Number.parseInt(part, 10)
        return Number.isInteger(parsed) && parsed >= 0 && parsed <= 255 ? parsed : null
    })

    if (octets.some((part) => part === null)) return null
    return octets.join('.')
}

function expandIPv6Groups(ip: string): number[] | null {
    const withoutZone = ip.toLowerCase().split('%')[0]
    const dottedMatch = /(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(withoutZone)
    const normalized = dottedMatch
        ? withoutZone.replace(dottedMatch[1], (() => {
            const dotted = parseDottedIPv4(dottedMatch[1])
            if (!dotted) return dottedMatch[1]
            const [a, b, c, d] = dotted.split('.').map((part) => Number.parseInt(part, 10))
            return `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
        })())
        : withoutZone

    const halves = normalized.split('::')
    if (halves.length > 2) return null

    const parseHalf = (value: string): number[] | null => {
        if (!value) return []
        const groups = value.split(':')
        const parsed = groups.map((group) => {
            if (!/^[0-9a-f]{1,4}$/i.test(group)) return null
            return Number.parseInt(group, 16)
        })
        return parsed.some((group) => group === null) ? null : parsed as number[]
    }

    const left = parseHalf(halves[0])
    const right = parseHalf(halves[1] ?? '')
    if (!left || !right) return null

    if (halves.length === 1) {
        return left.length === 8 ? left : null
    }

    const zeroCount = 8 - left.length - right.length
    if (zeroCount < 1) return null
    return [...left, ...Array.from({ length: zeroCount }, () => 0), ...right]
}

function extractMappedIPv4(ip: string): string | null {
    const groups = expandIPv6Groups(ip)
    if (!groups || groups.length !== 8) return null

    const isIPv4Mapped = groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff
    const isIPv4Compatible = groups.slice(0, 6).every((group) => group === 0)
    if (!isIPv4Mapped && !isIPv4Compatible) return null

    const high = groups[6]
    const low = groups[7]
    return [
        (high >> 8) & 0xff,
        high & 0xff,
        (low >> 8) & 0xff,
        low & 0xff
    ].join('.')
}

function isPrivateIPv6(ip: string): boolean {
    const normalized = ip.toLowerCase()
    const mappedIPv4 = extractMappedIPv4(normalized)
    if (mappedIPv4) return isPrivateIPv4(mappedIPv4)

    const groups = expandIPv6Groups(normalized)
    if (!groups || groups.length !== 8) return true

    const first = groups[0]
    return normalized === '::'
        || normalized === '::1'
        || groups.every((group) => group === 0)
        || groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1
        || (first & 0xfe00) === 0xfc00
        || (first & 0xffc0) === 0xfe80
        || (first & 0xff00) === 0xff00
}

function isBlockedIpAddress(address: string): boolean {
    const version = isIP(address)
    if (version === 4) {
        const parts = address.split('.').map((part) => Number.parseInt(part, 10))
        if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
            return true
        }
        const [a, b] = parts
        return a === 0
            || a === 127
            || (a === 169 && b === 254)
            || a >= 224
    }
    if (version === 6) return isPrivateIPv6(address)
    return true
}

function isLikelyEncodedIp(hostname: string): boolean {
    const normalized = hostname.trim().toLowerCase()
    return /^\d+$/.test(normalized)
        || /^0x[0-9a-f]+$/.test(normalized)
        || normalized.split('.').some((part) => /^0\d+/.test(part) || /^0x[0-9a-f]+$/i.test(part))
}

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`
}

function createSafeGitEnv(overrides?: Record<string, string | undefined>): Record<string, string> {
    const env: Record<string, string> = {}
    for (const key of SAFE_GIT_CONFIG_ENV_KEYS) {
        const value = process.env[key]
        if (value !== undefined) {
            env[key] = value
        }
    }

    env.LANG = 'C'
    env.LC_ALL = 'C'
    env.GIT_CONFIG_NOSYSTEM = '1'
    env.GIT_CONFIG_SYSTEM = GIT_NULL_DEVICE
    env.GIT_CONFIG_GLOBAL = GIT_NULL_DEVICE
    env.GIT_CONFIG_COUNT = '0'
    env.GIT_TERMINAL_PROMPT = '0'

    for (const [key, value] of Object.entries(overrides ?? {})) {
        if (value === undefined) {
            delete env[key]
        } else {
            env[key] = value
        }
    }

    return env
}

function formatCurlResolveAddress(address: string): string {
    return isIP(address) === 6 ? `[${address}]` : address
}

function buildPinnedSshCommand(hostname: string, address: string): string {
    return [
        'ssh',
        '-F',
        shellQuote(GIT_NULL_DEVICE),
        '-o',
        `HostName=${shellQuote(address)}`,
        '-o',
        `HostKeyAlias=${shellQuote(hostname)}`,
        '-o',
        'ProxyCommand=none',
        '-o',
        'ProxyJump=none',
        '-o',
        'CanonicalizeHostname=no'
    ].join(' ')
}

async function validateCloneUrl(url: string): Promise<ValidatedCloneUrl | { error: string }> {
    if (!url || typeof url !== 'string') return { error: 'Clone URL required' }
    if (url.startsWith('file://')) return { error: 'file:// protocol is not allowed' }

    const isSupportedUrl = /^(https:\/\/|http:\/\/|ssh:\/\/|git@)/.test(url)
    if (!isSupportedUrl) return { error: 'Only http://, https://, ssh://, and git@ URLs are allowed' }

    const isHttp = url.startsWith('http://')
    const isHttps = url.startsWith('https://')
    const isHttpLike = isHttp || isHttps
    const isSsh = url.startsWith('ssh://') || url.startsWith('git@')
    if (!isHttpLike && !isSsh) {
        return { error: 'Only http://, https://, ssh://, and git@ URLs are allowed' }
    }

    let hostname: string | null = null
    let httpPort = isHttps ? '443' : '80'
    if (isHttpLike) {
        try {
            const parsed = new URL(url)
            if (parsed.username || parsed.password) {
                return { error: 'URL must not contain embedded credentials' }
            }
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
                return { error: 'Only http://, https://, ssh://, and git@ URLs are allowed' }
            }
            hostname = parsed.hostname
            httpPort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80')
        } catch {
            return { error: 'Invalid URL format' }
        }
    } else if (url.startsWith('ssh://')) {
        try {
            const parsed = new URL(url)
            if (parsed.username && parsed.username !== 'git') {
                return { error: 'SSH URL username must be git' }
            }
            if (parsed.password) {
                return { error: 'URL must not contain embedded credentials' }
            }
            hostname = parsed.hostname
        } catch {
            return { error: 'Invalid SSH URL format' }
        }
    } else {
        if (!/^git@[^:\s]+:.+/.test(url)) {
            return { error: 'Invalid git SSH URL format' }
        }
        hostname = extractSshLikeHostname(url)
    }

    if (!hostname) {
        return { error: 'Clone URL hostname required' }
    }

    const normalizedHost = hostname.replace(/^\[|\]$/g, '').toLowerCase()
    if (normalizedHost === 'localhost' || normalizedHost.endsWith('.localhost')) {
        return { error: 'Cannot clone from localhost' }
    }
    if (isLikelyEncodedIp(normalizedHost)) {
        return { error: 'Cannot clone from encoded IP addresses' }
    }

    const gitConfigArgs = isHttpLike ? ['-c', 'http.followRedirects=false'] : []
    const configuredHttpProxy = isHttpLike ? await readGitHttpProxyForUrl(url) : undefined
    if (configuredHttpProxy) {
        gitConfigArgs.push('-c', `http.proxy=${configuredHttpProxy}`)
    }
    const directIpVersion = isIP(normalizedHost)
    if (directIpVersion) {
        if (isBlockedIpAddress(normalizedHost)) {
            return { error: 'Cannot clone from local or unsafe network addresses' }
        }
        return {
            url,
            gitConfigArgs,
            sshCommand: isSsh ? buildPinnedSshCommand(normalizedHost, normalizedHost) : undefined
        }
    }

    try {
        const resolved = await lookup(normalizedHost, { all: true, verbatim: true })
        if (resolved.length === 0) {
            return { error: 'Clone URL hostname could not be resolved' }
        }
        if (resolved.some((record) => isBlockedIpAddress(record.address))) {
            return { error: 'Cannot clone from local or unsafe network addresses' }
        }
        if (isHttpLike) {
            const addresses = Array.from(new Set(resolved.map((record) => record.address)))
            gitConfigArgs.push('-c', `http.curloptResolve=${normalizedHost}:${httpPort}:${addresses.map(formatCurlResolveAddress).join(',')}`)
        }
        if (isSsh) {
            return {
                url,
                gitConfigArgs,
                sshCommand: buildPinnedSshCommand(normalizedHost, resolved[0].address)
            }
        }
    } catch {
        return { error: 'Clone URL hostname could not be resolved' }
    }

    return { url, gitConfigArgs }
}

function sanitizeGitUrl(url: string): string {
    return url.replace(/:\/\/[^@]+@/, '://***@')
}

async function sanitizeCloneOriginRemote(destinationPath: string, url: string): Promise<string | null> {
    if (!existsSync(join(destinationPath, '.git'))) return null

    try {
        await execFileAsync('git', ['remote', 'set-url', 'origin', url], {
            cwd: destinationPath,
            timeout: 10_000,
            env: createSafeGitEnv()
        })
        return null
    } catch {
        return 'Clone completed but failed to sanitize the origin remote URL'
    }
}

const GIT_SAFE_NAME_RE = /^[A-Za-z0-9._/-]+$/
const GIT_SAFE_REF_RE = /^[A-Za-z0-9._/@{}~^:-]+$/
const GIT_PATHSPEC_MAGIC_RE = /[*?[\]{}]/

function validateGitName(value: string | undefined, label: string): string | null {
    if (!value) return null
    if (value.startsWith('-') || value.includes('\0') || !GIT_SAFE_NAME_RE.test(value)) {
        return `Invalid ${label}`
    }
    return null
}

function validateGitRef(value: string | undefined, label: string): string | null {
    if (!value) return null
    if (value.startsWith('-') || value.includes('\0') || /\s/.test(value) || !GIT_SAFE_REF_RE.test(value)) {
        return `Invalid ${label}`
    }
    return null
}

function validateGitPathspecs(paths: string[] | undefined, workingDirectory: string): string | null {
    if (!paths) return null
    if (paths.length === 0) return 'No paths specified'
    if (paths.length > 500) return 'Too many paths specified'

    for (const path of paths) {
        if (!path || path.length > 4096 || path.includes('\0')) {
            return `Invalid path: ${path}`
        }
        if (path.startsWith('-') || isAbsolute(path) || path.split(/[\\/]+/).some((part) => part === '..')) {
            return `Invalid path: ${path}`
        }
        if (path.startsWith(':(') || GIT_PATHSPEC_MAGIC_RE.test(path)) {
            return `Invalid path: ${path}`
        }
        const validation = validatePath(path, workingDirectory)
        if (!validation.valid) {
            return validation.error ?? `Invalid path: ${path}`
        }
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

function cleanupCloneTempDir(tempDir: string | undefined): void {
    if (!tempDir) return
    try {
        rmSync(tempDir, { recursive: true, force: true })
    } catch {
        // best-effort cleanup
    }
}

function cleanupIncompleteCloneDestination(destinationPath: string): void {
    try {
        if (!destinationPath || destinationPath === dirname(destinationPath)) return
        rmSync(destinationPath, { recursive: true, force: true })
    } catch {
        // best-effort cleanup; the next attempt will still report a clear destination error.
    }
}

function createAskpassScript(cloneId: string, auth: GitCloneAuth | undefined, env: Record<string, string>): string | undefined {
    if (!auth || auth.type === 'ssh' || !auth.password) {
        return undefined
    }

    const parsedCloneId = CloneIdSchema.safeParse(cloneId)
    if (!parsedCloneId.success) {
        throw new Error('Invalid cloneId')
    }

    const tempDir = mkdtempSync(join(tmpdir(), 'hp-git-askpass-'))
    const askpassScript = join(tempDir, 'askpass.sh')
    env.GP_CLONE_USERNAME = auth.username || (auth.type === 'token' ? 'git' : '')
    env.GP_CLONE_PASSWORD = auth.password
    writeFileSync(askpassScript, [
        '#!/bin/sh',
        'case "$1" in',
        '  *Username*|*username*) printf \'%s\' "$GP_CLONE_USERNAME" ;;',
        '  *Password*|*password*|*Token*|*token*) printf \'%s\' "$GP_CLONE_PASSWORD" ;;',
        '  *) printf \'%s\' "$GP_CLONE_PASSWORD" ;;',
        'esac',
        ''
    ].join('\n'), { mode: 0o700 })
    return tempDir
}

function toExecError(error: unknown): NodeJS.ErrnoException & {
    stdout?: string | Buffer
    stderr?: string | Buffer
    code?: number | string
    killed?: boolean
} {
    return error as NodeJS.ErrnoException & {
        stdout?: string | Buffer
        stderr?: string | Buffer
        code?: number | string
        killed?: boolean
    }
}

function stringifyExecOutput(value: string | Buffer | undefined): string {
    return value ? value.toString() : ''
}

async function runSafeGitConfig(
    args: string[],
    cwd: string,
    timeout?: number
): Promise<{ success: true; stdout: string } | { success: false; code?: number | string; error: string }> {
    try {
        const { stdout } = await execFileAsync('git', ['config', ...args], {
            cwd,
            timeout: timeout ?? 10_000,
            env: createSafeGitEnv()
        })
        return { success: true, stdout: stringifyExecOutput(stdout) }
    } catch (error) {
        const execError = toExecError(error)
        return {
            success: false,
            code: execError.code,
            error: execError.message || 'Unable to read git config'
        }
    }
}

async function auditUnsafeGitNetworkConfig(cwd: string, timeout?: number): Promise<string | null> {
    const unsafeConfig = await runSafeGitConfig([
        '--get-regexp',
        '^(url\\..*\\.(insteadof|pushinsteadof)|core\\.sshcommand|core\\.hookspath|credential\\.helper|protocol\\.(file|ext)\\.allow)$'
    ], cwd, timeout)

    if (!unsafeConfig.success) {
        return unsafeConfig.code === 1 ? null : 'Unable to verify git network configuration'
    }

    if (unsafeConfig.stdout.trim()) {
        return 'Unsafe git network configuration is not allowed'
    }

    return null
}

async function getConfiguredRemoteUrl(
    cwd: string,
    remoteName: string,
    timeout?: number
): Promise<string | { error: string }> {
    const result = await runSafeGitConfig(['--get', `remote.${remoteName}.url`], cwd, timeout)
    if (!result.success) {
        return { error: `Remote '${remoteName}' URL is not configured` }
    }

    const url = result.stdout.trim()
    if (!url) {
        return { error: `Remote '${remoteName}' URL is not configured` }
    }

    return url
}

async function prepareGitNetworkRemote(
    cwd: string,
    requestedRemote: string | undefined,
    timeout?: number
): Promise<{ remoteName: string; validatedUrl: ValidatedCloneUrl } | { error: string }> {
    const remoteName = requestedRemote?.trim() || 'origin'
    const remoteError = validateGitName(remoteName, 'remote name')
    if (remoteError) return { error: remoteError }

    const unsafeConfigError = await auditUnsafeGitNetworkConfig(cwd, timeout)
    if (unsafeConfigError) return { error: unsafeConfigError }

    const remoteUrl = await getConfiguredRemoteUrl(cwd, remoteName, timeout)
    if (typeof remoteUrl !== 'string') return remoteUrl

    const validatedUrl = await validateCloneUrl(remoteUrl)
    if ('error' in validatedUrl) return { error: validatedUrl.error }

    return { remoteName, validatedUrl }
}

function deriveCloneTargetName(url: string): string | null {
    const trimmed = url.trim().replace(/[/?#]+$/, '')
    let candidate = ''

    if (trimmed.startsWith('git@')) {
        const separator = trimmed.lastIndexOf(':')
        candidate = separator >= 0 ? trimmed.slice(separator + 1) : trimmed
    } else {
        try {
            const parsed = new URL(trimmed)
            candidate = parsed.pathname
        } catch {
            candidate = trimmed
        }
    }

    const base = basename(candidate.replace(/\.git$/i, '').replace(/\/+$|\\+$/g, ''))
    const parsedName = GitCloneTargetNameSchema.safeParse(base)
    return parsedName.success ? parsedName.data : null
}

function ensureDirectory(path: string): string | null {
    try {
        const stats = statSync(path)
        if (!stats.isDirectory()) {
            return 'Clone parent path is not a directory'
        }
        return null
    } catch {
        return 'Clone parent directory does not exist'
    }
}

function resolveForClonePathCheck(path: string): string {
    const absolute = resolve(path)
    try {
        return realpathSync(absolute)
    } catch {
        const missing: string[] = []
        let cursor = absolute
        while (cursor !== dirname(cursor)) {
            missing.unshift(basename(cursor))
            cursor = dirname(cursor)
            try {
                return join(realpathSync(cursor), ...missing)
            } catch {
                // Keep walking to the nearest existing ancestor.
            }
        }
        return absolute
    }
}

function validateClonePathWithinWorkingDirectory(path: string, workingDirectory: string): string | null {
    const target = resolveForClonePathCheck(path)
    const root = resolveForClonePathCheck(workingDirectory)
    const normalizedTarget = process.platform === 'win32' ? target.toLowerCase() : target
    const normalizedRoot = process.platform === 'win32' ? root.toLowerCase() : root
    const rel = relative(normalizedRoot, normalizedTarget)
    if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
        return null
    }
    return `Access denied: Path '${path}' is outside the working directory`
}

async function ensureDiskSpace(path: string): Promise<string | null> {
    const minFreeBytes = Number.parseInt(process.env.HAPI_POWER_GIT_CLONE_MIN_FREE_BYTES ?? '', 10)
    const required = Number.isFinite(minFreeBytes) && minFreeBytes > 0 ? minFreeBytes : 256 * 1024 * 1024
    try {
        const stats = await statfs(path)
        const available = Number(stats.bavail) * Number(stats.bsize)
        if (Number.isFinite(available) && available < required) {
            return `Insufficient disk space for clone. At least ${Math.ceil(required / 1024 / 1024)}MB free is required.`
        }
    } catch {
        return 'Unable to check available disk space'
    }
    return null
}

async function prepareCloneDestination(
    data: GitCloneRpcRequest,
    defaultCwd: string,
    validateResolvedPath: (path: string) => Promise<string | null>
): Promise<PreparedCloneDestination | { error: string }> {
    const explicitDestination = data.destinationPath?.trim()
    const parentRaw = explicitDestination
        ? dirname(explicitDestination)
        : (data.targetDir?.trim() || data.cwd?.trim() || defaultCwd)

    const parentPath = resolve(defaultCwd, parentRaw)
    const parentError = await validateResolvedPath(parentPath)
    if (parentError) return { error: parentError }

    const targetName = explicitDestination
        ? basename(explicitDestination)
        : data.targetName?.trim() || deriveCloneTargetName(data.url)
    const parsedTargetName = GitCloneTargetNameSchema.safeParse(targetName)
    if (!parsedTargetName.success) {
        return { error: 'Invalid or unsupported repository directory name' }
    }

    const destinationPath = explicitDestination
        ? resolve(defaultCwd, explicitDestination)
        : resolve(parentPath, parsedTargetName.data)
    const destinationError = await validateResolvedPath(destinationPath)
    if (destinationError) return { error: destinationError }

    const parentExistsError = ensureDirectory(parentPath)
    if (parentExistsError) return { error: parentExistsError }
    if (existsSync(destinationPath)) {
        return { error: 'Clone destination already exists' }
    }

    const diskError = await ensureDiskSpace(parentPath)
    if (diskError) return { error: diskError }

    return {
        cwd: parentPath,
        targetName: parsedTargetName.data,
        destinationPath
    }
}

function normalizeGitCloneRequest(data: GitCloneRpcRequest): GitCloneRpcRequest | { error: string } {
    const candidate = {
        url: data?.url,
        targetDir: data?.targetDir,
        targetName: data?.targetName,
        destinationPath: data?.destinationPath,
        branch: data?.branch,
        depth: data?.depth,
        cloneId: data?.cloneId,
        auth: data?.auth
    }
    const parsed = GitCloneRequestSchema.safeParse(candidate)
    if (!parsed.success) {
        return { error: 'Invalid git clone request' }
    }

    return {
        ...parsed.data,
        cwd: typeof data?.cwd === 'string' ? data.cwd : undefined,
        timeout: typeof data?.timeout === 'number' ? data.timeout : undefined
    }
}

function cancelActiveClone(cloneId: string | undefined, scope: CloneScope, rpcHandlerManager: RpcHandlerManager): GitCommandResponse {
    const parsed = GitCloneCancelRequestSchema.safeParse({ cloneId })
    if (!parsed.success) {
        return rpcError('Invalid cloneId')
    }

    const key = getActiveCloneKey(parsed.data.cloneId, scope)
    const active = activeClones.get(key)
    if (!active) {
        markCloneCancelled(key)
        rpcHandlerManager.emitCloneProgress({
            ...scope,
            cloneId: parsed.data.cloneId,
            phase: 'error',
            message: 'Clone cancelled'
        })
        return { success: true, stdout: 'No active clone to cancel', stderr: '', exitCode: 0 }
    }
    if (scope.sessionId && active.scope.sessionId !== scope.sessionId) {
        return rpcError('Clone is outside this session scope')
    }
    if (scope.machineId && active.scope.machineId !== scope.machineId) {
        return rpcError('Clone is outside this machine scope')
    }

    active.cancelled = true
    terminateCloneProcess(active.child, 'SIGTERM')
    setTimeout(() => {
        if (activeClones.has(key)) {
            terminateCloneProcess(active.child, 'SIGKILL')
            active.forceFinish?.('Clone cancelled')
        }
    }, getCloneForceKillGraceMs()).unref()

    rpcHandlerManager.emitCloneProgress({
        ...scope,
        cloneId: parsed.data.cloneId,
        phase: 'error',
        message: 'Clone cancelled'
    })
    return { success: true, stdout: '', stderr: '', exitCode: 0 }
}

function runGitCloneStreaming(
    url: string,
    destination: PreparedCloneDestination,
    branch: string | undefined,
    depth: number | undefined,
    cloneId: string,
    gitConfigArgs: string[],
    sshCommand: string | undefined,
    rpcHandlerManager: RpcHandlerManager,
    scope: CloneScope,
    auth?: GitCloneAuth,
    timeout?: number
): Promise<GitCommandResponse> {
    return new Promise((resolveResult) => {
        const parsedCloneId = CloneIdSchema.safeParse(cloneId)
        if (!parsedCloneId.success) {
            resolveResult(rpcError('Invalid cloneId'))
            return
        }
        const activeKey = getActiveCloneKey(parsedCloneId.data, scope)
        if (consumeCloneCancelled(activeKey)) {
            resolveResult(rpcError('Clone cancelled'))
            return
        }

        const args = [...SAFE_GIT_NETWORK_CONFIG_ARGS, ...gitConfigArgs, 'clone', '--progress']
        if (branch) args.push('--branch', branch)
        if (depth && depth > 0) args.push('--depth', String(depth))
        args.push(url, destination.targetName)

        const env = createSafeGitEnv()
        if (sshCommand) {
            env.GIT_SSH_COMMAND = sshCommand
        }
        let tempDir: string | undefined

        try {
            tempDir = createAskpassScript(parsedCloneId.data, auth, env)
            if (tempDir) {
                env.GIT_ASKPASS = join(tempDir, 'askpass.sh')
                env.GIT_TERMINAL_PROMPT = '0'
            }
        } catch (error) {
            cleanupCloneTempDir(tempDir)
            resolveResult(rpcError(error instanceof Error ? error.message : 'Failed to create git credential helper'))
            return
        }

        const child = spawn('git', args, {
            cwd: destination.cwd,
            timeout: timeout ?? 600_000,
            env,
            detached: process.platform !== 'win32'
        })

        let stdout = ''
        let stderr = ''
        let settled = false
        let stalled = false
        let stallTimer: ReturnType<typeof setTimeout> | undefined
        let forceKillTimer: ReturnType<typeof setTimeout> | undefined

        const emitProgress = (payload: Omit<CloneProgressPayload, 'cloneId'>) => {
            rpcHandlerManager.emitCloneProgress({ ...payload, cloneId: parsedCloneId.data })
        }

        const clearStallTimer = () => {
            if (!stallTimer) return
            clearTimeout(stallTimer)
            stallTimer = undefined
        }

        const clearForceKillTimer = () => {
            if (!forceKillTimer) return
            clearTimeout(forceKillTimer)
            forceKillTimer = undefined
        }

        const finish = (response: GitCommandResponse) => {
            if (settled) return
            settled = true
            clearStallTimer()
            clearForceKillTimer()
            activeClones.delete(activeKey)
            cleanupCloneTempDir(tempDir)
            resolveResult(response)
        }

        const forceFinish = (error: string) => {
            cleanupIncompleteCloneDestination(destination.destinationPath)
            finish({
                success: false,
                error,
                stdout: sanitizeGitUrl(stdout),
                stderr: sanitizeGitUrl(stderr),
                exitCode: -1
            })
        }

        const scheduleForceKill = (error: string) => {
            clearForceKillTimer()
            forceKillTimer = setTimeout(() => {
                if (settled) return
                terminateCloneProcess(child, 'SIGKILL')
                forceFinish(error)
            }, getCloneForceKillGraceMs())
            forceKillTimer.unref()
        }

        const armStallTimer = () => {
            clearStallTimer()
            const stallTimeoutMs = getGitCloneStallTimeoutMs()
            stallTimer = setTimeout(() => {
                stalled = true
                const error = `git clone stalled with no output for ${stallTimeoutMs}ms`
                emitProgress({
                    ...scope,
                    phase: 'error',
                    message: `Clone stalled with no output for ${stallTimeoutMs}ms`
                })
                terminateCloneProcess(child, 'SIGTERM')
                scheduleForceKill(error)
            }, stallTimeoutMs)
            stallTimer.unref()
        }

        activeClones.set(activeKey, { child, scope, tempDir, cancelled: false, forceFinish })
        armStallTimer()

        child.stdout?.on('data', (chunk: Buffer) => {
            armStallTimer()
            stdout += chunk.toString()
        })

        child.stderr?.on('data', (chunk: Buffer) => {
            armStallTimer()
            const text = chunk.toString()
            stderr += text
            for (const segment of text.split(/\r?\n|\r/)) {
                const line = segment.trim()
                if (!line) continue
                const parsed = parseClonePhase(line)
                if (parsed) {
                    emitProgress({ ...scope, ...parsed, message: sanitizeGitUrl(line) })
                }
            }
        })

        child.on('close', (code, signal) => {
            if (settled) return
            const active = activeClones.get(activeKey)
            if (active?.cancelled) {
                cleanupIncompleteCloneDestination(destination.destinationPath)
                finish({
                    success: false,
                    error: 'Clone cancelled',
                    stdout: sanitizeGitUrl(stdout),
                    stderr: sanitizeGitUrl(stderr),
                    exitCode: code ?? -1
                })
                return
            }

            if (stalled) {
                cleanupIncompleteCloneDestination(destination.destinationPath)
                finish({
                    success: false,
                    error: `git clone stalled with no output for ${getGitCloneStallTimeoutMs()}ms`,
                    stdout: sanitizeGitUrl(stdout),
                    stderr: sanitizeGitUrl(stderr),
                    exitCode: code ?? -1
                })
                return
            }

            if (code === 0) {
                void (async () => {
                    const remoteError = await sanitizeCloneOriginRemote(destination.destinationPath, url)
                    if (remoteError) {
                        emitProgress({ ...scope, phase: 'error', message: remoteError })
                        finish({
                            success: false,
                            error: remoteError,
                            stdout: sanitizeGitUrl(stdout),
                            stderr: sanitizeGitUrl(stderr),
                            exitCode: 0
                        })
                        return
                    }

                    emitProgress({ ...scope, phase: 'done', progress: 100, message: 'Clone completed successfully' })
                    finish({
                        success: true,
                        stdout: sanitizeGitUrl(stdout),
                        stderr: sanitizeGitUrl(stderr),
                        exitCode: 0
                    })
                })()
            } else {
                const exitText = signal ? `signal ${signal}` : `exit code ${code}`
                emitProgress({ ...scope, phase: 'error', message: `Clone failed with ${exitText}` })
                cleanupIncompleteCloneDestination(destination.destinationPath)
                finish({
                    success: false,
                    error: `git clone failed (${exitText})`,
                    stdout: sanitizeGitUrl(stdout),
                    stderr: sanitizeGitUrl(stderr),
                    exitCode: code ?? 1
                })
            }
        })

        child.on('error', (err) => {
            if (settled) return
            emitProgress({ ...scope, phase: 'error', message: sanitizeGitUrl(err.message) })
            cleanupIncompleteCloneDestination(destination.destinationPath)
            finish({
                success: false,
                error: sanitizeGitUrl(err.message),
                stdout: sanitizeGitUrl(stdout),
                stderr: sanitizeGitUrl(stderr),
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
    timeout?: number,
    commandOptions?: GitCommandOptions
): Promise<GitCommandResponse> {
    try {
        const options: ExecFileOptions = {
            cwd,
            timeout: timeout ?? 10_000,
            ...(commandOptions?.env ? { env: commandOptions.env } : {})
        }
        const { stdout, stderr } = await execFileAsync('git', args, options)
        return {
            success: true,
            stdout: stringifyExecOutput(stdout),
            stderr: stringifyExecOutput(stderr),
            exitCode: 0
        }
    } catch (error) {
        const execError = toExecError(error)

        if (execError.code === 'ETIMEDOUT' || execError.killed) {
            return rpcError('Command timed out', {
                stdout: stringifyExecOutput(execError.stdout),
                stderr: stringifyExecOutput(execError.stderr),
                exitCode: typeof execError.code === 'number' ? execError.code : -1
            })
        }

        return rpcError(execError.message || 'Command failed', {
            stdout: stringifyExecOutput(execError.stdout),
            stderr: stringifyExecOutput(execError.stderr) || execError.message || 'Command failed',
            exitCode: typeof execError.code === 'number' ? execError.code : 1
        })
    }
}

async function runGitNetworkCommand(
    args: string[],
    cwd: string,
    timeout: number | undefined,
    validatedUrl?: ValidatedCloneUrl
): Promise<GitCommandResponse> {
    return await runGitCommand(
        [
            ...SAFE_GIT_NETWORK_CONFIG_ARGS,
            ...(validatedUrl?.gitConfigArgs ?? []),
            ...args
        ],
        cwd,
        timeout,
        {
            env: createSafeGitEnv(validatedUrl?.sshCommand ? { GIT_SSH_COMMAND: validatedUrl.sshCommand } : undefined)
        }
    )
}

export function registerGitHandlers(
    rpcHandlerManager: RpcHandlerManager,
    workingDirectory: string,
    options?: { validateClonePath?: GitClonePathValidator }
): void {
    const validateClonePath = options?.validateClonePath ?? ((path: string) => validateClonePathWithinWorkingDirectory(path, workingDirectory))

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
            const fileError = validateFilePath(data.filePath, workingDirectory)
            if (fileError) return rpcError(fileError)
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
        const nameError = validateGitRef(data.name, 'branch name')
        if (nameError) return rpcError(nameError)
        const args = ['checkout', '-b', data.name]
        const startPointError = validateGitRef(data.startPoint, 'start point')
        if (startPointError) return rpcError(startPointError)
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
        const nameError = validateGitRef(data.name, 'branch name')
        if (nameError) return rpcError(nameError)
        return await runGitCommand(['checkout', data.name], resolved.cwd, data.timeout)
    })

    // Git Branch Merge
    rpcHandlerManager.registerHandler<GitBranchMergeRequest, GitCommandResponse>(RPC_METHODS.GitBranchMerge, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.name || !/^[\w.\-\/]+$/.test(data.name)) {
            return rpcError('Invalid branch name')
        }
        const nameError = validateGitRef(data.name, 'branch name')
        if (nameError) return rpcError(nameError)
        return await runGitCommand(['merge', data.name], resolved.cwd, data.timeout)
    })

    // Git Branch Delete
    rpcHandlerManager.registerHandler<GitBranchDeleteRequest, GitCommandResponse>(RPC_METHODS.GitBranchDelete, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.name || !/^[\w.\-\/]+$/.test(data.name)) {
            return rpcError('Invalid branch name')
        }
        const nameError = validateGitRef(data.name, 'branch name')
        if (nameError) return rpcError(nameError)
        const args = ['branch', data.force ? '-D' : '-d', data.name]
        return await runGitCommand(args, resolved.cwd, data.timeout)
    })

    // Git Commit
    rpcHandlerManager.registerHandler<GitCommitRequest, GitCommandResponse>(RPC_METHODS.GitCommit, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.message) return rpcError('Commit message required')
        const pathError = validateGitPathspecs(data.paths, workingDirectory)
        if (pathError) return rpcError(pathError)
        if (data.paths?.length) {
            const addResult = await runGitCommand(['--literal-pathspecs', 'add', '--', ...data.paths], resolved.cwd, data.timeout)
            if (!addResult.success) return addResult
            return await runGitCommand(['--literal-pathspecs', 'commit', '-m', data.message, '--', ...data.paths], resolved.cwd, data.timeout)
        }
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
        const pathError = validateGitPathspecs(data.paths, workingDirectory)
        if (pathError) return rpcError(pathError)
        return await runGitCommand(['--literal-pathspecs', 'add', '--', ...data.paths], resolved.cwd, data.timeout)
    })

    // Git Auto Commit (add + commit in one step, for GitInternalAPI)
    rpcHandlerManager.registerHandler<GitAutoCommitRequest, GitCommandResponse>(RPC_METHODS.GitAutoCommit, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.message) return rpcError('Commit message required')

        // Add specific paths or all tracked changes
        if (data.paths?.length) {
            // Validate paths don't start with - to prevent argument injection
            const pathError = validateGitPathspecs(data.paths, workingDirectory)
            if (pathError) return rpcError(pathError)
            const addResult = await runGitCommand(['--literal-pathspecs', 'add', '--', ...data.paths], resolved.cwd, data.timeout)
            if (!addResult.success) return addResult
        } else {
            const addResult = await runGitCommand(['add', '-u'], resolved.cwd, data.timeout)
            if (!addResult.success) return addResult
        }

        return await runGitCommand(['commit', '-m', data.message], resolved.cwd, data.timeout)
    })

    // Git Clone — streaming with progress, ASKPASS auth, depth support
    rpcHandlerManager.registerHandler<GitCloneRpcRequest, GitCommandResponse>(RPC_METHODS.GitClone, async (data) => {
        const normalized = normalizeGitCloneRequest(data)
        if ('error' in normalized) return rpcError(normalized.error)

        const resolved = resolveCwd(normalized.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)

        const destination = await prepareCloneDestination(
            normalized,
            resolved.cwd,
            async (path) => {
                return await validateClonePath(path)
            }
        )
        if ('error' in destination) return rpcError(destination.error)

        const validatedUrl = await validateCloneUrl(normalized.url)
        if ('error' in validatedUrl) return rpcError(validatedUrl.error)

        return await runGitCloneStreaming(
            validatedUrl.url,
            destination,
            normalized.branch,
            normalized.depth,
            normalized.cloneId,
            validatedUrl.gitConfigArgs,
            validatedUrl.sshCommand,
            rpcHandlerManager,
            { sessionId: rpcHandlerManager.getScopePrefix() },
            normalized.auth,
            normalized.timeout
        )
    })

    rpcHandlerManager.registerHandler<GitCloneCancelRpcRequest, GitCommandResponse>(RPC_METHODS.GitCloneCancel, async (data) => {
        return cancelActiveClone(data?.cloneId, { sessionId: rpcHandlerManager.getScopePrefix() }, rpcHandlerManager)
    })

    // Machine Git Clone — same handler with machine scope context
    rpcHandlerManager.registerHandler<GitCloneRpcRequest, GitCommandResponse>(RPC_METHODS.MachineGitClone, async (data) => {
        const normalized = normalizeGitCloneRequest(data)
        if ('error' in normalized) return rpcError(normalized.error)

        const resolved = resolveCwd(normalized.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)

        const destination = await prepareCloneDestination(
            normalized,
            resolved.cwd,
            async (path) => {
                return await validateClonePath(path)
            }
        )
        if ('error' in destination) return rpcError(destination.error)

        const validatedUrl = await validateCloneUrl(normalized.url)
        if ('error' in validatedUrl) return rpcError(validatedUrl.error)

        return await runGitCloneStreaming(
            validatedUrl.url,
            destination,
            normalized.branch,
            normalized.depth,
            normalized.cloneId,
            validatedUrl.gitConfigArgs,
            validatedUrl.sshCommand,
            rpcHandlerManager,
            { machineId: rpcHandlerManager.getScopePrefix() },
            normalized.auth,
            normalized.timeout
        )
    })

    rpcHandlerManager.registerHandler<GitCloneCancelRpcRequest, GitCommandResponse>(RPC_METHODS.MachineGitCloneCancel, async (data) => {
        return cancelActiveClone(data?.cloneId, { machineId: rpcHandlerManager.getScopePrefix() }, rpcHandlerManager)
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
        const nameError = validateGitName(data.name, 'remote name')
        if (nameError) return rpcError(nameError)
        if (!data.url) return rpcError('Remote URL required')
        const validatedUrl = await validateCloneUrl(data.url)
        if ('error' in validatedUrl) return rpcError(validatedUrl.error)
        return await runGitNetworkCommand(['remote', 'add', data.name, validatedUrl.url], resolved.cwd, data.timeout, validatedUrl)
    })

    // Git Remote Remove
    rpcHandlerManager.registerHandler<GitRemoteRemoveRequest, GitCommandResponse>(RPC_METHODS.GitRemoteRemove, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        if (!data.name || !/^[\w.\-\/]+$/.test(data.name)) return rpcError('Invalid remote name')
        const nameError = validateGitName(data.name, 'remote name')
        if (nameError) return rpcError(nameError)
        return await runGitCommand(['remote', 'remove', data.name], resolved.cwd, data.timeout)
    })

    // Git Push
    rpcHandlerManager.registerHandler<GitPushRequest, GitCommandResponse>(RPC_METHODS.GitPush, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        const remoteError = validateGitName(data.remote, 'remote name')
        if (remoteError) return rpcError(remoteError)
        const branchError = validateGitRef(data.branch, 'branch name')
        if (branchError) return rpcError(branchError)
        const remote = await prepareGitNetworkRemote(resolved.cwd, data.remote, data.timeout)
        if ('error' in remote) return rpcError(remote.error)
        const args = ['push']
        if (data.force) args.push('--force')
        args.push(remote.remoteName)
        if (data.branch) args.push(data.branch)
        return await runGitNetworkCommand(args, resolved.cwd, data.timeout ?? 120_000, remote.validatedUrl)
    })

    // Git Pull
    rpcHandlerManager.registerHandler<GitPullRequest, GitCommandResponse>(RPC_METHODS.GitPull, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        const remoteError = validateGitName(data.remote, 'remote name')
        if (remoteError) return rpcError(remoteError)
        const branchError = validateGitRef(data.branch, 'branch name')
        if (branchError) return rpcError(branchError)
        const remote = await prepareGitNetworkRemote(resolved.cwd, data.remote, data.timeout)
        if ('error' in remote) return rpcError(remote.error)
        const args = ['pull', remote.remoteName]
        if (data.branch) args.push(data.branch)
        return await runGitNetworkCommand(args, resolved.cwd, data.timeout ?? 120_000, remote.validatedUrl)
    })

    // Git Fetch
    rpcHandlerManager.registerHandler<GitFetchRequest, GitCommandResponse>(RPC_METHODS.GitFetch, async (data) => {
        const resolved = resolveCwd(data.cwd, workingDirectory)
        if (resolved.error) return rpcError(resolved.error)
        const remoteError = validateGitName(data.remote, 'remote name')
        if (remoteError) return rpcError(remoteError)
        const remote = await prepareGitNetworkRemote(resolved.cwd, data.remote, data.timeout)
        if ('error' in remote) return rpcError(remote.error)
        return await runGitNetworkCommand(['fetch', remote.remoteName], resolved.cwd, data.timeout ?? 120_000, remote.validatedUrl)
    })
}
