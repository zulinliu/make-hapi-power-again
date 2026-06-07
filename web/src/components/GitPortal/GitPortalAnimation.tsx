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
        {/* Outer diamond (portal frame) */}
        <rect
          className="gp-portal-ring"
          x="15" y="15" width="70" height="70"
          rx="4"
          transform="rotate(45 50 50)"
          fill="none"
          stroke={ringColor}
          strokeWidth="2.5"
          opacity="0.8"
        />

        {/* Inner diamond (rotated 8 deg) */}
        <rect
          x="28" y="28" width="44" height="44"
          rx="3"
          transform="rotate(53 50 50)"
          fill="none"
          stroke={innerColor}
          strokeWidth="1.5"
          opacity="0.6"
        />

        {/* Center branch line */}
        <line
          x1="50" y1="38" x2="50" y2="62"
          stroke={innerColor}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* Data flow lines (only during transfer) */}
        {(phase === 'connecting' || phase === 'transferring' || phase === 'unpacking') && (
          <>
            <line className="gp-data-stream" x1="35" y1="50" x2="46" y2="50" stroke={innerColor} strokeWidth="1" opacity="0.5" />
            <line className="gp-data-stream" x1="54" y1="50" x2="65" y2="50" stroke={innerColor} strokeWidth="1" opacity="0.5" />
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
      <span className="sr-only" aria-live="polite">
        {isDone ? t('gitPortal.result.success') : isError ? t('gitPortal.error.authFailed') : `${t('gitPortal.progress.transferring')} ${progress ?? 0}%`}
      </span>
    </div>
  )
}
