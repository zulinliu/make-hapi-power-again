import { useState, useCallback, useEffect, useRef } from 'react'
import { BreadcrumbNav, buildBreadcrumbs } from './BreadcrumbNav'
import DirectoryView from './DirectoryView'
import { ContextMenu, useContextMenu } from './ContextMenu'
import type { ContextMenuItem } from './ContextMenu'
import { Dialog, InputField, ConfirmMessage } from './Dialog'
import { showToast, ToastContainer } from './Toast'
import {
  mockListDirectory,
  mockCreateFile,
  mockCreateFolder,
  mockDelete,
  mockRename,
} from '@/lib/file-manager-mock'
import type { FileEntry, SortOption, BreadcrumbSegment } from './types'

const DEFAULT_ROOT = '/home/user/project'
const DEFAULT_SORT: SortOption = { field: 'name', direction: 'asc' }

type DialogState =
  | { type: 'newFile' }
  | { type: 'newFolder' }
  | { type: 'rename'; name: string; path: string }
  | { type: 'delete'; name: string; path: string }
  | null

export function FileManager() {
  const [currentPath, setCurrentPath] = useState(DEFAULT_ROOT)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [sort, setSort] = useState<SortOption>(DEFAULT_SORT)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
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

  const reload = useCallback(() => {
    loadDirectory(currentPath, showHidden)
  }, [loadDirectory, currentPath, showHidden])

  useEffect(() => { loadDirectory(DEFAULT_ROOT, false) }, [loadDirectory])

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
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
      const name = path.split('/').pop() ?? ''
      const items: ContextMenuItem[] = [
        { label: 'New File', icon: '📄', onClick: () => { setInputValue(''); setDialog({ type: 'newFile' }) } },
        { label: 'New Folder', icon: '📁', onClick: () => { setInputValue(''); setDialog({ type: 'newFolder' }) } },
        { label: 'Rename', icon: '✏️', onClick: () => { setInputValue(name); setDialog({ type: 'rename', name, path }) } },
        { label: 'Copy Path', icon: '📋', onClick: () => { navigator.clipboard.writeText(path); showToast('Path copied') } },
        { label: 'Move…', icon: '↗️', onClick: () => {} },
        { label: 'Copy…', icon: '⊂', onClick: () => {} },
      ]
      if (type === 'file') {
        items.push({ label: 'Download', icon: '⬇️', onClick: () => {} })
      }
      items.push({
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: () => setDialog({ type: 'delete', name, path }),
      })
      ctxMenu.show(point.x, point.y, items)
    },
    [ctxMenu],
  )

  const handleDialogSubmit = useCallback(async () => {
    if (!dialog) return
    setDialogLoading(true)
    try {
      switch (dialog.type) {
        case 'newFile': {
          if (!inputValue.trim()) return
          await mockCreateFile(currentPath, inputValue.trim())
          showToast('File created')
          break
        }
        case 'newFolder': {
          if (!inputValue.trim()) return
          await mockCreateFolder(currentPath, inputValue.trim())
          showToast('Folder created')
          break
        }
        case 'rename': {
          if (!inputValue.trim() || inputValue.trim() === dialog.name) { setDialog(null); setDialogLoading(false); return }
          await mockRename(currentPath, dialog.name, inputValue.trim())
          showToast('Renamed')
          break
        }
        case 'delete': {
          await mockDelete(currentPath, dialog.name)
          showToast('Deleted')
          break
        }
      }
      setDialog(null)
      setInputValue('')
      reload()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Operation failed', 'error')
    } finally {
      setDialogLoading(false)
    }
  }, [dialog, inputValue, currentPath, reload])

  const handleToolbarNew = useCallback(() => {
    setInputValue('')
    setDialog({ type: 'newFile' })
  }, [])

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
          <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {showHidden ? (
              <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
            ) : (
              <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
            )}
          </svg>
          <span className="hidden sm:inline">{showHidden ? 'Hide dotfiles' : 'Show dotfiles'}</span>
        </button>

        <button
          type="button"
          onClick={handleToolbarNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            color: 'oklch(100% 0 0)',
            background: 'var(--hp-primary)',
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
          <span className="hidden sm:inline">New</span>
        </button>

        <div className="flex-1" />

        <span style={{ fontSize: 11, color: 'var(--hp-text-tertiary)', fontFamily: 'var(--hp-font-mono, ui-monospace, monospace)' }}>
          {entries.length} item{entries.length !== 1 ? 's' : ''}
        </span>
      </div>

      <BreadcrumbNav segments={breadcrumbs} onNavigate={handleNavigate} />

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
          onRetry={reload}
        />
      </div>

      {/* Bottom toolbar (mobile) */}
      <div
        className="flex items-center justify-around border-t border-(--hp-border) md:hidden"
        style={{ height: 56, background: 'var(--hp-surface-0)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <ToolbarButton label="New" icon="+" onClick={handleToolbarNew} />
        <ToolbarButton label="Paste" icon="⊂" />
        <ToolbarButton label="Upload" icon="↑" />
        <ToolbarButton label="Session" icon="▶" />
      </div>

      <ContextMenu state={ctxMenu.state} onClose={ctxMenu.hide} />

      {/* Dialogs */}
      {dialog?.type === 'newFile' && (
        <Dialog title="New File" onClose={() => setDialog(null)} onSubmit={handleDialogSubmit} submitLabel="Create" loading={dialogLoading}>
          <InputField value={inputValue} onChange={setInputValue} placeholder="filename.ts" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleDialogSubmit() }} />
        </Dialog>
      )}
      {dialog?.type === 'newFolder' && (
        <Dialog title="New Folder" onClose={() => setDialog(null)} onSubmit={handleDialogSubmit} submitLabel="Create" loading={dialogLoading}>
          <InputField value={inputValue} onChange={setInputValue} placeholder="folder-name" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleDialogSubmit() }} />
        </Dialog>
      )}
      {dialog?.type === 'rename' && (
        <Dialog title="Rename" onClose={() => setDialog(null)} onSubmit={handleDialogSubmit} submitLabel="Rename" loading={dialogLoading}>
          <InputField value={inputValue} onChange={setInputValue} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleDialogSubmit() }} />
        </Dialog>
      )}
      {dialog?.type === 'delete' && (
        <Dialog title="Delete" onClose={() => setDialog(null)} onSubmit={handleDialogSubmit} submitLabel="Delete" submitDanger loading={dialogLoading}>
          <ConfirmMessage message={`Delete "${dialog.name}"? This cannot be undone.`} />
        </Dialog>
      )}

      <ToastContainer />
    </div>
  )
}

function ToolbarButton({ label, icon, onClick }: { label: string; icon: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
