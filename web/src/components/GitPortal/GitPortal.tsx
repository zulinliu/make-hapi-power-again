import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '@/lib/use-translation'
import { cn } from '@/lib/utils'
import type { ApiClient } from '@/api/client'
import { useGitClone } from './useGitClone'
import { GitPortalStepInput } from './GitPortalStepInput'
import { GitPortalProgress } from './GitPortalProgress'
import { GitPortalResult } from './GitPortalResult'

interface GitPortalProps {
  isOpen: boolean
  onClose: () => void
  api: ApiClient | null
  machineId: string | null
  sessionId?: string | null
  currentPath?: string
  onCloneComplete?: (clonedPath: string) => void
  onProgressEvent?: (event: { type: string; data?: any }) => void
}

export function GitPortal({
  isOpen,
  onClose,
  api,
  machineId,
  sessionId,
  currentPath,
  onCloneComplete,
  onProgressEvent,
}: GitPortalProps) {
  const { t } = useTranslation()
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)

  const {
    state: cloneState,
    setUrl,
    setConfig,
    setAuth,
    startClone,
    reset,
    cancel,
    handleProgressEvent,
  } = useGitClone({
    api,
    machineId,
    sessionId,
    currentPath,
    onCloneComplete,
  })

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
      const activePhase = cloneState.phase
      if (activePhase === 'connecting' || activePhase === 'transferring' || activePhase === 'unpacking') {
        if (window.confirm(t('gitPortal.confirm.cancel'))) {
          cancel()
        }
        return
      }
      onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, cloneState.phase, cancel, onClose, t])

  useEffect(() => {
    if (onProgressEvent && isOpen) {
      onProgressEvent({ type: 'subscribe', data: { handler: handleProgressEvent } })
    }
  }, [onProgressEvent, isOpen, handleProgressEvent])

  const handleStart = useCallback(() => {
    startClone()
  }, [startClone])

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      const activePhase = cloneState.phase
      if (activePhase === 'connecting' || activePhase === 'transferring' || activePhase === 'unpacking') {
        return
      }
      onClose()
    }
  }, [cloneState.phase, onClose])

  if (!isOpen) return null

  const isCloning = cloneState.phase === 'connecting' || cloneState.phase === 'transferring' || cloneState.phase === 'unpacking'

  if (isMobile) {
    return (
      <div className="gp-portal gp-portal-mobile fixed inset-0 z-50 bg-[var(--hp-surface)] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hp-border)]">
          <h3 className="text-sm font-semibold text-[var(--hp-text)]">
            {t('gitPortal.title')}
          </h3>
          <button
            type="button"
            className={cn(
              'p-1.5 rounded-md transition-colors',
              isCloning
                ? 'text-[var(--hp-text-muted)] cursor-not-allowed'
                : 'text-[var(--hp-text-muted)] hover:text-[var(--hp-text)] hover:bg-[var(--hp-surface-2)]'
            )}
            disabled={isCloning}
            onClick={onClose}
            aria-label={t('gitPortal.close')}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cloneState.phase === 'input' && (
            <GitPortalStepInput
              state={cloneState}
              setUrl={setUrl}
              setConfig={setConfig}
              setAuth={setAuth}
              onStart={handleStart}
              isMobile={true}
            />
          )}
          {isCloning && (
            <GitPortalProgress phase={cloneState.phase} progress={cloneState.progress} onCancel={cancel} isMobile={true} />
          )}
          {cloneState.phase === 'done' && (
            <GitPortalResult
              clonedPath={cloneState.result?.clonedPath ?? ''}
              repoInfo={cloneState.result?.repoInfo}
              onClose={onClose}
              onOpenDir={onCloneComplete ?? (() => {})}
              onStartSession={() => {}}
              isMobile={true}
            />
          )}
          {cloneState.phase === 'error' && (
            <GitPortalProgress phase="error" progress={cloneState.progress} onCancel={cancel} isMobile={true} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="gp-portal-backdrop fixed inset-0 z-40" onClick={handleBackdropClick}>
      <div
        className="gp-portal gp-portal-desktop absolute top-0 right-0 h-full w-[420px] bg-[var(--hp-surface)] border-l border-[var(--hp-border)] shadow-lg flex flex-col animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-label={t('gitPortal.title')}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hp-border)]">
          <h3 className="text-sm font-semibold text-[var(--hp-text)]">
            {t('gitPortal.title')}
          </h3>
          <button
            type="button"
            className={cn(
              'p-1.5 rounded-md transition-colors',
              isCloning
                ? 'text-[var(--hp-text-muted)] cursor-not-allowed'
                : 'text-[var(--hp-text-muted)] hover:text-[var(--hp-text)] hover:bg-[var(--hp-surface-2)]'
            )}
            disabled={isCloning}
            onClick={onClose}
            aria-label={t('gitPortal.close')}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cloneState.phase === 'input' && (
            <GitPortalStepInput
              state={cloneState}
              setUrl={setUrl}
              setConfig={setConfig}
              setAuth={setAuth}
              onStart={handleStart}
              isMobile={false}
            />
          )}
          {isCloning && (
            <GitPortalProgress phase={cloneState.phase} progress={cloneState.progress} onCancel={cancel} isMobile={false} />
          )}
          {cloneState.phase === 'done' && (
            <GitPortalResult
              clonedPath={cloneState.result?.clonedPath ?? ''}
              repoInfo={cloneState.result?.repoInfo}
              onClose={onClose}
              onOpenDir={onCloneComplete ?? (() => {})}
              onStartSession={() => {}}
              isMobile={false}
            />
          )}
          {cloneState.phase === 'error' && (
            <GitPortalProgress phase="error" progress={cloneState.progress} onCancel={cancel} isMobile={false} />
          )}
        </div>
      </div>
    </div>
  )
}
