import { useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'
import { GitStatusPanel } from '@/components/git/GitStatusPanel'
import { GitHistory } from '@/components/git/GitHistory'
import { GitBranchManager } from '@/components/git/GitBranchManager'
import { LoadingState } from '@/components/LoadingState'
import { useSession } from '@/hooks/queries/useSession'

type Tab = 'status' | 'history' | 'branches'

export default function GitPage() {
  const { sessionId } = useParams({ from: '/sessions/$sessionId/git' })
  const navigate = useNavigate()
  const { api } = useAppContext()
  const { session, isLoading } = useSession(api, sessionId)
  const [activeTab, setActiveTab] = useState<Tab>('status')

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
  ]

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--hp-surface-0)' }}>
      <div className="flex items-center gap-3 px-4 h-12 border-b shrink-0" style={{ borderColor: 'var(--hp-border)' }}>
        <button onClick={() => navigate({ to: '/sessions/$sessionId', params: { sessionId } })}
          className="text-sm" style={{ color: 'var(--hp-text-tertiary)' }}>←</button>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--hp-text-primary)' }}>Git</h2>
        <span className="text-xs font-mono" style={{ color: 'var(--hp-text-tertiary)' }}>{sessionId.slice(0, 8)}</span>
      </div>

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
      </div>
    </div>
  )
}
