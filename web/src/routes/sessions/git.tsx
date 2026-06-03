import { useState, useCallback } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { useToast } from '@/lib/toast-context'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { encodeBase64 } from '@/lib/utils'
import { GitStatusPanel } from '@/components/git/GitStatusPanel'
import { GitHistory } from '@/components/git/GitHistory'
import { GitBranchManager } from '@/components/git/GitBranchManager'
import { GitCloneDialog } from '@/components/git/GitCloneDialog'
import { GitRemoteManager } from '@/components/git/GitRemoteManager'
import { GitPushDialog } from '@/components/git/GitPushDialog'
import { GitPullDialog } from '@/components/git/GitPullDialog'
import { GitCommitDialog } from '@/components/git/GitCommitDialog'
import { LoadingState } from '@/components/LoadingState'
import { SubPageLayout } from '@/components/ui/SubPageLayout'
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
  const { addToast } = useToast()
  const { copy } = useCopyToClipboard()
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

  const handleViewDiff = useCallback((path: string) => {
    navigate({ to: '/sessions/$sessionId/file', params: { sessionId }, search: { path: encodeBase64(path) } })
  }, [navigate, sessionId])

  const handleCopyPath = useCallback((path: string) => {
    const basePath = session?.metadata?.path || ''
    const fullPath = basePath ? `${basePath}/${path}` : path
    copy(fullPath).then((ok) => {
      if (ok) addToast({ title: t('git.context.copyPathSuccess'), body: '' })
    })
  }, [session?.metadata?.path, copy, addToast, t])

  const handleOpenFile = useCallback((path: string) => {
    navigate({ to: '/sessions/$sessionId/file', params: { sessionId }, search: { path: encodeBase64(path) } })
  }, [navigate, sessionId])

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
        <p className="text-sm text-[var(--app-danger)]">{t('git.sessionNotFound')}</p>
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
    <>
      <SubPageLayout
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as Tab)}
        toolbar={
          <>
            <div className="flex items-center gap-1">
              <button
                onClick={handleFetch}
                disabled={fetching}
                className="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--app-secondary-bg)] disabled:opacity-50 text-[var(--app-hint)]"
              >
                {fetching ? t('git.fetch.fetching') : t('git.fetch')}
              </button>
              <button
                onClick={() => { setPushPullError(''); setPullOpen(true) }}
                className="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--app-secondary-bg)] text-[var(--app-hint)]"
              >
                {t('git.pull')}
              </button>
              <button
                onClick={() => { setPushPullError(''); setPushOpen(true) }}
                className="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--app-secondary-bg)] text-[var(--app-hint)]"
              >
                {t('git.push')}
              </button>
              <button
                onClick={() => setCommitOpen(true)}
                disabled={changedFiles.length === 0}
                className="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--app-secondary-bg)] disabled:opacity-50 text-[var(--app-link)]"
              >
                {t('git.commit')}
              </button>
              <button
                onClick={() => setCloneOpen(true)}
                className="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--app-secondary-bg)] text-[var(--app-link)]"
              >
                {t('git.clone')}
              </button>
            </div>
            {(pushPullError || fetchResult) && (
              <div className={`text-xs mt-1 ${fetchResult?.ok ? 'text-green-400' : 'text-red-400'}`}>
                {pushPullError || fetchResult?.msg}
              </div>
            )}
          </>
        }
      >
        {activeTab === 'status' && <GitStatusPanel sessionId={sessionId} onStatusLoaded={handleStatusLoaded} onFilesChanged={handleFilesChanged} onViewDiff={handleViewDiff} onCopyPath={handleCopyPath} onOpenFile={handleOpenFile} />}
        {activeTab === 'history' && <GitHistory sessionId={sessionId} />}
        {activeTab === 'branches' && <GitBranchManager sessionId={sessionId} />}
        {activeTab === 'remotes' && <GitRemoteManager sessionId={sessionId} onRemotesLoaded={handleRemotesLoaded} />}
      </SubPageLayout>

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
    </>
  )
}
