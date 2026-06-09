import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RPC_METHODS } from '@hapipower/protocol/rpcMethods'
import { RpcHandlerManager } from '../../../api/rpc/RpcHandlerManager'
import { registerGitHandlers } from './git'

const execFileAsync = promisify(execFile)

type GitCommandResponse = {
    success: boolean
    stdout?: string
    stderr?: string
    exitCode?: number
    error?: string
}

async function createTempDir(prefix: string): Promise<string> {
    const root = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
    await mkdir(root, { recursive: true })
    return root
}

async function callRpc<T>(rpc: RpcHandlerManager, method: string, params: unknown): Promise<T> {
    const response = await rpc.handleRequest({ method: `session-1:${method}`, params: JSON.stringify(params) })
    return JSON.parse(response) as T
}

async function git(cwd: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, { cwd, timeout: 10_000 })
    return stdout.toString()
}

describe('git commit RPC handler', () => {
    let rootDir: string
    let rpc: RpcHandlerManager

    beforeEach(async () => {
        rootDir = await createTempDir('hapi-power-git-commit')
        rpc = new RpcHandlerManager({ scopePrefix: 'session-1', scopeKind: 'session' })
        registerGitHandlers(rpc, rootDir)

        await git(rootDir, ['init'])
        await git(rootDir, ['config', 'user.name', 'zulinliu'])
        await git(rootDir, ['config', 'user.email', 'zulinliu@example.com'])
        await writeFile(join(rootDir, 'selected.txt'), 'base selected\n')
        await writeFile(join(rootDir, 'unselected.txt'), 'base unselected\n')
        await git(rootDir, ['add', 'selected.txt', 'unselected.txt'])
        await git(rootDir, ['commit', '-m', '初始提交'])
    })

    afterEach(async () => {
        await rm(rootDir, { recursive: true, force: true })
    })

    it('只提交 paths 指定的文件，未选文件仍留在工作区', async () => {
        await writeFile(join(rootDir, 'selected.txt'), 'base selected\nselected change\n')
        await writeFile(join(rootDir, 'unselected.txt'), 'base unselected\nunselected change\n')

        const result = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.GitCommit, {
            cwd: rootDir,
            message: '提交选中文件',
            paths: ['selected.txt']
        })

        expect(result.success).toBe(true)
        expect(await git(rootDir, ['show', '--name-only', '--format=', 'HEAD'])).toBe('selected.txt\n')
        expect(await git(rootDir, ['status', '--porcelain', '--', 'unselected.txt'])).toContain(' M unselected.txt')
        expect(await readFile(join(rootDir, 'unselected.txt'), 'utf8')).toContain('unselected change')
    })

    it('拒绝危险 pathspec，避免参数注入和目录穿越', async () => {
        const injection = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.GitCommit, {
            cwd: rootDir,
            message: '提交危险路径',
            paths: ['--all']
        })
        const traversal = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.GitCommit, {
            cwd: rootDir,
            message: '提交危险路径',
            paths: ['../outside.txt']
        })
        const glob = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.GitCommit, {
            cwd: rootDir,
            message: '提交危险路径',
            paths: ['*.txt']
        })
        const magic = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.GitCommit, {
            cwd: rootDir,
            message: '提交危险路径',
            paths: [':(top)**']
        })

        expect(injection.success).toBe(false)
        expect(injection.error).toContain('Invalid path')
        expect(traversal.success).toBe(false)
        expect(traversal.error).toContain('Invalid path')
        expect(glob.success).toBe(false)
        expect(glob.error).toContain('Invalid path')
        expect(magic.success).toBe(false)
        expect(magic.error).toContain('Invalid path')
    })

    it('不让 glob pathspec 扩展提交未选文件', async () => {
        await writeFile(join(rootDir, 'selected.txt'), 'base selected\nselected change\n')
        await writeFile(join(rootDir, 'unselected.txt'), 'base unselected\nunselected change\n')

        const result = await callRpc<GitCommandResponse>(rpc, RPC_METHODS.GitCommit, {
            cwd: rootDir,
            message: '提交危险路径',
            paths: ['*.txt']
        })

        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid path')
        expect(await git(rootDir, ['status', '--porcelain', '--', 'selected.txt', 'unselected.txt'])).toContain(' M selected.txt')
        expect(await git(rootDir, ['status', '--porcelain', '--', 'selected.txt', 'unselected.txt'])).toContain(' M unselected.txt')
    })
})
