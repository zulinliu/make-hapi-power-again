import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearch, useNavigate, useBlocker } from '@tanstack/react-router'
import { FileIcon } from '@/components/FileIcon'
import { CopyIcon, CheckIcon } from '@/components/icons'
import { MarkdownFilePreview } from '@/components/MarkdownFilePreview'
import { ImagePreview } from '@/components/ImagePreview'
import { LoadingState } from '@/components/LoadingState'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppContext } from '@/lib/app-context'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { formatDiffError, formatReadFileError } from '@/lib/files-i18n'
import { queryKeys } from '@/lib/query-keys'
import { useTranslation } from '@/lib/use-translation'
import { decodeBase64, encodeBase64 } from '@/lib/utils'
import { resolveImageMimeType, isBinaryContent, isMarkdownFile } from '@/lib/file-utils'

const MAX_COPYABLE_FILE_BYTES = 1_000_000
const LARGE_FILE_THRESHOLD = 1_000_000

function decodePath(value: string): string {
    if (!value) return ''
    const decoded = decodeBase64(value)
    return decoded.ok ? decoded.text : value
}

function getUtf8ByteLength(value: string): number {
    return new TextEncoder().encode(value).length
}

function FileContentSkeleton(props: { label: string }) {
    return <LoadingState label={props.label} />
}

type DisplayMode = 'preview' | 'edit' | 'diff'

function extractCommandError(result: { success?: boolean; error?: string; stderr?: string } | undefined): string | null {
    if (!result) return null
    if (result.success) return null
    return result.error ?? result.stderr ?? 'Failed to load diff'
}

