import { useEffect, useMemo, useState, useCallback, lazy, Suspense } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearch } from '@tanstack/react-router'
import type { GitCommandResponse } from '@/types/api'
import { FileIcon } from '@/components/FileIcon'
import { CopyIcon, CheckIcon } from '@/components/icons'
import { MarkdownFilePreview } from '@/components/MarkdownFilePreview'
import { useAppContext } from '@/lib/app-context'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { formatDiffError, formatReadFileError } from '@/lib/files-i18n'
import { queryKeys } from '@/lib/query-keys'
import { useTranslation } from '@/lib/use-translation'
import { decodeBase64 } from '@/lib/utils'
import { ImagePreview } from '@/components/ImagePreview'
import { LoadingState } from '@/components/LoadingState'

const CodeEditor = lazy(() =>
    import('@/components/Editor/CodeEditor').then(m => ({ default: m.CodeEditor }))
)
const DiffView = lazy(() =>
    import('@/components/Editor/DiffView').then(m => ({ default: m.DiffView }))
)

const MAX_COPYABLE_FILE_BYTES = 1_000_000
const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
    apng: 'image/apng', avif: 'image/avif', bmp: 'image/bmp',
    gif: 'image/gif', ico: 'image/x-icon', jpeg: 'image/jpeg',
    jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml',
    tif: 'image/tiff', tiff: 'image/tiff', webp: 'image/webp'
}

function decodePath(value: string): string {
    if (!value) return ''
    const decoded = decodeBase64(value)
    return decoded.ok ? decoded.text : value
}

function BackIcon(props: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={props.className}>
            <polyline points="15 18 9 12 15 6" />
        </svg>
    )
}

function FileContentSkeleton(props: { label: string }) {
    return <LoadingState label={props.label} />
}

function resolveImageMimeType(path: string): string | null {
    const ext = path.split('.').pop()?.toLowerCase()
    if (!ext) return null
    return IMAGE_MIME_BY_EXTENSION[ext] ?? null
}

function getUtf8ByteLength(value: string): number {
    return new TextEncoder().encode(value).length
}

function isBinaryContent(content: string): boolean {
    if (!content) return false
    if (content.includes('\0')) return true
    const nonPrintable = content.split('').filter((char) => {
        const code = char.charCodeAt(0)
        return code < 32 && code !== 9 && code !== 10 && code !== 13
    }).length
    return nonPrintable / content.length > 0.1
}

function isMarkdownFile(path: string): boolean {
    return /\.(md|mdx|markdown)$/i.test(path)
}

type DisplayMode = 'preview' | 'edit' | 'diff'

function extractCommandError(result: GitCommandResponse | undefined): string | null {
    if (!result) return null
    if (result.success) return null
    return result.error ?? result.stderr ?? 'Failed to load diff'
}

