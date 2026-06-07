import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from '@/lib/use-translation'
import { safeCopyToClipboard } from '@/lib/clipboard'
import { encodeBase64 } from '@/lib/utils'
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
  mockCopy,
  mockMove,
} from '@/lib/file-manager-mock'
import {
  isApiReady,
  listDirectory as apiListDirectory,
  createFile as apiCreateFile,
  createFolder as apiCreateFolder,
  deleteEntry as apiDeleteEntry,
  renameEntry as apiRenameEntry,
  copyEntry as apiCopyEntry,
  moveEntry as apiMoveEntry,
} from '@/lib/file-manager-api'
import type { ApiClient } from '@/api/client'
import type { FileSearchItem } from '@/types/api'
import type { FileEntry, FileManagerMode, SortOption, SortField, BreadcrumbSegment } from './types'

export interface FileManagerProps {
  api?: ApiClient | null
  machineId?: string | null
  sessionId?: string | null
  initialPath?: string
  rootPath?: string
}

const DEFAULT_ROOT = '/home/user/project'
const DEFAULT_SORT: SortOption = { field: 'name', direction: 'asc' }
const ROW_ANIMATION_LIMIT = 200
const LARGE_DIRECTORY_WARNING_THRESHOLD = 500

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

type CreateKind = 'file' | 'folder'
type TransferOperation = 'move' | 'copy'
type SearchMode = 'name' | 'content'

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; fileName: string; progress: number }
  | { status: 'error'; fileName: string; error: string }

type DialogState =
  | { type: 'create' }
  | { type: 'rename'; name: string; path: string }
  | { type: 'delete'; name: string; path: string }
  | { type: 'batchDelete'; paths: string[] }
  | { type: 'transfer'; operation: TransferOperation; paths: string[] }
  | null

function isValidFileName(name: string): boolean {
  if (!name || name === '.' || name === '..') return false
  if (name.length > 255) return false
  if (name.includes('/') || name.includes('\\')) return false
  if (/[\x00-\x1f]/.test(name)) return false
  if (name.includes(':') && !/^[a-zA-Z]:/.test(name)) return false
  return true
}

function normalizePath(path: string): string {
  const normalized = path.replace(/\/+$/, '')
  return normalized || '/'
}

function joinPath(dirPath: string, name: string): string {
  const dir = normalizePath(dirPath)
  return dir === '/' ? `/${name}` : `${dir}/${name}`
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path
}

function buildReturnTo(machineId: string | null | undefined, path: string, sessionId?: string | null): string {
  if (sessionId) {
    return `/sessions/${encodeURIComponent(sessionId)}/files?tab=directories`
  }
  const params = new URLSearchParams()
  if (machineId) params.set('machineId', machineId)
  if (path) params.set('path', encodeBase64(path))
  const query = params.toString()
  return query ? `/browse?${query}` : '/browse'
}

function isValidDestinationDir(path: string): boolean {
  const value = path.trim()
  if (!value) return false
  if (value.includes('\0')) return false
  return true
}

function getParentPath(path: string, rootPath: string): string | null {
  const normalized = normalizePath(path)
  const root = normalizePath(rootPath)
  if (normalized === root) return null
  const idx = normalized.lastIndexOf('/')
  const parent = idx > 0 ? normalized.slice(0, idx) : '/'
  if (root !== '/' && (parent.length < root.length || !parent.startsWith(root))) return null
  return parent
}

async function copyToClipboard(text: string, t: Translate) {
  try {
    await safeCopyToClipboard(text)
    showToast(t('fm.toast.pathCopied'))
  } catch {
    showToast(t('fm.toast.copyPathFailed'), 'error')
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function readBrowserFileAsBase64(file: File, onProgress: (progress: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.round((event.loaded / event.total) * 100))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error('Failed to read file'))
        return
      }
      onProgress(100)
      resolve(arrayBufferToBase64(reader.result))
    }
    reader.readAsArrayBuffer(file)
  })
}

