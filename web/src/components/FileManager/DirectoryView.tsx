import { useCallback, useInsertionEffect, useRef } from 'react'
import { FileIcon } from './FileIcon'
import type { FileEntry, SortOption, SortField, SortDirection } from './types'

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
  onSelect: (path: string) => void
  onRetry: () => void
  /** Batch selection */
  selectedPaths: Set<string>
  onToggleSelect: (path: string, shiftKey: boolean, ctrlKey: boolean) => void
  onSelectAll: () => void
  highlightPath: string | null
}

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

const OPPOSITE: Record<SortDirection, SortDirection> = { asc: 'desc', desc: 'asc' }

function SkeletonRow() {
  return (
    <div style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderBottom: '1px solid var(--hp-divider)' }}>
      <div className="animate-pulse" style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--hp-surface-1)' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="animate-pulse" style={{ height: 12, width: '60%', borderRadius: 4, background: 'var(--hp-surface-1)' }} />
        <div className="animate-pulse" style={{ height: 10, width: '35%', borderRadius: 4, background: 'var(--hp-surface-1)' }} />
      </div>
    </div>
  )
}

interface FileRowProps {
  entry: FileEntry
  index: number
  isSelected: boolean
  isChecked: boolean
  isNew: boolean
  onOpenDirectory: (path: string) => void
  onOpenFile: (path: string) => void
  onContextMenu: (path: string, type: 'file' | 'directory', point: { x: number; y: number }) => void
  onToggleSelect: (path: string, shiftKey: boolean, ctrlKey: boolean) => void
  onSelect: (path: string) => void
}

function FileRow({ entry, index, isSelected, isChecked, isNew, onOpenDirectory, onOpenFile, onContextMenu, onToggleSelect, onSelect }: FileRowProps) {
  const handleClick = useCallback(() => {
    onSelect(entry.path)
    if (entry.type === 'directory') onOpenDirectory(entry.path)
    else onOpenFile(entry.path)
  }, [entry.path, entry.type, onOpenDirectory, onOpenFile, onSelect])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      const rect = e.currentTarget.getBoundingClientRect()
      onContextMenu(entry.path, entry.type, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    },
    [entry.path, entry.type, onContextMenu],
  )

  const animClass = isNew ? 'fm-row-new' : 'fm-row-enter'
  const bg = isChecked ? 'var(--hp-primary-subtle)' : isSelected ? 'var(--hp-primary-subtle)' : undefined
  const borderLeft = isSelected || isChecked ? '3px solid var(--hp-primary)' : '3px solid transparent'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
      className={`fm-file-row ${animClass}`}
      style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        borderBottom: '1px solid var(--hp-divider)',
        cursor: 'pointer',
        position: 'relative',
        background: bg,
        borderLeft,
        animationDelay: `${index * 30}ms`,
      }}
      onMouseEnter={(e) => { if (!isSelected && !isChecked) e.currentTarget.style.background = 'var(--hp-surface-1)' }}
      onMouseLeave={(e) => { if (!isSelected && !isChecked) e.currentTarget.style.background = '' }}
    >
      {/* Desktop checkbox */}
      <label
        className="fm-row-checkbox"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            const ne = e.nativeEvent as MouseEvent
            onToggleSelect(entry.path, ne.shiftKey, ne.ctrlKey || ne.metaKey)
          }}
          style={{ width: 16, height: 16, accentColor: 'var(--hp-primary)', cursor: 'pointer' }}
        />
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <FileIcon fileName={entry.name} size={28} isHidden={entry.isHidden} isGitRepo={entry.isGitRepo} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--hp-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.name}
          </div>
          <div className="fm-row-subtitle" style={{ fontSize: 11, color: 'var(--hp-text-tertiary)', marginTop: 2 }}>
            {formatSize(entry.size)} &middot; {formatDate(entry.modified)}
          </div>
        </div>
      </div>

      <div className="fm-row-size-desktop" style={{ width: 70, textAlign: 'right', fontSize: 12, fontFamily: 'var(--hp-font-mono, ui-monospace, monospace)', color: 'var(--hp-text-tertiary)', flexShrink: 0, display: 'none' }}>
        {entry.type === 'file' ? formatSize(entry.size) : '--'}
      </div>
      <div className="fm-row-modified-desktop" style={{ width: 70, textAlign: 'right', fontSize: 12, color: 'var(--hp-text-tertiary)', flexShrink: 0, display: 'none' }}>
        {formatDate(entry.modified)}
      </div>

      <button type="button" onClick={handleContextMenu} style={{ width: 32, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--hp-text-tertiary)', fontSize: 18, lineHeight: 1, borderRadius: 6, flexShrink: 0 }} aria-label="Context menu"
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hp-surface-2)'; e.currentTarget.style.color = 'var(--hp-text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--hp-text-tertiary)' }}>
        &#8943;
      </button>
    </div>
  )
}

