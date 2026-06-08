import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import type { ApiClient } from '@/api/client'
import { GitPortal } from './GitPortal'

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

function GitPortalHarness(props: { api: ApiClient; onOpenDirectory: (path: string) => void }) {
    const [isOpen, setIsOpen] = useState(true)

    return (
        <>
            <button type="button" onClick={() => setIsOpen(true)}>
                open git portal
            </button>
            <GitPortal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                api={props.api}
                machineId="machine-1"
                currentPath="/workspace"
                onOpenDirectory={(path) => {
                    props.onOpenDirectory(path)
                    setIsOpen(false)
                }}
            />
        </>
    )
}

describe('GitPortal', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.unstubAllGlobals()
        vi.clearAllMocks()
        vi.stubGlobal('crypto', {
            ...globalThis.crypto,
            randomUUID: vi.fn(() => '11111111-1111-4111-8111-111111111111')
        })
    })

    it('returns to a fresh input step after opening a cloned directory and reopening clone', async () => {
        const api = createApi()
        const onOpenDirectory = vi.fn()

        render(<GitPortalHarness api={api} onOpenDirectory={onOpenDirectory} />)

        fireEvent.change(screen.getByLabelText('gitPortal.input.urlPlaceholder'), {
            target: { value: 'https://github.com/acme/repo.git' }
        })
        fireEvent.click(screen.getByRole('button', { name: 'gitPortal.input.start' }))

        await waitFor(() => expect(screen.getAllByText('gitPortal.result.success').length).toBeGreaterThan(0))

        fireEvent.click(screen.getByRole('button', { name: 'gitPortal.result.openDir' }))

        expect(onOpenDirectory).toHaveBeenCalledWith('/workspace/repo')
        expect(screen.queryByText('gitPortal.result.success')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'open git portal' }))

        expect(screen.getByLabelText('gitPortal.input.urlPlaceholder')).toHaveValue('')
        expect(screen.queryByText('gitPortal.result.success')).not.toBeInTheDocument()
    })
})
