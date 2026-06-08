import { useState, useCallback } from 'react'
import { useTranslation } from '@/lib/use-translation'
import { cn } from '@/lib/utils'
import { parseRepoUrl, detectPlatform } from '@/lib/git-portal-storage'
import type { GitPlatform } from '@/lib/git-portal-storage'
import type { CloneAuth } from '@/lib/git-portal-api'
import { GitPortalAuth } from './GitPortalAuth'
import { GitPortalHistory } from './GitPortalHistory'

interface GitPortalStepInputProps {
  state: {
    url: string
    parsedRepo: ReturnType<typeof parseRepoUrl>
    config: { targetDir: string; branch: string; depth: number | null }
    auth: CloneAuth | null
  }
  setUrl: (url: string) => void
  setConfig: (config: Partial<{ targetDir: string; branch: string; depth: number | null }>) => void
  setAuth: (auth: CloneAuth | null) => void
  onStart: () => void
  isMobile: boolean
}

export function GitPortalStepInput({
  state,
  setUrl,
  setConfig,
  setAuth,
  onStart,
  isMobile,
}: GitPortalStepInputProps) {
  const { t } = useTranslation()
  const [showAdvanced, setShowAdvanced] = useState(false)

  const trimmedUrl = state.url.trim()
  const parsed = trimmedUrl ? parseRepoUrl(trimmedUrl) : null
  const isValid = Boolean(parsed)
  const isEmpty = !trimmedUrl
  const usesHttpCredentials = trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('http://')
  const platform: GitPlatform = trimmedUrl ? detectPlatform(trimmedUrl) : 'other'
  const canStart = isValid && trimmedUrl.length > 10

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value)
  }, [setUrl])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canStart) {
      e.preventDefault()
      onStart()
    }
  }, [canStart, onStart])

  const handleSelectHistory = useCallback((url: string, targetDir: string, branch?: string) => {
    setUrl(url)
    if (targetDir) setConfig({ targetDir })
    if (branch) setConfig({ branch })
  }, [setUrl, setConfig])

  const handleToggleFavorite = useCallback((_entryId: string) => {
    // Re-render is handled inside GitPortalHistory because it owns localStorage reads.
  }, [])

  return (
    <div className={cn('gp-step-input flex flex-col gap-4', isMobile && 'pb-4')}>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--hp-text-secondary)]" htmlFor="gp-repo-url">
          {t('gitPortal.input.urlLabel')}
        </label>
        <div className="relative">
          <input
            id="gp-repo-url"
            type="text"
            className={cn(
              'gp-url-input min-h-11 w-full px-3 py-2.5 pr-10 text-sm rounded-lg border bg-[var(--hp-surface-0)] text-[var(--hp-text-primary)] placeholder:text-[var(--hp-text-tertiary)] focus:outline-none focus:ring-2 transition-colors',
              isEmpty
                ? 'border-[var(--hp-border)] focus:ring-[var(--hp-primary)]'
                : isValid
                  ? 'border-[var(--hp-success)] focus:ring-[var(--hp-success)]'
                  : 'border-[var(--hp-danger)] focus:ring-[var(--hp-danger)]'
            )}
            placeholder={t('gitPortal.input.urlPlaceholder')}
            aria-label={t('gitPortal.input.urlPlaceholder')}
            value={state.url}
            onChange={handleUrlChange}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
            autoFocus
          />
          {!isEmpty && (
            <span className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2',
              isValid ? 'text-[var(--hp-success)]' : 'text-[var(--hp-danger)]'
            )}>
              {isValid ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </span>
          )}
        </div>

        {isValid && parsed && (
          <p className="mt-1.5 text-xs text-[var(--hp-text-tertiary)] flex items-center gap-1.5">
            <PlatformLabel platform={parsed.platform} />
            <span className="opacity-50">/</span>
            <span className="font-medium text-[var(--hp-text-primary)]">{parsed.owner}</span>
            <span className="opacity-50">/</span>
            <span className="font-medium text-[var(--hp-text-primary)]">{parsed.repoName}</span>
          </p>
        )}
      </div>

      <GitPortalHistory
        onSelect={handleSelectHistory}
        onToggleFavorite={handleToggleFavorite}
      />

      <div>
        <button
          type="button"
          className="flex min-h-11 items-center gap-1.5 rounded-md px-1 text-xs text-[var(--hp-text-tertiary)] hover:text-[var(--hp-text-primary)] transition-colors"
          onClick={() => setShowAdvanced(v => !v)}
          aria-expanded={showAdvanced}
        >
          <svg
            className={cn('w-3.5 h-3.5 transition-transform', showAdvanced && 'rotate-90')}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {t('gitPortal.input.advanced')}
        </button>

        {showAdvanced && (
          <div className="gp-advanced-options mt-3 space-y-2.5 pl-1">
            <div>
              <label className="block text-xs text-[var(--hp-text-tertiary)] mb-1" htmlFor="gp-target-dir">
                {t('gitPortal.input.targetDir')}
              </label>
              <input
                id="gp-target-dir"
                type="text"
                className="gp-input min-h-11 w-full px-3 py-2 text-sm rounded-md border border-[var(--hp-border)] bg-[var(--hp-surface-0)] text-[var(--hp-text-primary)] placeholder:text-[var(--hp-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--hp-primary)]"
                value={state.config.targetDir}
                onChange={e => setConfig({ targetDir: e.target.value })}
                placeholder={t('gitPortal.input.targetDirPlaceholder')}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--hp-text-tertiary)] mb-1" htmlFor="gp-branch">
                {t('gitPortal.input.branch')}
              </label>
              <input
                id="gp-branch"
                type="text"
                className="gp-input min-h-11 w-full px-3 py-2 text-sm rounded-md border border-[var(--hp-border)] bg-[var(--hp-surface-0)] text-[var(--hp-text-primary)] placeholder:text-[var(--hp-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--hp-primary)]"
                value={state.config.branch}
                onChange={e => setConfig({ branch: e.target.value })}
                placeholder={t('gitPortal.input.branchPlaceholder')}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--hp-text-tertiary)] mb-1" htmlFor="gp-depth">
                {t('gitPortal.input.depth')}
              </label>
              <input
                id="gp-depth"
                type="number"
                min={1}
                className="gp-input min-h-11 w-full px-3 py-2 text-sm rounded-md border border-[var(--hp-border)] bg-[var(--hp-surface-0)] text-[var(--hp-text-primary)] placeholder:text-[var(--hp-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--hp-primary)]"
                value={state.config.depth ?? ''}
                onChange={e => setConfig({ depth: e.target.value ? Number(e.target.value) : null })}
                placeholder={t('gitPortal.input.depthPlaceholder')}
                inputMode="numeric"
              />
            </div>
          </div>
        )}
      </div>

      <GitPortalAuth
        auth={state.auth}
        onAuthChange={setAuth}
        platform={platform}
        show={usesHttpCredentials}
      />

      <button
        type="button"
        className={cn(
          'gp-start-btn min-h-11 w-full py-2.5 rounded-lg text-sm font-medium transition-colors',
          canStart
            ? 'bg-[var(--hp-primary)] text-[var(--hp-primary-text)] hover:bg-[var(--hp-primary-hover)]'
            : 'bg-[var(--hp-surface-2)] text-[var(--hp-text-tertiary)] cursor-not-allowed'
        )}
        disabled={!canStart}
        onClick={onStart}
      >
        {t('gitPortal.input.start')}
      </button>
    </div>
  )
}

function PlatformLabel({ platform }: { platform: GitPlatform }) {
  const labels: Record<GitPlatform, string> = {
    github: 'GitHub',
    gitlab: 'GitLab',
    bitbucket: 'Bitbucket',
    other: 'Git',
  }
  return (
    <span className="inline-flex items-center gap-1 text-[var(--hp-primary-readable,var(--hp-primary))]">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {labels[platform]}
    </span>
  )
}
