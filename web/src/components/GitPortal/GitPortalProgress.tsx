import { useTranslation } from '@/lib/use-translation'
import { GitPortalAnimation } from './GitPortalAnimation'
import type { ClonePhase } from '../../lib/git-portal-api'

interface GitPortalProgressProps {
  phase: ClonePhase
  progress: {
    bytesReceived: number
    bytesTotal?: number
    message: string
    percent: number
  }
  onCancel: () => void
  isMobile: boolean
  isCancelling?: boolean
}

type NavigatorWithDeviceMemory = Navigator & {
  deviceMemory?: number
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as NavigatorWithDeviceMemory
  const cores = nav.hardwareConcurrency ?? 4
  const memory = nav.deviceMemory ?? 4
  return cores <= 2 || memory <= 2
}

export function GitPortalProgress({ phase, progress, onCancel, isMobile, isCancelling = false }: GitPortalProgressProps) {
  const { t } = useTranslation()
  const isCloning = phase === 'connecting' || phase === 'transferring' || phase === 'unpacking'
  const lowEnd = isLowEndDevice()
  const progressValue = Math.max(0, Math.min(100, Math.round(progress.percent)))

  return (
    <div className={`flex flex-col items-center justify-center gap-6 ${isMobile ? 'min-h-[60dvh] px-6' : 'min-h-[300px]'}`}>
      {/* Animation or progress bar for low-end */}
      {isCloning && (
        <GitPortalAnimation phase={phase} progress={progress.percent} isLowEnd={lowEnd} />
      )}
      {phase === 'done' && (
        <GitPortalAnimation phase="done" isLowEnd={lowEnd} />
      )}
      {phase === 'error' && (
        <GitPortalAnimation phase="error" isLowEnd={lowEnd} />
      )}

      {/* Low-end fallback: static progress bar */}
      {lowEnd && isCloning && (
        <div className="w-full max-w-xs">
          <div
            className="h-2 rounded-full bg-[var(--hp-surface-2)] overflow-hidden"
            role="progressbar"
            aria-label={t('gitPortal.a11y.cloneProgress')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressValue}
          >
            <div
              className="gp-progress-bar h-full rounded-full bg-[var(--hp-primary)] transition-all duration-300"
              style={{ width: `${Math.max(progressValue, 5)}%` }}
            />
          </div>
        </div>
      )}

      {/* Progress text */}
      <div className="text-center space-y-1">
        {phase === 'connecting' && (
          <p className="text-sm text-[var(--hp-text-primary)] motion-safe:animate-pulse">
            {t('gitPortal.progress.connecting', { host: '' })}
          </p>
        )}
        {phase === 'transferring' && (
          <>
            <p className="text-sm text-[var(--hp-text-primary)]">
              {t('gitPortal.progress.transferring', { received: formatBytes(progress.bytesReceived) })}
            </p>
            {progress.bytesTotal && (
              <p className="text-xs text-[var(--hp-text-tertiary)]">
                {formatBytes(progress.bytesReceived)} / {formatBytes(progress.bytesTotal)}
              </p>
            )}
          </>
        )}
        {phase === 'unpacking' && (
          <p className="text-sm text-[var(--hp-text-primary)]">
            {t('gitPortal.progress.unpacking')}
          </p>
        )}

        {/* Standard progress bar */}
        {!lowEnd && isCloning && (
          <div className="w-full max-w-xs mx-auto mt-2">
            <div
              className="h-1.5 rounded-full bg-[var(--hp-surface-2)] overflow-hidden"
              role="progressbar"
              aria-label={t('gitPortal.a11y.cloneProgress')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressValue}
            >
              <div
                className="h-full rounded-full bg-[var(--hp-primary)] transition-all duration-300"
                style={{ width: `${Math.max(progressValue, 3)}%` }}
              />
            </div>
            {progressValue > 0 && (
              <p className="text-xs text-[var(--hp-text-tertiary)] mt-1">{progressValue}%</p>
            )}
          </div>
        )}
      </div>

      <span className="sr-only" aria-live="polite">
        {phase === 'connecting'
          ? t('gitPortal.progress.connecting', { host: '' })
          : phase === 'transferring'
            ? `${t('gitPortal.progress.transferring', { received: formatBytes(progress.bytesReceived) })} ${progressValue}%`
            : phase === 'unpacking'
              ? t('gitPortal.progress.unpacking')
              : ''}
      </span>

      {/* Cancel button */}
      {isCloning && (
        <button
          type="button"
          className="min-h-11 px-4 py-2 text-sm rounded-md border border-[var(--hp-border)] text-[var(--hp-text-tertiary)] hover:text-[var(--hp-danger-readable,var(--hp-danger))] hover:border-[var(--hp-danger-readable,var(--hp-danger))] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          onClick={onCancel}
          disabled={isCancelling}
        >
          {isCancelling ? t('gitPortal.progress.cancelling') : t('gitPortal.progress.cancel')}
        </button>
      )}
    </div>
  )
}
