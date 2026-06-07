import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { formatReadFileError } from '@/lib/files-i18n'
import { queryKeys } from '@/lib/query-keys'
import { useTranslation } from '@/lib/use-translation'
import { decodeBase64, encodeBase64 } from '@/lib/utils'
import { resolveImageMimeType, isBinaryContent, isMarkdownFile } from '@/lib/file-utils'

const MAX_COPYABLE_FILE_BYTES = 1_000_000
const LARGE_FILE_THRESHOLD = 1_000_000

type DisplayMode = 'preview' | 'edit'

function decodePath(value: string): string {
    if (!value) return ''
    const decoded = decodeBase64(value)
    return decoded.ok ? decoded.text : value
}

function getUtf8ByteLength(value: string): number {
    return new TextEncoder().encode(value).length
}

function getParentPath(path: string): string {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
    const index = normalized.lastIndexOf('/')
    if (index <= 0) return '/'
    return normalized.slice(0, index)
}

function FileContentSkeleton(props: { label: string }) {
    return <LoadingState label={props.label} />
}

export default function BrowseFilePage() {
    const { api } = useAppContext()
    const { t } = useTranslation()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { copied: pathCopied, copy: copyPath } = useCopyToClipboard()
    const { copied: contentCopied, copy: copyContent } = useCopyToClipboard()
    const search = useSearch({ from: '/browse/file' })
    const machineId = typeof search.machineId === 'string' ? search.machineId : ''
    const encodedPath = typeof search.path === 'string' ? search.path : ''

    const filePath = useMemo(() => decodePath(encodedPath), [encodedPath])
    const fileName = filePath.split('/').pop() || filePath || t('file.page.fallbackName')
    const imageMimeType = useMemo(() => resolveImageMimeType(filePath), [filePath])
    const isMarkdown = useMemo(() => isMarkdownFile(filePath), [filePath])

    const [displayMode, setDisplayMode] = useState<DisplayMode>('preview')
    const [serverContent, setServerContent] = useState('')
    const [serverHash, setServerHash] = useState<string | null>(null)
    const [localContent, setLocalContent] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
    const saveButtonRef = useRef<HTMLButtonElement>(null)
    const prevDecodedRef = useRef('')

    const isDirty = localContent !== serverContent

    const fileQuery = useQuery({
        queryKey: queryKeys.machineFile(machineId, filePath),
        queryFn: async () => {
            if (!api || !machineId || !filePath) throw new Error('Missing machine or path')
            return await api.readMachineFile(machineId, filePath)
        },
        enabled: Boolean(api && machineId && filePath)
    })

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
    const contentSizeBytes = useMemo(() => getUtf8ByteLength(decodedContent), [decodedContent])
    const isLargeFile = contentSizeBytes > LARGE_FILE_THRESHOLD
    const canCopyContent = fileContentResult?.success === true
        && !binaryFile
        && decodedContent.length > 0
        && contentSizeBytes <= MAX_COPYABLE_FILE_BYTES
    const isEditable = !binaryFile && !imageMimeType && !isLargeFile

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

    useEffect(() => {
        if (!fileContentResult?.success) return
        setDisplayMode('preview')
    }, [fileContentResult?.success, filePath])

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

    const handleSave = useCallback(async () => {
        if (!api || !machineId || !filePath || isSaving) return
        setIsSaving(true)
        setSaveError(null)
        try {
            const encoded = encodeBase64(localContent)
            const expectedHash = serverHash ?? fileContentResult?.hash
            const res = await api.writeMachineFile(machineId, filePath, encoded, expectedHash, false)
            if (!res.success) throw new Error(res.error ?? t('file.page.saveFailed'))
            setServerContent(localContent)
            setServerHash(res.hash ?? expectedHash ?? null)
            prevDecodedRef.current = localContent
            queryClient.invalidateQueries({ queryKey: queryKeys.machineFile(machineId, filePath) })
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : String(err))
        } finally {
            setIsSaving(false)
        }
    }, [api, machineId, filePath, localContent, serverHash, fileContentResult?.hash, isSaving, queryClient, t])

    const handleForceSave = useCallback(async () => {
        if (!api || !machineId || !filePath || isSaving) return
        setIsSaving(true)
        setSaveError(null)
        try {
            const encoded = encodeBase64(localContent)
            const res = await api.writeMachineFile(machineId, filePath, encoded, undefined, true)
            if (!res.success) throw new Error(res.error ?? t('file.page.saveFailed'))
            setServerContent(localContent)
            setServerHash(res.hash ?? null)
            prevDecodedRef.current = localContent
            queryClient.invalidateQueries({ queryKey: queryKeys.machineFile(machineId, filePath) })
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : String(err))
        } finally {
            setIsSaving(false)
        }
    }, [api, machineId, filePath, localContent, isSaving, queryClient, t])

    const handleReloadFromDisk = useCallback(async () => {
        if (!api || !machineId || !filePath) return
        setSaveError(null)
        const res = await api.readMachineFile(machineId, filePath)
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
        queryClient.invalidateQueries({ queryKey: queryKeys.machineFile(machineId, filePath) })
    }, [api, queryClient, machineId, filePath, t])

    const handleDiscard = useCallback(() => {
        setLocalContent(serverContent)
        setSaveError(null)
    }, [serverContent])

    useEffect(() => {
        if (!isDirty) return
        function handler(e: BeforeUnloadEvent) {
            e.preventDefault()
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [isDirty])

    const blocker = useBlocker({ condition: isDirty })

    useEffect(() => {
        if (blocker.status === 'blocked') {
            setPendingNavigation(() => () => blocker.proceed?.())
        } else if (blocker.status === 'idle') {
            setPendingNavigation(null)
        }
    }, [blocker.status, blocker.proceed])

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

    const handleGoBack = useCallback(() => {
        const parentPath = filePath ? getParentPath(filePath) : ''
        const go = () => navigate({
            to: '/browse',
            search: {
                ...(machineId ? { machineId } : {}),
                ...(parentPath ? { path: encodeBase64(parentPath) } : {}),
            },
            replace: true,
        })
        if (isDirty) setPendingNavigation(() => go)
        else go()
    }, [filePath, isDirty, machineId, navigate])

    const handleModeChange = useCallback((mode: DisplayMode) => {
        if (mode === displayMode) return
        setDisplayMode(mode)
    }, [displayMode])

    const loading = fileQuery.isLoading
    const fileError = fileContentResult && !fileContentResult.success
        ? (fileContentResult.error ?? 'Failed to read file')
        : null
    const noApi = !api
    const missingPath = !filePath || !machineId
    const fileErrorMessage = fileError ? formatReadFileError(fileError, t) : null
    const hasModeBar = isMarkdown || isEditable

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="bg-(--hp-surface-0)">
                <div className="mx-auto flex w-full max-w-content items-center gap-2 border-b border-(--hp-divider) px-3 py-2">
                    <button
                        type="button"
                        onClick={handleGoBack}
                        className="shrink-0 rounded p-1.5 text-(--hp-text-tertiary) transition-colors hover:bg-(--hp-surface-1) hover:text-(--hp-text-primary) focus-visible:outline-2 focus-visible:outline-(--hp-primary) focus-visible:outline-offset-1"
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
                    {saveError ? (
                        <span className="max-w-[200px] truncate text-xs font-medium text-(--hp-danger)" role="status" aria-live="polite">
                            {t('file.page.saveFailed')}
                        </span>
                    ) : null}
                    {isDirty && !saveError ? (
                        <span className="text-xs font-medium text-(--hp-warning)" role="status" aria-live="polite">
                            {t('file.page.unsavedChanges')}
                        </span>
                    ) : null}
                    <button type="button" onClick={() => copyPath(filePath)}
                        className="shrink-0 rounded p-1.5 text-(--hp-text-tertiary) transition-colors hover:bg-(--hp-surface-1) hover:text-(--hp-text-primary) focus-visible:outline-2 focus-visible:outline-(--hp-primary) focus-visible:outline-offset-1"
                        title={t('file.page.copyPath')}
                        aria-label={t('file.page.copyPath')}>
                        {pathCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                    </button>
                    {fileContentResult?.success && fileContentResult.content ? (
                        <button type="button" onClick={handleDownload}
                            className="shrink-0 rounded p-1.5 text-(--hp-text-tertiary) transition-colors hover:bg-(--hp-surface-1) hover:text-(--hp-text-primary) focus-visible:outline-2 focus-visible:outline-(--hp-primary) focus-visible:outline-offset-1"
                            title={t('file.page.download')}
                            aria-label={t('file.page.download')}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
                            </svg>
                        </button>
                    ) : null}
                </div>
            </div>

            {hasModeBar ? (
                <div className="bg-(--hp-surface-0)">
                    <div className="mx-auto flex w-full max-w-content items-center gap-2 border-b border-(--hp-divider) px-3 py-2">
                        {isMarkdown ? (
                            <button type="button" onClick={() => handleModeChange('preview')}
                                aria-pressed={displayMode === 'preview'}
                                className={`min-h-[32px] rounded px-3 py-1 text-xs font-semibold max-md:min-h-[44px] max-md:px-4 ${displayMode === 'preview' ? 'bg-(--hp-primary) text-(--hp-primary-text)' : 'bg-(--hp-surface-1) text-(--hp-text-tertiary)'}`}>
                                {t('file.preview.mode.preview')}
                            </button>
                        ) : null}
                        {isEditable ? (
                            <button type="button" onClick={() => handleModeChange('edit')}
                                aria-pressed={displayMode === 'edit'}
                                className={`min-h-[32px] rounded px-3 py-1 text-xs font-semibold max-md:min-h-[44px] max-md:px-4 ${displayMode === 'edit' ? 'bg-(--hp-primary) text-(--hp-primary-text)' : 'bg-(--hp-surface-1) text-(--hp-text-tertiary)'}`}>
                                {t('file.preview.mode.edit')}
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}

            <div className="min-h-0 flex-1" aria-busy={loading}>
                {noApi ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-(--hp-text-tertiary)">
                        <span className="text-sm">{t('file.viewer.noApi')}</span>
                    </div>
                ) : missingPath ? (
                    <div className="p-4 text-sm text-(--hp-text-tertiary) sm:p-6">{t('file.page.missingPath')}</div>
                ) : loading ? (
                    <FileContentSkeleton label={t('file.page.opening')} />
                ) : fileErrorMessage ? (
                    <div className="p-4 sm:p-6">
                        <div className="text-sm text-(--hp-text-tertiary)">{fileErrorMessage}</div>
                        <button
                            type="button"
                            onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.machineFile(machineId, filePath) })}
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
                        <span className="text-sm">{t('file.page.binary')}</span>
                        <div className="mt-1 flex gap-2">
                            <button type="button" onClick={() => copyPath(filePath)}
                                className="min-h-[44px] rounded bg-(--hp-surface-1) px-3 py-1.5 text-xs text-(--hp-text-secondary) transition-colors hover:text-(--hp-text-primary)">
                                {t('file.page.copyPath')}
                            </button>
                            {fileContentResult?.content ? (
                                <button type="button" onClick={handleDownload}
                                    className="min-h-[44px] rounded bg-(--hp-surface-1) px-3 py-1.5 text-xs text-(--hp-text-secondary) transition-colors hover:text-(--hp-text-primary)">
                                    {t('file.page.download')}
                                </button>
                            ) : null}
                        </div>
                    </div>
                ) : isLargeFile && displayMode === 'preview' ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-(--hp-text-tertiary)">
                        <span className="text-sm">{t('file.page.largeFile')}</span>
                        <div className="mt-1 flex gap-2">
                            <button type="button" onClick={() => copyContent(localContent)}
                                className="min-h-[44px] rounded bg-(--hp-surface-1) px-3 py-1.5 text-xs text-(--hp-text-secondary) transition-colors hover:text-(--hp-text-primary)">
                                {t('file.page.copyContent')}
                            </button>
                            <button type="button" onClick={handleDownload}
                                className="min-h-[44px] rounded bg-(--hp-surface-1) px-3 py-1.5 text-xs text-(--hp-text-secondary) transition-colors hover:text-(--hp-text-primary)">
                                {t('file.page.download')}
                            </button>
                        </div>
                    </div>
                ) : displayMode === 'preview' && isMarkdown && decodedContent ? (
                    <div className="app-scroll-y h-full p-4 sm:p-6 lg:p-8">
                        <MarkdownFilePreview content={serverContent || decodedContent} />
                    </div>
                ) : (
                    <div className="flex h-full flex-col">
                        <div className="flex shrink-0 items-center gap-2 border-b border-(--hp-divider) bg-(--hp-surface-0) px-3" style={{ minHeight: 'var(--hp-space-12)' }}>
                            <div className="min-w-0 flex-1 text-xs text-(--hp-text-tertiary)">
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
                                className="rounded p-1.5 text-(--hp-text-tertiary) transition-colors hover:bg-(--hp-surface-1) focus-visible:outline-2 focus-visible:outline-(--hp-primary) focus-visible:outline-offset-1 disabled:opacity-40 max-md:flex max-md:min-h-[44px] max-md:min-w-[44px] max-md:items-center max-md:justify-center"
                                title={t('file.page.copyContent')}
                                aria-label={t('file.page.copyContent')}>
                                {contentCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                            </button>
                            <button type="button" onClick={handleDownload}
                                className="rounded p-1.5 text-(--hp-text-tertiary) transition-colors hover:bg-(--hp-surface-1) focus-visible:outline-2 focus-visible:outline-(--hp-primary) focus-visible:outline-offset-1 max-md:flex max-md:min-h-[44px] max-md:min-w-[44px] max-md:items-center max-md:justify-center"
                                title={t('file.page.download')}
                                aria-label={t('file.page.download')}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
                                </svg>
                            </button>
                            {isDirty ? (
                                <button type="button" onClick={handleDiscard}
                                    aria-label={t('file.page.discardChanges')}
                                    className="min-h-[32px] rounded bg-(--hp-surface-1) px-3 py-1 text-xs font-semibold text-(--hp-text-secondary) transition-colors hover:text-(--hp-text-primary) max-md:min-h-[44px]">
                                    {t('file.page.discardChanges')}
                                </button>
                            ) : null}
                            {isDirty ? (
                                <button ref={saveButtonRef} type="button" onClick={handleSave}
                                    disabled={isSaving}
                                    aria-label={t('button.save')}
                                    className="min-h-[32px] rounded px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 max-md:min-h-[44px]"
                                    style={{ background: 'var(--hp-primary)', color: 'var(--hp-primary-text)' }}>
                                    {isSaving ? t('button.save') : t('button.save')}
                                </button>
                            ) : null}
                        </div>
                        {saveError ? (
                            <div className="flex shrink-0 items-center gap-2 border-b border-(--hp-divider) bg-(--hp-danger-subtle) px-3 py-2">
                                <span className="flex-1 break-words text-xs text-(--hp-danger)" role="alert">
                                    {t('file.page.saveErrorDetail', { error: saveError })}
                                </span>
                                <button type="button" onClick={handleSave}
                                    className="min-h-[32px] rounded bg-(--hp-primary) px-2 py-1 text-xs font-semibold text-(--hp-primary-text)">
                                    {t('file.page.retry')}
                                </button>
                                <button type="button" onClick={handleReloadFromDisk}
                                    className="min-h-[32px] rounded bg-(--hp-surface-1) px-2 py-1 text-xs text-(--hp-text-secondary)">
                                    {t('file.page.reloadFromDisk')}
                                </button>
                                <button type="button" onClick={handleForceSave}
                                    className="min-h-[32px] rounded bg-(--hp-danger-subtle) px-2 py-1 text-xs text-(--hp-danger)">
                                    {t('file.page.forceOverwrite')}
                                </button>
                                <button type="button" onClick={() => copyContent(localContent)}
                                    className="min-h-[32px] rounded bg-(--hp-surface-1) px-2 py-1 text-xs text-(--hp-text-secondary)">
                                    {t('file.page.copyContent')}
                                </button>
                            </div>
                        ) : null}
                        <textarea
                            value={localContent}
                            onChange={(e) => { setLocalContent(e.target.value); setSaveError(null) }}
                            spellCheck={false}
                            readOnly={displayMode === 'preview'}
                            className={`h-full w-full flex-1 resize-none p-4 font-mono text-sm leading-relaxed focus:outline-none ${displayMode === 'preview' ? 'cursor-default opacity-80' : ''}`}
                            style={{
                                background: 'var(--hp-canvas)',
                                color: 'var(--hp-text-primary)',
                                tabSize: 4,
                                WebkitAppearance: 'none',
                            }}
                            aria-label={fileName}
                        />
                    </div>
                )}
            </div>

            <Dialog open={pendingNavigation !== null} onOpenChange={(open) => { if (!open) handleLeaveStay() }}>
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
        </div>
    )
}