function SortHeader({ sort, onSortChange, allSelected, onSelectAll }: { sort: SortOption; onSortChange: (s: SortOption) => void; allSelected: boolean; onSelectAll: () => void }) {
  const cells: { field: SortField; label: string; flex?: number; width?: number; align: 'left' | 'right' }[] = [
    { field: 'name', label: 'Name', flex: 1, align: 'left' },
    { field: 'size', label: 'Size', width: 70, align: 'right' },
    { field: 'modified', label: 'Modified', width: 70, align: 'right' },
  ]

  return (
    <div className="fm-sort-header" style={{ height: 32, display: 'none', alignItems: 'center', gap: 12, padding: '0 16px', background: 'var(--hp-surface-1)', borderBottom: '1px solid var(--hp-divider)' }}>
      <label className="fm-row-checkbox" style={{ display: 'none', alignItems: 'center', justifyContent: 'center', width: 20, flexShrink: 0, cursor: 'pointer' }}>
        <input type="checkbox" checked={allSelected} onChange={onSelectAll} style={{ width: 16, height: 16, accentColor: 'var(--hp-primary)', cursor: 'pointer' }} />
      </label>
      {cells.map((cell) => {
        const active = sort.field === cell.field
        return (
          <button key={cell.field} type="button" onClick={() => onSortChange({ field: cell.field, direction: active ? OPPOSITE[sort.direction] : 'asc' })}
            style={{ ...(cell.flex != null ? { flex: cell.flex } : { width: cell.width }), textAlign: cell.align, fontSize: 11, fontWeight: 600, color: active ? 'var(--hp-text-secondary)' : 'var(--hp-text-tertiary)', textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer', padding: 0, letterSpacing: '0.02em', userSelect: 'none' }}>
            {cell.label}{active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
          </button>
        )
      })}
      <div style={{ width: 32, flexShrink: 0 }} />
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 8 }}>
      <svg xmlns="http://www.w3.org/2000/svg" width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--hp-text-tertiary)', marginBottom: 8 }} aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--hp-text-primary)' }}>This folder is empty</div>
      <div style={{ fontSize: 13, color: 'var(--hp-text-tertiary)' }}>Create a new file or folder to get started</div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 }}>
      <svg xmlns="http://www.w3.org/2000/svg" width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--hp-danger)' }} aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--hp-text-primary)' }}>Failed to load directory</div>
      <div style={{ fontSize: 13, color: 'var(--hp-text-tertiary)', textAlign: 'center', maxWidth: 320 }}>{message}</div>
      <button type="button" onClick={onRetry} style={{ marginTop: 4, padding: '8px 20px', fontSize: 13, fontWeight: 500, color: 'var(--hp-text-primary)', background: 'none', border: '1px solid var(--hp-border)', borderRadius: 8, cursor: 'pointer' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hp-surface-1)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}>
        Retry
      </button>
    </div>
  )
}

const STYLESHEET = `
@keyframes fm-row-enter {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fm-row-new {
  0% { opacity: 0; transform: translateX(-12px); }
  60% { opacity: 1; transform: translateX(0); background: var(--hp-primary-subtle); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes fm-dir-enter {
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: translateX(0); }
}
.fm-dir-enter {
  animation: fm-dir-enter 200ms var(--hp-ease-overlay, cubic-bezier(0.16, 1, 0.3, 1)) both;
}
@media (min-width: 768px) {
  .fm-sort-header { display: flex !important; }
  .fm-file-row { height: 44px !important; }
  .fm-row-subtitle { display: none !important; }
  .fm-row-size-desktop, .fm-row-modified-desktop { display: block !important; }
  .fm-row-checkbox { display: flex !important; }
}
@media (max-width: 767px) {
  .fm-sort-header { display: none !important; }
  .fm-row-size-desktop, .fm-row-modified-desktop { display: none !important; }
}
@media (prefers-reduced-motion: reduce) {
  .fm-row-enter, .fm-row-new { animation: none !important; }
  .fm-dir-enter { animation: none !important; }
}
`

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

export default function DirectoryView({
  entries, isLoading, error, sort, onSortChange, onOpenDirectory, onOpenFile, onContextMenu,
  selectedPath, onSelect, onRetry, selectedPaths, onToggleSelect, onSelectAll, highlightPath,
}: DirectoryViewProps) {
  useDirectoryStyles()

  const sorted = entries

  const allSelected = entries.length > 0 && entries.every((e) => selectedPaths.has(e.path))

  return (
    <div className="fm-dir-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SortHeader sort={sort} onSortChange={onSortChange} allSelected={allSelected} onSelectAll={onSelectAll} />

      {isLoading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Loading directory contents</span>
          {Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} />)}
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
              isChecked={selectedPaths.has(entry.path)}
              isNew={highlightPath === entry.path}
              onOpenDirectory={onOpenDirectory}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
              onToggleSelect={onToggleSelect}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
