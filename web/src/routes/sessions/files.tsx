import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import type { FileSearchItem, GitFileStatus } from '@/types/api'
import { FileIcon } from '@/components/FileIcon'
import { DirectoryTree } from '@/components/SessionFiles/DirectoryTree'
import { ContextMenu } from '@/components/ui/ContextMenu'
import type { ContextMenuItem } from '@/components/ui/ContextMenu'
import { FileInputDialog, FileMoveDialog } from '@/components/ui/FileDialogs'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SubPageLayout } from '@/components/ui/SubPageLayout'
import { useAppContext } from '@/lib/app-context'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { useGitStatusFiles } from '@/hooks/queries/useGitStatusFiles'
import { useSession } from '@/hooks/queries/useSession'
import { useSessionFileSearch } from '@/hooks/queries/useSessionFileSearch'
import {
    formatFileSearchError,
    formatGitStatusError,
    getDetachedBranchLabel,
    getProjectRootLabel,
} from '@/lib/files-i18n'
import { encodeBase64 } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '@/lib/use-translation'
import { useToast } from '@/lib/toast-context'

function RefreshIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <polyline points="21 3 21 9 15 9" />
        </svg>
    )
}

function SearchIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    )
}

function GitBranchIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="6" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
    )
}

function FolderIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
    )
}

function StatusBadge(props: { status: GitFileStatus['status'] }) {
    const { label, color, bg } = useMemo(() => {
        switch (props.status) {
            case 'added':
                return { label: 'A', color: 'var(--hp-success)', bg: 'var(--hp-success-subtle)' }
            case 'deleted':
                return { label: 'D', color: 'var(--hp-danger)', bg: 'var(--hp-danger-subtle)' }
            case 'renamed':
                return { label: 'R', color: 'var(--hp-info)', bg: 'var(--hp-primary-subtle)' }
            case 'untracked':
                return { label: '?', color: 'var(--hp-text-tertiary)', bg: 'var(--hp-surface-1)' }
            case 'conflicted':
                return { label: 'U', color: 'var(--hp-danger)', bg: 'var(--hp-danger-subtle)' }
            default:
                return { label: 'M', color: 'var(--hp-warning)', bg: 'var(--hp-warning-subtle)' }
        }
    }, [props.status])

    return (
        <span
            className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold font-mono"
            style={{ color, background: bg }}
        >
            {label}
        </span>
    )
}

function LineChanges(props: { added: number; removed: number }) {
    if (!props.added && !props.removed) return null

    return (
        <span className="flex items-center gap-1 text-[11px] font-mono">
            {props.added ? (
                <span className="text-[var(--hp-success)]">+{props.added}</span>
            ) : null}
            {props.removed ? (
                <span className="text-[var(--hp-danger)]">-{props.removed}</span>
            ) : null}
        </span>
    )
}

function GitFileRow(props: {
    file: GitFileStatus
    onOpen: () => void
    showDivider: boolean
}) {
    const { t } = useTranslation()
    const subtitle = getProjectRootLabel(props.file.filePath, t)

    return (
        <button
            type="button"
            onClick={props.onOpen}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--hp-surface-1)] transition-colors ${props.showDivider ? 'border-b border-[var(--hp-divider)]' : ''}`}
        >
            <FileIcon fileName={props.file.fileName} size={22} />
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-[var(--hp-text-primary)]">{props.file.fileName}</div>
                <div className="truncate text-xs text-[var(--hp-text-tertiary)]">{subtitle}</div>
            </div>
            <div className="flex items-center gap-2">
                <LineChanges added={props.file.linesAdded} removed={props.file.linesRemoved} />
                <StatusBadge status={props.file.status} />
            </div>
        </button>
    )
}

function SearchResultRow(props: {
    file: FileSearchItem
    onOpen: () => void
    showDivider: boolean
}) {
    const { t } = useTranslation()
    const subtitle = getProjectRootLabel(props.file.filePath, t)
    const icon = props.file.fileType === 'file'
        ? <FileIcon fileName={props.file.fileName} size={22} />
        : <FolderIcon className="text-[var(--hp-primary)]" />

    return (
        <button
            type="button"
            onClick={props.onOpen}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--hp-surface-1)] transition-colors ${props.showDivider ? 'border-b border-[var(--hp-divider)]' : ''}`}
        >
            {icon}
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-[var(--hp-text-primary)]">{props.file.fileName}</div>
                <div className="truncate text-xs text-[var(--hp-text-tertiary)]">{subtitle}</div>
            </div>
        </button>
    )
}

