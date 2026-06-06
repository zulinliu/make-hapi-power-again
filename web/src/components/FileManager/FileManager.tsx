import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from '@/lib/use-translation'
import { BreadcrumbNav, buildBreadcrumbs } from './BreadcrumbNav'
import DirectoryView from './DirectoryView'
import { ContextMenu, useContextMenu } from './ContextMenu'
import type { ContextMenuItem } from './ContextMenu'
import { Dialog, InputField, ConfirmMessage } from './Dialog'
import { showToast, ToastContainer } from './Toast'
import { BatchActionBar } from './BatchActionBar'
import {
  mockListDirectory,
  mockCreateFile,
  mockCreateFolder,
  mockDelete,
  mockRename,
} from '@/lib/file-manager-mock'
import {
  isApiReady,
  listDirectory as apiListDirectory,
  createFile as apiCreateFile,
  createFolder as apiCreateFolder,
  deleteEntry as apiDeleteEntry,
  renameEntry as apiRenameEntry,
} from '@/lib/file-manager-api'
import type { ApiClient } from '@/api/client'
import type { FileEntry, SortOption, SortField, BreadcrumbSegment } from './types'

export interface FileManagerProps {
  api?: ApiClient | null
  machineId?: string | null
  sessionId?: string | null
  initialPath?: string
}

const DEFAULT_ROOT = '/home/user/project'
const DEFAULT_SORT: SortOption = { field: 'name', direction: 'asc' }

type Translate = (key: string, params?: Record<string, string | number>) => string

function sortEntries(entries: FileEntry[], sort: SortOption): FileEntry[] {
  const copy = [...entries]
  copy.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    const dir = sort.direction === 'asc' ? 1 : -1
    switch (sort.field as SortField) {
      case 'name': return dir * a.name.localeCompare(b.name)
      case 'size': return dir * (a.size - b.size)
      case 'modified': return dir * (new Date(a.modified).getTime() - new Date(b.modified).getTime())
      default: return 0
    }
  })
  return copy
}

type DialogState =
  | { type: 'newFile' }
  | { type: 'newFolder' }
  | { type: 'rename'; name: string; path: string }
  | { type: 'delete'; name: string; path: string }
  | { type: 'batchDelete'; paths: string[] }
  | null

function isValidFileName(name: string): boolean {
  if (!name || name === '.' || name === '..') return false
  if (name.length > 255) return false
  if (name.includes('/') || name.includes('\\')) return false
  if (/[\x00-\x1f]/.test(name)) return false
  if (name.includes(':') && !/^[a-zA-Z]:/.test(name)) return false
  return true
}

async function copyToClipboard(text: string, t: Translate) {
  try {
    if (!navigator.clipboard?.writeText) {
      showToast(t('fm.toast.clipboardUnavailable'), 'error')
      return
    }
    await navigator.clipboard.writeText(text)
    showToast(t('fm.toast.pathCopied'))
  } catch {
    showToast(t('fm.toast.copyPathFailed'), 'error')
  }
}

