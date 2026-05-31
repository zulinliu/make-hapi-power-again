import { useState, useCallback } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { GitStatusPanel } from '@/components/git/GitStatusPanel'
import { GitHistory } from '@/components/git/GitHistory'
import { GitBranchManager } from '@/components/git/GitBranchManager'
import { GitCloneDialog } from '@/components/git/GitCloneDialog'
import { GitRemoteManager } from '@/components/git/GitRemoteManager'
import { GitPushDialog } from '@/components/git/GitPushDialog'
import { GitPullDialog } from '@/components/git/GitPullDialog'
import { GitCommitDialog } from '@/components/git/GitCommitDialog'
import { LoadingState } from '@/components/LoadingState'
import { useSession } from '@/hooks/queries/useSession'

type Tab = 'status' | 'history' | 'branches' | 'remotes'

interface GitFile {
  status: string
  path: string
}

export default function GitPage() {
  const { sessionId } = useParams({ from: '/sessions/$sessionId/git' })
  const navigate = useNavigate()
  const { api } = useAppContext()
  const { t } = useTranslation()
  const { session, isLoading } = useSession(api, sessionId)
  const [activeTab, setActiveTab] = useState<Tab>('status')
  const [cloneOpen, setCloneOpen] = useState(false)
  const [pushOpen, setPushOpen] = useState(false)
  const [pullOpen, setPullOpen] = useState(false)
  const [commitOpen, setCommitOpen] = useState(false)
  const [pushPullError, setPushPullError] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const [currentBranch, setCurrentBranch] = useState('')
  const [remotes, setRemotes] = useState<{ name: string; url: string }[]>([])
  const [changedFiles, setChangedFiles] = useState<GitFile[]>([])

  const handleStatusLoaded = useCallback((branch: string) => {
    setCurrentBranch(branch)
  }, [])

  const handleFilesChanged = useCallback((files: GitFile[]) => {
    setChangedFiles(files)
  }, [])

  const handleRemotesLoaded = useCallback((remoteList: { name: string; url: string }[]) => {
    setRemotes(remoteList)
  }, [])

  const handleFetch = async () => {
    if (!api) return
    setFetching(true)
    setFetchResult(null)
    try {
      const res = await api.gitFetch(sessionId, {})
      if (res.success) {
        const output = (res.stdout || '').trim()
        setFetchResult({
          ok: true,
          msg: output || t('git.fetch.noChanges'),
        })
      } else {
        setFetchResult({ ok: false, msg: res.stderr || res.error || 'Fetch failed' })
      }
    } catch (err) {
      setFetchResult({ ok: false, msg: err instanceof Error ? err.message : 'Fetch failed' })
    } finally {
      setFetching(false)
      setTimeout(() => setFetchResult(null), 4000)
    }
  }

  if (isLoading) return <LoadingState label={t('loading')} />
  if (!session) {
    return (
      <div className="p-4">
        <p className="text-sm" style={{ color: 'var(--hp-danger)' }}>{t('git.sessionNotFound')}</p>
        <button onClick={() => navigate({ to: '/sessions' })} className="text-xs mt-2 underline">{t('git.backToSessions')}</button>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'status', label: t('git.tab.status') },
    { id: 'history', label: t('git.tab.history') },
    { id: 'branches', label: t('git.tab.branches') },
    { id: 'remotes', label: t('git.tab.remotes') },
  ]

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--hp-surface-0)' }}>
      <div className="flex items-center gap-3 px-4 h-12 border-b shrink-0" style={{ borderColor: 'var(--hp-border)' }}>
        <button onClick={() => navigate({ to: '/sessions/$sessionId', params: { sessionId } })}
          className="text-sm" style={{ color: 'var(--hp-text-tertiary)' }}>←</button>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--hp-text-primary)' }}>{t('git.title')}</h2>
        <span className="text-xs font-mono" style={{ color: 'var(--hp-text-tertiary)' }}>{sessionId.slice(0, 8)}</span>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleFetch}
            disabled={fetching}
            className="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--hp-surface-1)] disabled:opacity-50"
            style={{ color: 'var(--hp-text-tertiary)' }}
          >
            {fetching ? t('git.fetch.fetching') : t('git.fetch')}
          </button>
          <button
            onClick={() => { setPushPullError(''); setPullOpen(true) }}
            className="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--hp-surface-1)]"
            style={{ color: 'var(--hp-text-tertiary)' }}
          >
            {t('git.pull')}
          </button>
          <button
            onClick={() => { setPushPullError(''); setPushOpen(true) }}
            className="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--hp-surface-1)]"
            style={{ color: 'var(--hp-text-tertiary)' }}
          >
            {t('git.push')}
          </button>
          <button
            onClick={() => setCommitOpen(true)}
            disabled={changedFiles.length === 0}
            className="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--hp-surface-1)] disabled:opacity-50"
            style={{ color: 'var(--hp-primary)' }}
          >
            {t('git.commit')}
          </button>
          <button
            onClick={() => setCloneOpen(true)}
            className="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--hp-surface-1)]"
            style={{ color: 'var(--hp-accent)' }}
          >
            {t('git.clone')}
          </button>
        </div>
      </div>

      {(pushPullError || fetchResult) && (
        <div className={`px-4 py-2 text-xs border-b ${fetchResult?.ok ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`} style={{ borderColor: 'var(--hp-border)' }}>
          {pushPullError || fetchResult?.msg}
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
        {activeTab === 'status' && <GitStatusPanel sessionId={sessionId} onStatusLoaded={handleStatusLoaded} onFilesChanged={handleFilesChanged} />}
        {activeTab === 'history' && <GitHistory sessionId={sessionId} />}
        {activeTab === 'branches' && <GitBranchManager sessionId={sessionId} />}
        {activeTab === 'remotes' && <GitRemoteManager sessionId={sessionId} onRemotesLoaded={handleRemotesLoaded} />}
      </div>

      <GitCloneDialog
        isOpen={cloneOpen}
        onClose={() => setCloneOpen(false)}
        sessionId={sessionId}
      />
      <GitPushDialog
        isOpen={pushOpen}
        onClose={() => setPushOpen(false)}
        sessionId={sessionId}
        currentBranch={currentBranch}
        remotes={remotes}
        onPushComplete={() => setActiveTab('status')}
      />
      <GitPullDialog
        isOpen={pullOpen}
        onClose={() => setPullOpen(false)}
        sessionId={sessionId}
        currentBranch={currentBranch}
        remotes={remotes}
        onPullComplete={() => setActiveTab('status')}
      />
      <GitCommitDialog
        isOpen={commitOpen}
        onClose={() => setCommitOpen(false)}
        sessionId={sessionId}
        files={changedFiles}
        onCommitComplete={() => setActiveTab('status')}
      />
    </div>
  )
}