function FileListSkeleton(props: { label: string; rows?: number }) {
    const titleWidths = ['w-1/3', 'w-1/2', 'w-2/3', 'w-2/5', 'w-3/5']
    const subtitleWidths = ['w-1/2', 'w-2/3', 'w-3/4', 'w-1/3']
    const rows = props.rows ?? 6

    return (
        <div className="p-3 animate-pulse space-y-3" role="status" aria-live="polite">
            <span className="sr-only">{props.label}</span>
            {Array.from({ length: rows }).map((_, index) => (
                <div key={`skeleton-row-${index}`} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded bg-[var(--hp-surface-1)]" />
                    <div className="flex-1 space-y-2">
                        <div className={`h-3 ${titleWidths[index % titleWidths.length]} rounded bg-[var(--hp-surface-1)]`} />
                        <div className={`h-2 ${subtitleWidths[index % subtitleWidths.length]} rounded bg-[var(--hp-surface-1)]`} />
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function FilesPage() {
    const { api } = useAppContext()
    const { t } = useTranslation()
    const { addToast } = useToast()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { copy: copyToClipboard } = useCopyToClipboard()
    const { sessionId } = useParams({ from: '/sessions/$sessionId/files' })
    const search = useSearch({ from: '/sessions/$sessionId/files' })
    const { session } = useSession(api, sessionId)
    const [searchQuery, setSearchQuery] = useState('')

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        x: number
        y: number
        path: string
        type: 'file' | 'directory'
    } | null>(null)
    const justClosedRef = useRef(false)

    // Dialog states
    const [renameDialog, setRenameDialog] = useState<{ isOpen: boolean; path: string }>({ isOpen: false, path: '' })
    const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; path: string; type: 'file' | 'directory' }>({ isOpen: false, path: '', type: 'file' })
    const [moveDialog, setMoveDialog] = useState<{ isOpen: boolean; path: string; mode: 'move' | 'copy' }>({ isOpen: false, path: '', mode: 'move' })
    const [newFileDialog, setNewFileDialog] = useState<{ isOpen: boolean; basePath: string }>({ isOpen: false, basePath: '' })
    const [newFolderDialog, setNewFolderDialog] = useState<{ isOpen: boolean; basePath: string }>({ isOpen: false, basePath: '' })
    const [uploadBasePath, setUploadBasePath] = useState('')
    const [deleting, setDeleting] = useState(false)
    const uploadRef = useRef<HTMLInputElement>(null)

    const initialTab = search.tab === 'directories' ? 'directories' : 'changes'
    const [activeTab, setActiveTab] = useState<'changes' | 'directories'>(initialTab)

    const {
        status: gitStatus,
        error: gitError,
        isLoading: gitLoading,
        refetch: refetchGit
    } = useGitStatusFiles(api, sessionId)

    const shouldSearch = Boolean(searchQuery)

    const searchResults = useSessionFileSearch(api, sessionId, searchQuery, {
        enabled: shouldSearch
    })

    const handleOpenFile = useCallback((path: string, staged?: boolean) => {
        const fileSearch = staged === undefined
            ? (activeTab === 'directories'
                ? { path: encodeBase64(path), tab: 'directories' as const }
                : { path: encodeBase64(path) })
            : (activeTab === 'directories'
                ? { path: encodeBase64(path), staged, tab: 'directories' as const }
                : { path: encodeBase64(path), staged })
        navigate({
            to: '/sessions/$sessionId/file',
            params: { sessionId },
            search: fileSearch
        })
    }, [activeTab, navigate, sessionId])

    const branchLabel = getDetachedBranchLabel(gitStatus?.branch, t)
    const subtitle = session?.metadata?.path ?? sessionId
    const showGitErrorBanner = Boolean(gitError)
    const gitErrorMessage = useMemo(
        () => (gitError ? formatGitStatusError(gitError, t) : null),
        [gitError, t]
    )
    const searchErrorMessage = useMemo(
        () => (searchResults.error ? formatFileSearchError(searchResults.error, t) : null),
        [searchResults.error, t]
    )
    const rootLabel = useMemo(() => {
        const base = session?.metadata?.path ?? sessionId
        const parts = base.split(/[/\\]/).filter(Boolean)
        return parts.length ? parts[parts.length - 1] : base
    }, [session?.metadata?.path, sessionId])

    const handleRefresh = useCallback(() => {
        if (searchQuery) {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.sessionFiles(sessionId, searchQuery)
            })
            return
        }

        if (activeTab === 'directories') {
            void queryClient.invalidateQueries({
                queryKey: ['session-directory', sessionId]
            })
            return
        }

        void refetchGit()
    }, [activeTab, queryClient, refetchGit, searchQuery, sessionId])

    const handleTabChange = useCallback((nextTab: 'changes' | 'directories') => {
        setActiveTab(nextTab)
        navigate({
            to: '/sessions/$sessionId/files',
            params: { sessionId },
            search: nextTab === 'changes' ? {} : { tab: nextTab },
            replace: true,
        })
    }, [navigate, sessionId])

    const refreshDirectory = useCallback(() => {
        void queryClient.invalidateQueries({
            queryKey: ['session-directory', sessionId]
        })
    }, [queryClient, sessionId])

    const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !api || !sessionId) return
        if (file.size > 5 * 1024 * 1024) {
            addToast({ title: t('file.upload.tooLarge'), body: '' })
            e.target.value = ''
            return
        }
        try {
            const reader = new FileReader()
            const content = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string)
                reader.onerror = reject
                reader.readAsDataURL(file)
            })
            const base64 = content.split(',')[1]
            if (!base64) throw new Error('Failed to read file')
            const destPath = uploadBasePath ? `${uploadBasePath}/${file.name}` : file.name
            const res = await api.writeSessionFile(sessionId, destPath, base64, undefined, true)
            if (!res.success) throw new Error(res.error || t('file.upload.error'))
            addToast({ title: t('file.upload.success'), body: file.name })
            refreshDirectory()
            void refetchGit()
        } catch (err) {
            addToast({ title: t('file.upload.error'), body: err instanceof Error ? err.message : '' })
        }
        e.target.value = ''
        setUploadBasePath('')
    }, [api, sessionId, addToast, t, refreshDirectory, refetchGit, uploadBasePath])

    const handleContextMenu = useCallback((path: string, type: 'file' | 'directory', point: { x: number; y: number }) => {
        if (justClosedRef.current) {
            justClosedRef.current = false
            return
        }
        setContextMenu((prev) => {
            if (prev && prev.path === path && prev.type === type) return null
            return { ...point, path, type }
        })
    }, [])

    const contextMenuItems = useMemo((): ContextMenuItem[] => {
        if (!contextMenu) return []
        const items: ContextMenuItem[] = []
        const isDir = contextMenu.type === 'directory'
        const fileName = contextMenu.path.split('/').pop() || contextMenu.path

        if (isDir) {
            items.push({
                label: t('file.context.newFile'),
                icon: '+',
                onClick: () => setNewFileDialog({ isOpen: true, basePath: contextMenu.path }),
            })
            items.push({
                label: t('file.context.newFolder'),
                icon: '+',
                onClick: () => setNewFolderDialog({ isOpen: true, basePath: contextMenu.path }),
            })
            items.push({
                label: t('file.context.uploadHere'),
                icon: '↑',
                onClick: () => {
                    setUploadBasePath(contextMenu.path)
                    setTimeout(() => uploadRef.current?.click(), 0)
                },
            })
        }

        items.push({
            label: t('file.context.rename', { name: fileName }),
            icon: '✎',
            onClick: () => setRenameDialog({ isOpen: true, path: contextMenu.path }),
        })
        items.push({
            label: t('file.context.copyPath'),
            icon: '📋',
            onClick: async () => {
                const basePath = session?.metadata?.path ?? ''
                const fullPath = basePath ? `${basePath}/${contextMenu.path}` : contextMenu.path
                const ok = await copyToClipboard(fullPath)
                if (ok) addToast({ title: t('file.context.copyPathSuccess'), body: '' })
            },
        })
        if (!isDir) {
            items.push({
                label: t('file.context.download'),
                icon: '↓',
                onClick: async () => {
                    if (!api || !sessionId) return
                    try {
                        const res = await api.readSessionFile(sessionId, contextMenu.path)
                        if (!res.success || !res.content) return
                        const byteChars = atob(res.content)
                        const bytes = new Uint8Array(byteChars.length)
                        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
                        const blob = new Blob([bytes])
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = fileName
                        a.click()
                        URL.revokeObjectURL(url)
                    } catch {}
                },
            })
        }
        items.push({
            label: t('file.context.move'),
            icon: '→',
            onClick: () => setMoveDialog({ isOpen: true, path: contextMenu.path, mode: 'move' }),
        })
        items.push({
            label: t('file.context.copy'),
            icon: '⊕',
            onClick: () => setMoveDialog({ isOpen: true, path: contextMenu.path, mode: 'copy' }),
        })
        items.push({
            label: t('file.context.delete'),
            icon: '✕',
            danger: true,
            onClick: () => setDeleteDialog({ isOpen: true, path: contextMenu.path, type: contextMenu.type }),
        })

        return items
    }, [contextMenu, t, api, sessionId, session?.metadata?.path])

    const filesTabs = useMemo(() => [
        { id: 'changes', label: t('files.tab.changes') },
        { id: 'directories', label: t('files.tab.directories') },
    ], [t])

    return (
        <>
        <SubPageLayout
            tabs={filesTabs}
            activeTab={activeTab}
            onTabChange={(id) => handleTabChange(id as 'changes' | 'directories')}
            toolbar={
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--hp-text-tertiary)]">
                            <SearchIcon />
                        </div>
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={t('files.page.searchPlaceholder')}
                            className="w-full rounded-[var(--hp-radius-sm,6px)] border border-[var(--hp-border)] bg-[var(--hp-canvas)] py-2 pl-9 pr-3 text-sm text-[var(--hp-text-primary)] placeholder:text-[var(--hp-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--hp-primary)]"
                            autoCapitalize="none"
                            autoCorrect="off"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--hp-text-secondary)] transition-colors hover:bg-[var(--hp-surface-1)] hover:text-[var(--hp-text-primary)]"
                        title={t('files.page.refresh')}
                    >
                        <RefreshIcon />
                    </button>
                </div>
            }
        >
            {!gitLoading && gitStatus && !searchQuery && activeTab === 'changes' ? (
                <div className="px-3 py-2 border-b border-[var(--hp-divider)]">
                    <div className="flex items-center gap-2 text-sm">
                        <GitBranchIcon className="text-[var(--hp-text-tertiary)]" />
                        <span className="font-semibold text-[var(--hp-text-primary)]">{branchLabel}</span>
                    </div>
                    <div className="text-xs text-[var(--hp-text-tertiary)]">
                        {t('files.branch.summary', {
                            staged: gitStatus.totalStaged,
                            unstaged: gitStatus.totalUnstaged,
                        })}
                    </div>
                </div>
            ) : null}

            {showGitErrorBanner && activeTab === 'changes' ? (
                <div className="border-b border-[var(--hp-divider)] bg-[var(--hp-warning-subtle)] px-3 py-2 text-xs text-[var(--hp-text-secondary)]">
                    {gitErrorMessage}
                </div>
            ) : null}
            {shouldSearch ? (
                searchResults.isLoading ? (
                    <FileListSkeleton label={t('loading.files')} />
                ) : searchResults.error ? (
                    <div className="p-6 text-sm text-[var(--hp-text-tertiary)]">{searchErrorMessage}</div>
                ) : searchResults.files.length === 0 ? (
                    <div className="p-6 text-sm text-[var(--hp-text-tertiary)]">
                        {t('files.search.empty')}
                    </div>
                ) : (
                    <div className="border-t border-[var(--hp-divider)]">
                        {searchResults.files.map((file, index) => (
                            <SearchResultRow
                                key={`${file.fullPath}-${index}`}
                                file={file}
                                onOpen={() => handleOpenFile(file.fullPath)}
                                showDivider={index < searchResults.files.length - 1}
                            />
                        ))}
                    </div>
                )
            ) : activeTab === 'directories' ? (
                <div>
                    <input
                        ref={uploadRef}
                        type="file"
                        className="hidden"
                        onChange={handleUpload}
                    />
                    <DirectoryTree
                        api={api}
                        sessionId={sessionId}
                        rootLabel={rootLabel}
                        onOpenFile={(path) => handleOpenFile(path)}
                        onContextMenu={handleContextMenu}
                    />
                </div>
            ) : gitLoading ? (
                <FileListSkeleton label={t('loading.git')} />
            ) : (
                <div>
                    {gitStatus?.stagedFiles.length ? (
                        <div>
                            <div className="border-b border-[var(--hp-divider)] px-3 py-2 text-xs font-semibold text-[var(--hp-success)]">
                                {t('files.changes.section.staged', { n: gitStatus.stagedFiles.length })}
                            </div>
                            {gitStatus.stagedFiles.map((file, index) => (
                                <GitFileRow
                                    key={`staged-${file.fullPath}-${index}`}
                                    file={file}
                                    onOpen={() => handleOpenFile(file.fullPath, file.isStaged)}
                                    showDivider={index < gitStatus.stagedFiles.length - 1 || gitStatus.unstagedFiles.length > 0}
                                />
                            ))}
                        </div>
                    ) : null}

                    {gitStatus?.unstagedFiles.length ? (
                        <div>
                            <div className="border-b border-[var(--hp-divider)] px-3 py-2 text-xs font-semibold text-[var(--hp-warning)]">
                                {t('files.changes.section.unstaged', { n: gitStatus.unstagedFiles.length })}
                            </div>
                            {gitStatus.unstagedFiles.map((file, index) => (
                                <GitFileRow
                                    key={`unstaged-${file.fullPath}-${index}`}
                                    file={file}
                                    onOpen={() => handleOpenFile(file.fullPath, file.isStaged)}
                                    showDivider={index < gitStatus.unstagedFiles.length - 1}
                                />
                            ))}
                        </div>
                    ) : null}

                    {!gitStatus ? (
                        <div className="p-6 text-sm text-[var(--hp-text-tertiary)]">
                            {t('files.changes.empty.unavailable')}
                        </div>
                    ) : null}

                    {gitStatus && gitStatus.stagedFiles.length === 0 && gitStatus.unstagedFiles.length === 0 ? (
                        <div className="p-6 text-sm text-[var(--hp-text-tertiary)]">
                            {t('files.changes.empty.none')}
                        </div>
                    ) : null}
                </div>
            )}

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={contextMenuItems}
                    onClose={() => {
                        setContextMenu(null)
                        justClosedRef.current = true
                        setTimeout(() => { justClosedRef.current = false }, 300)
                    }}
                />
            )}
        </SubPageLayout>

        <FileInputDialog
            isOpen={renameDialog.isOpen}
            onClose={() => setRenameDialog({ isOpen: false, path: '' })}
            title={t('file.rename.title')}
            placeholder={t('file.rename.placeholder')}
            initialValue={renameDialog.path.split('/').pop() || ''}
            submitLabel={t('file.rename.submit')}
            onSubmit={async (newName) => {
                if (!api) return
                const dir = renameDialog.path.includes('/') ? renameDialog.path.substring(0, renameDialog.path.lastIndexOf('/')) : ''
                const newPath = dir ? `${dir}/${newName}` : newName
                const res = await api.renameSessionFile(sessionId, renameDialog.path, newPath)
                if (!res.success) throw new Error(res.error || t('file.rename.failed'))
                addToast({ title: t('file.rename.success'), body: newPath })
                refreshDirectory()
            }}
        />

        <ConfirmDialog
            isOpen={deleteDialog.isOpen}
            onClose={() => setDeleteDialog({ isOpen: false, path: '', type: 'file' })}
            title={t('file.delete.title')}
            description={t('file.delete.confirm', { path: deleteDialog.path })}
            confirmLabel={t('file.delete.submit')}
            confirmingLabel={t('file.delete.submitting')}
            destructive
            isPending={deleting}
            onConfirm={async () => {
                if (!api) return
                setDeleting(true)
                try {
                    const res = await api.deleteSessionFile(sessionId, deleteDialog.path, deleteDialog.type === 'directory')
                    if (!res.success) {
                        throw new Error(res.error || t('file.delete.failed'))
                    }
                    addToast({ title: t('file.delete.success'), body: deleteDialog.path })
                    refreshDirectory()
                } finally {
                    setDeleting(false)
                }
            }}
        />

        <FileMoveDialog
            isOpen={moveDialog.isOpen}
            onClose={() => setMoveDialog({ isOpen: false, path: '', mode: 'move' })}
            sessionId={sessionId}
            sourcePath={moveDialog.path}
            mode={moveDialog.mode}
            onSubmit={async (destPath) => {
                if (!api) return
                const res = moveDialog.mode === 'move'
                    ? await api.moveSessionFile(sessionId, moveDialog.path, destPath)
                    : await api.copySessionFile(sessionId, moveDialog.path, destPath)
                if (!res.success) throw new Error(res.error || t('file.move.failed'))
                addToast({ title: moveDialog.mode === 'move' ? t('file.move.success') : t('file.copy.success'), body: destPath })
                refreshDirectory()
            }}
        />

        <FileInputDialog
            isOpen={newFileDialog.isOpen}
            onClose={() => setNewFileDialog({ isOpen: false, basePath: '' })}
            title={t('file.newFile.title')}
            placeholder={t('file.newFile.placeholder')}
            submitLabel={t('file.newFile.submit')}
            onSubmit={async (name) => {
                if (!api) return
                const fullPath = newFileDialog.basePath ? `${newFileDialog.basePath}/${name}` : name
                const res = await api.writeSessionFile(sessionId, fullPath, '', undefined, true)
                if (!res.success) throw new Error(res.error || t('file.newFile.failed'))
                addToast({ title: t('file.newFile.success'), body: fullPath })
                refreshDirectory()
                handleOpenFile(fullPath)
            }}
        />

        <FileInputDialog
            isOpen={newFolderDialog.isOpen}
            onClose={() => setNewFolderDialog({ isOpen: false, basePath: '' })}
            title={t('file.newFolder.title')}
            placeholder={t('file.newFolder.placeholder')}
            submitLabel={t('file.newFolder.submit')}
            onSubmit={async (name) => {
                if (!api) return
                const fullPath = newFolderDialog.basePath ? `${newFolderDialog.basePath}/${name}` : name
                const res = await api.createDirectory(sessionId, fullPath, true)
                if (!res.success) throw new Error(res.error || t('file.newFolder.failed'))
                addToast({ title: t('file.newFolder.success'), body: fullPath })
                refreshDirectory()
            }}
        />
        </>
    )
}
