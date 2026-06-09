import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n-context'
import type { GitAtlasDashboardResponse, GitAtlasDiffResponse, GitSyncRequest } from '@/types/api'
import GitPage from './git'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    getGitDashboard: vi.fn(),
    getGitAtlasDiff: vi.fn(),
    createGitCommitBasket: vi.fn(),
    gitSync: vi.fn(),
    addToast: vi.fn(),
    copy: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
    useParams: () => ({ sessionId: 'session-1' }),
    useNavigate: () => mocks.navigate,
}))

vi.mock('@/lib/app-context', () => ({
    useAppContext: () => ({
        api: {
            getGitDashboard: mocks.getGitDashboard,
            getGitAtlasDiff: mocks.getGitAtlasDiff,
            createGitCommitBasket: mocks.createGitCommitBasket,
            gitSync: mocks.gitSync,
        },
        token: 'test-token',
        baseUrl: '',
    }),
}))

vi.mock('@/hooks/queries/useSession', () => ({
    useSession: () => ({
        session: {
            id: 'session-1',
            active: true,
            metadata: { path: '/home/tester/project' },
        },
        isLoading: false,
        error: null,
        notFound: false,
        refetch: vi.fn(),
    }),
}))

vi.mock('@/lib/toast-context', () => ({
    useToast: () => ({ addToast: mocks.addToast }),
}))

vi.mock('@/hooks/useCopyToClipboard', () => ({
    useCopyToClipboard: () => ({ copied: false, copy: mocks.copy }),
}))

vi.mock('@/components/git/GitHistory', () => ({
    GitHistory: () => <div data-testid="git-history" />,
}))

vi.mock('@/components/git/GitBranchManager', () => ({
    GitBranchManager: () => <div data-testid="git-branches" />,
}))

vi.mock('@/components/git/GitRemoteManager', () => ({
    GitRemoteManager: () => <div data-testid="git-remotes" />,
}))

vi.mock('@/components/git/GitCloneDialog', () => ({
    GitCloneDialog: ({ isOpen }: { isOpen: boolean }) => (
        isOpen ? <div data-testid="git-clone-dialog" /> : null
    ),
}))

function dashboard(overrides: Partial<GitAtlasDashboardResponse> = {}): GitAtlasDashboardResponse {
    return {
        success: true,
        repo: {
            isRepo: true,
            root: '/home/tester/project',
            branch: 'feat/v0.18.0',
            upstream: 'origin/feat/v0.18.0',
            detached: false,
            ahead: 2,
            behind: 1,
            hasConflicts: true,
        },
        summary: {
            totalChanges: 4,
            staged: 1,
            unstaged: 2,
            untracked: 1,
            conflicted: 1,
            linesAdded: 18,
            linesRemoved: 5,
        },
        recommendation: {
            kind: 'push',
            label: 'Push local commits',
            description: 'Backend text must not be rendered directly.',
        },
        changes: [
            {
                path: 'src/app.ts',
                status: 'modified',
                stage: 'unstaged',
                linesAdded: 8,
                linesRemoved: 2,
                binary: false,
                selectable: true,
            },
            {
                path: 'web/src/routes/sessions/git.tsx',
                status: 'added',
                stage: 'staged',
                linesAdded: 10,
                linesRemoved: 0,
                binary: false,
                selectable: true,
            },
            {
                path: 'src/conflict.ts',
                status: 'conflicted',
                stage: 'mixed',
                linesAdded: 0,
                linesRemoved: 0,
                binary: false,
                selectable: false,
            },
            {
                path: 'assets/logo.png',
                status: 'modified',
                stage: 'unstaged',
                linesAdded: 0,
                linesRemoved: 0,
                binary: true,
                selectable: true,
            },
        ],
        remotes: [{ name: 'origin', url: 'https://example.com/repo.git' }],
        recentCommits: [],
        sync: {
            remote: 'origin',
            branch: 'feat/v0.18.0',
            ahead: 2,
            behind: 1,
            canPull: true,
            canPush: true,
            requiresRemote: false,
            inFlight: false,
        },
        ...overrides,
    }
}

function diff(overrides: Partial<GitAtlasDiffResponse> = {}): GitAtlasDiffResponse {
    return {
        success: true,
        path: 'src/app.ts',
        staged: false,
        diff: 'diff --git a/src/app.ts b/src/app.ts\n+export const ok = true',
        binary: false,
        truncated: false,
        ...overrides,
    }
}

