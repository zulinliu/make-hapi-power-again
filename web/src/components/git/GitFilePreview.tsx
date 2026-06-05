import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { decodeBase64 } from '@/lib/utils'
import { isBinaryContent, resolveImageMimeType, isMarkdownFile } from '@/lib/file-utils'
import { langAlias } from '@/lib/shiki'
import { queryKeys } from '@/lib/query-keys'
import { GitStatusBadge } from '@/components/git/GitStatusBadge'
import { CodeBlock } from '@/components/CodeBlock'
import { ImagePreview } from '@/components/ImagePreview'
import { MarkdownFilePreview } from '@/components/MarkdownFilePreview'
import { LoadingState } from '@/components/LoadingState'

interface GitFilePreviewProps {
  sessionId: string
  filePath: string
  fileStatus: string
  onClose: () => void
  onOpenInFileManager: () => void
}

function resolveLanguage(path: string): string | undefined {
  const ext = path.split('.').pop()?.toLowerCase()
  if (!ext) return undefined
  return langAlias[ext] ?? ext
}

export function GitFilePreview({ sessionId, filePath, fileStatus, onClose, onOpenInFileManager }: GitFilePreviewProps) {
  const { api } = useAppContext()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const closedRef = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef(0)
  const touchCurrentY = useRef(0)

  const handleClose = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    setClosing(true)
    setOpen(false)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }, [onClose])

  useEffect(() => {
    closedRef.current = false
    requestAnimationFrame(() => setOpen(true))
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [handleClose])

  useEffect(() => {
    if (open && closeBtnRef.current) {
      closeBtnRef.current.focus()
    }
  }, [open])

  // Swipe-to-dismiss for mobile bottom sheet
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (!isMobile) return

    function onTouchStart(e: TouchEvent) {
      touchStartY.current = e.touches[0].clientY
    }
    function onTouchMove(e: TouchEvent) {
      touchCurrentY.current = e.touches[0].clientY
      const delta = touchCurrentY.current - touchStartY.current
      if (delta > 0 && panel) {
        panel.style.transform = `translateY(${delta}px)`
      }
    }
    function onTouchEnd() {
      const delta = touchCurrentY.current - touchStartY.current
      if (delta > 80) {
        handleClose()
      } else if (panel) {
        panel.style.transform = ''
      }
      touchStartY.current = 0
      touchCurrentY.current = 0
    }

    panel.addEventListener('touchstart', onTouchStart, { passive: true })
    panel.addEventListener('touchmove', onTouchMove, { passive: true })
    panel.addEventListener('touchend', onTouchEnd)
    return () => {
      panel.removeEventListener('touchstart', onTouchStart)
      panel.removeEventListener('touchmove', onTouchMove)
      panel.removeEventListener('touchend', onTouchEnd)
    }
  }, [handleClose])

  const fileName = filePath.split('/').pop() || filePath

  const fileQuery = useQuery({
    queryKey: queryKeys.sessionFile(sessionId, filePath),
    queryFn: async () => {
      if (!api) throw new Error('No API')
      return await api.readSessionFile(sessionId, filePath)
    },
    enabled: Boolean(api && sessionId && filePath && fileStatus !== 'D'),
  })

  const isDeleted = fileStatus === 'D'

  let content: React.ReactNode

  if (isDeleted) {
    content = (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-(--hp-text-tertiary)">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" />
        </svg>
        <span className="text-sm">{t('git.preview.deleted')}</span>
      </div>
    )
  } else if (fileQuery.isLoading) {
    content = <LoadingState label={t('loading')} />
  } else if (fileQuery.error) {
    content = (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-(--hp-text-tertiary)">
        <span className="text-sm">{t('git.preview.loadFailed')}</span>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.sessionFile(sessionId, filePath) })}
          className="text-xs text-(--hp-primary) hover:underline"
        >
          {t('git.preview.retry')}
        </button>
      </div>
    )
  } else if (fileQuery.data?.success && fileQuery.data.content) {
    const decoded = decodeBase64(fileQuery.data.content)
    const binary = !decoded.ok || isBinaryContent(decoded.text)
    const imageMime = resolveImageMimeType(filePath)

    if (binary && imageMime) {
      const dataUri = `data:${imageMime};base64,${fileQuery.data.content}`
      content = (
        <div className="p-4">
          <ImagePreview src={dataUri} fileName={fileName} label={filePath} />
        </div>
      )
    } else if (binary) {
      content = (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-(--hp-text-tertiary)">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="4.93" x2="19.07" y1="4.93" y2="19.07" />
          </svg>
          <span className="text-sm">{t('git.preview.binary')}</span>
        </div>
      )
    } else if (isMarkdownFile(filePath)) {
      content = <MarkdownFilePreview content={decoded.text} className="p-4" />
    } else {
      const language = resolveLanguage(filePath)
      content = (
        <CodeBlock
          code={decoded.text}
          language={language}
          collapseLongContent
          scrollY
          size="compact"
        />
      )
    }
  } else {
    content = (
      <div className="flex items-center justify-center py-12 text-sm text-(--hp-text-tertiary)">
        {t('git.preview.noContent')}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch" role="dialog" aria-modal="true" aria-label={t('git.preview.title')}>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        style={{ opacity: open ? 1 : 0 }}
        onClick={handleClose}
      />
      <div
        ref={panelRef}
        className="absolute right-0 top-0 bottom-0 w-[55vw] max-w-[800px] min-w-[320px] bg-(--hp-surface-0) border-l border-(--hp-divider) flex flex-col transition-transform duration-200 ease-out max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-full max-md:w-full max-md:min-w-0 max-md:max-w-none max-md:rounded-t-xl max-md:border-l-0 max-md:border-t"
        style={{
          transform: open ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-(--hp-divider) shrink-0">
          <button
            ref={closeBtnRef}
            onClick={handleClose}
            className="h-10 w-10 max-md:h-10 max-md:w-10 md:h-8 md:w-8 rounded-full flex items-center justify-center hover:bg-(--hp-surface-1) transition-colors text-(--hp-text-tertiary)"
            aria-label={t('button.close')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
          <span className="font-mono text-xs truncate flex-1 text-(--hp-text-primary)">{filePath}</span>
          <GitStatusBadge status={fileStatus} />
          <button
            onClick={onOpenInFileManager}
            disabled={closing}
            className="text-xs text-(--hp-primary) hover:underline shrink-0 disabled:opacity-50"
          >
            {t('git.preview.openInFileManager')}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 pb-[env(safe-area-inset-bottom)]">
          {content}
        </div>
      </div>
    </div>
  )
}
