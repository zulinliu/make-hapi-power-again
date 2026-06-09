import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import type { GitAtlasChange, GitAtlasDashboardResponse, GitAtlasDiffResponse, GitSyncAction } from '@/types/api'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { useToast } from '@/lib/toast-context'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { encodeBase64 } from '@/lib/utils'
import {
  buildGitAtlasSyncRequest,
  getChangeStatusKey,
  getDefaultBasketPaths,
  getGitAtlasRecommendationKeys,
  getPrimaryBranch,
  getPrimaryRemote,
  isForcePushConfirmed,
  toggleBasketPath,
} from '@/lib/git-atlas'
import { GitHistory } from '@/components/git/GitHistory'
import { GitBranchManager } from '@/components/git/GitBranchManager'
import { GitCloneDialog } from '@/components/git/GitCloneDialog'
import { GitRemoteManager } from '@/components/git/GitRemoteManager'
import { LoadingState } from '@/components/LoadingState'
import { SubPageLayout } from '@/components/ui/SubPageLayout'
import { useSession } from '@/hooks/queries/useSession'

type SyncPhase = 'idle' | 'running' | 'done' | 'error'

const PATH_LABEL_LIMIT = 72
const DIFF_CHUNK_LINES = 180

const EMPTY_SUMMARY = {
  totalChanges: 0,
  staged: 0,
  unstaged: 0,
  untracked: 0,
  conflicted: 0,
  linesAdded: 0,
  linesRemoved: 0,
}

function getStageLabelKey(stage: GitAtlasChange['stage']): string {
  return `gitAtlas.stage.${stage}`
}

function isDiffStaged(change: GitAtlasChange): boolean {
  return change.stage === 'staged'
}

function formatLineDelta(change: GitAtlasChange): string {
  if (change.binary) return 'bin'
  return `+${change.linesAdded} / -${change.linesRemoved}`
}

function formatPathLabel(path: string, expanded: boolean): string {
  if (expanded || path.length <= PATH_LABEL_LIMIT) return path
  const keep = Math.floor((PATH_LABEL_LIMIT - 3) / 2)
  return `${path.slice(0, keep)}...${path.slice(-keep)}`
}

function chunkDiff(diffText: string | undefined): string[] {
  if (!diffText) return []
  const lines = diffText.split('\n')
  const chunks: string[] = []
  for (let index = 0; index < lines.length; index += DIFF_CHUNK_LINES) {
    chunks.push(lines.slice(index, index + DIFF_CHUNK_LINES).join('\n'))
  }
  return chunks
}

function getStatusTone(change: GitAtlasChange): string {
  if (change.status === 'conflicted') return 'text-[var(--hp-danger)] bg-[var(--hp-danger-subtle)]'
  if (change.status === 'added') return 'text-[var(--hp-success)] bg-[var(--hp-success-subtle)]'
  if (change.status === 'deleted') return 'text-[var(--hp-danger)] bg-[var(--hp-danger-subtle)]'
  if (change.status === 'renamed') return 'text-[var(--hp-info)] bg-[var(--hp-info-subtle)]'
  if (change.status === 'untracked') return 'text-[var(--hp-text-secondary)] bg-[var(--hp-surface-2)]'
  return 'text-[var(--hp-warning)] bg-[var(--hp-warning-subtle)]'
}

