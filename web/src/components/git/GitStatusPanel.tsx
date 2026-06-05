import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { useContextMenu } from '@/hooks/useContextMenu'
import { ContextMenu } from '@/components/ui/ContextMenu'
import type { ContextMenuItem } from '@/components/ui/ContextMenu'
import { GitStatusBadge } from '@/components/git/GitStatusBadge'

interface GitFile {
  status: string
  path: string
}

interface StatusData {
  branch: string
  ahead: number
  behind: number
  files: GitFile[]
}

interface GitStatusPanelProps {
  sessionId: string
  onStatusLoaded?: (branch: string) => void
  onFilesChanged?: (files: { status: string; path: string }[]) => void
  onViewDiff?: (path: string) => void
  onCopyPath?: (path: string) => void
  onOpenFile?: (path: string) => void
  onPreview?: (path: string, status: string) => void
}

export function GitStatusPanel({ sessionId, onStatusLoaded, onFilesChanged, onViewDiff, onCopyPath, onOpenFile, onPreview }: GitStatusPanelProps) {
  const { api } = useAppContext()
  const { t } = useTranslation()
  const [status, setStatus] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!api) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.getGitStatus(sessionId)
      if (res.success && res.stdout) {
        const parsed = parseGitStatus(res.stdout)
        setStatus(parsed)
        onStatusLoaded?.(parsed.branch)
        onFilesChanged?.(parsed.files)
      } else {
        setError(res.error || t('git.status.failed'))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [api, sessionId, onStatusLoaded, onFilesChanged, t])

  useEffect(() => { refresh() }, [refresh])

  if (loading && !status) {
    return <div className="p-4 text-sm text-[--hp-text-tertiary]">{t('git.status.loading')}</div>
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-[--hp-danger]">{error}</p>
        <button onClick={refresh} className="text-xs mt-2 underline text-[--hp-primary]">{t('git.status.retry')}</button>
      </div>
    )
  }

  if (!status) return null

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono px-2 py-0.5 rounded-[--hp-radius-xs] text-[--hp-primary] bg-[--hp-primary-subtle]">
          {status.branch}
        </span>
        {(status.ahead > 0 || status.behind > 0) && (
          <span className="text-xs text-[--hp-text-tertiary]">
            {status.ahead > 0 && `↑${status.ahead}`}
            {status.behind > 0 && `↓${status.behind}`}
          </span>
        )}
        <button onClick={refresh} className="ml-auto text-xs text-[--hp-text-tertiary]" title="Refresh">↻</button>
      </div>

      {status.files.length === 0 ? (
        <p className="text-sm text-[--hp-text-tertiary]">{t('git.status.clean')}</p>
      ) : (
        <div className="space-y-1">
          {status.files.map((file) => (
            <GitFileRow
              key={file.path}
              file={file}
              onViewDiff={onViewDiff}
              onCopyPath={onCopyPath}
              onOpenFile={onOpenFile}
              onPreview={onPreview}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GitFileRow({ file, onViewDiff, onCopyPath, onOpenFile, onPreview }: {
  file: GitFile
  onViewDiff?: (path: string) => void
  onCopyPath?: (path: string) => void
  onOpenFile?: (path: string) => void
  onPreview?: (path: string, status: string) => void
}) {
  const { t } = useTranslation()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const justClosedRef = useRef(false)
  const longPressJustFiredRef = useRef(false)
  const moreBtnRef = useRef<HTMLButtonElement>(null)

  const handleContextMenu = useCallback((pos: { x: number; y: number }) => {
    if (justClosedRef.current) return
    longPressJustFiredRef.current = true
    setTimeout(() => { longPressJustFiredRef.current = false }, 400)
    setContextMenu(pos)
  }, [])

  const handlers = useContextMenu(handleContextMenu)

  const handleClose = useCallback(() => {
    setContextMenu(null)
    justClosedRef.current = true
    setTimeout(() => { justClosedRef.current = false }, 300)
  }, [])

  const handleMoreClick = useCallback(() => {
    if (justClosedRef.current) return
    const rect = moreBtnRef.current?.getBoundingClientRect()
    if (rect) {
      setContextMenu({ x: rect.left, y: rect.bottom + 4 })
    }
  }, [])

  const contextMenuItems = useMemo<ContextMenuItem[]>(() => [
    {
      label: t('git.context.viewDiff'),
      icon: '∓',
      disabled: file.status === '?',
      onClick: () => onViewDiff?.(file.path),
    },
    {
      label: t('git.context.copyPath'),
      icon: '📋',
      onClick: () => onCopyPath?.(file.path),
    },
    {
      label: t('git.context.openFile'),
      icon: '↗',
      onClick: () => onPreview?.(file.path, file.status),
    },
  ], [t, file.path, file.status, onViewDiff, onCopyPath, onPreview])

  return (
    <>
      <div
        {...handlers}
        onClick={() => { if (!longPressJustFiredRef.current) onPreview?.(file.path, file.status) }}
        className="flex items-center gap-2 text-sm py-2 px-2 rounded-[--hp-radius-sm] bg-[--hp-surface-0] cursor-pointer hover:bg-[--hp-surface-1] active:bg-[--hp-surface-1] transition-colors min-h-[44px]"
        tabIndex={0}
        role="button"
        aria-label={`${file.path} ${file.status}`}
      >
        <GitStatusBadge status={file.status} />
        <span className="font-mono text-xs truncate flex-1 text-[--hp-text-primary]">
          {file.path}
        </span>
        <button
          ref={moreBtnRef}
          onClick={(e) => { e.stopPropagation(); handleMoreClick() }}
          className="w-8 h-8 flex items-center justify-center text-[--hp-text-tertiary] hover:text-[--hp-text-primary] text-sm leading-none rounded-full hover:bg-[--hp-surface-1] transition-colors"
        >
          ···
        </button>
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={handleClose}
        />
      )}
    </>
  )
}

function parseGitStatus(raw: string): StatusData {
  const lines = raw.split('\n').filter(Boolean)
  let branch = 'HEAD'
  let ahead = 0
  let behind = 0
  const files: GitFile[] = []

  for (const line of lines) {
    if (line.startsWith('# branch.head')) {
      branch = line.split(' ').pop() || 'HEAD'
    } else if (line.startsWith('# branch.ab')) {
      const parts = line.split(' ')
      ahead = Math.abs(Number(parts.find(p => p.startsWith('+'))?.slice(1) || '0'))
      behind = Math.abs(Number(parts.find(p => p.startsWith('-'))?.slice(1) || '0'))
    } else if (line.startsWith('1 ') || line.startsWith('? ')) {
      const xy = line.startsWith('1 ') ? line.split(' ')[1] : '??'
      const statusChar = xy === '??' ? '?' : (xy[0] !== '.' ? xy[0] : xy[1])
      const pathPart = line.startsWith('1 ')
        ? line.split(' ').slice(8).join(' ')
        : line.slice(2)
      files.push({ status: statusChar, path: pathPart })
    } else if (line.startsWith('2 ')) {
      const parts = line.split(' ')
      const xy = parts[1]
      const statusChar = xy[0] !== '.' ? xy[0] : xy[1]
      const path = parts.slice(8).join(' ')
      files.push({ status: statusChar, path })
    }
  }

  return { branch, ahead, behind, files }
}
