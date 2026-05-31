import { useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'
import { GitStatusPanel } from '@/components/git/GitStatusPanel'
import { GitHistory } from '@/components/git/GitHistory'
import { GitBranchManager } from '@/components/git/GitBranchManager'
import { GitCloneDialog } from '@/components/git/GitCloneDialog'
import { GitRemoteManager } from '@/components/git/GitRemoteManager'
import { LoadingState } from '@/components/LoadingState'
import { useSession } from '@/hooks/queries/useSession'

type Tab = 'status' | 'history' | 'branches' | 'remotes'

export default function GitPage() {
  const { sessionId } = useParams({ from: '/sessions/$sessionId/git' })
  const navigate = useNavigate()
  const { api } = useAppContext()
  const { session, isLoading } = useSession(api, sessionId)
  const [activeTab, setActiveTab] = useState<Tab>('status')
  const [cloneOpen, setCloneOpen] = useState(false)
  const [pushPullLoading, setPushPullLoading] = useState(false)
  const [pushPullError, setPushPullError] = useState('')

  if (isLoading) return <LoadingState label="Loading..." />
  if (!session) {
    return (
      <div className="p-4">
        <p className="text-sm" style={{ color: 'var(--hp-danger)' }}>Session not found</p>
        <button onClick={() => navigate({ to: '/sessions' })} className="text-xs mt-2 underline">Back to sessions</button>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'status', label: 'Status' },
    { id: 'history', label: 'History' },
    { id: 'branches', label: 'Branches' },
    { id: 'remotes', label: 'Remotes' },
  ]

  async function handlePull() {
    setPushPullLoading(true)
    setPushPullError('')
    try {
      const result = await api.gitPull(sessionId, {})
      if (!result.success) {
        setPushPullError(result.stderr ?? result.error ?? 'Pull failed')
      }
    } catch (err) {
      setPushPullError(err instanceof Error ? err.message : 'Pull failed')
    } finally {
      setPushPullLoading(false)
    }
  }

  async function handlePush() {
    setPushPullLoading(true)
    setPushPullError('')
    try {
      const result = await api.gitPush(sessionId, {})
      if (!result.success) {
        setPushPullError(result.stderr ?? result.error ?? 'Push failed')
      }
    } catch (err) {
      setPushPullError(err instanceof Error ? err.message : 'Push failed')
    } finally {
      setPushPullLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--hp-surface-0)' }}>
      <div className="flex items-center gap-3 px-4 h-12 border-b shrink-0" style={{ borderColor: 'var(--hp-border)' }}>
        <button onClick={() => navigate({ to: '/sessions/$sessionId', params: { sessionId } })}
          className="text-sm" style={{ color: 'var(--hp-text-tertiary)' }}>←</button>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--hp-text-primary)' }}>Git</h2>
        <span className="text-xs font-mono" style={{ color: 'var(--hp-text-tertiary)' }}>{sessionId.slice(0, 8)}</span>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handlePull}
            disabled={pushPullLoading}
            className="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--hp-surface-1)]"
            style={{ color: 'var(--hp-text-tertiary)' }}
          >
            Pull
          </button>
          <button
            onClick={handlePush}
            disabled={pushPullLoading}
            className="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--hp-surface-1)]"
            style={{ color: 'var(--hp-text-tertiary)' }}
          >
            Push
          </button>
          <button
            onClick={() => setCloneOpen(true)}
            className="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--hp-surface-1)]"
            style={{ color: 'var(--hp-accent)' }}
          >
            Clone
          </button>
        </div>
      </div>

      {pushPullError && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border-b" style={{ borderColor: 'var(--hp-border)' }}>
          {pushPullError}
        </div>
      )}

      <div className="flex border-b shrink-0" style={{ borderColor: 'var(--hp-border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-2 text-sm text-center border-b-2 transition-colors"
            style={{
              borderColor: activeTab === tab.id ? 'var(--hp-primary)' : 'transparent',
              color: activeTab === tab.id ? 'var(--hp-primary)' : 'var(--hp-text-tertiary)',
              fontWeight: activeTab === tab.id ? 500 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'status' && <GitStatusPanel sessionId={sessionId} />}
        {activeTab === 'history' && <GitHistory sessionId={sessionId} />}
        {activeTab === 'branches' && <GitBranchManager sessionId={sessionId} />}
        {activeTab === 'remotes' && <GitRemoteManager sessionId={sessionId} />}
      </div>

      <GitCloneDialog
        isOpen={cloneOpen}
        onClose={() => setCloneOpen(false)}
        sessionId={sessionId}
      />
    </div>
  )
}
