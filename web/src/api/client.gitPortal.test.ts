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
})
