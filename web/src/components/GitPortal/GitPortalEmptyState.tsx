import { useTranslation } from '@/lib/use-translation'
import { cn } from '@/lib/utils'

interface GitPortalEmptyStateProps {
  variant: 'noHistory' | 'noFavorites' | 'cloneFailed' | 'firstUse'
  error?: string
  onRetry?: () => void
  onSwitchToToken?: () => void
}

export function GitPortalEmptyState({ variant, error, onRetry, onSwitchToToken }: GitPortalEmptyStateProps) {
  const { t } = useTranslation()

  if (variant === 'cloneFailed') {
    return (
      <div className="gp-empty-state flex flex-col items-center justify-center py-8 px-4 text-center">
        <svg
          className="w-10 h-10 text-[var(--hp-danger-readable,var(--hp-danger))] mb-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        {error && (
          <p className="text-sm text-[var(--hp-danger-readable,var(--hp-danger))] mb-3 max-w-[280px] break-words">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2 w-full max-w-[280px]">
          {onRetry && (
            <button
              type="button"
              className="gp-retry-btn min-h-11 px-4 py-2 text-sm rounded-md bg-[var(--hp-primary)] text-[var(--hp-primary-text)] hover:bg-[var(--hp-primary-hover)] transition-colors"
              onClick={onRetry}
            >
              {t('gitPortal.error.retry')}
            </button>
          )}
          {onSwitchToToken && (
            <button
              type="button"
              className="min-h-11 px-4 py-2 text-sm rounded-md border border-[var(--hp-border)] text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)] hover:border-[var(--hp-primary)] transition-colors"
              onClick={onSwitchToToken}
            >
              {t('gitPortal.error.switchToToken')}
            </button>
          )}
        </div>
      </div>
    )
  }

  const content = {
    noHistory: {
      title: t('gitPortal.empty.noHistory.title'),
      hint: t('gitPortal.empty.noHistory.hint'),
    },
    noFavorites: {
      title: t('gitPortal.empty.noFavorites.title'),
      hint: t('gitPortal.empty.noFavorites.hint'),
    },
    firstUse: {
      title: t('gitPortal.empty.firstUse.title'),
      hint: t('gitPortal.empty.firstUse.hint'),
    },
  }[variant]

  return (
    <div className="gp-empty-state flex flex-col items-center justify-center py-8 px-4 text-center">
      <svg
        className="w-10 h-10 text-[var(--hp-text-tertiary)] mb-3 opacity-40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {variant === 'firstUse' ? (
          <>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </>
        )}
      </svg>
      <p className={cn(
        'text-sm font-medium mb-1',
        variant === 'firstUse' ? 'text-[var(--hp-primary-readable,var(--hp-primary))]' : 'text-[var(--hp-text-tertiary)]'
      )}>
        {content.title}
      </p>
      <p className="text-xs text-[var(--hp-text-tertiary)] max-w-[260px]">
        {content.hint}
      </p>
    </div>
  )
}
