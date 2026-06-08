import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { subscribeCloneProgressEvents } from '@/lib/git-portal-events'
import { isGlobalScopedMessageStreamEvent, useSSE } from './useSSE'

class MockEventSource {
    static readonly CLOSED = 2
    readonly url: string
    readyState = 1
    onmessage: ((event: MessageEvent<string>) => void) | null = null
    onopen: (() => void) | null = null
    onerror: ((event: Event) => void) | null = null
    close = vi.fn(() => {
        this.readyState = MockEventSource.CLOSED
    })

    constructor(url: string) {
        this.url = url
        mockEventSources.push(this)
    }
}

const mockEventSources: MockEventSource[] = []

function createWrapper() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return function Wrapper({ children }: { children: ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children)
    }
}

afterEach(() => {
    vi.unstubAllGlobals()
    mockEventSources.length = 0
})

describe('useSSE scope handling', () => {
    it('treats message stream events as global-scoped skips', () => {
        expect(isGlobalScopedMessageStreamEvent('global', 'message-received')).toBe(true)
        expect(isGlobalScopedMessageStreamEvent('global', 'messages-consumed')).toBe(true)
        expect(isGlobalScopedMessageStreamEvent('global', 'message-cancelled')).toBe(true)
        expect(isGlobalScopedMessageStreamEvent('global', 'scheduled-matured')).toBe(true)
    })

    it('does not skip session lifecycle events on the global connection', () => {
        expect(isGlobalScopedMessageStreamEvent('global', 'session-updated')).toBe(false)
        expect(isGlobalScopedMessageStreamEvent('global', 'session-added')).toBe(false)
        expect(isGlobalScopedMessageStreamEvent('global', 'session-removed')).toBe(false)
    })

    it('processes message stream events on full-scoped connections', () => {
        expect(isGlobalScopedMessageStreamEvent('full', 'message-received')).toBe(false)
    })

    it('bridges clone-progress SSE messages to Git Portal subscribers', () => {
        vi.stubGlobal('EventSource', MockEventSource)
        const received: unknown[] = []
        const unsubscribe = subscribeCloneProgressEvents((event) => {
            received.push(event)
        })

        const { unmount } = renderHook(() => useSSE({
            enabled: true,
            token: 'token-1',
            baseUrl: 'https://hub.example',
            subscription: { all: true },
            onEvent: vi.fn()
        }), { wrapper: createWrapper() })

        expect(mockEventSources).toHaveLength(1)
        mockEventSources[0]?.onmessage?.(new MessageEvent('message', {
            data: JSON.stringify({
                type: 'clone-progress',
                namespace: 'default',
                machineId: 'machine-1',
                data: {
                    cloneId: '11111111-1111-4111-8111-111111111111',
                    machineId: 'machine-1',
                    phase: 'writing',
                    progress: 45
                }
            })
        }))

        expect(received).toHaveLength(1)
        expect(received[0]).toMatchObject({
            type: 'clone-progress',
            data: {
                cloneId: '11111111-1111-4111-8111-111111111111',
                phase: 'writing',
                progress: 45
            }
        })

        unsubscribe()
        unmount()
    })
})
