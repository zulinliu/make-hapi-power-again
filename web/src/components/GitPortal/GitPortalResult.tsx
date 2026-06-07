import { useState, useCallback } from 'react'
import { useTranslation } from '@/lib/use-translation'
import { cn } from '@/lib/utils'
import { toggleFavorite, getHistory } from '../../lib/git-portal-storage'
import { GitPortalAnimation } from './GitPortalAnimation'

interface GitPortalResultProps {
  clonedPath: string
  repoInfo?: { name: string; branch: string; sizeBytes: number }
  onClose: () => void
  onOpenDir: (path: string) => void
  onStartSession: (path: string) => void
  isMobile: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function GitPortalResult({ clonedPath, repoInfo, onClose, onOpenDir, onStartSession, isMobile }: GitPortalResultProps) {
  const { t } = useTranslation()
  const [isFavorite, setIsFavorite] = useState(() => {
    const history = getHistory()
    const entry = history.find(e => e.url && e.repoName === repoInfo?.name)
    return entry?.isFavorite ?? false
  })
  const [starSpinning, setStarSpinning] = useState(false)

  const handleToggleFavorite = useCallback(() => {
    const history = getHistory()
    const entry = history.find(e => e.repoName === repoInfo?.name)
    if (entry) {
      const nowFav = toggleFavorite(entry.id)
      setIsFavorite(nowFav)
      setStarSpinning(true)
      setTimeout(() => setStarSpinning(false), 300)
    }
  }, [repoInfo])

  return (
    <div className={`flex flex-col items-center gap-4 ${isMobile ? 'min-h-[60dvh] px-6' : 'min-h-[300px]'}`}>
      {/* Success animation + favorite toggle */}
      <div className="relative">
        <GitPortalAnimation phase="done" />
        <button
          type="button"
          className={cn(
            'absolute -top-1 -right-3 p-1 rounded-full transition-colors',
            isFavorite ? 'text-yellow-500' : 'text-[var(--hp-text-muted)] hover:text-yellow-500'
          )}
          onClick={handleToggleFavorite}
          aria-label={isFavorite ? t('gitPortal.result.unfavorite') : t('gitPortal.result.favorite')}
          title={isFavorite ? t('gitPortal.result.unfavorite') : t('gitPortal.result.favorite')}
        >
          <svg
            className={cn('w-5 h-5', starSpinning && 'gp-star-active')}
            viewBox="0 0 24 24"
            fill={isFavorite ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      </div>

      {/* Success text */}
      <div className="text-center space-y-1">
        <p className="text-base font-semibold text-[var(--hp-text)]">
          {t('gitPortal.result.success')}
        </p>
        {repoInfo && (
          <p className="text-sm text-[var(--hp-text-muted)]">
            {repoInfo.name} / {repoInfo.branch} / {formatBytes(repoInfo.sizeBytes)}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className={cn('flex flex-col gap-2 w-full', isMobile ? 'max-w-sm' : 'max-w-xs')}>
        <button
          type="button"
          className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-[var(--hp-primary)] text-white hover:opacity-90 transition-opacity"
          onClick={() => onStartSession(clonedPath)}
        >
          {t('gitPortal.result.startSession')}
        </button>
        <button
          type="button"
          className="w-full px-4 py-2 text-sm rounded-lg border border-[var(--hp-border)] text-[var(--hp-text-muted)] hover:text-[var(--hp-text)] hover:border-[var(--hp-text-muted)] transition-colors"
          onClick={() => onOpenDir(clonedPath)}
        >
          {t('gitPortal.result.openDir')}
        </button>
      </div>
    </div>
  )
}