function downloadBase64File(content: string, fileName: string): void {
  const byteCharacters = atob(content)
  const byteNumbers = new Uint8Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const blob = new Blob([byteNumbers])
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

interface TransferDirectoryPickerProps {
  api?: ApiClient | null
  machineId?: string | null
  useRealApi: boolean
  rootPath: string
  currentPath: string
  showHidden: boolean
  selectedPath: string
  onSelect: (path: string) => void
  t: Translate
}

function TransferDirectoryPicker({
  api,
  machineId,
  useRealApi,
  rootPath,
  currentPath,
  showHidden,
  selectedPath,
  onSelect,
  t,
}: TransferDirectoryPickerProps) {
  const [browsePath, setBrowsePath] = useState(() => normalizePath(selectedPath || currentPath || rootPath))
  const [directories, setDirectories] = useState<FileEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const normalizedRoot = useMemo(() => normalizePath(rootPath), [rootPath])
  const parent = useMemo(() => getParentPath(browsePath, normalizedRoot), [browsePath, normalizedRoot])

  const loadPickerDirectory = useCallback(async (path: string) => {
    const targetPath = normalizePath(path)
    setIsLoading(true)
    setError(null)
    try {
      const result = useRealApi && api && machineId
        ? await apiListDirectory(api, machineId, targetPath, showHidden)
        : await mockListDirectory(targetPath, showHidden)
      setBrowsePath(targetPath)
      setDirectories(sortEntries(
        result.entries.filter((entry) => entry.type === 'directory'),
        DEFAULT_SORT,
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('fm.dialog.transfer.loadError'))
      setDirectories([])
    } finally {
      setIsLoading(false)
    }
  }, [api, machineId, showHidden, t, useRealApi])

  useEffect(() => {
    void loadPickerDirectory(browsePath)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedNormalized = normalizePath(selectedPath || currentPath)

  return (
    <div
      className="fm-transfer-picker"
      aria-label={t('fm.dialog.transfer.pickerLabel')}
      style={{
        border: '1px solid var(--hp-border)',
        borderRadius: 'var(--hp-radius-md)',
        background: 'var(--hp-surface-0)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 8,
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--hp-divider)',
          background: 'var(--hp-surface-1)',
        }}
      >
        <button
          type="button"
          className="fm-secondary-button"
          onClick={() => { if (parent) void loadPickerDirectory(parent) }}
          disabled={!parent || isLoading}
          style={{
            minHeight: 44,
            padding: '0 10px',
            flex: '1 1 96px',
            opacity: parent ? 1 : 0.55,
            cursor: parent ? 'pointer' : 'not-allowed',
          }}
        >
          {t('fm.dialog.transfer.upFolder')}
        </button>
        <button
          type="button"
          className="fm-secondary-button"
          onClick={() => { void loadPickerDirectory(normalizedRoot) }}
          disabled={isLoading}
          style={{ minHeight: 44, padding: '0 10px', flex: '1 1 112px' }}
        >
          {t('fm.dialog.transfer.rootFolder')}
        </button>
        <button
          type="button"
          className="fm-primary-button"
          onClick={() => onSelect(browsePath)}
          disabled={isLoading}
          style={{ minHeight: 44, padding: '0 12px', flex: '1 1 100%' }}
        >
          {t('fm.dialog.transfer.useThisFolder')}
        </button>
      </div>

      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--hp-divider)' }}>
        <div
          title={browsePath}
          style={{
            fontSize: 12,
            fontFamily: 'var(--hp-font-mono, ui-monospace, monospace)',
            color: 'var(--hp-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {browsePath}
        </div>
        <div
          title={selectedNormalized}
          style={{
            marginTop: 4,
            fontSize: 11,
            color: 'var(--hp-text-tertiary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {t('fm.dialog.transfer.selected', { path: selectedNormalized })}
        </div>
      </div>

      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--hp-text-tertiary)' }}>
            {t('fm.dialog.transfer.loading')}
          </div>
        ) : error ? (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--hp-danger)', overflowWrap: 'anywhere' }}>{error}</div>
            <button
              type="button"
              className="fm-secondary-button"
              onClick={() => void loadPickerDirectory(browsePath)}
              style={{ alignSelf: 'flex-start' }}
            >
              {t('fm.error.retry')}
            </button>
          </div>
        ) : directories.length === 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--hp-text-tertiary)' }}>
            {t('fm.dialog.transfer.empty')}
          </div>
        ) : (
          directories.map((directory) => {
            const isSelected = normalizePath(directory.path) === selectedNormalized
            return (
              <button
                key={directory.path}
                type="button"
                onClick={() => { void loadPickerDirectory(directory.path) }}
                aria-label={t('fm.dialog.transfer.openFolder', { name: directory.name })}
                className="fm-transfer-picker-row"
                style={{
                  minHeight: 44,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 10px',
                  border: 'none',
                  borderBottom: '1px solid var(--hp-divider)',
                  background: isSelected ? 'var(--hp-primary-subtle)' : 'transparent',
                  color: isSelected ? 'var(--hp-primary)' : 'var(--hp-text-primary)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 15 }}>▸</span>
                <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                  {directory.name}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export function FileManager({ api, machineId, sessionId, initialPath, rootPath: rootPathProp }: FileManagerProps = {}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const useRealApi = isApiReady(api ?? null, machineId ?? null)
  const mode: FileManagerMode = useRealApi ? (sessionId ? 'session' : 'machine') : 'mock'
  const initialDirectoryPath = initialPath ?? DEFAULT_ROOT
  const [currentPath, setCurrentPath] = useState<string>(initialDirectoryPath)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [sort, setSort] = useState<SortOption>(DEFAULT_SORT)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [createKind, setCreateKind] = useState<CreateKind>('file')
  const [highlightPath, setHighlightPath] = useState<string | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [navKey, setNavKey] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('name')
  const [searchResults, setSearchResults] = useState<FileSearchItem[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' })
  const [lastUploadFiles, setLastUploadFiles] = useState<File[]>([])
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const sortedEntries = useMemo(() => sortEntries(entries, sort), [entries, sort])
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const visibleEntries = useMemo(() => {
    if (!normalizedSearch) return sortedEntries
    return sortedEntries.filter((entry) => entry.name.toLowerCase().includes(normalizedSearch))
  }, [normalizedSearch, sortedEntries])
  const searchFilterActive = normalizedSearch.length > 0
  const rootPath = useMemo(() => normalizePath(rootPathProp ?? initialDirectoryPath), [rootPathProp, initialDirectoryPath])
  const parentPath = useMemo(() => getParentPath(currentPath, rootPath), [currentPath, rootPath])
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

  // Load initial directory on mount and when route-level directory search changes.
  useEffect(() => {
    loadDirectory(initialDirectoryPath, showHidden)
  }, [initialDirectoryPath]) // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    setSearchResults(null)
    setSearchError(null)
    setSelectedPaths(new Set())
  }, [currentPath, searchQuery, searchMode])

  const breadcrumbs: BreadcrumbSegment[] = useMemo(() => buildBreadcrumbs(currentPath, 'project', t('fm.projectRoot')), [currentPath, t])

  const handleNavigate = useCallback((path: string) => {
    loadDirectory(path, showHidden)
  }, [loadDirectory, showHidden])

  const handleOpenDirectory = useCallback((path: string) => {
    loadDirectory(path, showHidden)
  }, [loadDirectory, showHidden])

  const handleOpenFile = useCallback((filePath: string) => {
    if (sessionId) {
      navigate({
        to: '/sessions/$sessionId/file',
        params: { sessionId },
        search: { path: encodeBase64(filePath) },
      })
      return
    }
    if (machineId) {
      navigate({
        to: '/browse/file',
        search: { machineId, path: encodeBase64(filePath) },
      })
      return
    }
    showToast(t(mode === 'machine' ? 'fm.toast.machineUnavailable' : 'fm.toast.operationFailed'), 'error')
  }, [sessionId, machineId, navigate, t, mode])

  const handleDownload = useCallback(async (paths: string[]) => {
    if (paths.length === 0) return
    if (!api || !machineId) {
      showToast(t('fm.toast.machineUnavailable'), 'error')
      return
    }

    const filePaths = paths.filter((path) => {
      const entry = entries.find((candidate) => candidate.path === path)
      return entry?.type !== 'directory'
    })

    if (filePaths.length === 0) {
      showToast(t('fm.toast.downloadNoFiles'), 'error')
      return
    }

    try {
      for (const filePath of filePaths) {
        const res = sessionId
          ? await api.readSessionFile(sessionId, filePath)
          : await api.readMachineFile(machineId, filePath)
        if (!res.success || !res.content) {
          throw new Error(res.error ?? t('fm.toast.downloadFailed'))
        }
        downloadBase64File(res.content, basename(filePath))
      }
      showToast(filePaths.length === 1
        ? t('fm.toast.downloaded.one')
        : t('fm.toast.downloaded', { count: filePaths.length }))
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('fm.toast.downloadFailed'), 'error')
    }
  }, [api, entries, machineId, sessionId, t])

  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    if (!api || !machineId) {
      showToast(t('fm.toast.machineUnavailable'), 'error')
      return
    }

    setLastUploadFiles(files)
    const maxBytes = 5 * 1024 * 1024

    try {
      for (const file of files) {
        if (file.size > maxBytes) {
          throw new Error(t('file.upload.tooLarge'))
        }
        setUploadState({ status: 'uploading', fileName: file.name, progress: 0 })
        const content = await readBrowserFileAsBase64(file, (progress) => {
          setUploadState({ status: 'uploading', fileName: file.name, progress })
        })
        const targetPath = joinPath(currentPath, file.name)
        const res = sessionId
          ? await api.writeSessionFile(sessionId, targetPath, content)
          : await api.writeMachineFile(machineId, targetPath, content)
        if (!res.success) {
          throw new Error(res.error ?? t('file.upload.error'))
        }
        setHighlightPath(targetPath)
      }
      setUploadState({ status: 'idle' })
      showToast(files.length === 1
        ? t('fm.toast.uploaded.one')
        : t('fm.toast.uploaded', { count: files.length }))
      reload()
    } catch (error) {
      const message = error instanceof Error ? error.message : t('file.upload.error')
      const fileName = files[0]?.name ?? t('fm.upload.unknownFile')
      setUploadState({ status: 'error', fileName, error: message })
      showToast(message, 'error')
    }
  }, [api, currentPath, machineId, reload, sessionId, t])

  const handleUploadClick = useCallback(() => {
    uploadInputRef.current?.click()
  }, [])

  const handleUploadInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    void uploadFiles(files)
  }, [uploadFiles])

  const handleRetryUpload = useCallback(() => {
    void uploadFiles(lastUploadFiles)
  }, [lastUploadFiles, uploadFiles])

  const handleDeepSearch = useCallback(async () => {
    const query = searchQuery.trim()
    if (!query) return
    if (!api || !machineId) {
      setSearchError(t('fm.toast.machineUnavailable'))
      return
    }
    setSearchLoading(true)
    setSearchError(null)
    try {
      const res = await api.searchMachineFiles(machineId, currentPath, query, {
        mode: searchMode,
        limit: 100,
        showHidden
      })
      if (!res.success) {
        throw new Error(res.error ?? t('fm.search.failed'))
      }
      setSearchResults(res.files ?? [])
    } catch (error) {
      setSearchResults([])
      setSearchError(error instanceof Error ? error.message : t('fm.search.failed'))
    } finally {
      setSearchLoading(false)
    }
  }, [api, currentPath, machineId, searchMode, searchQuery, showHidden, t])

  const handleOpenSearchResult = useCallback((item: FileSearchItem) => {
    if (item.fileType === 'folder') {
      handleOpenDirectory(item.fullPath)
      return
    }
    handleOpenFile(item.fullPath)
  }, [handleOpenDirectory, handleOpenFile])

  const handleContextMenu = useCallback(
    (path: string, type: 'file' | 'directory', point: { x: number; y: number }) => {
      if (isLoading) return
      setSelectedPath(path)
      const name = path.split('/').pop() ?? ''
      const items: ContextMenuItem[] = [
        { label: t('fm.context.rename'), icon: 'rename', onClick: () => { setInputValue(name); setDialog({ type: 'rename', name, path }) } },
        { label: t('fm.context.move'), icon: 'move', onClick: () => { setInputValue(currentPath); setDialog({ type: 'transfer', operation: 'move', paths: [path] }) } },
        { label: t('fm.context.copy'), icon: 'copy', onClick: () => { setInputValue(currentPath); setDialog({ type: 'transfer', operation: 'copy', paths: [path] }) } },
        ...(type === 'file' ? [{ label: t('fm.context.download'), icon: 'download' as const, onClick: () => { void handleDownload([path]) } }] : []),
        { label: t('fm.context.copyPath'), icon: 'copyPath', onClick: () => { copyToClipboard(path, t) } },
      ]
      items.push({
        label: t('fm.context.delete'),
        icon: 'delete',
        danger: true,
        onClick: () => setDialog({ type: 'delete', name, path }),
      })
      ctxMenu.show(point.x, point.y, items)
    },
    [ctxMenu, currentPath, handleDownload, isLoading, t],
  )

  // Batch selection
  const handleToggleSelect = useCallback((path: string, shiftKey: boolean, _ctrlKey: boolean) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (shiftKey && prev.size > 0) {
        const paths = visibleEntries.map((e) => e.path)
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
  }, [visibleEntries])

  const handleSelectAll = useCallback(() => {
    setSelectedPaths((prev) => {
      if (prev.size === visibleEntries.length) return new Set()
      return new Set(visibleEntries.map((e) => e.path))
    })
  }, [visibleEntries])

  // Dialog submit
  const handleDialogSubmit = useCallback(async () => {
    if (!dialog) return

    // Validate BEFORE setting loading state so early returns don't bypass finally
    if (dialog.type === 'create' || dialog.type === 'rename') {
      const name = inputValue.trim()
      if (!name) { showToast(t('fm.toast.nameRequired'), 'error'); return }
      if (!isValidFileName(name)) { showToast(t('fm.toast.invalidName'), 'error'); return }
      if (dialog.type === 'rename' && name === dialog.name) { setDialog(null); return }
    }
    if (dialog.type === 'transfer') {
      const destinationDir = inputValue.trim()
      if (!destinationDir) { showToast(t('fm.toast.destinationRequired'), 'error'); return }
      if (!isValidDestinationDir(destinationDir)) { showToast(t('fm.toast.invalidDestination'), 'error'); return }
    }

    setDialogLoading(true)
    try {
      const mid = machineId ?? ''
      switch (dialog.type) {
        case 'create': {
          const name = inputValue.trim()
          if (createKind === 'file') {
            if (useRealApi && api && mid) {
              await apiCreateFile(api, mid, sessionId ?? null, currentPath, name)
            } else if (!useRealApi) {
              await mockCreateFile(currentPath, name)
            } else {
              throw new Error(t('fm.toast.machineUnavailable'))
            }
            showToast(t('fm.toast.fileCreated'))
          } else {
            if (useRealApi && api && mid) {
              await apiCreateFolder(api, mid, sessionId ?? null, currentPath, name)
            } else if (!useRealApi) {
              await mockCreateFolder(currentPath, name)
            } else {
              throw new Error(t('fm.toast.machineUnavailable'))
            }
            showToast(t('fm.toast.folderCreated'))
          }
          setHighlightPath(joinPath(currentPath, name))
          break
        }
        case 'rename': {
          const name = inputValue.trim()
          if (useRealApi && api && mid) {
            await apiRenameEntry(api, mid, sessionId ?? null, currentPath, dialog.name, name)
          } else if (!useRealApi) {
            await mockRename(currentPath, dialog.name, name)
          } else {
            throw new Error(t('fm.toast.machineUnavailable'))
          }
          showToast(t('fm.toast.renamed'))
          break
        }
        case 'delete': {
          if (useRealApi && api && mid) {
            const entry = entries.find(e => e.path === dialog.path)
            await apiDeleteEntry(api, mid, sessionId ?? null, currentPath, dialog.name, dialog.path, entry?.type ?? 'file')
          } else if (!useRealApi) {
            await mockDelete(currentPath, dialog.name)
          } else {
            throw new Error(t('fm.toast.machineUnavailable'))
          }
          setSelectedPaths((prev) => { const n = new Set(prev); n.delete(dialog.path); return n })
          showToast(t('fm.toast.deleted'))
          break
        }
        case 'batchDelete': {
          for (const p of dialog.paths) {
            const name = p.split('/').pop() ?? ''
            if (useRealApi && api && mid) {
              const entry = entries.find(e => e.path === p)
              await apiDeleteEntry(api, mid, sessionId ?? null, currentPath, name, p, entry?.type ?? 'file')
            } else if (!useRealApi) {
              await mockDelete(currentPath, name)
            } else {
              throw new Error(t('fm.toast.machineUnavailable'))
            }
          }
          setSelectedPaths(new Set())
          showToast(dialog.paths.length === 1 ? t('fm.toast.batchDeleted.one') : t('fm.toast.batchDeleted', { count: dialog.paths.length }))
          break
        }
        case 'transfer': {
          const destinationDir = inputValue.trim()
          for (const p of dialog.paths) {
            if (useRealApi && api && mid) {
              if (dialog.operation === 'move') {
                await apiMoveEntry(api, mid, sessionId ?? null, p, destinationDir)
              } else {
                await apiCopyEntry(api, mid, sessionId ?? null, p, destinationDir)
              }
            } else if (!useRealApi) {
              if (dialog.operation === 'move') {
                await mockMove(p, destinationDir)
              } else {
                await mockCopy(p, destinationDir)
              }
            } else {
              throw new Error(t('fm.toast.machineUnavailable'))
            }
          }
          setSelectedPaths(new Set())
          showToast(dialog.operation === 'move'
            ? (dialog.paths.length === 1 ? t('fm.toast.moved.one') : t('fm.toast.moved', { count: dialog.paths.length }))
            : (dialog.paths.length === 1 ? t('fm.toast.copied.one') : t('fm.toast.copied', { count: dialog.paths.length })))
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
  }, [dialog, inputValue, createKind, currentPath, reload, useRealApi, api, machineId, sessionId, entries, t])

  const handleCreate = useCallback((kind: CreateKind = 'file') => {
    setCreateKind(kind)
    setInputValue('')
    setDialog({ type: 'create' })
  }, [])

  const handleTransfer = useCallback((operation: TransferOperation, paths: string[]) => {
    if (paths.length === 0) return
    setInputValue(currentPath)
    setDialog({ type: 'transfer', operation, paths })
  }, [currentPath])

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

  const itemCountLabel = searchFilterActive
    ? t('fm.itemCount.filtered', { shown: visibleEntries.length, total: entries.length })
    : entries.length === 1 ? t('fm.itemCount.one') : t('fm.itemCount', { n: entries.length })
  const animateRows = visibleEntries.length <= ROW_ANIMATION_LIMIT
  const showLargeDirectoryNotice = !searchFilterActive
    && visibleEntries.length > LARGE_DIRECTORY_WARNING_THRESHOLD

  return (
    <div className="flex h-full flex-col">
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUploadInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />

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
          onClick={() => { if (parentPath) handleNavigate(parentPath) }}
          disabled={!parentPath}
          aria-label={t('fm.toolbar.parent')}
          title={t('fm.toolbar.parent')}
          className="fm-toolbar-button"
          style={{
            minHeight: 44,
            minWidth: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 var(--hp-space-3)',
            borderRadius: 'var(--hp-radius-md)',
            fontSize: 12,
            fontWeight: 650,
            border: '1px solid var(--hp-border)',
            cursor: parentPath ? 'pointer' : 'not-allowed',
            color: parentPath ? 'var(--hp-text-secondary)' : 'var(--hp-text-disabled, var(--hp-text-tertiary))',
            background: 'var(--hp-surface-1)',
            opacity: parentPath ? 1 : 0.55,
            transition: 'background var(--hp-duration-fast) var(--hp-ease-out), border-color var(--hp-duration-fast) var(--hp-ease-out), color var(--hp-duration-fast) var(--hp-ease-out)',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
            <path d="M9 12h12" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setShowHidden((v) => !v)}
          aria-label={showHidden ? t('fm.toolbar.hideHidden') : t('fm.toolbar.showHidden')}
          title={showHidden ? t('fm.toolbar.hideHidden') : t('fm.toolbar.showHidden')}
          className="fm-toolbar-button"
          style={{
            minHeight: 44,
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
          onClick={() => handleCreate('file')}
          aria-label={t('fm.toolbar.new')}
          className="fm-toolbar-primary fm-desktop-action"
          style={{
            minHeight: 44,
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
          <span>{t('fm.toolbar.new')}</span>
        </button>

        <button
          type="button"
          onClick={handleUploadClick}
          aria-label={t('fm.toolbar.upload')}
          className="fm-toolbar-button fm-desktop-action"
          style={{
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 var(--hp-space-3)',
            borderRadius: 'var(--hp-radius-md)',
            fontSize: 12,
            fontWeight: 650,
            border: '1px solid var(--hp-border)',
            cursor: 'pointer',
            color: 'var(--hp-text-secondary)',
            background: 'var(--hp-surface-1)',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          <span className="hidden sm:inline">{t('fm.toolbar.upload')}</span>
        </button>

        <div className="min-w-0 flex-1" />
        <span
          title={itemCountLabel}
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
          {itemCountLabel}
        </span>
      </div>

      <div
        className="fm-search-strip"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid var(--hp-divider)',
          padding: '8px var(--hp-space-3)',
          background: 'var(--hp-surface-0)',
          flexShrink: 0,
        }}
      >
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void handleDeepSearch() }}
          placeholder={t('fm.search.placeholder')}
          aria-label={t('fm.search.placeholder')}
          autoCapitalize="none"
          autoCorrect="off"
          style={{
            minHeight: 44,
            minWidth: 0,
            flex: 1,
            borderRadius: 'var(--hp-radius-md)',
            border: '1px solid var(--hp-border)',
            background: 'var(--hp-canvas)',
            color: 'var(--hp-text-primary)',
            padding: '0 12px',
            fontSize: 13,
          }}
        />
        <select
          value={searchMode}
          onChange={(event) => setSearchMode(event.target.value as SearchMode)}
          aria-label={t('fm.search.mode')}
          style={{
            minHeight: 44,
            borderRadius: 'var(--hp-radius-md)',
            border: '1px solid var(--hp-border)',
            background: 'var(--hp-surface-1)',
            color: 'var(--hp-text-secondary)',
            padding: '0 8px',
            fontSize: 12,
            fontWeight: 650,
          }}
        >
          <option value="name">{t('fm.search.mode.name')}</option>
          <option value="content">{t('fm.search.mode.content')}</option>
        </select>
        <button
          type="button"
          onClick={() => void handleDeepSearch()}
          disabled={!searchQuery.trim() || searchLoading}
          className="fm-toolbar-button"
          style={{
            minHeight: 44,
            padding: '0 var(--hp-space-3)',
            borderRadius: 'var(--hp-radius-md)',
            border: '1px solid var(--hp-border)',
            background: 'var(--hp-surface-1)',
            color: 'var(--hp-text-secondary)',
            fontSize: 12,
            fontWeight: 650,
            cursor: !searchQuery.trim() || searchLoading ? 'not-allowed' : 'pointer',
            opacity: !searchQuery.trim() || searchLoading ? 0.55 : 1,
          }}
        >
          {searchLoading ? t('fm.search.searching') : t('fm.search.deep')}
        </button>
      </div>

      {uploadState.status !== 'idle' ? (
        <div className={`border-b border-(--hp-divider) px-3 py-2 text-xs ${uploadState.status === 'error' ? 'bg-(--hp-danger-subtle) text-(--hp-danger)' : 'bg-(--hp-primary-subtle) text-(--hp-primary)'}`}>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">
              {uploadState.status === 'error'
                ? t('fm.upload.errorDetail', { name: uploadState.fileName, error: uploadState.error })
                : t('fm.upload.progress', { name: uploadState.fileName, progress: uploadState.progress })}
            </span>
            {uploadState.status === 'error' && lastUploadFiles.length > 0 ? (
              <button type="button" onClick={handleRetryUpload} className="min-h-[44px] rounded bg-(--hp-surface-1) px-3 py-1 text-xs text-(--hp-text-secondary)">
                {t('fm.upload.retry')}
              </button>
            ) : null}
          </div>
          {uploadState.status === 'uploading' ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--hp-surface-2)">
              <div className="h-full rounded-full bg-(--hp-primary)" style={{ width: `${uploadState.progress}%` }} />
            </div>
          ) : null}
        </div>
      ) : null}

      <BreadcrumbNav segments={breadcrumbs} onNavigate={handleNavigate} onCopyPath={(path) => copyToClipboard(path, t)} />

      {searchResults !== null || searchError ? (
        <div className="border-b border-(--hp-divider) bg-(--hp-surface-0)">
          <div className="flex items-center gap-2 px-3 py-2 text-xs">
            <span className="font-semibold text-(--hp-text-primary)">
              {searchMode === 'content' ? t('fm.search.contentResults') : t('fm.search.nameResults')}
            </span>
            <span className="flex-1 text-(--hp-text-tertiary)">
              {searchError ? searchError : t('fm.search.resultCount', { count: searchResults?.length ?? 0 })}
            </span>
            <button type="button" onClick={() => { setSearchResults(null); setSearchError(null) }}
              className="min-h-[44px] rounded px-3 text-(--hp-text-tertiary) hover:bg-(--hp-surface-1)">
              {t('fm.search.close')}
            </button>
          </div>
          {!searchError && searchResults?.length === 0 ? (
            <div className="px-3 pb-3 text-xs text-(--hp-text-tertiary)">{t('fm.search.empty')}</div>
          ) : null}
          {!searchError && searchResults && searchResults.length > 0 ? (
            <div className="max-h-64 overflow-y-auto border-t border-(--hp-divider)">
              {searchResults.map((item) => (
                <button
                  key={item.fullPath}
                  type="button"
                  onClick={() => handleOpenSearchResult(item)}
                  className="flex min-h-[44px] w-full items-center gap-2 border-b border-(--hp-divider) px-3 text-left hover:bg-(--hp-surface-1) focus-visible:outline-2 focus-visible:outline-(--hp-primary) focus-visible:outline-offset-[-2px]"
                >
                  <span className="text-xs font-semibold text-(--hp-text-primary)">{item.fileName}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-(--hp-text-tertiary)">{item.fullPath}</span>
                  <span className="text-[11px] text-(--hp-text-tertiary)">{item.fileType === 'folder' ? t('fm.search.folder') : t('fm.search.file')}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {showLargeDirectoryNotice ? (
        <div className="border-b border-(--hp-divider) bg-(--hp-warning-subtle) px-3 py-2 text-xs text-(--hp-text-secondary)">
          {t('fm.performance.largeDirectory', { count: visibleEntries.length })}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto" key={navKey}>
        <DirectoryView
            entries={visibleEntries}
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
            onCreate={() => handleCreate('file')}
            selectedPaths={selectedPaths}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            highlightPath={highlightPath}
            emptyTitle={searchFilterActive ? t('fm.search.noLocalMatches') : undefined}
            emptyHint={searchFilterActive ? t('fm.search.noLocalMatchesHint') : undefined}
            showCreateInEmpty={!searchFilterActive}
            animateRows={animateRows}
        />
      </div>

      {/* Batch action bar (desktop) */}
      {selectedPaths.size > 0 && (
        <BatchActionBar
          selectedCount={selectedPaths.size}
          onDelete={handleBatchDelete}
          onMove={() => handleTransfer('move', [...selectedPaths])}
          onCopy={() => handleTransfer('copy', [...selectedPaths])}
          onDownload={() => { void handleDownload([...selectedPaths]) }}
          onStartSession={() => {
            const returnTo = buildReturnTo(machineId, currentPath, sessionId)
            if (machineId && selectedPaths.size === 1) {
              const path = [...selectedPaths][0]
              const entry = entries.find(e => e.path === path)
              const dir = entry?.type === 'directory' ? path : currentPath
              navigate({ to: '/sessions/new', search: { directory: dir, machineId, returnTo } })
            } else {
              navigate({ to: '/sessions/new', search: { directory: currentPath, ...(machineId ? { machineId } : {}), returnTo } })
            }
          }}
        />
      )}

      {/* Bottom toolbar (mobile) */}
      <div className="flex items-center justify-around border-t border-(--hp-border) md:hidden" style={{ height: 56, background: 'var(--hp-surface-0)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <ToolbarButton label={t('fm.toolbar.newShort')} icon="new" onClick={() => handleCreate('file')} />
        <ToolbarButton label={t('fm.toolbar.uploadShort')} icon="upload" onClick={handleUploadClick} />
        <ToolbarButton label={t('fm.toolbar.sessionShort')} icon="session" onClick={() => {
          navigate({
            to: '/sessions/new',
            search: {
              directory: currentPath,
              ...(machineId ? { machineId } : {}),
              returnTo: buildReturnTo(machineId, currentPath, sessionId),
            }
          })
        }} />
      </div>

      <ContextMenu state={ctxMenu.state} onClose={ctxMenu.hide} />

      {/* Dialogs */}
      {dialog?.type === 'create' && (
        <Dialog title={t('fm.dialog.create.title')} onClose={() => setDialog(null)} onSubmit={handleDialogSubmit} submitLabel={t('fm.dialog.create')} loading={dialogLoading}>
          <div role="group" aria-label={t('fm.dialog.create.kind')} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['file', 'folder'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={createKind === kind}
                onClick={() => setCreateKind(kind)}
                className="fm-dialog-button"
                style={{
                  minHeight: 44,
                  flex: 1,
                  borderRadius: 'var(--hp-radius-md)',
                  border: `1px solid ${createKind === kind ? 'var(--hp-primary)' : 'var(--hp-border)'}`,
                  background: createKind === kind ? 'var(--hp-primary-subtle)' : 'var(--hp-surface-0)',
                  color: createKind === kind ? 'var(--hp-primary)' : 'var(--hp-text-primary)',
                  fontSize: 13,
                  fontWeight: 650,
                  cursor: 'pointer',
                }}
              >
                {kind === 'file' ? t('fm.dialog.create.file') : t('fm.dialog.create.folder')}
              </button>
            ))}
          </div>
          <InputField value={inputValue} onChange={setInputValue} placeholder={createKind === 'file' ? t('fm.dialog.newFile.placeholder') : t('fm.dialog.newFolder.placeholder')} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleDialogSubmit() }} />
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
      {dialog?.type === 'transfer' && (
        <Dialog
          title={dialog.operation === 'move' ? t('fm.dialog.move.title') : t('fm.dialog.copy.title')}
          onClose={() => setDialog(null)}
          onSubmit={handleDialogSubmit}
          submitLabel={dialog.operation === 'move' ? t('fm.dialog.move.submit') : t('fm.dialog.copy.submit')}
          loading={dialogLoading}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ConfirmMessage message={dialog.paths.length === 1
              ? t('fm.dialog.transfer.source', { name: basename(dialog.paths[0]) })
              : t('fm.dialog.transfer.sourceMany', { count: dialog.paths.length })} />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--hp-text-secondary)' }}>
                {t('fm.dialog.transfer.destinationLabel')}
              </span>
              <InputField value={inputValue} onChange={setInputValue} placeholder={currentPath} onKeyDown={(e) => { if (e.key === 'Enter') handleDialogSubmit() }} />
            </label>
            <TransferDirectoryPicker
              api={api}
              machineId={machineId}
              useRealApi={useRealApi}
              rootPath={rootPath}
              currentPath={currentPath}
              showHidden={showHidden}
              selectedPath={inputValue}
              onSelect={setInputValue}
              t={t}
            />
            <div style={{ fontSize: 12, color: 'var(--hp-text-tertiary)', lineHeight: 1.5 }}>
              {t('fm.dialog.transfer.hint')}
            </div>
          </div>
        </Dialog>
      )}

      <ToastContainer />
    </div>
  )
}

type ToolbarIcon = 'new' | 'upload' | 'session'

function ToolbarButton({ label, icon, onClick }: { label: string; icon: ToolbarIcon; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="fm-mobile-toolbar-button"
      style={{ minHeight: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '4px 10px', background: 'transparent', border: '1px solid transparent', cursor: 'pointer', color: 'var(--hp-text-secondary)', borderRadius: 'var(--hp-radius-md)', minWidth: 58, transition: 'background var(--hp-duration-fast) var(--hp-ease-out), color var(--hp-duration-fast) var(--hp-ease-out)' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--hp-text-primary)' }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--hp-text-secondary)' }}>
      <span style={{ width: 20, height: 20, display: 'grid', placeItems: 'center', fontSize: 18, lineHeight: 1 }} aria-hidden="true">
        {icon === 'new' ? (
          <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        ) : icon === 'upload' ? (
          <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M17 8 12 3 7 8" />
            <path d="M12 3v12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 5a2 2 0 0 1 2-2h6l4 4v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
            <path d="M15 3v5h5" />
            <path d="m10 14 2 2 4-5" />
          </svg>
        )}
      </span>
      <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
    </button>
  )
}
