import { useState, useCallback, useEffect, useRef } from 'react'
import { BreadcrumbNav, buildBreadcrumbs } from './BreadcrumbNav'
import DirectoryView from './DirectoryView'
import { ContextMenu, useContextMenu } from './ContextMenu'
import type { ContextMenuItem } from './ContextMenu'
import { mockListDirectory } from '@/lib/file-manager-mock'
import type { FileEntry, SortOption, BreadcrumbSegment } from './types'

const DEFAULT_ROOT = '/home/user/project'
const DEFAULT_SORT: SortOption = { field: 'name', direction: 'asc' }

export function FileManager() {
  const [currentPath, setCurrentPath] = useState(DEFAULT_ROOT)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [sort, setSort] = useState<SortOption>(DEFAULT_SORT)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const mountedRef = useRef(false)
  const ctxMenu = useContextMenu()

  const loadDirectory = useCallback(async (path: string, hidden: boolean) => {
    setIsLoading(true)
    setError(null)
    setSelectedPath(null)
    try {
      const result = await mockListDirectory(path, hidden)
      setEntries(result.entries)
      setCurrentPath(path)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load directory')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDirectory(DEFAULT_ROOT, false)
  }, [loadDirectory])

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    loadDirectory(currentPath, showHidden)
  }, [showHidden]) // eslint-disable-line react-hooks/exhaustive-deps

  const breadcrumbs: BreadcrumbSegment[] = buildBreadcrumbs(currentPath, 'project')

  const handleNavigate = useCallback((path: string) => {
    loadDirectory(path, showHidden)
  }, [loadDirectory, showHidden])

  const handleOpenDirectory = useCallback((path: string) => {
    loadDirectory(path, showHidden)
  }, [loadDirectory, showHidden])

  const handleOpenFile = useCallback((_path: string) => {
    // Phase 3+: file preview
  }, [])

  const handleContextMenu = useCallback(
    (path: string, type: 'file' | 'directory', point: { x: number; y: number }) => {
      setSelectedPath(path)
      const items: ContextMenuItem[] = [
        { label: 'New File', icon: '📄', onClick: () => {} },
        { label: 'New Folder', icon: '📁', onClick: () => {} },
        { label: 'Rename', icon: '✏️', onClick: () => {} },
        { label: 'Copy Path', icon: '📋', onClick: () => { navigator.clipboard.writeText(path) } },
        { label: 'Move…', icon: '↗️', onClick: () => {} },
        { label: 'Copy…', icon: '📋', onClick: () => {} },
      ]
      if (type === 'file') {
        items.push({ label: 'Download', icon: '⬇️', onClick: () => {} })
      }
      items.push({ label: 'Delete', icon: '🗑️', danger: true, onClick: () => {} })
      ctxMenu.show(point.x, point.y, items)
    },
    [ctxMenu],
  )

  const handleRetry = useCallback(() => {
    loadDirectory(currentPath, showHidden)
  }, [loadDirectory, currentPath, showHidden])

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 border-b border-(--hp-border) px-3"
        style={{ height: 44, background: 'var(--hp-surface-0)' }}
      >
        <button
          type="button"
          onClick={() => setShowHidden((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            color: showHidden ? 'var(--hp-primary)' : 'var(--hp-text-tertiary)',
            background: showHidden ? 'var(--hp-primary-subtle)' : 'var(--hp-surface-1)',
            transition: 'all 0.15s',
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {showHidden ? (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </>
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
          <span className="hidden sm:inline">
            {showHidden ? 'Hide dotfiles' : 'Show dotfiles'}
          </span>
        </button>

        <div className="flex-1" />

        <span
          style={{
            fontSize: 11,
            color: 'var(--hp-text-tertiary)',
            fontFamily: 'var(--hp-font-mono, ui-monospace, monospace)',
          }}
        >
          {entries.length} item{entries.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Breadcrumb */}
      <BreadcrumbNav segments={breadcrumbs} onNavigate={handleNavigate} />

      {/* File list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DirectoryView
          entries={entries}
          isLoading={isLoading}
          error={error}
          sort={sort}
          onSortChange={setSort}
          onOpenDirectory={handleOpenDirectory}
          onOpenFile={handleOpenFile}
          onContextMenu={handleContextMenu}
          selectedPath={selectedPath}
          onRetry={handleRetry}
        />
      </div>

      {/* Bottom toolbar (mobile) */}
      <div
        className="flex items-center justify-around border-t border-(--hp-border) md:hidden"
        style={{
          height: 56,
          background: 'var(--hp-surface-0)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <ToolbarButton label="New" icon="+" />
        <ToolbarButton label="Paste" icon="⊂" />
        <ToolbarButton label="Upload" icon="↑" />
        <ToolbarButton label="Session" icon="▶" />
      </div>

      {/* Context menu (portal-level fixed) */}
      <ContextMenu state={ctxMenu.state} onClose={ctxMenu.hide} />
    </div>
  )
}

function ToolbarButton({ label, icon }: { label: string; icon: string }) {
  return (
    <button
      type="button"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '4px 12px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--hp-text-tertiary)',
        borderRadius: 8,
        minWidth: 56,
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--hp-text-primary)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--hp-text-tertiary)' }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
    </button>
  )
}