export default function FilePage() {
    const { api } = useAppContext()
    const { t } = useTranslation()
    const { copied: pathCopied, copy: copyPath } = useCopyToClipboard()
    const { copied: contentCopied, copy: copyContent } = useCopyToClipboard()

    const goBack = useAppGoBack()
    const queryClient = useQueryClient()
    const { sessionId } = useParams({ from: '/sessions/$sessionId/file' })
    const search = useSearch({ from: '/sessions/$sessionId/file' })
    const encodedPath = typeof search.path === 'string' ? search.path : ''
    const staged = search.staged

    const filePath = useMemo(() => decodePath(encodedPath), [encodedPath])
    const fileName = filePath.split('/').pop() || filePath || t('file.page.fallbackName')
    const imageMimeType = useMemo(() => resolveImageMimeType(filePath), [filePath])

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
        () => (decodedContent ? getUtf8ByteLength(decodedContent) : 0),
        [decodedContent]
    )
    const canCopyContent = fileContentResult?.success === true
        && !binaryFile
        && decodedContent.length > 0
        && contentSizeBytes <= MAX_COPYABLE_FILE_BYTES

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
        URL.revokeObjectURL(url)
    }, [fileContentResult, fileName])

    const [displayMode, setDisplayMode] = useState<DisplayMode>('diff')
    const [localContent, setLocalContent] = useState('')

    const isMarkdown = useMemo(() => isMarkdownFile(filePath), [filePath])

    useEffect(() => {
        if (decodedContent && localContent !== decodedContent) {
            setLocalContent(decodedContent)
        }
    }, [decodedContent])

    useEffect(() => {
        if (isMarkdown) {
            setDisplayMode('preview')
            return
        }
        if (imageMimeType) { setDisplayMode('edit'); return }
        if (diffSuccess && !diffContent) { setDisplayMode('edit'); return }
        if (diffFailed) setDisplayMode('edit')
    }, [diffSuccess, diffFailed, diffContent, imageMimeType, isMarkdown])

    async function handleSave(newValue: string) {
        if (!api || !sessionId || !filePath || !fileContentResult?.success) return
        const encoded = btoa(unescape(encodeURIComponent(newValue)))
        await api.writeSessionFile(sessionId, filePath, encoded, undefined, true)
        queryClient.invalidateQueries({ queryKey: queryKeys.sessionFile(sessionId, filePath) })
        queryClient.invalidateQueries({ queryKey: queryKeys.gitFileDiff(sessionId, filePath, staged) })
    }

    const loading = diffQuery.isLoading || fileQuery.isLoading
    const fileError = fileContentResult && !fileContentResult.success
        ? (fileContentResult.error ?? 'Failed to read file')
        : null
    const missingPath = !filePath
    const diffErrorMessage = diffError ? formatDiffError(diffError, t) : null
    const fileErrorMessage = fileError ? formatReadFileError(fileError, t) : null

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="bg-[var(--app-bg)] pt-[env(safe-area-inset-top)]">
                <div className="mx-auto w-full max-w-content flex items-center gap-2 p-3 border-b border-[var(--app-border)]">
                    <button type="button" onClick={goBack} aria-label={t('file.page.goBack')}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]">
                        <BackIcon />
                    </button>
                    <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{fileName}</div>
                        <div className="truncate text-xs text-[var(--app-hint)]">{filePath || t('file.page.unknownPath')}</div>
                    </div>
                </div>
            </div>

            <div className="bg-[var(--app-bg)]">
                <div className="mx-auto w-full max-w-content px-3 py-2 flex items-center gap-2 border-b border-[var(--app-divider)]">
                    <FileIcon fileName={fileName} size={20} />
                    <span className="min-w-0 flex-1 truncate text-xs text-[var(--app-hint)]">{filePath || t('file.page.unknownPath')}</span>
                    <button type="button" onClick={() => copyPath(filePath)}
                        className="shrink-0 rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors"
                        title={t('file.page.copyPath')}>
                        {pathCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                    </button>
                    {fileContentResult?.success && fileContentResult.content && (
                        <button type="button" onClick={handleDownload}
                            className="shrink-0 rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors"
                            title={t('file.page.download')}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {(diffContent || isMarkdown) ? (
                <div className="bg-[var(--app-bg)]">
                    <div className="mx-auto w-full max-w-content px-3 py-2 flex items-center gap-2 border-b border-[var(--app-divider)]">
                        {isMarkdown && (
                            <button type="button" onClick={() => setDisplayMode('preview')}
                                className={`rounded px-3 py-1 text-xs font-semibold ${displayMode === 'preview' ? 'bg-[var(--app-button)] text-[var(--app-button-text)] opacity-80' : 'bg-[var(--app-subtle-bg)] text-[var(--app-hint)]'}`}>
                                {t('file.preview.mode.preview')}
                            </button>
                        )}
                        <button type="button" onClick={() => setDisplayMode('edit')}
                            className={`rounded px-3 py-1 text-xs font-semibold ${displayMode === 'edit' ? 'bg-[var(--app-button)] text-[var(--app-button-text)] opacity-80' : 'bg-[var(--app-subtle-bg)] text-[var(--app-hint)]'}`}>
                            {t('file.preview.mode.edit')}
                        </button>
                        {diffContent && (
                            <button type="button" onClick={() => setDisplayMode('diff')}
                                className={`rounded px-3 py-1 text-xs font-semibold ${displayMode === 'diff' ? 'bg-[var(--app-button)] text-[var(--app-button-text)] opacity-80' : 'bg-[var(--app-subtle-bg)] text-[var(--app-hint)]'}`}>
                                {t('file.preview.mode.diff')}
                            </button>
                        )}
                    </div>
                </div>
            ) : null}

            <div className="flex-1 min-h-0">
                {diffErrorMessage ? (
                    <div className="p-4"><div className="mb-3 rounded-md bg-amber-500/10 p-2 text-xs text-[var(--app-hint)]">{diffErrorMessage}</div></div>
                ) : missingPath ? (
                    <div className="p-4 text-sm text-[var(--app-hint)]">{t('file.page.missingPath')}</div>
                ) : loading ? (
                    <FileContentSkeleton label={t('loading.file')} />
                ) : fileErrorMessage ? (
                    <div className="p-4 text-sm text-[var(--app-hint)]">{fileErrorMessage}</div>
                ) : displayMode === 'preview' && isMarkdown && decodedContent ? (
                    <div className="app-scroll-y h-full p-4">
                        <MarkdownFilePreview content={decodedContent} />
                    </div>
                ) : displayMode === 'diff' && diffContent && decodedContent ? (
                    <Suspense fallback={<FileContentSkeleton label="Loading diff..." />}>
                        <DiffView
                            original={decodedContent.replace(
                                new RegExp(`^\\+.*$`, 'gm'), ''
                            ).replace(new RegExp(`^-`, 'gm'), '')}
                            modified={decodedContent}
                            filePath={filePath}
                        />
                    </Suspense>
                ) : displayMode === 'edit' ? (
                    imagePreviewUrl ? (
                        <div className="app-scroll-y h-full p-4">
                            <ImagePreview src={imagePreviewUrl} fileName={fileName}
                                label={t('file.page.imagePreviewAlt', { name: fileName })} />
                        </div>
                    ) : binaryFile ? (
                        <div className="p-4 text-sm text-[var(--app-hint)]">{t('file.page.binary')}</div>
                    ) : (
                        <Suspense fallback={<FileContentSkeleton label="Loading editor..." />}>
                            <div className="relative h-full">
                                {canCopyContent && (
                                    <button type="button" onClick={() => copyContent(localContent)}
                                        className="absolute right-2 top-2 z-10 rounded p-1 text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)] transition-colors"
                                        title={t('file.page.copyContent')}>
                                        {contentCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                                    </button>
                                )}
                                <CodeEditor
                                    value={localContent}
                                    filePath={filePath}
                                    readOnly={false}
                                    onChange={(v) => setLocalContent(v)}
                                    onSave={handleSave}
                                />
                            </div>
                        </Suspense>
                    )
                ) : (
                    <div className="p-4 text-sm text-[var(--app-hint)]">{t('file.page.noChanges')}</div>
                )}
            </div>
        </div>
    )
}
