import { useMemo, useCallback, useInsertionEffect, useRef } from 'react'
import { FileIcon } from './FileIcon'
import type { FileEntry, SortOption, SortField, SortDirection } from './types'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface DirectoryViewProps {
  entries: FileEntry[]
  isLoading: boolean
  error: string | null
  sort: SortOption
  onSortChange: (sort: SortOption) => void
  onOpenDirectory: (path: string) => void
  onOpenFile: (path: string) => void
  onContextMenu: (path: string, type: 'file' | 'directory', point: { x: number; y: number }) => void
  selectedPath: string | null
  onRetry: () => void
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${i === 0 ? value : value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const OPPOSITE_DIRECTION: Record<SortDirection, SortDirection> = {
  asc: 'desc',
  desc: 'asc',
}

/* ------------------------------------------------------------------ */
/*  SkeletonRow                                                        */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <div
      style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        borderBottom: '1px solid var(--hp-divider)',
      }}
    >
      <div
        className="animate-pulse"
        style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--hp-surface-1)' }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          className="animate-pulse"
          style={{ height: 12, width: '60%', borderRadius: 4, background: 'var(--hp-surface-1)' }}
        />
        <div
          className="animate-pulse"
          style={{ height: 10, width: '35%', borderRadius: 4, background: 'var(--hp-surface-1)' }}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  FileRow                                                            */
/* ------------------------------------------------------------------ */

interface FileRowProps {
  entry: FileEntry
  index: number
  isSelected: boolean
  onOpenDirectory: (path: string) => void
  onOpenFile: (path: string) => void
  onContextMenu: (path: string, type: 'file' | 'directory', point: { x: number; y: number }) => void
}

function FileRow({
  entry,
  index,
  isSelected,
  onOpenDirectory,
  onOpenFile,
  onContextMenu,
}: FileRowProps) {
  const handleClick = useCallback(() => {
    if (entry.type === 'directory') {
      onOpenDirectory(entry.path)
    } else {
      onOpenFile(entry.path)
    }
  }, [entry.path, entry.type, onOpenDirectory, onOpenFile])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const rect = e.currentTarget.getBoundingClientRect()
      onContextMenu(entry.path, entry.type, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    },
    [entry.path, entry.type, onContextMenu],
  )

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
      className="fm-file-row"
      style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        borderBottom: '1px solid var(--hp-divider)',
        cursor: 'pointer',
        position: 'relative',
        background: isSelected ? 'var(--hp-primary-subtle)' : undefined,
        borderLeft: isSelected ? '3px solid var(--hp-primary)' : '3px solid transparent',
        animation: `fm-fadeInUp 0.2s ease-out ${index * 30}ms both`,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'var(--hp-surface-1)'
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = ''
      }}
    >
      {/* Mobile: Name column (full width, icon + text + action) */}
      <div className="fm-row-mobile" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <FileIcon fileName={entry.name} size={28} isHidden={entry.isHidden} isGitRepo={entry.isGitRepo} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 'var(--hp-text-base, 14px)',
            fontWeight: 500,
            color: 'var(--hp-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {entry.name}
          </div>
          {/* Subtitle: mobile only */}
          <div className="fm-row-subtitle" style={{
            fontSize: 'var(--hp-text-xs, 11px)',
            color: 'var(--hp-text-tertiary)',
            marginTop: 2,
          }}>
            {formatSize(entry.size)} &middot; {formatDate(entry.modified)}
          </div>
        </div>
      </div>

      {/* Desktop: Size column */}
      <div className="fm-row-size-desktop" style={{
        width: 70,
        textAlign: 'right',
        fontSize: 'var(--hp-text-sm, 12px)',
        fontFamily: 'var(--hp-font-mono, ui-monospace, monospace)',
        color: 'var(--hp-text-tertiary)',
        flexShrink: 0,
      }}>
        {entry.type === 'file' ? formatSize(entry.size) : '--'}
      </div>

      {/* Desktop: Modified column */}
      <div className="fm-row-modified-desktop" style={{
        width: 70,
        textAlign: 'right',
        fontSize: 'var(--hp-text-sm, 12px)',
        color: 'var(--hp-text-tertiary)',
        flexShrink: 0,
      }}>
        {formatDate(entry.modified)}
      </div>

      {/* Action button */}
      <button
        type="button"
        onClick={handleContextMenu}
        style={{
          width: 32,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--hp-text-tertiary)',
          fontSize: 18,
          lineHeight: 1,
          borderRadius: 6,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--hp-surface-2)'
          e.currentTarget.style.color = 'var(--hp-text-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none'
          e.currentTarget.style.color = 'var(--hp-text-tertiary)'
        }}
        aria-label="Context menu"
      >
        &#8943;
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

interface HeaderCell {
  field: SortField
  label: string
  width?: string | number
  flex?: number
  align: 'left' | 'right'
}