export default function GitPage() {
  const { sessionId } = useParams({ from: '/sessions/$sessionId/git' })
  const navigate = useNavigate()
  const { api } = useAppContext()
  const { t } = useTranslation()
  const { session, isLoading } = useSession(api, sessionId)
  const { addToast } = useToast()
  const { copy } = useCopyToClipboard()

  const [dashboard, setDashboard] = useState<GitAtlasDashboardResponse | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [basketPaths, setBasketPaths] = useState<string[]>([])
  const [commitMessage, setCommitMessage] = useState('')
  const [commitPhase, setCommitPhase] = useState<SyncPhase>('idle')
  const [commitError, setCommitError] = useState('')
  const [diff, setDiff] = useState<GitAtlasDiffResponse | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState('')
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle')
  const [syncMessage, setSyncMessage] = useState('')
  const [forcePush, setForcePush] = useState(false)
  const [forceConfirmation, setForceConfirmation] = useState('')
  const [cloneOpen, setCloneOpen] = useState(false)
  const changeMapRef = useRef<HTMLElement | null>(null)
  const basketRef = useRef<HTMLElement | null>(null)
  const syncRef = useRef<HTMLElement | null>(null)
  const commitMessageRef = useRef<HTMLTextAreaElement | null>(null)

  const changes = dashboard?.changes ?? []
  const summary = dashboard?.summary ?? EMPTY_SUMMARY
  const selectedChange = changes.find(change => change.path === selectedPath) ?? changes[0] ?? null
  const branch = getPrimaryBranch(dashboard)
  const remote = getPrimaryRemote(dashboard)
  const recommendationKind = dashboard?.recommendation?.kind ?? 'clean'
  const recommendationKeys = getGitAtlasRecommendationKeys(recommendationKind)
  const syncLocked = dashboard?.sync?.inFlight === true || syncPhase === 'running'
  const canForcePush = isForcePushConfirmed(branch, forceConfirmation)
  const diffChunks = useMemo(() => chunkDiff(diff?.diff), [diff?.diff])
  const recommendationActionDisabled =
    (recommendationKind === 'push' || recommendationKind === 'pull')
      ? syncLocked || !dashboard?.repo?.isRepo || !remote
      : recommendationKind === 'commit'
        ? basketPaths.length === 0
        : recommendationKind === 'review' || recommendationKind === 'resolve-conflicts'
          ? changes.length === 0
          : recommendationKind === 'clean'
            ? dashboardLoading
            : false

  const refreshDashboard = useCallback(async () => {
    setDashboardLoading(true)
    setDashboardError('')
    try {
      const response = await api.getGitDashboard(sessionId)
      if (!response.success) {
        setDashboardError(response.error ?? t('gitAtlas.error.dashboard'))
        return
      }
      setDashboard(response)
      setBasketPaths(getDefaultBasketPaths(response.changes ?? []))
      const nextSelected = response.changes?.[0]?.path ?? null
      setSelectedPath(nextSelected)
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : t('gitAtlas.error.dashboard'))
    } finally {
      setDashboardLoading(false)
    }
  }, [api, sessionId, t])

  useEffect(() => {
    void refreshDashboard()
  }, [refreshDashboard])

  useEffect(() => {
    if (!selectedChange) {
      setDiff(null)
      setDiffError('')
      return
    }

    let cancelled = false
    async function loadDiff() {
      setDiffLoading(true)
      setDiffError('')
      try {
        const response = await api.getGitAtlasDiff(sessionId, selectedChange.path, isDiffStaged(selectedChange))
        if (cancelled) return
        if (response.success) {
          setDiff(response)
        } else {
          setDiff(null)
          setDiffError(response.error ?? t('gitAtlas.error.diff'))
        }
      } catch (error) {
        if (!cancelled) {
          setDiff(null)
          setDiffError(error instanceof Error ? error.message : t('gitAtlas.error.diff'))
        }
      } finally {
        if (!cancelled) setDiffLoading(false)
      }
    }

    void loadDiff()
    return () => {
      cancelled = true
    }
  }, [api, selectedChange, sessionId, t])

  const basketSet = useMemo(() => new Set(basketPaths), [basketPaths])
  const selectedBasketChanges = useMemo(
    () => changes.filter(change => basketSet.has(change.path)),
    [basketSet, changes]
  )

  const handleOpenFile = useCallback((path: string) => {
    navigate({ to: '/sessions/$sessionId/file', params: { sessionId }, search: { path: encodeBase64(path) } })
  }, [navigate, sessionId])

  const handleCopyPath = useCallback((path: string) => {
    const basePath = session?.metadata?.path || ''
    const fullPath = basePath ? `${basePath}/${path}` : path
    copy(fullPath).then((ok) => {
      if (ok) addToast({ title: t('git.context.copyPathSuccess'), body: '' })
    })
  }, [addToast, copy, session?.metadata?.path, t])

  async function handleCommitBasket() {
    if (basketPaths.length === 0 || !commitMessage.trim()) return
    setCommitPhase('running')
    setCommitError('')
    try {
      const result = await api.createGitCommitBasket(sessionId, commitMessage.trim(), basketPaths)
      if (result.success) {
        setCommitPhase('done')
        setCommitMessage('')
        addToast({ title: t('gitAtlas.basket.commitSuccess'), body: '' })
        await refreshDashboard()
      } else {
        setCommitPhase('error')
        setCommitError(result.stderr || result.error || t('gitAtlas.error.commit'))
      }
    } catch (error) {
      setCommitPhase('error')
      setCommitError(error instanceof Error ? error.message : t('gitAtlas.error.commit'))
    }
  }

  async function handleSync(action: GitSyncAction) {
    if (action === 'push' && forcePush && !canForcePush) return
    setSyncPhase('running')
    setSyncMessage('')
    try {
      const request = buildGitAtlasSyncRequest(action, dashboard, {
        force: action === 'push' && forcePush,
        confirmation: action === 'push' && forcePush ? forceConfirmation : undefined,
      })
      const response = await api.gitSync(sessionId, request)
      if (response.success) {
        const output = (response.stdout || response.stderr || '').trim()
        setSyncPhase('done')
        setSyncMessage(output || t(`gitAtlas.sync.${action}Success`))
        setForcePush(false)
        setForceConfirmation('')
        await refreshDashboard()
      } else {
        setSyncPhase('error')
        setSyncMessage(response.stderr || response.error || t('gitAtlas.error.sync'))
      }
    } catch (error) {
      setSyncPhase('error')
      setSyncMessage(error instanceof Error ? error.message : t('gitAtlas.error.sync'))
    }
  }

  function scrollToSection(ref: RefObject<HTMLElement | null>) {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    ref.current?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
  }

  function handleRecommendationAction() {
    if (recommendationActionDisabled) return
    if (recommendationKind === 'clone') {
      setCloneOpen(true)
      return
    }
    if (recommendationKind === 'pull') {
      void handleSync('pull')
      return
    }
    if (recommendationKind === 'push') {
      void handleSync('push')
      return
    }
    if (recommendationKind === 'commit') {
      scrollToSection(basketRef)
      commitMessageRef.current?.focus()
      return
    }
    if (recommendationKind === 'resolve-conflicts') {
      const conflict = changes.find(change => change.status === 'conflicted')
      if (conflict) setSelectedPath(conflict.path)
      scrollToSection(changeMapRef)
      return
    }
    if (recommendationKind === 'review') {
      scrollToSection(changeMapRef)
      return
    }
    void refreshDashboard()
  }

  if (isLoading) return <LoadingState label={t('loading')} />
  if (!session) {
    return (
      <div className="p-4">
        <p className="text-sm text-[var(--app-danger)]">{t('git.sessionNotFound')}</p>
        <button onClick={() => navigate({ to: '/sessions' })} className="mt-2 text-xs underline">{t('git.backToSessions')}</button>
      </div>
    )
  }

  return (
    <>
      <SubPageLayout
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--hp-text-primary)]">{t('gitAtlas.title')}</div>
              <div className="truncate text-xs text-[var(--hp-text-secondary)]">{session.metadata?.path ?? t('gitAtlas.unknownPath')}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void refreshDashboard()}
                disabled={dashboardLoading}
                className="min-h-11 rounded-[var(--hp-radius-sm)] border border-[var(--hp-border)] px-3 text-sm text-[var(--hp-text-primary)] hover:bg-[var(--hp-surface-1)] disabled:opacity-50 sm:min-h-9"
              >
                {dashboardLoading ? t('gitAtlas.refreshing') : t('gitAtlas.refresh')}
              </button>
              <button
                type="button"
                onClick={() => setCloneOpen(true)}
                className="min-h-11 rounded-[var(--hp-radius-sm)] bg-[var(--hp-primary)] px-3 text-sm font-medium text-[var(--hp-primary-text)] hover:bg-[var(--hp-primary-hover)] sm:min-h-9"
              >
                {t('git.clone')}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4">
          {dashboardError && (
            <div className="rounded-[var(--hp-radius-md)] border border-[var(--hp-danger)] bg-[var(--hp-danger-subtle)] px-3 py-2 text-sm text-[var(--hp-danger)]">
              {dashboardError}
            </div>
          )}

          <section className="rounded-[var(--hp-radius-lg)] border border-[var(--hp-border)] bg-[var(--hp-surface-0)] p-4 shadow-[var(--hp-shadow-sm)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-[var(--hp-radius-full)] bg-[var(--hp-primary-subtle)] px-3 py-1 text-xs font-semibold text-[var(--hp-primary-readable)]">
                    {dashboard?.repo?.isRepo ? t('gitAtlas.repoDetected') : t('gitAtlas.repoMissing')}
                  </span>
                  {remote && (
                    <span className="rounded-[var(--hp-radius-full)] bg-[var(--hp-surface-2)] px-3 py-1 text-xs text-[var(--hp-text-secondary)]">
                      {remote}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-semibold tracking-normal text-[var(--hp-text-primary)]">
                  {branch || t('gitAtlas.detached')}
                </h1>
                <p className="max-w-[70ch] text-sm leading-6 text-[var(--hp-text-secondary)]">
                  {t(recommendationKeys.label)}: {t(recommendationKeys.description)}
                </p>
                <button
                  type="button"
                  onClick={handleRecommendationAction}
                  disabled={recommendationActionDisabled}
                  className="min-h-11 rounded-[var(--hp-radius-md)] bg-[var(--hp-primary)] px-4 text-sm font-semibold text-[var(--hp-primary-text)] hover:bg-[var(--hp-primary-hover)] disabled:opacity-50 sm:min-h-9"
                >
                  {t(recommendationKeys.label)}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[420px]">
                <Metric label={t('gitAtlas.metric.changes')} value={`${summary.totalChanges}`} />
                <Metric label={t('gitAtlas.metric.ahead')} value={`${dashboard?.repo?.ahead ?? 0}`} />
                <Metric label={t('gitAtlas.metric.behind')} value={`${dashboard?.repo?.behind ?? 0}`} />
                <Metric label={t('gitAtlas.metric.conflicts')} value={`${summary.conflicted}`} tone={summary.conflicted > 0 ? 'danger' : 'default'} />
              </div>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
            <section ref={changeMapRef} className="min-w-0 rounded-[var(--hp-radius-lg)] border border-[var(--hp-border)] bg-[var(--hp-surface-0)] shadow-[var(--hp-shadow-sm)]">
              <div className="flex flex-col gap-3 border-b border-[var(--hp-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[var(--hp-text-primary)]">{t('gitAtlas.changeMap.title')}</h2>
                  <p className="text-sm text-[var(--hp-text-secondary)]">{t('gitAtlas.changeMap.subtitle', { count: changes.length })}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-[var(--hp-text-secondary)]">
                  <span>{t('gitAtlas.summary.staged', { count: summary.staged })}</span>
                  <span>{t('gitAtlas.summary.unstaged', { count: summary.unstaged })}</span>
                  <span>{t('gitAtlas.summary.untracked', { count: summary.untracked })}</span>
                </div>
              </div>

              {changes.length === 0 ? (
                <div className="p-6 text-sm text-[var(--hp-text-secondary)]">{t('gitAtlas.changeMap.empty')}</div>
              ) : (
                <div className="divide-y divide-[var(--hp-border)]">
                  {changes.map((change) => {
                    const selected = selectedChange?.path === change.path
                    return (
                      <div
                        key={change.path}
                        className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        style={{ background: selected ? 'var(--hp-primary-subtle)' : 'transparent' }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedPath(change.path)}
                          className="flex min-h-11 min-w-0 flex-col justify-center rounded-[var(--hp-radius-sm)] text-left outline-none focus:ring-2 focus:ring-[var(--hp-primary)]"
                          aria-label={t('gitAtlas.changeMap.selectFile', { path: change.path })}
                          title={change.path}
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className={`rounded-[var(--hp-radius-xs)] px-2 py-1 text-xs font-semibold ${getStatusTone(change)}`}>
                              {t(getChangeStatusKey(change))}
                            </span>
                            <span className="rounded-[var(--hp-radius-xs)] bg-[var(--hp-surface-2)] px-2 py-1 text-xs text-[var(--hp-text-secondary)]">
                              {t(getStageLabelKey(change.stage))}
                            </span>
                            <span className="text-xs font-mono text-[var(--hp-text-secondary)]">{formatLineDelta(change)}</span>
                          </div>
                          <div className={`mt-2 font-mono text-sm text-[var(--hp-text-primary)] ${selected ? 'break-all whitespace-normal' : 'truncate'}`}>
                            {formatPathLabel(change.path, selected)}
                          </div>
                          {change.oldPath && (
                            <div className="mt-1 truncate font-mono text-xs text-[var(--hp-text-secondary)]">
                              {t('gitAtlas.changeMap.renamedFrom', { path: change.oldPath })}
                            </div>
                          )}
                        </button>

                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <label className="flex min-h-11 items-center gap-2 rounded-[var(--hp-radius-sm)] border border-[var(--hp-border)] px-3 text-sm text-[var(--hp-text-primary)] sm:min-h-9">
                            <input
                              type="checkbox"
                              checked={basketSet.has(change.path)}
                              disabled={!change.selectable}
                              onChange={() => setBasketPaths(prev => toggleBasketPath(prev, change.path))}
                            />
                            {t('gitAtlas.basket.include')}
                          </label>
                          <button
                            type="button"
                            onClick={() => handleOpenFile(change.path)}
                            className="min-h-11 rounded-[var(--hp-radius-sm)] border border-[var(--hp-border)] px-3 text-sm text-[var(--hp-text-primary)] hover:bg-[var(--hp-surface-1)] sm:min-h-9"
                          >
                            {t('gitAtlas.openFile')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyPath(change.path)}
                            className="min-h-11 rounded-[var(--hp-radius-sm)] border border-[var(--hp-border)] px-3 text-sm text-[var(--hp-text-secondary)] hover:bg-[var(--hp-surface-1)] sm:min-h-9"
                          >
                            {t('button.copy')}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <div className="min-w-0 space-y-4">
              <section className="rounded-[var(--hp-radius-lg)] border border-[var(--hp-border)] bg-[var(--hp-surface-0)] shadow-[var(--hp-shadow-sm)]">
                <div className="border-b border-[var(--hp-border)] p-4">
                  <h2 className="text-base font-semibold text-[var(--hp-text-primary)]">{t('gitAtlas.diff.title')}</h2>
                  <p className="truncate text-sm text-[var(--hp-text-secondary)]" title={selectedChange?.path ?? undefined}>
                    {selectedChange?.path ? formatPathLabel(selectedChange.path, false) : t('gitAtlas.diff.empty')}
                  </p>
                </div>
                <div className="p-4">
                  {diffLoading ? (
                    <div className="h-40 rounded-[var(--hp-radius-md)] bg-[var(--hp-surface-1)] p-4 text-sm text-[var(--hp-text-secondary)]">{t('gitAtlas.diff.loading')}</div>
                  ) : diffError ? (
                    <div className="rounded-[var(--hp-radius-md)] bg-[var(--hp-danger-subtle)] p-3 text-sm text-[var(--hp-danger)]">{diffError}</div>
                  ) : diff?.binary ? (
                    <div className="rounded-[var(--hp-radius-md)] bg-[var(--hp-surface-1)] p-4 text-sm text-[var(--hp-text-secondary)]">{t('gitAtlas.diff.binary')}</div>
                  ) : diff?.diff ? (
                    <div className="space-y-2">
                      {(diff.truncated || diff.tooLarge) && (
                        <div className="rounded-[var(--hp-radius-sm)] bg-[var(--hp-warning-subtle)] p-2 text-xs text-[var(--hp-warning)]">
                          {t('gitAtlas.diff.truncated')}
                        </div>
                      )}
                      <div className="max-h-[min(60vh,520px)] overflow-auto rounded-[var(--hp-radius-md)] bg-[var(--hp-surface-1)]">
                        {diffChunks.map((chunk, index) => (
                          <pre key={index} className="border-b border-[var(--hp-border)] p-3 text-xs leading-5 text-[var(--hp-text-primary)] last:border-b-0">
                            {chunk}
                          </pre>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[var(--hp-radius-md)] bg-[var(--hp-surface-1)] p-4 text-sm text-[var(--hp-text-secondary)]">{t('gitAtlas.diff.noDiff')}</div>
                  )}
                </div>
              </section>

              <section ref={basketRef} className="rounded-[var(--hp-radius-lg)] border border-[var(--hp-border)] bg-[var(--hp-surface-0)] p-4 shadow-[var(--hp-shadow-sm)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--hp-text-primary)]">{t('gitAtlas.basket.title')}</h2>
                    <p className="text-sm text-[var(--hp-text-secondary)]">{t('gitAtlas.basket.selected', { count: basketPaths.length })}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBasketPaths(getDefaultBasketPaths(changes))}
                    className="min-h-11 rounded-[var(--hp-radius-sm)] border border-[var(--hp-border)] px-3 text-sm text-[var(--hp-text-primary)] hover:bg-[var(--hp-surface-1)] sm:min-h-9"
                  >
                    {t('gitAtlas.basket.selectAll')}
                  </button>
                </div>
                <div className="mt-3 max-h-32 overflow-auto rounded-[var(--hp-radius-md)] bg-[var(--hp-surface-1)] p-2">
                  {selectedBasketChanges.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-[var(--hp-text-secondary)]">{t('gitAtlas.basket.empty')}</div>
                  ) : selectedBasketChanges.map(change => (
                    <div key={change.path} className="truncate px-2 py-1 font-mono text-xs text-[var(--hp-text-primary)]" title={change.path}>
                      {formatPathLabel(change.path, false)}
                    </div>
                  ))}
                </div>
                <textarea
                  ref={commitMessageRef}
                  value={commitMessage}
                  onChange={(event) => {
                    setCommitMessage(event.target.value)
                    setCommitPhase('idle')
                  }}
                  placeholder={t('git.commit.messagePlaceholder')}
                  rows={3}
                  className="mt-3 min-h-24 w-full resize-none rounded-[var(--hp-radius-md)] border border-[var(--hp-border)] bg-[var(--hp-surface-0)] px-3 py-2 text-base text-[var(--hp-text-primary)] outline-none focus:ring-2 focus:ring-[var(--hp-primary)]"
                />
                {commitError && (
                  <div className="mt-2 rounded-[var(--hp-radius-sm)] bg-[var(--hp-danger-subtle)] p-2 text-sm text-[var(--hp-danger)]">{commitError}</div>
                )}
                <button
                  type="button"
                  onClick={() => void handleCommitBasket()}
                  disabled={commitPhase === 'running' || basketPaths.length === 0 || !commitMessage.trim()}
                  className="mt-3 min-h-11 w-full rounded-[var(--hp-radius-md)] bg-[var(--hp-primary)] px-4 text-sm font-semibold text-[var(--hp-primary-text)] hover:bg-[var(--hp-primary-hover)] disabled:opacity-50"
                >
                  {commitPhase === 'running' ? t('git.commit.committing') : t('gitAtlas.basket.commitSelected')}
                </button>
              </section>

              <section ref={syncRef} className="rounded-[var(--hp-radius-lg)] border border-[var(--hp-border)] bg-[var(--hp-surface-0)] p-4 shadow-[var(--hp-shadow-sm)]">
                <h2 className="text-base font-semibold text-[var(--hp-text-primary)]">{t('gitAtlas.sync.title')}</h2>
                <p className="mt-1 text-sm text-[var(--hp-text-secondary)]">
                  {t('gitAtlas.sync.remoteBranch', { remote: remote || t('gitAtlas.none'), branch: branch || t('gitAtlas.detached') })}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(['fetch', 'pull', 'push'] as const).map(action => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => void handleSync(action)}
                      disabled={syncLocked || !dashboard?.repo?.isRepo || (action !== 'fetch' && !remote) || (action === 'push' && forcePush)}
                      className="min-h-11 rounded-[var(--hp-radius-sm)] border border-[var(--hp-border)] px-3 text-sm font-medium text-[var(--hp-text-primary)] hover:bg-[var(--hp-surface-1)] disabled:opacity-50"
                    >
                      {t(`gitAtlas.sync.${action}`)}
                    </button>
                  ))}
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm text-[var(--hp-text-primary)]">
                  <input
                    type="checkbox"
                    checked={forcePush}
                    onChange={(event) => {
                      setForcePush(event.target.checked)
                      setForceConfirmation('')
                    }}
                  />
                  {t('git.push.force')}
                </label>
                {forcePush && (
                  <div className="mt-2 rounded-[var(--hp-radius-md)] bg-[var(--hp-danger-subtle)] p-3">
                    <label className="text-sm text-[var(--hp-danger)]">
                      {t('gitAtlas.sync.forceConfirm', { branch: branch || t('gitAtlas.detached') })}
                      <input
                        value={forceConfirmation}
                        onChange={(event) => setForceConfirmation(event.target.value)}
                        className="mt-2 min-h-11 w-full rounded-[var(--hp-radius-sm)] border border-[var(--hp-border)] bg-[var(--hp-surface-0)] px-3 text-base text-[var(--hp-text-primary)] outline-none focus:ring-2 focus:ring-[var(--hp-danger)]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleSync('push')}
                      disabled={syncLocked || !canForcePush}
                      className="mt-2 min-h-11 w-full rounded-[var(--hp-radius-sm)] bg-[var(--hp-danger-action)] px-3 text-sm font-semibold text-[var(--hp-danger-action-text)] hover:bg-[var(--hp-danger-action-hover)] disabled:opacity-50"
                    >
                      {t('gitAtlas.sync.forcePush')}
                    </button>
                  </div>
                )}
                {dashboard?.sync?.inFlight && (
                  <div className="mt-2 rounded-[var(--hp-radius-sm)] bg-[var(--hp-warning-subtle)] p-2 text-sm text-[var(--hp-warning)]">{t('gitAtlas.sync.inFlight')}</div>
                )}
                {syncMessage && (
                  <div className={`mt-2 rounded-[var(--hp-radius-sm)] p-2 text-sm ${syncPhase === 'error' ? 'bg-[var(--hp-danger-subtle)] text-[var(--hp-danger)]' : 'bg-[var(--hp-success-subtle)] text-[var(--hp-success)]'}`}>
                    {syncMessage}
                  </div>
                )}
              </section>
            </div>
          </div>

          <section className="rounded-[var(--hp-radius-lg)] border border-[var(--hp-border)] bg-[var(--hp-surface-0)] shadow-[var(--hp-shadow-sm)]">
            <div className="border-b border-[var(--hp-border)] p-4">
              <h2 className="text-base font-semibold text-[var(--hp-text-primary)]">{t('gitAtlas.management.title')}</h2>
              <p className="text-sm text-[var(--hp-text-secondary)]">{t('gitAtlas.management.subtitle')}</p>
            </div>
            <div className="grid gap-3 p-3 lg:grid-cols-3">
              <details className="rounded-[var(--hp-radius-md)] border border-[var(--hp-border)] bg-[var(--hp-surface-1)]">
                <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold text-[var(--hp-text-primary)]">{t('git.tab.history')}</summary>
                <GitHistory sessionId={sessionId} />
              </details>
              <details className="rounded-[var(--hp-radius-md)] border border-[var(--hp-border)] bg-[var(--hp-surface-1)]">
                <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold text-[var(--hp-text-primary)]">{t('git.tab.branches')}</summary>
                <GitBranchManager sessionId={sessionId} />
              </details>
              <details className="rounded-[var(--hp-radius-md)] border border-[var(--hp-border)] bg-[var(--hp-surface-1)]">
                <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold text-[var(--hp-text-primary)]">{t('git.tab.remotes')}</summary>
                <GitRemoteManager sessionId={sessionId} />
              </details>
            </div>
          </section>
        </div>
      </SubPageLayout>

      <GitCloneDialog
        isOpen={cloneOpen}
        onClose={() => setCloneOpen(false)}
        sessionId={sessionId}
        onCloneComplete={() => {
          setCloneOpen(false)
          void refreshDashboard()
        }}
      />
    </>
  )
}

function Metric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' }) {
  return (
    <div className="rounded-[var(--hp-radius-md)] border border-[var(--hp-border)] bg-[var(--hp-surface-1)] px-3 py-2">
      <div className={`text-lg font-semibold ${tone === 'danger' ? 'text-[var(--hp-danger)]' : 'text-[var(--hp-text-primary)]'}`}>{value}</div>
      <div className="text-xs text-[var(--hp-text-secondary)]">{label}</div>
    </div>
  )
}
