import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import type { FileSearchItem, GitFileStatus } from '@/types/api'
import { FileIcon } from '@/components/FileIcon'
import { FileManager } from '@/components/FileManager/FileManager'
import { SubPageLayout } from '@/components/ui/SubPageLayout'
import { useAppContext } from '@/lib/app-context'
import { useGitStatusFiles } from '@/hooks/queries/useGitStatusFiles'
import { useSession } from '@/hooks/queries/useSession'
import { useSessionFileSearch } from '@/hooks/queries/useSessionFileSearch'
import {
    formatFileSearchError,
    formatGitStatusError,
    getDetachedBranchLabel,
    getProjectRootLabel,
} from '@/lib/files-i18n'
import { decodeBase64, encodeBase64 } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '@/lib/use-translation'

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
                <span className="text-(--hp-success)">+{props.added}</span>
            ) : null}
            {props.removed ? (
                <span className="text-(--hp-danger)">-{props.removed}</span>
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
            className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-(--hp-surface-1) transition-colors ${props.showDivider ? 'border-b border-(--hp-divider)' : ''}`}
        >
            <FileIcon fileName={props.file.fileName} size={22} />
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-(--hp-text-primary)">{props.file.fileName}</div>
                <div className="truncate text-xs text-(--hp-text-tertiary)">{subtitle}</div>
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
        : <FolderIcon className="text-(--hp-primary)" />

    return (
        <button
            type="button"
            onClick={props.onOpen}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-(--hp-surface-1) transition-colors ${props.showDivider ? 'border-b border-(--hp-divider)' : ''}`}
        >
            {icon}
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-(--hp-text-primary)">{props.file.fileName}</div>
                <div className="truncate text-xs text-(--hp-text-tertiary)">{subtitle}</div>
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
                    <div className="h-6 w-6 rounded bg-(--hp-surface-1)" />
                    <div className="flex-1 space-y-2">
                        <div className={`h-3 ${titleWidths[index % titleWidths.length]} rounded bg-(--hp-surface-1)`} />
                        <div className={`h-2 ${subtitleWidths[index % subtitleWidths.length]} rounded bg-(--hp-surface-1)`} />
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function FilesPage() {
    const { api } = useAppContext()
    const { t } = useTranslation()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { sessionId } = useParams({ from: '/sessions/$sessionId/files' })
    const search = useSearch({ from: '/sessions/$sessionId/files' })
    const { session } = useSession(api, sessionId)
    const [searchQuery, setSearchQuery] = useState('')
    const [directoryRefreshKey, setDirectoryRefreshKey] = useState(0)

    const initialTab = search.tab === 'directories' ? 'directories' : 'changes'
    const [activeTab, setActiveTab] = useState<'changes' | 'directories'>(initialTab)
    const initialDirectoryPath = useMemo(() => {
        if (typeof search.path !== 'string' || !search.path) return session?.metadata?.path
        const decoded = decodeBase64(search.path)
        return decoded.ok ? decoded.text : search.path
    }, [search.path, session?.metadata?.path])

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
    const handleRefresh = useCallback(() => {
        if (searchQuery) {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.sessionFiles(sessionId, searchQuery)
            })
            return
        }

        if (activeTab === 'directories') {
            setDirectoryRefreshKey((key) => key + 1)
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
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-(--hp-text-tertiary)">
                            <SearchIcon />
                        </div>
                        <input
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={t('files.page.searchPlaceholder')}
                            className="min-h-[44px] w-full rounded-[var(--hp-radius-sm,6px)] border border-(--hp-border) bg-(--hp-canvas) py-2 pl-9 pr-3 text-sm text-(--hp-text-primary) placeholder:text-(--hp-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--hp-primary)"
                            autoCapitalize="none"
                            autoCorrect="off"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="flex h-11 w-11 items-center justify-center rounded-full text-(--hp-text-secondary) transition-colors hover:bg-(--hp-surface-1) hover:text-(--hp-text-primary)"
                        title={t('files.page.refresh')}
                    >
                        <RefreshIcon />
                    </button>
                </div>
            }
        >
            {!gitLoading && gitStatus && !searchQuery && activeTab === 'changes' ? (
                <div className="px-3 py-2 border-b border-(--hp-divider)">
                    <div className="flex items-center gap-2 text-sm">
                        <GitBranchIcon className="text-(--hp-text-tertiary)" />
                        <span className="font-semibold text-(--hp-text-primary)">{branchLabel}</span>
                    </div>
                    <div className="text-xs text-(--hp-text-tertiary)">
                        {t('files.branch.summary', {
                            staged: gitStatus.totalStaged,
                            unstaged: gitStatus.totalUnstaged,
                        })}
                    </div>
                </div>
            ) : null}

            {showGitErrorBanner && activeTab === 'changes' ? (
                <div className="border-b border-(--hp-divider) bg-(--hp-warning-subtle) px-3 py-2 text-xs text-(--hp-text-secondary)">
                    {gitErrorMessage}
                </div>
            ) : null}
            {shouldSearch ? (
                searchResults.isLoading ? (
                    <FileListSkeleton label={t('loading.files')} />
                ) : searchResults.error ? (
                    <div className="p-6 text-sm text-(--hp-text-tertiary)">{searchErrorMessage}</div>
                ) : searchResults.files.length === 0 ? (
                    <div className="p-6 text-sm text-(--hp-text-tertiary)">
                        {t('files.search.empty')}
                    </div>
                ) : (
                    <div className="border-t border-(--hp-divider)">
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
                <div className="h-[calc(100dvh-190px)] min-h-[360px] md:min-h-[520px]">
                    {api && session?.metadata?.machineId && session?.metadata?.path ? (
                        <FileManager
                            key={`${directoryRefreshKey}-${initialDirectoryPath ?? ''}`}
                            api={api}
                            machineId={session.metadata.machineId}
                            sessionId={sessionId}
                            initialPath={initialDirectoryPath}
                            rootPath={session.metadata.path}
                        />
                    ) : (
                        <div className="p-6 text-sm text-(--hp-text-tertiary)">
                            {t('files.directory.unavailable')}
                        </div>
                    )}
                </div>
            ) : gitLoading ? (
                <FileListSkeleton label={t('loading.git')} />
            ) : (
                <div>
                    {gitStatus?.stagedFiles.length ? (
                        <div>
                            <div className="border-b border-(--hp-divider) px-3 py-2 text-xs font-semibold text-(--hp-success)">
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
                            <div className="border-b border-(--hp-divider) px-3 py-2 text-xs font-semibold text-(--hp-warning)">
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
                        <div className="p-6 text-sm text-(--hp-text-tertiary)">
                            {t('files.changes.empty.unavailable')}
                        </div>
                    ) : null}

                    {gitStatus && gitStatus.stagedFiles.length === 0 && gitStatus.unstagedFiles.length === 0 ? (
                        <div className="p-6 text-sm text-(--hp-text-tertiary)">
                            {t('files.changes.empty.none')}
                        </div>
                    ) : null}
                </div>
            )}

        </SubPageLayout>

        </>
    )
}