const HEADER_CELLS: HeaderCell[] = [
  { field: 'name', label: 'Name', flex: 1, align: 'left' },
  { field: 'size', label: 'Size', width: 70, align: 'right' },
  { field: 'modified', label: 'Modified', width: 70, align: 'right' },
]

function SortHeader({
  sort,
  onSortChange,
}: {
  sort: SortOption
  onSortChange: (sort: SortOption) => void
}) {
  return (
    <div
      className="fm-sort-header"
      style={{
        height: 32,
        display: 'none',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        background: 'var(--hp-surface-1)',
        borderBottom: '1px solid var(--hp-divider)',
      }}
    >
      {HEADER_CELLS.map((cell) => {
        const isActive = sort.field === cell.field
        const arrow = isActive ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''
        return (
          <button
            key={cell.field}
            type="button"
            onClick={() => {
              onSortChange({
                field: cell.field,
                direction: isActive ? OPPOSITE_DIRECTION[sort.direction] : 'asc',
              })
            }}
            style={{
              ...(cell.flex != null ? { flex: cell.flex } : { width: cell.width }),
              textAlign: cell.align,
              fontSize: 11,
              fontWeight: 600,
              color: isActive ? 'var(--hp-text-secondary)' : 'var(--hp-text-tertiary)',
              textTransform: 'uppercase' as const,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              letterSpacing: '0.02em',
              userSelect: 'none',
            }}
          >
            {cell.label}{arrow}
          </button>
        )
      })}
      {/* Spacer matching action button width */}
      <div style={{ width: 32, flexShrink: 0 }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48,
      gap: 8,
    }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={40}
        height={40}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: 'var(--hp-text-tertiary)', marginBottom: 8 }}
        aria-hidden="true"
      >
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--hp-text-primary)' }}>
        This folder is empty
      </div>
      <div style={{ fontSize: 13, color: 'var(--hp-text-tertiary)' }}>
        Create a new file or folder to get started
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Error state                                                        */
/* ------------------------------------------------------------------ */

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48,
      gap: 12,
    }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={40}
        height={40}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: 'var(--hp-danger)' }}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--hp-text-primary)' }}>
        Failed to load directory
      </div>
      <div style={{ fontSize: 13, color: 'var(--hp-text-tertiary)', textAlign: 'center', maxWidth: 320 }}>
        {message}
      </div>
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: 4,
          padding: '8px 20px',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--hp-text-primary)',
          background: 'none',
          border: '1px solid var(--hp-border)',
          borderRadius: 8,
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hp-surface-1)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
      >
        Retry
      </button>
    </div>
  )
}

const STYLESHEET = [
  '@keyframes fm-fadeInUp {',
  '  from { opacity: 0; transform: translateY(4px); }',
  '  to { opacity: 1; transform: translateY(0); }',
  '}',
  '@media (min-width: 768px) {',
  '  .fm-sort-header { display: flex !important; }',
  '  .fm-file-row { height: 44px !important; }',
  '  .fm-row-subtitle { display: none !important; }',
  '  .fm-row-size-desktop,',
  '  .fm-row-modified-desktop { display: block !important; }',
  '}',
  '@media (max-width: 767px) {',
  '  .fm-sort-header { display: none !important; }',
  '  .fm-row-size-desktop,',
  '  .fm-row-modified-desktop { display: none !important; }',
  '}',
].join('\n')

let styleInjected = false

function useDirectoryStyles() {
  const injected = useRef(styleInjected)
  useInsertionEffect(() => {
    if (injected.current) return
    const el = document.createElement('style')
    el.setAttribute('data-fm', '')
    el.textContent = STYLESHEET
    document.head.appendChild(el)
    styleInjected = true
    injected.current = true
  }, [])
}

/* ------------------------------------------------------------------ */
/*  DirectoryView                                                      */
/* ------------------------------------------------------------------ */

export default function DirectoryView({
  entries,
  isLoading,
  error,
  sort,
  onSortChange,
  onOpenDirectory,
  onOpenFile,
  onContextMenu,
  selectedPath,
  onRetry,
}: DirectoryViewProps) {
  useDirectoryStyles()

  const sorted = useMemo(() => {
    const copy = [...entries]
    copy.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1

      const dir = sort.direction === 'asc' ? 1 : -1
      switch (sort.field) {
        case 'name':
          return dir * a.name.localeCompare(b.name)
        case 'size':
          return dir * (a.size - b.size)
        case 'modified': {
          const ta = new Date(a.modified).getTime()
          const tb = new Date(b.modified).getTime()
          return dir * (ta - tb)
        }
        default:
          return 0
      }
    })
    return copy
  }, [entries, sort])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SortHeader sort={sort} onSortChange={onSortChange} />

      {isLoading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            Loading directory contents
          </span>
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : sorted.length === 0 ? (
        <EmptyState />
      ) : (
        <div role="list" aria-label="Directory contents">
          {sorted.map((entry, index) => (
            <FileRow
              key={entry.path}
              entry={entry}
              index={index}
              isSelected={selectedPath === entry.path}
              onOpenDirectory={onOpenDirectory}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}
