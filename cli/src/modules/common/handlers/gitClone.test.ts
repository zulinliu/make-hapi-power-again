import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RPC_METHODS } from '@hapipower/protocol/rpcMethods'
import { RpcHandlerManager } from '../../../api/rpc/RpcHandlerManager'
import { registerGitHandlers } from './git'

const spawnMock = vi.hoisted(() => vi.fn())
const lookupMock = vi.hoisted(() => vi.fn(async () => [{ address: '140.82.112.4', family: 4 }]))
const SAFE_GIT_NETWORK_CONFIG_ARGS = [
    '-c',
    'protocol.file.allow=never',
    '-c',
    'protocol.ext.allow=never',
    '-c',
    'core.hooksPath=/dev/null',
    '-c',
    'credential.helper=',
    '-c',
    'http.proxy=',
    '-c',
    'https.proxy=',
    '-c',
    'http.lowSpeedLimit=1',
    '-c',
    'http.lowSpeedTime=120'
]

vi.mock('child_process', async () => {
    const actual = await vi.importActual<typeof import('child_process')>('child_process')
    return {
        ...actual,
        spawn: spawnMock
    }
})

vi.mock('node:dns/promises', () => ({
    lookup: lookupMock
}))

type GitCommandResponse = {
    success: boolean
    stdout?: string
    stderr?: string
    exitCode?: number
    error?: string
}

type FakeChild = EventEmitter & {
    stdout: PassThrough
    stderr: PassThrough
    killed: boolean
    pid?: number
    kill: ReturnType<typeof vi.fn>
}

function createFakeChild(): FakeChild {
    const child = new EventEmitter() as FakeChild
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.killed = false
    child.kill = vi.fn(() => {
        child.killed = true
        return true
    })
    return child
}

async function createTempDir(prefix: string): Promise<string> {
    const root = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    await mkdir(root, { recursive: true })
    return root
}

async function callRpc<T>(rpc: RpcHandlerManager, method: string, params: unknown): Promise<T> {
    const response = await rpc.handleRequest({ method: `machine-1:${method}`, params: JSON.stringify(params) })
    return JSON.parse(response) as T
}

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((innerResolve) => {
        resolve = innerResolve
    })
    return { promise, resolve }
}

