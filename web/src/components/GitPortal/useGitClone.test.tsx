import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api/client'
import { useGitClone } from './useGitClone'

vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}))

type MockGitPortalApi = Pick<ApiClient, 'gitCloneMachine' | 'gitClone' | 'cancelGitCloneMachine' | 'cancelGitClone'>

function createApi(overrides: Partial<MockGitPortalApi> = {}): ApiClient {
    return {
        gitCloneMachine: vi.fn(async () => ({ success: true })),
        gitClone: vi.fn(async () => ({ success: true })),
        cancelGitCloneMachine: vi.fn(async () => ({ success: true })),
        cancelGitClone: vi.fn(async () => ({ success: true })),
        ...overrides
    } as unknown as ApiClient
}

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((innerResolve) => {
        resolve = innerResolve
    })
    return { promise, resolve }
}

describe('useGitClone', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.unstubAllGlobals()
        vi.clearAllMocks()
        vi.stubGlobal('crypto', {
            ...globalThis.crypto,
            randomUUID: vi.fn(() => '11111111-1111-4111-8111-111111111111')
        })
    })

    it('falls back to done state when REST succeeds before SSE arrives', async () => {
        const onCloneComplete = vi.fn()
        const api = createApi()

        const { result } = renderHook(() => useGitClone({
            api,
            machineId: 'machine-1',
            currentPath: '/workspace',
            onCloneComplete
        }))

        act(() => {
            result.current.setUrl('https://github.com/acme/repo.git')
        })
        await act(async () => {
            await result.current.startClone()
        })

        await waitFor(() => expect(result.current.state.phase).toBe('done'))
        expect(result.current.state.result?.clonedPath).toBe('/workspace/repo')
        expect(api.gitCloneMachine).toHaveBeenCalledWith('machine-1', expect.objectContaining({
            url: 'https://github.com/acme/repo.git',
            targetDir: '/workspace',
            targetName: 'repo',
            cloneId: '11111111-1111-4111-8111-111111111111'
        }))
        await waitFor(() => expect(onCloneComplete).toHaveBeenCalledWith('/workspace/repo'))
    })

    it('updates progress only for the active clone id', async () => {
        const clone = deferred<{ success: boolean }>()
        const api = createApi({
            gitCloneMachine: vi.fn(async () => await clone.promise)
        })

        const { result } = renderHook(() => useGitClone({
            api,
            machineId: 'machine-1',
            currentPath: '/workspace'
        }))

        act(() => {
            result.current.setUrl('https://github.com/acme/repo.git')
        })
        act(() => {
            void result.current.startClone()
        })

        await waitFor(() => expect(api.gitCloneMachine).toHaveBeenCalled())

        act(() => {
            result.current.handleProgressEvent({
                type: 'clone-progress',
                data: { cloneId: '22222222-2222-4222-8222-222222222222', phase: 'writing', progress: 80 }
            })
        })
        expect(result.current.state.progress.percent).toBe(0)

        act(() => {
            result.current.handleProgressEvent({
                type: 'clone-progress',
                data: { cloneId: '11111111-1111-4111-8111-111111111111', phase: 'writing', progress: 42, message: 'Receiving objects' }
            })
        })

        await waitFor(() => expect(result.current.state.phase).toBe('transferring'))
        expect(result.current.state.progress.percent).toBe(42)
        expect(result.current.state.progress.message).toBe('Receiving objects')

        await act(async () => {
            clone.resolve({ success: false })
            await clone.promise
        })
    })

    it('sends cancel RPC for active machine clones and resets local state', async () => {
        const clone = deferred<{ success: boolean }>()
        const api = createApi({
            gitCloneMachine: vi.fn(async () => await clone.promise),
            cancelGitCloneMachine: vi.fn(async () => ({ success: true }))
        })

        const { result } = renderHook(() => useGitClone({
            api,
            machineId: 'machine-1',
            currentPath: '/workspace'
        }))

        act(() => {
            result.current.setUrl('https://github.com/acme/repo.git')
        })
        act(() => {
            void result.current.startClone()
        })

        await waitFor(() => expect(result.current.state.phase).toBe('connecting'))
        await act(async () => {
            await result.current.cancel()
        })

        expect(api.cancelGitCloneMachine).toHaveBeenCalledWith('machine-1', '11111111-1111-4111-8111-111111111111')
        expect(result.current.state.phase).toBe('input')
        expect(result.current.state.auth).toBeNull()

        await act(async () => {
            clone.resolve({ success: true })
            await clone.promise
        })
        expect(result.current.state.phase).toBe('input')
    })

    it('clears HTTPS auth when switching to SSH URL input', () => {
        const api = createApi()
        const { result } = renderHook(() => useGitClone({ api, machineId: 'machine-1' }))

        act(() => {
            result.current.setUrl('https://github.com/acme/repo.git')
            result.current.setAuth({ type: 'token', password: 'secret' })
        })
        expect(result.current.state.auth).toEqual({ type: 'token', password: 'secret' })

        act(() => {
            result.current.setUrl('git@github.com:acme/repo.git')
        })

        expect(result.current.state.auth).toBeNull()
    })
})