export default function FilePage() {
    const { api } = useAppContext()
    const { t } = useTranslation()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { copied: pathCopied, copy: copyPath } = useCopyToClipboard()
    const { copied: contentCopied, copy: copyContent } = useCopyToClipboard()

    const { sessionId } = useParams({ from: '/sessions/$sessionId/file' })
    const search = useSearch({ from: '/sessions/$sessionId/file' })
    const encodedPath = typeof search.path === 'string' ? search.path : ''
    const staged = search.staged

    const filePath = useMemo(() => decodePath(encodedPath), [encodedPath])
    const fileName = filePath.split('/').pop() || filePath || t('file.page.fallbackName')
    const imageMimeType = useMemo(() => resolveImageMimeType(filePath), [filePath])
    const isMarkdown = useMemo(() => isMarkdownFile(filePath), [filePath])

    // --- State ---
    const [displayMode, setDisplayMode] = useState<DisplayMode>('preview')
    const [serverContent, setServerContent] = useState('')
    const [serverHash, setServerHash] = useState<string | null>(null)
    const [localContent, setLocalContent] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
    const [forceConfirmOpen, setForceConfirmOpen] = useState(false)
    const saveButtonRef = useRef<HTMLButtonElement>(null)

    const isDirty = localContent !== serverContent

    // --- Queries ---
    const diffQuery = useQuery({
        queryKey: queryKeys.gitFileDiff(sessionId, filePath, staged),
        queryFn: async () => {
            if (!api || !sessionId || !filePath) throw new Error('Missing session or path')
            return await api.getGitDiffFile(sessionId, filePath, staged)
        },
        enabled: Boolean(api && sessionId && filePath)
    })

    const fileQuery = useQuery({
        queryKey: queryKeys.sessionFile(sessionId, filePath),
        queryFn: async () => {
            if (!api || !sessionId || !filePath) throw new Error('Missing session or path')
            return await api.readSessionFile(sessionId, filePath)
        },
        enabled: Boolean(api && sessionId && filePath)
    })

    // --- Derived data ---
    const diffContent = diffQuery.data?.success ? (diffQuery.data.stdout ?? '') : ''
    const diffError = extractCommandError(diffQuery.data)
    const diffSuccess = diffQuery.data?.success === true
    const diffFailed = diffQuery.data?.success === false

    const fileContentResult = fileQuery.data
    const decodedContentResult = fileContentResult?.success && fileContentResult.content
        ? decodeBase64(fileContentResult.content)
        : { text: '', ok: true }
    const decodedContent = decodedContentResult.text
    const binaryFile = fileContentResult?.success
        ? !decodedContentResult.ok || isBinaryContent(decodedContent)
        : false
    const imagePreviewUrl = fileContentResult?.success && fileContentResult.content && imageMimeType
        ? `data:${imageMimeType};base64,${fileContentResult.content}`
        : null

    const contentSizeBytes = useMemo(
        () => getUtf8ByteLength(decodedContent),
        [decodedContent]
    )

    const isLargeFile = contentSizeBytes > LARGE_FILE_THRESHOLD

    const canCopyContent = fileContentResult?.success === true
        && !binaryFile
        && decodedContent.length > 0
        && contentSizeBytes <= MAX_COPYABLE_FILE_BYTES

    const isEditable = !binaryFile && !imageMimeType && !isLargeFile

    // --- Sync server content to state (only when not dirty) ---
    const prevDecodedRef = useRef(decodedContent)
    useEffect(() => {
        if (decodedContent !== prevDecodedRef.current) {
            prevDecodedRef.current = decodedContent
            if (!isSaving && !isDirty) {
                setServerContent(decodedContent)
                setLocalContent(decodedContent)
                setServerHash(fileContentResult?.hash ?? null)
            }
        }
    }, [decodedContent, fileContentResult?.hash, isSaving, isDirty])

    // --- Set initial display mode based on file type ---
    useEffect(() => {
        if (!fileContentResult?.success) return
        if (isMarkdown) {
            setDisplayMode('preview')
            return
        }
        if (imageMimeType) {
            setDisplayMode('preview')
            return
        }
        if (binaryFile) {
            setDisplayMode('preview')
            return
        }
        if (diffSuccess && diffContent) {
            setDisplayMode('diff')
            return
        }
        setDisplayMode('preview')
    }, [fileContentResult?.success, isMarkdown, imageMimeType, binaryFile, diffSuccess, diffContent])

    // --- Download ---
    const handleDownload = useCallback(() => {
        if (!fileContentResult?.success || !fileContentResult.content) return
        const byteCharacters = atob(fileContentResult.content)
        const byteNumbers = new Uint8Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const blob = new Blob([byteNumbers])
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
    }, [fileContentResult, fileName])

    // --- Save ---
    const handleSave = useCallback(async () => {
        if (!api || !sessionId || !filePath || isSaving) return
        setIsSaving(true)
        setSaveError(null)
        try {
            const encoded = encodeBase64(localContent)
            const expectedHash = serverHash ?? fileContentResult?.hash
            const res = await api.writeSessionFile(sessionId, filePath, encoded, expectedHash, false)
            if (!res.success) throw new Error(res.error ?? t('file.page.saveFailed'))
            setServerContent(localContent)
            setServerHash(res.hash ?? expectedHash ?? null)
            prevDecodedRef.current = localContent
            queryClient.invalidateQueries({ queryKey: queryKeys.sessionFile(sessionId, filePath) })
            queryClient.invalidateQueries({ queryKey: queryKeys.gitFileDiff(sessionId, filePath, staged) })
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : String(err))
        } finally {
            setIsSaving(false)
        }
    }, [api, sessionId, filePath, localContent, serverHash, fileContentResult?.hash, isSaving, queryClient, staged, t])

    const handleForceSave = useCallback(async () => {
        if (!api || !sessionId || !filePath || isSaving) return
        setIsSaving(true)
        setSaveError(null)
        try {
            const encoded = encodeBase64(localContent)
            const res = await api.writeSessionFile(sessionId, filePath, encoded, undefined, true)
            if (!res.success) throw new Error(res.error ?? t('file.page.saveFailed'))
            setServerContent(localContent)
            setServerHash(res.hash ?? null)
            prevDecodedRef.current = localContent
            queryClient.invalidateQueries({ queryKey: queryKeys.sessionFile(sessionId, filePath) })
            queryClient.invalidateQueries({ queryKey: queryKeys.gitFileDiff(sessionId, filePath, staged) })
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : String(err))
        } finally {
            setIsSaving(false)
        }
    }, [api, sessionId, filePath, localContent, isSaving, queryClient, staged, t])

    const handleReloadFromDisk = useCallback(async () => {
        if (!api || !sessionId || !filePath) return
        setSaveError(null)
        const res = await api.readSessionFile(sessionId, filePath)
        if (!res.success || !res.content) {
            setSaveError(res.error ?? t('file.page.saveFailed'))
            return
        }
        const decoded = decodeBase64(res.content)
        if (!decoded.ok) {
            setSaveError(t('file.page.binary'))
            return
        }
        setServerContent(decoded.text)
        setLocalContent(decoded.text)
        setServerHash(res.hash ?? null)
        prevDecodedRef.current = decoded.text
        queryClient.invalidateQueries({ queryKey: queryKeys.sessionFile(sessionId, filePath) })
        queryClient.invalidateQueries({ queryKey: queryKeys.gitFileDiff(sessionId, filePath, staged) })
    }, [api, queryClient, sessionId, filePath, staged, t])

    // --- Discard ---
    const handleDiscard = useCallback(() => {
        setLocalContent(serverContent)
        setSaveError(null)
    }, [serverContent])

    // --- beforeunload guard ---
    useEffect(() => {
        if (!isDirty) return
        function handler(e: BeforeUnloadEvent) {
            e.preventDefault()
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [isDirty])

    // --- TanStack Router useBlocker ---
    const blocker = useBlocker({ condition: isDirty })

    useEffect(() => {
        if (blocker.status === 'blocked') {
            setPendingNavigation(() => () => blocker.proceed?.())
        } else if (blocker.status === 'idle') {
            setPendingNavigation(null)
        }
    }, [blocker.status, blocker.proceed])

    // --- Leave confirm dialog ---
    const handleLeaveStay = useCallback(() => {
        setPendingNavigation(null)
        blocker.reset?.()
    }, [blocker])

    const handleLeaveDiscard = useCallback(() => {
        const proceed = pendingNavigation
        setPendingNavigation(null)
        setLocalContent(serverContent)
        setSaveError(null)
        proceed?.()
    }, [pendingNavigation, serverContent])

    // --- Go back ---
    const handleGoBack = useCallback(() => {
        if (isDirty) {
            setPendingNavigation(() => () => {
                navigate({ to: '/sessions/$sessionId/files', params: { sessionId } })
            })
        } else {
            navigate({ to: '/sessions/$sessionId/files', params: { sessionId } })
        }
    }, [isDirty, navigate, sessionId])

    // --- Mode change with dirty check ---
    const handleModeChange = useCallback((mode: DisplayMode) => {
        if (mode === displayMode) return
        setDisplayMode(mode)
    }, [displayMode])

    // --- Error/loading states ---
    const loading = fileQuery.isLoading
    const fileError = fileContentResult && !fileContentResult.success
        ? (fileContentResult.error ?? 'Failed to read file')
        : null
    const noApi = !api
    const missingPath = !filePath
    const diffErrorMessage = diffError ? formatDiffError(diffError, t) : null
    const fileErrorMessage = fileError ? formatReadFileError(fileError, t) : null

    // --- Render helpers ---
    const hasDiffBar = (diffContent || isMarkdown) && !binaryFile && !imageMimeType

    return (
        <div className="flex h-full min-h-0 flex-col">
            {/* Header */}
            <div className="bg-(--hp-surface-0)">
                <div className="mx-auto w-full max-w-content px-3 py-2 flex items-center gap-2 border-b border-(--hp-divider)">
                    <button
                        type="button"
                        onClick={handleGoBack}
                        className="shrink-0 rounded p-1.5 text-(--hp-text-tertiary) hover:bg-(--hp-surface-1) hover:text-(--hp-text-primary) focus-visible:outline-2 focus-visible:outline-(--hp-primary) focus-visible:outline-offset-1 transition-colors"
                        aria-label={t('file.page.goBack')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                    </button>
                    <FileIcon fileName={fileName} size={20} />
                    <span className="min-w-0 flex-1 truncate text-xs text-(--hp-text-tertiary)" title={filePath}>
                        {filePath || t('file.page.unknownPath')}
                    </span>
                    {saveError && (
                        <span className="text-xs font-medium text-(--hp-danger) truncate max-w-[200px]" role="status" aria-live="polite">
                            {t('file.page.saveFailed')}
                        </span>
                    )}
                    {isDirty && !saveError && (
                        <span className="text-xs font-medium text-(--hp-warning)" role="status" aria-live="polite">
                            {t('file.page.unsavedChanges')}
                        </span>
                    )}
                    <button type="button" onClick={() => copyPath(filePath)}
                        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded p-1.5 text-(--hp-text-tertiary) transition-colors hover:bg-(--hp-surface-1) hover:text-(--hp-text-primary) focus-visible:outline-2 focus-visible:outline-(--hp-primary) focus-visible:outline-offset-1"
                        title={t('file.page.copyPath')}
                        aria-label={t('file.page.copyPath')}>
                        {pathCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                    </button>
                    {fileContentResult?.success && fileContentResult.content && (
                        <button type="button" onClick={handleDownload}
                            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded p-1.5 text-(--hp-text-tertiary) transition-colors hover:bg-(--hp-surface-1) hover:text-(--hp-text-primary) focus-visible:outline-2 focus-visible:outline-(--hp-primary) focus-visible:outline-offset-1"
                            title={t('file.page.download')}
                            aria-label={t('file.page.download')}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Mode bar */}
            {hasDiffBar && (
                <div className="bg-(--hp-surface-0)">
                    <div className="mx-auto w-full max-w-content px-3 py-2 flex items-center gap-2 border-b border-(--hp-divider)">
                        {isMarkdown && (
                            <button type="button" onClick={() => handleModeChange('preview')}
                                aria-pressed={displayMode === 'preview'}
                                className={`rounded px-3 py-1 text-xs font-semibold min-h-[32px] max-md:min-h-[44px] max-md:px-4 ${displayMode === 'preview' ? 'bg-(--hp-primary) text-(--hp-primary-text)' : 'bg-(--hp-surface-1) text-(--hp-text-tertiary)'}`}>
                                {t('file.preview.mode.preview')}
                            </button>
                        )}
                        {isEditable && (
                            <button type="button" onClick={() => handleModeChange('edit')}
                                aria-pressed={displayMode === 'edit'}
                                className={`rounded px-3 py-1 text-xs font-semibold min-h-[32px] max-md:min-h-[44px] max-md:px-4 ${displayMode === 'edit' ? 'bg-(--hp-primary) text-(--hp-primary-text)' : 'bg-(--hp-surface-1) text-(--hp-text-tertiary)'}`}>
                                {t('file.preview.mode.edit')}
                            </button>
                        )}
                        {diffContent && !imageMimeType && (
                            <button type="button" onClick={() => handleModeChange('diff')}
                                aria-pressed={displayMode === 'diff'}
                                className={`rounded px-3 py-1 text-xs font-semibold min-h-[32px] max-md:min-h-[44px] max-md:px-4 ${displayMode === 'diff' ? 'bg-(--hp-primary) text-(--hp-primary-text)' : 'bg-(--hp-surface-1) text-(--hp-text-tertiary)'}`}>
                                {t('file.preview.mode.diff')}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 min-h-0" aria-busy={loading}>
                {noApi ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-(--hp-text-tertiary)">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
                        </svg>
                        <span className="text-sm">{t('file.viewer.noSession')}</span>
                    </div>
                ) : diffErrorMessage && !fileError ? (
                    <div className="p-4 sm:p-6"><div className="mb-3 rounded-md bg-(--hp-warning-subtle) p-2 text-xs text-(--hp-text-secondary)">{diffErrorMessage}</div></div>
                ) : missingPath ? (
                    <div className="p-4 sm:p-6 text-sm text-(--hp-text-tertiary)">{t('file.page.missingPath')}</div>
                ) : loading ? (
                    <FileContentSkeleton label={t('file.page.opening')} />
                ) : fileErrorMessage ? (
                    <div className="p-4 sm:p-6">
                        <div className="text-sm text-(--hp-text-tertiary)">{fileErrorMessage}</div>
                        <button
                            type="button"
                            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.sessionFile(sessionId, filePath) })}
                            className="mt-2 text-xs text-(--hp-primary) hover:underline focus-visible:underline"
                        >
                            {t('file.page.retry')}
                        </button>
                    </div>
                ) : imagePreviewUrl ? (
                    <div className="app-scroll-y h-full p-4 sm:p-6 lg:p-8">
                        <ImagePreview src={imagePreviewUrl} fileName={fileName}
                            label={t('file.page.imagePreviewAlt', { name: fileName })} />
                    </div>
                ) : binaryFile ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-(--hp-text-tertiary)">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="4.93" x2="19.07" y1="4.93" y2="19.07" />
                        </svg>
                        <span className="text-sm">{t('file.page.binary')}</span>
                        <div className="flex gap-2 mt-1">
                            <button type="button" onClick={() => copyPath(filePath)}
                                className="px-3 py-1.5 rounded text-xs bg-(--hp-surface-1) text-(--hp-text-secondary) hover:text-(--hp-text-primary) transition-colors min-h-[44px]">
                                {t('file.page.copyPath')}
                            </button>
                            {fileContentResult?.content && (
                                <button type="button" onClick={handleDownload}
                                    className="px-3 py-1.5 rounded text-xs bg-(--hp-surface-1) text-(--hp-text-secondary) hover:text-(--hp-text-primary) transition-colors min-h-[44px]">
                                    {t('file.page.download')}
                                </button>
                            )}
                        </div>
                    </div>
                ) : isLargeFile && displayMode === 'preview' ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-(--hp-text-tertiary)">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className="text-sm">{t('file.page.largeFile')}</span>
                        <div className="flex gap-2 mt-1">
                            <button type="button" onClick={() => copyContent(localContent)}
                                className="px-3 py-1.5 rounded text-xs bg-(--hp-surface-1) text-(--hp-text-secondary) hover:text-(--hp-text-primary) transition-colors min-h-[44px]">
                                {t('file.page.copyContent')}
                            </button>
                            <button type="button" onClick={handleDownload}
                                className="px-3 py-1.5 rounded text-xs bg-(--hp-surface-1) text-(--hp-text-secondary) hover:text-(--hp-text-primary) transition-colors min-h-[44px]">
                                {t('file.page.download')}
                            </button>
                        </div>
                    </div>
                ) : displayMode === 'preview' && isMarkdown && decodedContent ? (
                    <div className="app-scroll-y h-full p-4 sm:p-6 lg:p-8">
                        <MarkdownFilePreview content={serverContent || decodedContent} />
                    </div>
                ) : displayMode === 'diff' && diffContent ? (
                    <div className="app-scroll-y h-full p-4 sm:p-6 lg:p-8">
                        <pre className="font-mono text-xs leading-relaxed text-(--hp-text-primary) whitespace-pre-wrap break-words overflow-wrap-anywhere">
                            {diffContent.replace(/\x1b\[[0-9;]*m/g, '')}
                        </pre>
                    </div>
                ) : displayMode === 'edit' || displayMode === 'preview' ? (
                    <div className="flex flex-col h-full">
                        {/* Editor toolbar */}
                        <div className="flex items-center gap-2 px-3 border-b border-(--hp-divider) bg-(--hp-surface-0) shrink-0" style={{ minHeight: 'var(--hp-space-12)' }}>
                            <div className="flex-1 text-xs text-(--hp-text-tertiary) min-w-0">
                                {saveError ? (
                                    <span className="text-(--hp-danger)" role="alert">
                                        {t('file.page.saveErrorDetail', { error: saveError })}
                                    </span>
                                ) : isDirty ? (
                                    <span className="text-(--hp-warning)">{t('file.page.unsavedChanges')}</span>
                                ) : displayMode === 'preview' ? (
                                    <span>{t('file.page.readOnly')}</span>
                                ) : null}
                            </div>
                            <button type="button" onClick={() => copyContent(localContent)}
                                disabled={!canCopyContent}
                                className="rounded p-1.5 text-(--hp-text-tertiary) hover:bg-(--hp-surface-1) focus-visible:outline-2 focus-visible:outline-(--hp-primary) focus-visible:outline-offset-1 transition-colors disabled:opacity-40 max-md:min-h-[44px] max-md:min-w-[44px] max-md:flex max-md:items-center max-md:justify-center"
                                title={t('file.page.copyContent')}
                                aria-label={t('file.page.copyContent')}>
                                {contentCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                            </button>
                            <button type="button" onClick={handleDownload}
                                className="rounded p-1.5 text-(--hp-text-tertiary) hover:bg-(--hp-surface-1) focus-visible:outline-2 focus-visible:outline-(--hp-primary) focus-visible:outline-offset-1 transition-colors max-md:min-h-[44px] max-md:min-w-[44px] max-md:flex max-md:items-center max-md:justify-center"
                                title={t('file.page.download')}
                                aria-label={t('file.page.download')}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
                                </svg>
                            </button>
                            {isDirty && (
                                <button type="button" onClick={handleDiscard}
                                    aria-label={t('file.page.discardChanges')}
                                    className="px-3 py-1 rounded text-xs font-semibold transition-colors min-h-[32px] bg-(--hp-surface-1) text-(--hp-text-secondary) hover:text-(--hp-text-primary) max-md:min-h-[44px]">
                                    {t('file.page.discardChanges')}
                                </button>
                            )}
                            {isDirty && (
                                <button ref={saveButtonRef} type="button" onClick={handleSave}
                                    disabled={isSaving}
                                    aria-label={t('button.save')}
                                    className="px-3 py-1 rounded text-xs font-semibold transition-colors min-h-[32px] disabled:opacity-60 disabled:cursor-not-allowed max-md:min-h-[44px]"
                                    style={{ background: 'var(--hp-primary)', color: 'var(--hp-primary-text)' }}>
                                    {isSaving ? (
                                        <span className="flex items-center gap-1.5">
                                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            {t('button.save')}
                                        </span>
                                    ) : t('button.save')}
                                </button>
                            )}
                        </div>
                        {saveError && (
                            <div className="flex shrink-0 flex-col gap-2 border-b border-(--hp-divider) bg-(--hp-danger-subtle) px-3 py-2 md:flex-row md:items-center">
                                <span className="flex-1 text-xs text-(--hp-danger) break-words" role="alert">
                                        {t('file.page.saveErrorDetail', { error: saveError })}
                                    </span>
                                <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
                                    <button type="button" onClick={handleSave}
                                        className="min-h-[44px] rounded bg-(--hp-primary) px-3 py-1 text-xs font-semibold text-(--hp-primary-text)">
                                        {t('file.page.retry')}
                                    </button>
                                    <button type="button" onClick={() => copyContent(localContent)}
                                        className="min-h-[44px] rounded bg-(--hp-surface-1) px-3 py-1 text-xs text-(--hp-text-secondary)">
                                        {t('file.page.copyContent')}
                                    </button>
                                    <button type="button" onClick={handleReloadFromDisk}
                                        className="min-h-[44px] rounded bg-(--hp-surface-1) px-3 py-1 text-xs text-(--hp-text-secondary)">
                                        {t('file.page.reloadFromDisk')}
                                    </button>
                                    <button type="button" onClick={() => setForceConfirmOpen(true)}
                                        className="min-h-[44px] rounded bg-(--hp-danger-subtle) px-3 py-1 text-xs text-(--hp-danger)">
                                        {t('file.page.forceOverwrite')}
                                    </button>
                                </div>
                            </div>
                        )}
                        <textarea
                            value={localContent}
                            onChange={(e) => { setLocalContent(e.target.value); setSaveError(null) }}
                            spellCheck={false}
                            readOnly={displayMode === 'preview'}
                            className={`flex-1 w-full resize-none p-4 font-mono text-sm leading-relaxed focus:outline-none ${displayMode === 'preview' ? 'cursor-default opacity-80' : ''}`}
                            style={{
                                background: 'var(--hp-canvas)',
                                color: 'var(--hp-text-primary)',
                                tabSize: 4,
                                WebkitAppearance: 'none',
                            }}
                            aria-label={fileName}
                        />
                    </div>
                ) : (
                    <div className="p-4 sm:p-6 text-sm text-(--hp-text-tertiary)">{t('file.page.noChanges')}</div>
                )}
            </div>

            {/* Leave confirm dialog */}
            <Dialog
                open={pendingNavigation !== null}
                onOpenChange={(open) => { if (!open) handleLeaveStay() }}
            >
                <DialogContent style={{ maxWidth: 400 }}>
                    <DialogHeader>
                        <DialogTitle>{t('file.viewer.leaveTitle')}</DialogTitle>
                        <DialogDescription className="mt-1.5 leading-relaxed">
                            {t('file.viewer.leaveBody', { name: fileName })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleLeaveStay} className="min-h-[44px] flex-1 sm:flex-none">
                            {t('file.viewer.stay')}
                        </Button>
                        <Button type="button" variant="destructive" onClick={handleLeaveDiscard} className="min-h-[44px] flex-1 sm:flex-none">
                            {t('file.viewer.discardAndLeave')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={forceConfirmOpen} onOpenChange={setForceConfirmOpen}>
                <DialogContent style={{ maxWidth: 420 }}>
                    <DialogHeader>
                        <DialogTitle>{t('file.page.forceOverwriteTitle')}</DialogTitle>
                        <DialogDescription className="mt-1.5 leading-relaxed">
                            {t('file.page.forceOverwriteBody', { name: fileName })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setForceConfirmOpen(false)} className="min-h-[44px] flex-1 sm:flex-none">
                            {t('fm.dialog.cancel')}
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => { setForceConfirmOpen(false); void handleForceSave() }} className="min-h-[44px] flex-1 sm:flex-none">
                            {t('file.page.forceOverwrite')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