describe('git clone RPC handlers', () => {
    let rootDir: string
    let rpc: RpcHandlerManager
    let previousInheritProxyConfig: string | undefined

    beforeEach(async () => {
        previousInheritProxyConfig = process.env.HAPI_POWER_GIT_INHERIT_PROXY_CONFIG
        process.env.HAPI_POWER_GIT_INHERIT_PROXY_CONFIG = '0'
        spawnMock.mockReset()
        lookupMock.mockClear()
        rootDir = await createTempDir('hapi-power-git-clone')
        rpc = new RpcHandlerManager({ scopePrefix: 'machine-1', scopeKind: 'machine' })
        registerGitHandlers(rpc, rootDir)
    })

    afterEach(async () => {
        await rm(rootDir, { recursive: true, force: true })
        spawnMock.mockReset()
        if (previousInheritProxyConfig === undefined) {
            delete process.env.HAPI_POWER_GIT_INHERIT_PROXY_CONFIG
        } else {
            process.env.HAPI_POWER_GIT_INHERIT_PROXY_CONFIG = previousInheritProxyConfig
        }
    })

    it('uses a safe mkdtemp ASKPASS helper for HTTPS credentials and cleans it up', async () => {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child)
        const cloneId = '11111111-1111-4111-8111-111111111111'

        const clonePromise = callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitClone, {
            url: 'https://github.com/acme/repo.git',
            targetDir: '.',
            cloneId,
            auth: { type: 'token', username: 'git', password: 'secret-token' }
        })

        await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1))
        const [, args, options] = spawnMock.mock.calls[0] as [string, string[], { cwd: string; env: Record<string, string> }]

        expect(args).toEqual([
            ...SAFE_GIT_NETWORK_CONFIG_ARGS,
            '-c',
            'http.followRedirects=false',
            '-c',
            'http.curloptResolve=github.com:443:140.82.112.4',
            'clone',
            '--progress',
            'https://github.com/acme/repo.git',
            'repo'
        ])
        expect(options.cwd).toBe(rootDir)
        expect(options.env.GIT_TERMINAL_PROMPT).toBe('0')
        expect(options.env.GIT_CONFIG_NOSYSTEM).toBe('1')
        expect(options.env.GIT_CONFIG_SYSTEM).toBe('/dev/null')
        expect(options.env.GIT_CONFIG_GLOBAL).toBe('/dev/null')
        expect(options.env.GIT_CONFIG_COUNT).toBe('0')
        expect(options.env.GIT_ASKPASS).toMatch(/askpass\.sh$/)
        expect(options.env.GIT_ASKPASS).not.toContain(cloneId)
        expect(dirname(options.env.GIT_ASKPASS)).toContain('hp-git-askpass-')
        expect(existsSync(options.env.GIT_ASKPASS)).toBe(true)

        child.emit('close', 0, null)
        await expect(clonePromise).resolves.toEqual(expect.objectContaining({ success: true, exitCode: 0 }))
        expect(existsSync(dirname(options.env.GIT_ASKPASS))).toBe(false)
    })

    it('cancels an active clone by cloneId and kills the spawned git process', async () => {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child)
        const cloneId = '22222222-2222-4222-8222-222222222222'
        const destinationPath = join(rootDir, 'repo')

        const clonePromise = callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitClone, {
            url: 'https://github.com/acme/repo.git',
            targetDir: '.',
            cloneId
        })

        await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1))
        await mkdir(destinationPath, { recursive: true })
        expect(existsSync(destinationPath)).toBe(true)
        const cancel = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitCloneCancel, { cloneId })

        expect(cancel.success).toBe(true)
        expect(child.kill).toHaveBeenCalledWith('SIGTERM')

        child.emit('close', null, 'SIGTERM')
        await expect(clonePromise).resolves.toEqual(expect.objectContaining({
            success: false,
            error: 'Clone cancelled'
        }))
        expect(existsSync(destinationPath)).toBe(false)
    })

    it('uses the git process group for POSIX clone cancellation', async () => {
        if (process.platform === 'win32') return
        const child = createFakeChild()
        child.pid = 12345
        spawnMock.mockReturnValueOnce(child)
        const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)
        const cloneId = '99999999-9999-4999-8999-999999999999'

        try {
            const clonePromise = callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitClone, {
                url: 'https://github.com/acme/repo.git',
                targetDir: '.',
                cloneId
            })

            await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1))
            const cancel = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitCloneCancel, { cloneId })

            expect(cancel.success).toBe(true)
            expect(killSpy).toHaveBeenCalledWith(-12345, 'SIGTERM')
            expect(child.kill).not.toHaveBeenCalled()

            child.emit('close', null, 'SIGTERM')
            await expect(clonePromise).resolves.toEqual(expect.objectContaining({
                success: false,
                error: 'Clone cancelled'
            }))
        } finally {
            killSpy.mockRestore()
        }
    })

    it('cleans up incomplete destination directories after clone failures', async () => {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child)
        const destinationPath = join(rootDir, 'repo')

        const clonePromise = callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitClone, {
            url: 'https://github.com/acme/repo.git',
            targetDir: '.',
            cloneId: '77777777-7777-4777-8777-777777777777'
        })

        await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1))
        await mkdir(destinationPath, { recursive: true })
        child.emit('close', 128, null)

        await expect(clonePromise).resolves.toEqual(expect.objectContaining({
            success: false,
            error: 'git clone failed (exit code 128)'
        }))
        expect(existsSync(destinationPath)).toBe(false)
    })

    it('terminates stalled clones with no output and cleans up the incomplete destination', async () => {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child)
        const destinationPath = join(rootDir, 'repo')
        const previousStallTimeout = process.env.HAPI_POWER_GIT_CLONE_STALL_TIMEOUT_MS
        const previousForceKillGrace = process.env.HAPI_POWER_GIT_CLONE_FORCE_KILL_GRACE_MS
        process.env.HAPI_POWER_GIT_CLONE_STALL_TIMEOUT_MS = '30'
        process.env.HAPI_POWER_GIT_CLONE_FORCE_KILL_GRACE_MS = '20'

        try {
            const clonePromise = callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitClone, {
                url: 'https://github.com/acme/repo.git',
                targetDir: '.',
                cloneId: '88888888-8888-4888-8888-888888888888'
            })

            await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1))
            await mkdir(destinationPath, { recursive: true })
            await delay(80)

            expect(child.kill).toHaveBeenCalledWith('SIGTERM')
            expect(child.kill).toHaveBeenCalledWith('SIGKILL')

            await expect(clonePromise).resolves.toEqual(expect.objectContaining({
                success: false,
                error: 'git clone stalled with no output for 30ms'
            }))
            expect(existsSync(destinationPath)).toBe(false)
        } finally {
            if (previousStallTimeout === undefined) {
                delete process.env.HAPI_POWER_GIT_CLONE_STALL_TIMEOUT_MS
            } else {
                process.env.HAPI_POWER_GIT_CLONE_STALL_TIMEOUT_MS = previousStallTimeout
            }
            if (previousForceKillGrace === undefined) {
                delete process.env.HAPI_POWER_GIT_CLONE_FORCE_KILL_GRACE_MS
            } else {
                process.env.HAPI_POWER_GIT_CLONE_FORCE_KILL_GRACE_MS = previousForceKillGrace
            }
        }
    })

    it('honors cancellation that arrives before clone spawn after async URL validation', async () => {
        const pendingLookup = deferred<Array<{ address: string; family: number }>>()
        lookupMock.mockImplementationOnce(async () => await pendingLookup.promise)
        const cloneId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

        const clonePromise = callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitClone, {
            url: 'https://github.com/acme/repo.git',
            targetDir: '.',
            cloneId
        })

        await vi.waitFor(() => expect(lookupMock).toHaveBeenCalled())
        const cancel = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitCloneCancel, { cloneId })
        expect(cancel.success).toBe(true)

        pendingLookup.resolve([{ address: '140.82.112.4', family: 4 }])

        await expect(clonePromise).resolves.toEqual(expect.objectContaining({
            success: false,
            error: 'Clone cancelled'
        }))
        expect(spawnMock).not.toHaveBeenCalled()
    })

    it('rejects unsafe cloneIds before spawning git', async () => {
        const result = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitClone, {
            url: 'https://github.com/acme/repo.git',
            targetDir: '.',
            cloneId: '../../askpass.sh'
        })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Invalid git clone request')
        expect(spawnMock).not.toHaveBeenCalled()
    })

    it('rejects private and local network clone URLs before spawning git', async () => {
        const urls = [
            'https://localhost/acme/repo.git',
            'https://127.0.0.1/acme/repo.git',
            'https://[::ffff:7f00:1]/acme/repo.git',
            'git@localhost:acme/repo.git',
            'ssh://git@127.0.0.1/acme/repo.git'
        ]

        for (const url of urls) {
            const result = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitClone, {
                url,
                targetDir: '.',
                cloneId: '33333333-3333-4333-8333-333333333333'
            })

            expect(result.success).toBe(false)
        }

        expect(spawnMock).not.toHaveBeenCalled()
    })

    it('rejects DNS answers that resolve to private network addresses', async () => {
        lookupMock.mockResolvedValueOnce([{ address: '10.0.0.10', family: 4 }])

        const result = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitClone, {
            url: 'https://internal.example/acme/repo.git',
            targetDir: '.',
            cloneId: '44444444-4444-4444-8444-444444444444'
        })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Cannot clone from private or local network addresses')
        expect(spawnMock).not.toHaveBeenCalled()
    })

    it('pins SSH clone DNS resolution into GIT_SSH_COMMAND', async () => {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child)
        lookupMock.mockResolvedValueOnce([{ address: '140.82.112.4', family: 4 }])
        const previousSshCommand = process.env.GIT_SSH_COMMAND
        process.env.GIT_SSH_COMMAND = 'ssh -o HostName=127.0.0.1 -o ProxyCommand=nc 127.0.0.1 22'

        try {
            const clonePromise = callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitClone, {
                url: 'git@github.com:acme/repo.git',
                targetDir: '.',
                cloneId: '55555555-5555-4555-8555-555555555555',
                auth: { type: 'ssh' }
            })

            await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1))
            const [, args, options] = spawnMock.mock.calls[0] as [string, string[], { env: Record<string, string> }]

            expect(args).toEqual([
                ...SAFE_GIT_NETWORK_CONFIG_ARGS,
                'clone',
                '--progress',
                'git@github.com:acme/repo.git',
                'repo'
            ])
            expect(options.env.GIT_SSH_COMMAND).toContain("HostName='140.82.112.4'")
            expect(options.env.GIT_SSH_COMMAND).toContain("-F '/dev/null'")
            expect(options.env.GIT_SSH_COMMAND).toContain("HostKeyAlias='github.com'")
            expect(options.env.GIT_SSH_COMMAND).toContain('ProxyCommand=none')
            expect(options.env.GIT_SSH_COMMAND).toContain('ProxyJump=none')
            expect(options.env.GIT_SSH_COMMAND).not.toContain('127.0.0.1')
            expect(options.env.GIT_SSH_COMMAND).not.toContain('nc 127.0.0.1')

            child.emit('close', 0, null)
            await expect(clonePromise).resolves.toEqual(expect.objectContaining({ success: true }))
        } finally {
            if (previousSshCommand === undefined) {
                delete process.env.GIT_SSH_COMMAND
            } else {
                process.env.GIT_SSH_COMMAND = previousSshCommand
            }
        }
    })

    it('does not inherit hostile git environment for HTTPS clones', async () => {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child)
        const previousSshCommand = process.env.GIT_SSH_COMMAND
        const previousConfigCount = process.env.GIT_CONFIG_COUNT
        const previousProxyCommand = process.env.GIT_PROXY_COMMAND
        process.env.GIT_SSH_COMMAND = 'ssh -o ProxyCommand=nc 127.0.0.1 22'
        process.env.GIT_CONFIG_COUNT = '9'
        process.env.GIT_PROXY_COMMAND = 'nc 127.0.0.1 9418'

        try {
            const clonePromise = callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitClone, {
                url: 'https://github.com/acme/repo.git',
                targetDir: '.',
                cloneId: '66666666-6666-4666-8666-666666666666'
            })

            await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1))
            const [, args, options] = spawnMock.mock.calls[0] as [string, string[], { env: Record<string, string> }]

            expect(args).toEqual(expect.arrayContaining([
                'protocol.file.allow=never',
                'protocol.ext.allow=never',
                'http.lowSpeedLimit=1',
                'http.lowSpeedTime=120'
            ]))
            expect(options.env.GIT_SSH_COMMAND).toBeUndefined()
            expect(options.env.GIT_PROXY_COMMAND).toBeUndefined()
            expect(options.env.GIT_CONFIG_COUNT).toBe('0')

            child.emit('close', 0, null)
            await expect(clonePromise).resolves.toEqual(expect.objectContaining({ success: true }))
        } finally {
            if (previousSshCommand === undefined) {
                delete process.env.GIT_SSH_COMMAND
            } else {
                process.env.GIT_SSH_COMMAND = previousSshCommand
            }
            if (previousConfigCount === undefined) {
                delete process.env.GIT_CONFIG_COUNT
            } else {
                process.env.GIT_CONFIG_COUNT = previousConfigCount
            }
            if (previousProxyCommand === undefined) {
                delete process.env.GIT_PROXY_COMMAND
            } else {
                process.env.GIT_PROXY_COMMAND = previousProxyCommand
            }
        }
    })

    it('keeps URL-matched Git proxy config without enabling global config execution', async () => {
        const child = createFakeChild()
        spawnMock.mockReturnValueOnce(child)
        const previousHome = process.env.HOME
        const homeDir = await createTempDir('hapi-power-git-home')
        process.env.HOME = homeDir
        delete process.env.HAPI_POWER_GIT_INHERIT_PROXY_CONFIG
        await writeFile(join(homeDir, '.gitconfig'), [
            '[http "https://github.com/"]',
            '    proxy = http://proxy.example:8080',
            '[url "https://token@example.com/"]',
            '    insteadOf = https://github.com/',
            ''
        ].join('\n'))

        try {
            const clonePromise = callRpc<GitCommandResponse>(rpc, RPC_METHODS.MachineGitClone, {
                url: 'https://github.com/acme/repo.git',
                targetDir: '.',
                cloneId: '12121212-1212-4212-8212-121212121212'
            })

            await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1))
            const [, args, options] = spawnMock.mock.calls[0] as [string, string[], { env: Record<string, string> }]

            expect(args).toEqual(expect.arrayContaining([
                'http.proxy=http://proxy.example:8080',
                'http.curloptResolve=github.com:443:140.82.112.4'
            ]))
            expect(args).not.toContain('url.https://token@example.com/.insteadOf=https://github.com/')
            expect(options.env.GIT_CONFIG_GLOBAL).toBe('/dev/null')

            child.emit('close', 0, null)
            await expect(clonePromise).resolves.toEqual(expect.objectContaining({ success: true }))
        } finally {
            if (previousHome === undefined) {
                delete process.env.HOME
            } else {
                process.env.HOME = previousHome
            }
            await rm(homeDir, { recursive: true, force: true })
        }
    })

    it('rejects argument injection in git push, pull, fetch, and branch start points', async () => {
        const cases: Array<{ method: string; params: Record<string, unknown>; error: string }> = [
            {
                method: RPC_METHODS.GitPush,
                params: { cwd: '.', remote: '--upload-pack=/tmp/pwn', branch: 'main' },
                error: 'Invalid remote name'
            },
            {
                method: RPC_METHODS.GitPush,
                params: { cwd: '.', remote: 'origin', branch: '--force' },
                error: 'Invalid branch name'
            },
            {
                method: RPC_METHODS.GitPull,
                params: { cwd: '.', remote: '--exec=evil', branch: 'main' },
                error: 'Invalid remote name'
            },
            {
                method: RPC_METHODS.GitFetch,
                params: { cwd: '.', remote: '--upload-pack=/tmp/pwn' },
                error: 'Invalid remote name'
            },
            {
                method: RPC_METHODS.GitBranchCreate,
                params: { cwd: '.', name: 'safe-branch', startPoint: '--orphan=pwned' },
                error: 'Invalid start point'
            }
        ]

        for (const testCase of cases) {
            const result = await callRpc<GitCommandResponse>(rpc, testCase.method, testCase.params)
            expect(result.success).toBe(false)
            expect(result.error).toBe(testCase.error)
        }
    })

    it('rejects git log file paths outside the working directory before invoking git', async () => {
        const result = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.GitLog, {
            cwd: '.',
            filePath: '../../etc/passwd'
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('outside the working directory')
    })

    it('validates git remote add URLs with the clone SSRF guard', async () => {
        lookupMock.mockResolvedValueOnce([{ address: '10.0.0.10', family: 4 }])

        const privateResult = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.GitRemoteAdd, {
            cwd: '.',
            name: 'origin',
            url: 'https://internal.example/acme/repo.git'
        })
        expect(privateResult.success).toBe(false)
        expect(privateResult.error).toBe('Cannot clone from private or local network addresses')

        const fileResult = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.GitRemoteAdd, {
            cwd: '.',
            name: 'origin',
            url: 'file:///tmp/repo.git'
        })
        expect(fileResult.success).toBe(false)
        expect(fileResult.error).toBe('file:// protocol is not allowed')
    })
})
