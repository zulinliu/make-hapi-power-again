import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from './client'

type FetchCall = [input: RequestInfo | URL, init?: RequestInit]

function installFetchMock() {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
    }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

function jsonBody(init: RequestInit | undefined): unknown {
    return JSON.parse(String(init?.body ?? '{}')) as unknown
}

describe('ApiClient Git Portal requests', () => {
    beforeEach(() => {
        vi.unstubAllGlobals()
    })

    it('posts session clone requests with parent targetDir, targetName, cloneId and auth intact', async () => {
        const fetchMock = installFetchMock()
        const api = new ApiClient('token-1', { baseUrl: 'https://hub.example' })

        await api.gitClone('session/id', {
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            targetDir: '/workspace',
            targetName: 'make-hapi-power-again',
            branch: 'feat/v0.17.3',
            depth: 1,
            cloneId: '11111111-1111-4111-8111-111111111111',
            auth: { type: 'token', username: 'git', password: 'secret' }
        })

        const [url, init] = fetchMock.mock.calls[0] as unknown as FetchCall
        expect(String(url)).toBe('https://hub.example/api/sessions/session%2Fid/git-clone')
        expect(init?.method).toBe('POST')
        expect(jsonBody(init)).toEqual({
            url: 'https://github.com/zulinliu/make-hapi-power-again.git',
            targetDir: '/workspace',
            targetName: 'make-hapi-power-again',
            branch: 'feat/v0.17.3',
            depth: 1,
            cloneId: '11111111-1111-4111-8111-111111111111',
            auth: { type: 'token', username: 'git', password: 'secret' }
        })
    })

    it('uses scoped DELETE endpoints for clone cancellation', async () => {
        const fetchMock = installFetchMock()
        const api = new ApiClient('token-1', { baseUrl: 'https://hub.example' })

        await api.cancelGitCloneMachine('machine/id', '11111111-1111-4111-8111-111111111111')

        const [url, init] = fetchMock.mock.calls[0] as unknown as FetchCall
        expect(String(url)).toBe('https://hub.example/api/machines/machine%2Fid/git-clone/11111111-1111-4111-8111-111111111111')
        expect(init?.method).toBe('DELETE')
    })

    it('posts Git Atlas commit basket requests with selected paths only', async () => {
        const fetchMock = installFetchMock()
        const api = new ApiClient('token-1', { baseUrl: 'https://hub.example' })

        await api.createGitCommitBasket('session/id', '提交 Git 脉络', [
            'web/src/routes/sessions/git.tsx',
            'web/src/lib/git-atlas.ts',
        ])

        const [url, init] = fetchMock.mock.calls[0] as unknown as FetchCall
        expect(String(url)).toBe('https://hub.example/api/sessions/session%2Fid/git-commit-basket')
        expect(init?.method).toBe('POST')
        expect(jsonBody(init)).toEqual({
            message: '提交 Git 脉络',
            paths: [
                'web/src/routes/sessions/git.tsx',
                'web/src/lib/git-atlas.ts',
            ],
        })
    })

    it('sends confirmation phrases for dangerous Git operations', async () => {
        const fetchMock = installFetchMock()
        const api = new ApiClient('token-1', { baseUrl: 'https://hub.example' })

        await api.gitPush('session/id', {
            remote: 'origin',
            branch: 'feat/v0.18.0',
            force: true,
            confirmation: 'feat/v0.18.0',
        })
        await api.deleteGitBranch('session/id', 'old-branch', 'old-branch')
        await api.removeGitRemote('session/id', 'backup', 'backup')

        const [, pushInit] = fetchMock.mock.calls[0] as unknown as FetchCall
        const [, branchInit] = fetchMock.mock.calls[1] as unknown as FetchCall
        const [, remoteInit] = fetchMock.mock.calls[2] as unknown as FetchCall

        expect(jsonBody(pushInit)).toEqual({
            remote: 'origin',
            branch: 'feat/v0.18.0',
            force: true,
            confirmation: 'feat/v0.18.0',
        })
        expect(jsonBody(branchInit)).toEqual({
            name: 'old-branch',
            action: 'delete',
            confirmation: 'old-branch',
        })
        expect(jsonBody(remoteInit)).toEqual({
            confirmation: 'backup',
        })
    })

    it('throws ApiError with backend error codes for failed JSON requests', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
            error: 'Provider host resolves to a private or metadata address.',
            code: 'dns-private-ip-blocked',
        }), {
            status: 400,
            statusText: 'Bad Request',
            headers: { 'content-type': 'application/json' },
        })))
        const api = new ApiClient('token-1', { baseUrl: 'https://hub.example' })

        await expect(api.createProvider({
            name: 'Private Bridge',
            baseUrl: 'https://private.example.com/v1',
            apiKey: 'sk-test-private',
            protocol: 'openai',
        })).rejects.toMatchObject({
            name: 'ApiError',
            status: 400,
            code: 'dns-private-ip-blocked',
            message: expect.stringContaining('Provider host resolves'),
        })
    })
})