function renderGitPage() {
    return render(
        <I18nProvider>
            <GitPage />
        </I18nProvider>
    )
}

function expectMetricValue(scope: HTMLElement, label: string, value: string) {
    const labelNode = within(scope).getByText(label)
    const metric = labelNode.parentElement
    expect(metric).not.toBeNull()
    expect(within(metric as HTMLElement).getByText(value)).toBeInTheDocument()
}

describe('GitPage Git Atlas workflow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getGitDashboard.mockResolvedValue(dashboard())
        mocks.getGitAtlasDiff.mockResolvedValue(diff())
        mocks.createGitCommitBasket.mockResolvedValue({ success: true, stdout: 'committed' })
        mocks.gitSync.mockResolvedValue({ success: true, stdout: 'pushed' })
        mocks.copy.mockResolvedValue(true)
    })

    afterEach(() => {
        cleanup()
    })

    it('shows branch posture, change metrics and localized recommendation on the first screen', async () => {
        renderGitPage()

        expect(await screen.findByText('Git Atlas')).toBeInTheDocument()
        expect(screen.getByText('feat/v0.18.0')).toBeInTheDocument()
        expect(screen.getByText('origin')).toBeInTheDocument()
        expect(screen.getByText('Push local commits: Local commits are ahead of the remote branch.')).toBeInTheDocument()
        expect(screen.queryByText('Backend text must not be rendered directly.')).not.toBeInTheDocument()

        const hero = screen.getByText('Push local commits: Local commits are ahead of the remote branch.').closest('section')
        expect(hero).not.toBeNull()
        expectMetricValue(hero as HTMLElement, 'Changes', '4')
        expectMetricValue(hero as HTMLElement, 'Ahead', '2')
        expectMetricValue(hero as HTMLElement, 'Behind', '1')
        expectMetricValue(hero as HTMLElement, 'Conflicts', '1')
    })

    it('commits only selectable basket paths from the change map', async () => {
        renderGitPage()

        expect(await screen.findByText('Commit Basket')).toBeInTheDocument()
        const basketSection = screen.getByText('Commit Basket').closest('section')
        expect(basketSection).not.toBeNull()
        const basketScope = within(basketSection as HTMLElement)

        expect(screen.getByText('3 selected')).toBeInTheDocument()
        expect(basketScope.getByText('src/app.ts')).toBeInTheDocument()
        expect(basketScope.getByText('web/src/routes/sessions/git.tsx')).toBeInTheDocument()
        expect(basketScope.getByText('assets/logo.png')).toBeInTheDocument()
        expect(basketScope.queryByText('src/conflict.ts')).not.toBeInTheDocument()

        fireEvent.change(screen.getByPlaceholderText('Enter commit message…'), {
            target: { value: '提交 Git 脉络' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Commit selected paths' }))

        await waitFor(() => {
            expect(mocks.createGitCommitBasket).toHaveBeenCalledWith('session-1', '提交 Git 脉络', [
                'src/app.ts',
                'web/src/routes/sessions/git.tsx',
                'assets/logo.png',
            ])
        })
        expect(mocks.createGitCommitBasket.mock.calls[0]?.[2]).not.toContain('src/conflict.ts')
    })

    it('requires the current branch name before force pushing through Sync Center', async () => {
        renderGitPage()

        await screen.findByText('Sync Center')
        const pushButton = screen.getByRole('button', { name: 'Push' })
        fireEvent.click(screen.getByLabelText('Force push'))

        expect(pushButton).toBeDisabled()
        const forcePushButton = screen.getByRole('button', { name: 'Force push' })
        expect(forcePushButton).toBeDisabled()

        fireEvent.change(screen.getByLabelText('Type "feat/v0.18.0" to confirm force push.'), {
            target: { value: 'main' },
        })
        expect(forcePushButton).toBeDisabled()

        fireEvent.change(screen.getByLabelText('Type "feat/v0.18.0" to confirm force push.'), {
            target: { value: 'feat/v0.18.0' },
        })
        fireEvent.click(forcePushButton)

        await waitFor(() => {
            expect(mocks.gitSync).toHaveBeenCalledTimes(1)
        })

        const request = mocks.gitSync.mock.calls[0]?.[1] as GitSyncRequest
        expect(mocks.gitSync.mock.calls[0]?.[0]).toBe('session-1')
        expect(request).toEqual({
            action: 'push',
            remote: 'origin',
            branch: 'feat/v0.18.0',
            force: true,
            confirmation: 'feat/v0.18.0',
        })
    })
})
