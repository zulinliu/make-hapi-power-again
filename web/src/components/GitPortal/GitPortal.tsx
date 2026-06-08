import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from '@/lib/use-translation'
import { cn } from '@/lib/utils'
import type { ApiClient } from '@/api/client'
import { useGitClone } from './useGitClone'
import { GitPortalStepInput } from './GitPortalStepInput'
import { GitPortalProgress } from './GitPortalProgress'
import { GitPortalResult } from './GitPortalResult'
import { GitPortalEmptyState } from './GitPortalEmptyState'

interface GitPortalProps {
  isOpen: boolean
  onClose: () => void
  api: ApiClient | null
  machineId: string | null
  sessionId?: string | null
  currentPath?: string
  onCloneComplete?: (clonedPath: string) => void
  onOpenDirectory?: (path: string) => void
  onStartSession?: (path: string) => void
  startSessionLabel?: string
}

function isActiveClonePhase(phase: string): boolean {
  return phase === 'connecting' || phase === 'transferring' || phase === 'unpacking'
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',')

  return Array.from(root.querySelectorAll<HTMLElement>(selectors))
    .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
}

export function GitPortal({
  isOpen,
  onClose,
  api,
  machineId,
  sessionId,
  currentPath,
  onCloneComplete,
  onOpenDirectory,
  onStartSession,
  startSessionLabel,
}: GitPortalProps) {
  const { t } = useTranslation()
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelConfirmRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const cancelReturnFocusRef = useRef<HTMLElement | null>(null)

  const {
    state: cloneState,
    setUrl,
    setConfig,
    setAuth,
    startClone,
    reset,
    cancel,
    retryFromError,
    switchToTokenAuth,
  } = useGitClone({
    api,
    machineId,
    sessionId,
    currentPath,
    onCloneComplete,
  })

  const handleClose = useCallback(() => {
    setShowCancelConfirm(false)
    reset()
    onClose()
  }, [onClose, reset])

  useEffect(() => {
    if (!isOpen) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const timer = window.setTimeout(() => {
      const first = dialogRef.current ? getFocusableElements(dialogRef.current)[0] : null
      first?.focus()
    }, 0)
    return () => {
      window.clearTimeout(timer)
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showCancelConfirm) {
        e.preventDefault()
        setShowCancelConfirm(false)
        cancelReturnFocusRef.current?.focus()
        return
      }
      const activePhase = cloneState.phase
      if (isActiveClonePhase(activePhase)) {
        e.preventDefault()
        cancelReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        setShowCancelConfirm(true)
        return
      }
      handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, showCancelConfirm, cloneState.phase, handleClose])

  useEffect(() => {
    if (!showCancelConfirm) return
    const first = cancelConfirmRef.current ? getFocusableElements(cancelConfirmRef.current)[0] : null
    first?.focus()
  }, [showCancelConfirm])

  const handleDialogKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const focusRoot = showCancelConfirm ? cancelConfirmRef.current : dialogRef.current
    if (!focusRoot) return
    const focusable = getFocusableElements(focusRoot)
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement

    if (e.shiftKey && active === first) {
      e.preventDefault()
      last?.focus()
      return
    }

    if (!e.shiftKey && active === last) {
      e.preventDefault()
      first?.focus()
    }
  }, [showCancelConfirm])

  const handleStart = useCallback(() => {
    void startClone()
  }, [startClone])

  const handleCancel = useCallback(() => {
    cancelReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setShowCancelConfirm(true)
  }, [])

  const handleConfirmCancel = useCallback(() => {
    setShowCancelConfirm(false)
    void cancel()
  }, [cancel])

  const handleKeepCloning = useCallback(() => {
    setShowCancelConfirm(false)
    cancelReturnFocusRef.current?.focus()
  }, [])

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (isActiveClonePhase(cloneState.phase)) return
      handleClose()
    }
  }, [cloneState.phase, handleClose])

  const handleOpenDir = useCallback((path: string) => {
    onOpenDirectory?.(path)
  }, [onOpenDirectory])

  const handleStartSession = useCallback((path: string) => {
    onStartSession?.(path)
  }, [onStartSession])

  if (!isOpen) return null

  const isCloning = isActiveClonePhase(cloneState.phase)

  const closeBtn = (
    <button
      type="button"
      className={cn(
        'min-h-11 min-w-11 rounded-md transition-colors inline-flex items-center justify-center',
        isCloning
          ? 'text-[var(--hp-text-tertiary)] cursor-not-allowed'
          : 'text-[var(--hp-text-tertiary)] hover:text-[var(--hp-text-primary)] hover:bg-[var(--hp-surface-2)]'
      )}
      disabled={isCloning}
      onClick={handleClose}
      aria-label={t('gitPortal.close')}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  )

  const header = (
    <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--hp-border)]">
      <h3 className="text-sm font-semibold text-[var(--hp-text-primary)]">
        {t('gitPortal.title')}
      </h3>
      {closeBtn}
    </div>
  )

  const content = (
    <div className="flex-1 overflow-y-auto p-4">
      {isCloning && showCancelConfirm && (
        <div
          ref={cancelConfirmRef}
          className="mb-4 rounded-lg border border-[var(--hp-danger-readable,var(--hp-danger))] bg-[var(--hp-danger-subtle)] p-3"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="gp-cancel-title"
          aria-describedby="gp-cancel-desc"
        >
          <p id="gp-cancel-title" className="text-sm font-medium text-[var(--hp-text-primary)]">
            {t('gitPortal.confirm.cancelTitle')}
          </p>
          <p id="gp-cancel-desc" className="mt-1 text-xs text-[var(--hp-text-secondary)]">
            {t('gitPortal.confirm.cancel')}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="min-h-11 flex-1 rounded-md border border-[var(--hp-border)] px-3 py-2 text-sm text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)]"
              onClick={handleKeepCloning}
            >
              {t('gitPortal.confirm.keepCloning')}
            </button>
            <button
              type="button"
              className="min-h-11 flex-1 rounded-md bg-[var(--hp-danger-action,var(--hp-danger-readable,var(--hp-danger)))] px-3 py-2 text-sm font-medium text-[var(--hp-danger-action-text,var(--hp-text-inverse))] hover:bg-[var(--hp-danger-action-hover,var(--hp-danger-action,var(--hp-danger)))]"
              onClick={handleConfirmCancel}
            >
              {t('gitPortal.confirm.cancelAction')}
            </button>
          </div>
        </div>
      )}
      {cloneState.phase === 'input' && (
        <>
        {cloneState.notice && (
          <div
            className="mb-4 rounded-lg border border-[var(--hp-border)] bg-[var(--hp-surface-1)] px-3 py-2 text-sm text-[var(--hp-text-secondary)]"
            role="status"
          >
            {cloneState.notice}
          </div>
        )}
        <GitPortalStepInput
          state={cloneState}
          setUrl={setUrl}
          setConfig={setConfig}
          setAuth={setAuth}
          onStart={handleStart}
          isMobile={isMobile}
        />
        </>
      )}
      {isCloning && (
        <GitPortalProgress
          phase={cloneState.phase}
          progress={cloneState.progress}
          onCancel={handleCancel}
          isMobile={isMobile}
          isCancelling={cloneState.isCancelling}
        />
      )}
      {cloneState.phase === 'done' && (
        <GitPortalResult
          clonedPath={cloneState.result?.clonedPath ?? ''}
          repoInfo={cloneState.result?.repoInfo}
          onClose={handleClose}
          onOpenDir={handleOpenDir}
          onStartSession={handleStartSession}
          startSessionLabel={startSessionLabel}
          isMobile={isMobile}
        />
      )}
      {cloneState.phase === 'error' && (
        <GitPortalEmptyState
          variant="cloneFailed"
          error={cloneState.error ?? undefined}
          onRetry={retryFromError}
          onSwitchToToken={cloneState.url.trim().startsWith('https://') ? switchToTokenAuth : undefined}
        />
      )}
    </div>
  )

  if (isMobile) {
    return (
      <div
        ref={dialogRef}
        className="gp-portal gp-portal-mobile fixed inset-0 z-50 bg-[var(--hp-surface-0)] flex flex-col"
        style={{
          paddingTop: 'max(0px, env(safe-area-inset-top))',
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t('gitPortal.title')}
        onKeyDown={handleDialogKeyDown}
      >
        {header}
        {content}
      </div>
    )
  }

  return (
    <div className="gp-portal-backdrop fixed inset-0 z-40" onClick={handleBackdropClick}>
      <div
        ref={dialogRef}
        className="gp-portal gp-portal-desktop absolute top-0 right-0 h-full w-[420px] bg-[var(--hp-surface-0)] border-l border-[var(--hp-border)] shadow-lg flex flex-col animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-label={t('gitPortal.title')}
        onKeyDown={handleDialogKeyDown}
      >
        {header}
        {content}
      </div>
    </div>
  )
}
