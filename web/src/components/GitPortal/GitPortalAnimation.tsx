import { useTranslation } from '@/lib/use-translation'
import { cn } from '@/lib/utils'

interface GitPortalAnimationProps {
  phase: 'connecting' | 'transferring' | 'unpacking' | 'done' | 'error'
  progress?: number
  isLowEnd?: boolean
}

export function GitPortalAnimation({ phase, progress, isLowEnd }: GitPortalAnimationProps) {
  const { t } = useTranslation()

  if (isLowEnd) {
    return null
  }

  const isDone = phase === 'done'
  const isError = phase === 'error'
  const ringColor = isError ? 'var(--hp-danger)' : isDone ? 'var(--hp-success)' : 'var(--hp-primary)'
  const innerColor = isDone ? 'var(--hp-success)' : 'var(--hp-primary)'

  return (
    <div className={cn('gp-portal-svg-container flex items-center justify-center', isDone && 'gp-portal-success', isError && 'gp-portal-error')}>
      <svg
        className="gp-portal-svg w-24 h-24"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        {/* Repository frame */}
        <rect
          className="gp-portal-ring"
          x="18" y="18" width="64" height="64"
          rx="14"
          fill="none"
          stroke={ringColor}
          strokeWidth="2.5"
          opacity="0.8"
        />

        {/* Git branch graph */}
        <path
          d="M38 38v18a8 8 0 0 0 8 8h15"
          fill="none"
          stroke={innerColor}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.72"
        />
        <path
          d="M38 50h24"
          fill="none"
          stroke={innerColor}
          strokeWidth="2.25"
          strokeLinecap="round"
          opacity="0.72"
        />
        <circle cx="38" cy="36" r="5" fill="var(--hp-surface-0)" stroke={innerColor} strokeWidth="2.25" />
        <circle cx="38" cy="64" r="5" fill="var(--hp-surface-0)" stroke={innerColor} strokeWidth="2.25" />
        <circle cx="64" cy="50" r="5" fill="var(--hp-surface-0)" stroke={innerColor} strokeWidth="2.25" />

        {/* Repository inner boundary */}
        <rect
          x="28" y="28" width="44" height="44"
          rx="10"
          fill="none"
          stroke={innerColor}
          strokeWidth="1"
          opacity="0.22"
        />

        {/* Data flow lines (only during transfer) */}
        {(phase === 'connecting' || phase === 'transferring' || phase === 'unpacking') && (
          <>
            <line className="gp-data-stream" x1="30" y1="50" x2="36" y2="50" stroke={innerColor} strokeWidth="1.25" opacity="0.5" />
            <line className="gp-data-stream" x1="68" y1="50" x2="74" y2="50" stroke={innerColor} strokeWidth="1.25" opacity="0.5" />
          </>
        )}

        {/* Success check mark */}
        {isDone && (
          <polyline
            className="gp-check-mark"
            points="38,52 47,61 62,42"
            fill="none"
            stroke="var(--hp-success)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Error X */}
        {isError && (
          <>
            <line x1="42" y1="42" x2="58" y2="58" stroke="var(--hp-danger)" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="58" y1="42" x2="42" y2="58" stroke="var(--hp-danger)" strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}
      </svg>

      {/* Screen reader progress */}
      <span className="sr-only">
        {isDone ? t('gitPortal.result.success') : isError ? t('gitPortal.error.authFailed') : `${progress ?? 0}%`}
      </span>
    </div>
  )
}