export function FileManager({ api, machineId, sessionId, initialPath }: FileManagerProps = {}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const useRealApi = isApiReady(api ?? null, machineId ?? null)
  const [currentPath, setCurrentPath] = useState<string>(initialPath ?? DEFAULT_ROOT)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [sort, setSort] = useState<SortOption>(DEFAULT_SORT)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [highlightPath, setHighlightPath] = useState<string | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [navKey, setNavKey] = useState(0)
  const sortedEntries = useMemo(() => sortEntries(entries, sort), [entries, sort])
  const mountedRef = useRef(false)
  const ctxMenu = useContextMenu()

  const loadDirectory = useCallback(async (path: string, hidden: boolean) => {
    setIsLoading(true)
    setError(null)
    setSelectedPath(null)
    setSelectedPaths(new Set())
    try {
      let result: { path: string; entries: FileEntry[] }
      if (useRealApi && api && machineId) {
        result = await apiListDirectory(api, machineId, path, hidden)
      } else {
        result = await mockListDirectory(path, hidden)
      }
      setEntries(result.entries)
      setCurrentPath(path)
      setNavKey((k) => k + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('fm.error.title'))
    } finally {
      setIsLoading(false)
    }
  }, [useRealApi, api, machineId, t])

  const reload = useCallback(() => {
    loadDirectory(currentPath, showHidden)
  }, [loadDirectory, currentPath, showHidden])

  // Load initial directory once on mount
  useEffect(() => {
    loadDirectory(initialPath ?? DEFAULT_ROOT, false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    loadDirectory(currentPath, showHidden)
  }, [showHidden]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear highlight after animation
  useEffect(() => {
    if (!highlightPath) return
    const timer = setTimeout(() => setHighlightPath(null), 600)
    return () => clearTimeout(timer)
  }, [highlightPath])

  const breadcrumbs: BreadcrumbSegment[] = useMemo(() => buildBreadcrumbs(currentPath, 'project', t('fm.projectRoot')), [currentPath, t])

  const handleNavigate = useCallback((path: string) => {
    loadDirectory(path, showHidden)
  }, [loadDirectory, showHidden])

  const handleOpenDirectory = useCallback((path: string) => {
    loadDirectory(path, showHidden)
  }, [loadDirectory, showHidden])

  const handleOpenFile = useCallback((_path: string) => {
    // Phase 5+: file preview
  }, [])

  const handleUnavailableAction = useCallback((label: string) => {
    showToast(t('fm.toast.unavailableAction', { action: label }))
  }, [t])

  const handleContextMenu = useCallback(
    (path: string, type: 'file' | 'directory', point: { x: number; y: number }) => {
      if (isLoading) return
      setSelectedPath(path)
      const name = path.split('/').pop() ?? ''
      const items: ContextMenuItem[] = [
        { label: t('fm.context.newFile'), icon: 'file', onClick: () => { setInputValue(''); setDialog({ type: 'newFile' }) } },
        { label: t('fm.context.newFolder'), icon: 'folder', onClick: () => { setInputValue(''); setDialog({ type: 'newFolder' }) } },
        { label: t('fm.context.rename'), icon: 'rename', onClick: () => { setInputValue(name); setDialog({ type: 'rename', name, path }) } },
        { label: t('fm.context.copyPath'), icon: 'copyPath', onClick: () => { copyToClipboard(path, t) } },
        { label: t('fm.context.move'), icon: 'move', onClick: () => handleUnavailableAction(t('fm.batch.move')) },
        { label: t('fm.context.copy'), icon: 'copy', onClick: () => handleUnavailableAction(t('fm.batch.copy')) },
      ]
      if (type === 'file') {
        items.push({ label: t('fm.context.download'), icon: 'download', onClick: () => handleUnavailableAction(t('fm.context.download')) })
      }
      items.push({
        label: t('fm.context.delete'),
        icon: 'delete',
        danger: true,
        onClick: () => setDialog({ type: 'delete', name, path }),
      })
      ctxMenu.show(point.x, point.y, items)
    },
    [ctxMenu, handleUnavailableAction, isLoading, t],
  )

  // Batch selection
  const handleToggleSelect = useCallback((path: string, shiftKey: boolean, _ctrlKey: boolean) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (shiftKey && prev.size > 0) {
        const paths = sortedEntries.map((e) => e.path)
        const lastSelected = [...prev].pop()!
        const fromIdx = paths.indexOf(lastSelected)
        const toIdx = paths.indexOf(path)
        if (fromIdx !== -1 && toIdx !== -1) {
          const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
          for (let i = start; i <= end; i++) next.add(paths[i])
          return next
        }
      }
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [sortedEntries])

  const handleSelectAll = useCallback(() => {
    setSelectedPaths((prev) => {
      if (prev.size === sortedEntries.length) return new Set()
      return new Set(sortedEntries.map((e) => e.path))
    })
  }, [sortedEntries])

  // Dialog submit
  const handleDialogSubmit = useCallback(async () => {
    if (!dialog) return

    // Validate BEFORE setting loading state so early returns don't bypass finally
    if (dialog.type === 'newFile' || dialog.type === 'newFolder' || dialog.type === 'rename') {
      const name = inputValue.trim()
      if (!name) { showToast(t('fm.toast.nameRequired'), 'error'); return }
      if (!isValidFileName(name)) { showToast(t('fm.toast.invalidName'), 'error'); return }
      if (dialog.type === 'rename' && name === dialog.name) { setDialog(null); return }
    }

    setDialogLoading(true)
    try {
      const mid = machineId ?? ''
      const sid = sessionId ?? ''
      switch (dialog.type) {
        case 'newFile': {
          const name = inputValue.trim()
          if (useRealApi && api && sid) {
            await apiCreateFile(api, mid, sid, currentPath, name)
          } else if (!useRealApi) {
            await mockCreateFile(currentPath, name)
          } else {
            throw new Error(t('fm.toast.noActiveSession'))
          }
          setHighlightPath(`${currentPath}/${name}`)
          showToast(t('fm.toast.fileCreated'))
          break
        }
        case 'newFolder': {
          const name = inputValue.trim()
          if (useRealApi && api && sid) {
            await apiCreateFolder(api, mid, sid, currentPath, name)
          } else if (!useRealApi) {
            await mockCreateFolder(currentPath, name)
          } else {
            throw new Error(t('fm.toast.noActiveSession'))
          }
          setHighlightPath(`${currentPath}/${name}`)
          showToast(t('fm.toast.folderCreated'))
          break
        }
        case 'rename': {
          const name = inputValue.trim()
          if (useRealApi && api && sid) {
            await apiRenameEntry(api, mid, sid, currentPath, dialog.name, name)
          } else if (!useRealApi) {
            await mockRename(currentPath, dialog.name, name)
          } else {
            throw new Error(t('fm.toast.noActiveSession'))
          }
          showToast(t('fm.toast.renamed'))
          break
        }
        case 'delete': {
          if (useRealApi && api && sid) {
            const entry = entries.find(e => e.path === dialog.path)
            await apiDeleteEntry(api, mid, sid, currentPath, dialog.name, dialog.path, entry?.type ?? 'file')
          } else if (!useRealApi) {
            await mockDelete(currentPath, dialog.name)
          } else {
            throw new Error(t('fm.toast.noActiveSession'))
          }
          setSelectedPaths((prev) => { const n = new Set(prev); n.delete(dialog.path); return n })
          showToast(t('fm.toast.deleted'))
          break
        }
        case 'batchDelete': {
          for (const p of dialog.paths) {
            const name = p.split('/').pop() ?? ''
            if (useRealApi && api && sid) {
              const entry = entries.find(e => e.path === p)
              await apiDeleteEntry(api, mid, sid, currentPath, name, p, entry?.type ?? 'file')
            } else if (!useRealApi) {
              await mockDelete(currentPath, name)
            } else {
              throw new Error(t('fm.toast.noActiveSession'))
            }
          }
          setSelectedPaths(new Set())
          showToast(dialog.paths.length === 1 ? t('fm.toast.batchDeleted.one') : t('fm.toast.batchDeleted', { count: dialog.paths.length }))
          break
        }
      }
      setDialog(null)
      setInputValue('')
      reload()
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('fm.toast.operationFailed'), 'error')
    } finally {
      setDialogLoading(false)
    }
  }, [dialog, inputValue, currentPath, reload, useRealApi, api, machineId, sessionId, entries, t])

  const handleToolbarNew = useCallback(() => {
    setInputValue('')
    setDialog({ type: 'newFile' })
  }, [])

  const handleToolbarNewFolder = useCallback(() => {
    setInputValue('')
    setDialog({ type: 'newFolder' })
  }, [])


  const handleSelectPath = useCallback((path: string) => {
    setSelectedPath(path)
  }, [])

  const handleBatchDelete = useCallback(() => {
    if (selectedPaths.size === 0) return
    setDialog({ type: 'batchDelete', paths: [...selectedPaths] })
  }, [selectedPaths])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (dialog) return
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key === 'a') {
        e.preventDefault()
        handleSelectAll()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
        if (e.key === 'Backspace') {
          // Backspace: navigate to parent
          e.preventDefault()
          const parent = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].path : null
          if (parent) handleNavigate(parent)
          return
        }
        // Delete: delete selected items or single selected
        if (selectedPaths.size > 0) {
          handleBatchDelete()
        } else if (selectedPath) {
          const name = selectedPath.split('/').pop() ?? ''
          setDialog({ type: 'delete', name, path: selectedPath })
        }
        return
      }

      if (e.key === 'F2' && selectedPath) {
        e.preventDefault()
        const name = selectedPath.split('/').pop() ?? ''
        setInputValue(name)
        setDialog({ type: 'rename', name, path: selectedPath })
      }

      // Shift+F10 or ContextMenu key: open context menu for selected item
      if ((e.key === 'ContextMenu') || (e.shiftKey && e.key === 'F10')) {
        if (selectedPath) {
          e.preventDefault()
          const entry = entries.find(en => en.path === selectedPath)
          if (entry) {
            const active = document.activeElement as HTMLElement
            const rect = active?.getBoundingClientRect()
            if (rect) handleContextMenu(selectedPath, entry.type, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
          }
        }
      }

      if (mod && e.key === 'c' && selectedPath) {
        e.preventDefault()
        copyToClipboard(selectedPath, t)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dialog, selectedPath, selectedPaths, breadcrumbs, handleSelectAll, handleBatchDelete, handleNavigate, handleContextMenu, entries, t])

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div
        className="fm-toolbar"
        style={{
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid var(--hp-border)',
          padding: '0 var(--hp-space-3)',
          background: 'var(--hp-surface-0)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setShowHidden((v) => !v)}
          aria-label={showHidden ? t('fm.toolbar.hideHidden') : t('fm.toolbar.showHidden')}
          title={showHidden ? t('fm.toolbar.hideHidden') : t('fm.toolbar.showHidden')}
          className="fm-toolbar-button"
          style={{
            minHeight: 40,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '0 var(--hp-space-3)',
            borderRadius: 'var(--hp-radius-md)',
            fontSize: 12,
            fontWeight: 650,
            border: `1px solid ${showHidden ? 'var(--hp-primary)' : 'var(--hp-border)'}`,
            cursor: 'pointer',
            color: showHidden ? 'var(--hp-primary)' : 'var(--hp-text-secondary)',
            background: showHidden ? 'var(--hp-primary-subtle)' : 'var(--hp-surface-1)',
            transition: 'background var(--hp-duration-fast) var(--hp-ease-out), border-color var(--hp-duration-fast) var(--hp-ease-out), color var(--hp-duration-fast) var(--hp-ease-out)',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {showHidden ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
              : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
          </svg>
          <span className="hidden sm:inline">{showHidden ? t('fm.toolbar.hideHidden') : t('fm.toolbar.showHidden')}</span>
        </button>

        <button
          type="button"
          onClick={handleToolbarNew}
          aria-label={t('fm.toolbar.newFile')}
          className="fm-toolbar-primary"
          style={{
            minHeight: 40,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 var(--hp-space-4)',
            borderRadius: 'var(--hp-radius-md)',
            fontSize: 12,
            fontWeight: 700,
            border: '1px solid var(--hp-primary)',
            cursor: 'pointer',
            color: 'var(--hp-primary-text)',
            background: 'var(--hp-primary)',
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }} aria-hidden="true">+</span>
          <span className="hidden sm:inline">{t('fm.toolbar.newFile')}</span>
          <span className="sm:hidden">{t('fm.toolbar.fileShort')}</span>
        </button>

        <button
          type="button"
          onClick={handleToolbarNewFolder}
          aria-label={t('fm.toolbar.newFolder')}
          className="fm-toolbar-button hidden sm:inline-flex"
          style={{
            minHeight: 40,
            alignItems: 'center',
            gap: 6,
            padding: '0 var(--hp-space-3)',
            borderRadius: 'var(--hp-radius-md)',
            fontSize: 12,
            fontWeight: 650,
            border: '1px solid var(--hp-border)',
            cursor: 'pointer',
            color: 'var(--hp-text-primary)',
            background: 'var(--hp-surface-0)',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span>{t('fm.toolbar.newFolder')}</span>
        </button>

        <div className="min-w-0 flex-1" />
        <span
          title={entries.length === 1 ? t('fm.itemCount.one') : t('fm.itemCount', { n: entries.length })}
          style={{
            maxWidth: 96,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 11,
            color: 'var(--hp-text-secondary)',
            fontFamily: 'var(--hp-font-mono, ui-monospace, monospace)',
          }}
        >
          {entries.length === 1 ? t('fm.itemCount.one') : t('fm.itemCount', { n: entries.length })}
        </span>
      </div>

      <BreadcrumbNav segments={breadcrumbs} onNavigate={handleNavigate} onCopyPath={(path) => copyToClipboard(path, t)} />

      <div className="min-h-0 flex-1 overflow-y-auto" key={navKey}>
        <DirectoryView
            entries={sortedEntries}
            isLoading={isLoading}
            error={error}
            sort={sort}
            onSortChange={setSort}
            onOpenDirectory={handleOpenDirectory}
            onOpenFile={handleOpenFile}
            onContextMenu={handleContextMenu}
            selectedPath={selectedPath}
            onSelect={handleSelectPath}
            onRetry={reload}
            onCreateFile={handleToolbarNew}
            onCreateFolder={handleToolbarNewFolder}
            selectedPaths={selectedPaths}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            highlightPath={highlightPath}
        />
      </div>

      {/* Batch action bar (desktop) */}
      {selectedPaths.size > 0 && (
        <BatchActionBar
          selectedCount={selectedPaths.size}
          onDelete={handleBatchDelete}
          onMove={() => handleUnavailableAction(t('fm.batch.move'))}
          onCopy={() => handleUnavailableAction(t('fm.batch.copy'))}
          onStartSession={() => {
            if (machineId && selectedPaths.size === 1) {
              const path = [...selectedPaths][0]
              const entry = entries.find(e => e.path === path)
              const dir = entry?.type === 'directory' ? path : currentPath
              navigate({ to: '/sessions/new', search: { directory: dir, machineId } })
            } else {
              navigate({ to: '/sessions/new', search: { directory: currentPath, ...(machineId ? { machineId } : {}) } })
            }
          }}
        />
      )}

      {/* Bottom toolbar (mobile) */}
      <div className="flex items-center justify-around border-t border-(--hp-border) md:hidden" style={{ height: 56, background: 'var(--hp-surface-0)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <ToolbarButton label={t('fm.toolbar.fileShort')} icon="+" onClick={handleToolbarNew} />
        <ToolbarButton label={t('fm.toolbar.folderShort')} icon="folder" onClick={handleToolbarNewFolder} />
        <ToolbarButton label={t('fm.toolbar.upload')} icon="↑" onClick={() => handleUnavailableAction(t('fm.toolbar.upload'))} />
        <ToolbarButton label={t('fm.toolbar.sessionShort')} icon="▶" onClick={() => {
          navigate({ to: '/sessions/new', search: { directory: currentPath, ...(machineId ? { machineId } : {}) } })
        }} />
      </div>

      <ContextMenu state={ctxMenu.state} onClose={ctxMenu.hide} />

      {/* Dialogs */}
      {dialog?.type === 'newFile' && (
        <Dialog title={t('fm.dialog.newFile.title')} onClose={() => setDialog(null)} onSubmit={handleDialogSubmit} submitLabel={t('fm.dialog.create')} loading={dialogLoading}>
          <InputField value={inputValue} onChange={setInputValue} placeholder={t('fm.dialog.newFile.placeholder')} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleDialogSubmit() }} />
        </Dialog>
      )}
      {dialog?.type === 'newFolder' && (
        <Dialog title={t('fm.dialog.newFolder.title')} onClose={() => setDialog(null)} onSubmit={handleDialogSubmit} submitLabel={t('fm.dialog.create')} loading={dialogLoading}>
          <InputField value={inputValue} onChange={setInputValue} placeholder={t('fm.dialog.newFolder.placeholder')} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleDialogSubmit() }} />
        </Dialog>
      )}
      {dialog?.type === 'rename' && (
        <Dialog title={t('fm.dialog.rename.title')} onClose={() => setDialog(null)} onSubmit={handleDialogSubmit} submitLabel={t('fm.dialog.rename.submit')} loading={dialogLoading}>
          <InputField value={inputValue} onChange={setInputValue} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleDialogSubmit() }} />
        </Dialog>
      )}
      {dialog?.type === 'delete' && (
        <Dialog title={t('fm.dialog.delete.title')} onClose={() => setDialog(null)} onSubmit={handleDialogSubmit} submitLabel={t('fm.dialog.delete.submit')} submitDanger loading={dialogLoading}>
          <ConfirmMessage message={t('fm.dialog.delete.confirm', { name: dialog.name })} />
        </Dialog>
      )}
      {dialog?.type === 'batchDelete' && (
        <Dialog title={t('fm.dialog.delete.title')} onClose={() => setDialog(null)} onSubmit={handleDialogSubmit} submitLabel={t('fm.dialog.delete.submit')} submitDanger loading={dialogLoading}>
          <ConfirmMessage message={dialog.paths.length === 1 ? t('fm.dialog.batchDelete.confirm.one') : t('fm.dialog.batchDelete.confirm', { count: dialog.paths.length })} />
        </Dialog>
      )}

      <ToastContainer />
    </div>
  )
}

function ToolbarButton({ label, icon, onClick }: { label: string; icon: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="fm-mobile-toolbar-button"
      style={{ minHeight: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '4px 10px', background: 'transparent', border: '1px solid transparent', cursor: 'pointer', color: 'var(--hp-text-secondary)', borderRadius: 'var(--hp-radius-md)', minWidth: 58, transition: 'background var(--hp-duration-fast) var(--hp-ease-out), color var(--hp-duration-fast) var(--hp-ease-out)' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--hp-text-primary)' }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--hp-text-secondary)' }}>
      <span style={{ width: 20, height: 20, display: 'grid', placeItems: 'center', fontSize: 18, lineHeight: 1 }} aria-hidden="true">
        {icon === 'folder' ? (
          <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        ) : icon}
      </span>
      <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
    </button>
  )
}
