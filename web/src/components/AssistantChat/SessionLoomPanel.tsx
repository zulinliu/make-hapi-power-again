import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ApiClient } from '@/api/client'
import type { ConversationOutlineItem } from '@/chat/outline'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/Spinner'
import { CheckIcon, CloseIcon, CopyIcon, ShareIcon, TrashIcon } from '@/components/icons'
import { safeCopyToClipboard } from '@/lib/clipboard'
import { useTranslation } from '@/lib/use-translation'
import type {
    SessionLoomExportAsset,
    SessionLoomExportPreviewResponse,
    SessionLoomFilters,
    SessionLoomLanguage,
    SessionLoomOutlineItem,
    SessionLoomSynthesisResponse,
    SessionLoomTemplate
} from '@/types/api'

type SessionLoomTab = 'outline' | 'export' | 'synthesis' | 'assets'

type PanelStatus = 'idle' | 'loading' | 'error'

const DEFAULT_FILTERS: SessionLoomFilters = {
    redactSecrets: true,
    includeSystemEvents: false,
    includeToolDetails: false
}

const TEMPLATE_OPTIONS: SessionLoomTemplate[] = [
    'raw',
    'design',
    'prd',
    'decisions',
    'retrospective',
    'drift-check',
    'lesson-card'
]

function fallbackToServerOutline(items: readonly ConversationOutlineItem[]): SessionLoomOutlineItem[] {
    return items.map((item) => ({
        id: item.id,
        targetMessageId: item.targetMessageId,
        kind: item.kind,
        label: item.label,
        createdAt: item.createdAt,
        depth: 0
    }))
}

function serverToConversationOutline(item: SessionLoomOutlineItem): ConversationOutlineItem {
    return {
        id: item.id,
        targetMessageId: item.targetMessageId,
        kind: 'user',
        label: item.label,
        createdAt: item.createdAt
    }
}

function downloadMarkdownFile(fileName: string, markdown: string): void {
    if (typeof document === 'undefined') {
        throw new Error('Document is unavailable')
    }
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

function formatTime(value: number): string {
    return new Date(value).toLocaleString()
}

function formatBytes(value: number): string {
    if (value < 1024) return `${value} B`
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
    return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function getNavigatorShare(): ((data: ShareData) => Promise<void>) | null {
    if (typeof navigator === 'undefined') {
        return null
    }
    const candidate = (navigator as Navigator & { share?: unknown }).share
    return typeof candidate === 'function'
        ? (candidate.bind(navigator) as (data: ShareData) => Promise<void>)
        : null
}

export function ConversationOutlinePanel(props: {
    api?: ApiClient
    sessionId?: string
    title: string
    items: readonly ConversationOutlineItem[]
    hasMoreMessages: boolean
    isLoadingMoreMessages: boolean
    onLoadMore: () => void
    onSelect: (item: ConversationOutlineItem) => void
    onClose: () => void
}) {
    const { t, locale } = useTranslation()
    const closeButtonRef = useRef<HTMLButtonElement | null>(null)
    const [activeTab, setActiveTab] = useState<SessionLoomTab>('outline')
    const [outline, setOutline] = useState<SessionLoomOutlineItem[]>(() => fallbackToServerOutline(props.items))
    const [outlineStatus, setOutlineStatus] = useState<PanelStatus>('idle')
    const [outlineError, setOutlineError] = useState<string | null>(null)
    const [filters, setFilters] = useState<SessionLoomFilters>(DEFAULT_FILTERS)
    const [template, setTemplate] = useState<SessionLoomTemplate>('raw')
    const [preview, setPreview] = useState<SessionLoomExportPreviewResponse | null>(null)
    const [previewStatus, setPreviewStatus] = useState<PanelStatus>('idle')
    const [previewError, setPreviewError] = useState<string | null>(null)
    const [assets, setAssets] = useState<SessionLoomExportAsset[]>([])
    const [assetStatus, setAssetStatus] = useState<PanelStatus>('idle')
    const [assetError, setAssetError] = useState<string | null>(null)
    const [synthesis, setSynthesis] = useState<SessionLoomSynthesisResponse | null>(null)
    const [synthesisStatus, setSynthesisStatus] = useState<PanelStatus>('idle')
    const [synthesisError, setSynthesisError] = useState<string | null>(null)
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
    const [statusMessage, setStatusMessage] = useState<string | null>(null)

    const language: SessionLoomLanguage = locale === 'zh-CN' ? 'zh-CN' : 'en'
    const canUseApi = Boolean(props.api && props.sessionId)
    const canSharePreview = preview !== null && getNavigatorShare() !== null

    useEffect(() => {
        closeButtonRef.current?.focus()
    }, [])

    useEffect(() => {
        setOutline(fallbackToServerOutline(props.items))
    }, [props.items])

    const loadOutline = useCallback(async () => {
        if (!props.api || !props.sessionId) return
        setOutlineStatus('loading')
        setOutlineError(null)
        try {
            const response = await props.api.getSessionLoomOutline(props.sessionId)
            setOutline(response.items)
            setOutlineStatus('idle')
        } catch (error) {
            setOutlineError(error instanceof Error ? error.message : t('sessionLoom.error.outline'))
            setOutlineStatus('error')
        }
    }, [props.api, props.sessionId, t])

    const loadAssets = useCallback(async () => {
        if (!props.api || !props.sessionId) return
        setAssetStatus('loading')
        setAssetError(null)
        try {
            const response = await props.api.listSessionLoomExports(props.sessionId)
            setAssets(response.assets)
            setAssetStatus('idle')
        } catch (error) {
            setAssetError(error instanceof Error ? error.message : t('sessionLoom.error.assets'))
            setAssetStatus('error')
        }
    }, [props.api, props.sessionId, t])

    useEffect(() => {
        void loadOutline()
        void loadAssets()
    }, [loadOutline, loadAssets])

    const loadPreview = useCallback(async () => {
        if (!props.api || !props.sessionId) return
        setPreviewStatus('loading')
        setPreviewError(null)
        setStatusMessage(null)
        try {
            const response = await props.api.previewSessionLoomExport(props.sessionId, {
                language,
                format: 'markdown',
                template,
                filters
            })
            setPreview(response)
            setPreviewStatus('idle')
            setStatusMessage(t('sessionLoom.status.previewReady'))
        } catch (error) {
            setPreviewError(error instanceof Error ? error.message : t('sessionLoom.error.preview'))
            setPreviewStatus('error')
        }
    }, [filters, language, props.api, props.sessionId, t, template])

    const copyMarkdown = useCallback(async (markdown: string, successMessage: string) => {
        try {
            await safeCopyToClipboard(markdown)
            setCopyState('copied')
            setStatusMessage(successMessage)
            return true
        } catch {
            setCopyState('failed')
            setStatusMessage(t('sessionLoom.copyFailed'))
            return false
        }
    }, [t])

    const shareMarkdown = useCallback(async (title: string, markdown: string) => {
        const share = getNavigatorShare()
        if (!share) return false
        try {
            await share({ title, text: markdown })
            setStatusMessage(t('sessionLoom.status.shared'))
            return true
        } catch {
            return false
        }
    }, [t])

    const saveMarkdownWithFallback = useCallback(async (params: {
        fileName: string
        title: string
        markdown: string
    }) => {
        try {
            downloadMarkdownFile(params.fileName, params.markdown)
            setStatusMessage(t('sessionLoom.status.exportCreated'))
            return
        } catch {
            if (await shareMarkdown(params.title, params.markdown)) {
                return
            }
            await copyMarkdown(params.markdown, t('sessionLoom.status.savedFallbackCopied'))
        }
    }, [copyMarkdown, shareMarkdown, t])

    const createExport = useCallback(async () => {
        if (!props.api || !props.sessionId) return
        setPreviewStatus('loading')
        setPreviewError(null)
        setStatusMessage(null)
        try {
            const response = await props.api.createSessionLoomExport(props.sessionId, {
                language,
                format: 'markdown',
                template,
                filters
            })
            setPreview({
                success: true,
                sessionId: response.asset.sessionId,
                generatedAt: response.asset.createdAt,
                markdown: response.markdown,
                title: response.asset.title,
                stats: response.asset.stats,
                filters,
                warnings: []
            })
            setAssets((prev) => [response.asset, ...prev.filter((asset) => asset.exportId !== response.asset.exportId)])
            setPreviewStatus('idle')
            setStatusMessage(t('sessionLoom.status.exportCreated'))
            await saveMarkdownWithFallback({
                fileName: response.asset.fileName,
                title: response.asset.title,
                markdown: response.markdown
            })
        } catch (error) {
            setPreviewError(error instanceof Error ? error.message : t('sessionLoom.error.export'))
            setPreviewStatus('error')
        }
    }, [filters, language, props.api, props.sessionId, saveMarkdownWithFallback, t, template])

    const copyPreview = useCallback(async () => {
        if (!preview) return
        await copyMarkdown(preview.markdown, t('sessionLoom.status.copied'))
    }, [copyMarkdown, preview, t])

    const sharePreview = useCallback(async () => {
        if (!preview) return
        if (await shareMarkdown(preview.title, preview.markdown)) {
            return
        }
        await copyMarkdown(preview.markdown, t('sessionLoom.status.shareFallbackCopied'))
    }, [copyMarkdown, preview, shareMarkdown, t])

    const createSynthesis = useCallback(async () => {
        if (!props.api || !props.sessionId) return
        setSynthesisStatus('loading')
        setSynthesisError(null)
        try {
            const response = await props.api.createSessionLoomSynthesis(props.sessionId, {
                language,
                template,
                filters,
                useExternalModel: false,
                explicitConfirmation: false
            })
            setSynthesis(response)
            setSynthesisStatus('idle')
            setStatusMessage(t('sessionLoom.status.synthesisReady'))
        } catch (error) {
            setSynthesisError(error instanceof Error ? error.message : t('sessionLoom.error.synthesis'))
            setSynthesisStatus('error')
        }
    }, [filters, language, props.api, props.sessionId, t, template])

    const downloadAsset = useCallback(async (asset: SessionLoomExportAsset) => {
        if (!props.api || !props.sessionId) return
        try {
            const markdown = await props.api.downloadSessionLoomExport(props.sessionId, asset.exportId)
            await saveMarkdownWithFallback({
                fileName: asset.fileName,
                title: asset.title,
                markdown
            })
        } catch (error) {
            setAssetError(error instanceof Error ? error.message : t('sessionLoom.error.download'))
            setAssetStatus('error')
        }
    }, [props.api, props.sessionId, saveMarkdownWithFallback, t])

    const deleteAsset = useCallback(async (asset: SessionLoomExportAsset) => {
        if (!props.api || !props.sessionId) return
        setAssetStatus('loading')
        setAssetError(null)
        try {
            await props.api.deleteSessionLoomExport(props.sessionId, asset.exportId)
            setAssets((prev) => prev.filter((item) => item.exportId !== asset.exportId))
            setAssetStatus('idle')
            setStatusMessage(t('sessionLoom.status.assetDeleted'))
        } catch (error) {
            setAssetError(error instanceof Error ? error.message : t('sessionLoom.error.assets'))
            setAssetStatus('error')
        }
    }, [props.api, props.sessionId, t])

    const tabItems = useMemo<Array<{ id: SessionLoomTab; label: string; tabId: string; panelId: string }>>(() => [
        { id: 'outline', label: t('sessionLoom.tabs.outline'), tabId: 'session-loom-tab-outline', panelId: 'session-loom-panel-outline' },
        { id: 'export', label: t('sessionLoom.tabs.export'), tabId: 'session-loom-tab-export', panelId: 'session-loom-panel-export' },
        { id: 'synthesis', label: t('sessionLoom.tabs.synthesis'), tabId: 'session-loom-tab-synthesis', panelId: 'session-loom-panel-synthesis' },
        { id: 'assets', label: t('sessionLoom.tabs.assets'), tabId: 'session-loom-tab-assets', panelId: 'session-loom-panel-assets' },
    ], [t])
    const activeTabItem = tabItems.find((tab) => tab.id === activeTab) ?? tabItems[0]!

    const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
            props.onClose()
            return
        }
        if (event.key !== 'Tab') return
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ))
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
        }
    }, [props.onClose])

    const renderStatus = (status: PanelStatus, error: string | null) => {
        if (status === 'loading') {
            return (
                <div
                    className="flex items-center gap-2 rounded-md border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-2 text-xs text-[var(--app-hint)]"
                    aria-live="polite"
                >
                    <Spinner size="sm" label={null} className="text-current" />
                    {t('misc.loading')}
                </div>
            )
        }
        if (status === 'error' && error) {
            return (
                <div
                    className="rounded-md border border-(--hp-danger) bg-(--hp-danger-subtle) px-3 py-2 text-xs text-(--hp-danger)"
                    aria-live="assertive"
                >
                    {error}
                </div>
            )
        }
        return null
    }

    return (
        <aside
            className="absolute inset-0 z-30 flex flex-col border-l border-[var(--app-border)] bg-[var(--app-bg)] shadow-2xl sm:left-auto sm:w-[26rem] [padding-bottom:env(safe-area-inset-bottom)] [padding-top:env(safe-area-inset-top)] motion-reduce:transition-none"
            aria-label={t('sessionLoom.title')}
            onKeyDown={handleKeyDown}
        >
            <div className="flex items-start gap-3 border-b border-[var(--app-border)] p-3">
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[var(--app-fg)]">{t('sessionLoom.title')}</div>
                    <div className="mt-0.5 truncate text-xs text-[var(--app-hint)]">{props.title}</div>
                </div>
                <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={props.onClose}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)]"
                    aria-label={t('button.close')}
                    title={t('button.close')}
                >
                    <CloseIcon className="h-4 w-4" />
                </button>
            </div>

            <div className="grid grid-cols-4 gap-1 border-b border-[var(--app-border)] p-2" role="tablist" aria-label={t('sessionLoom.tabs.label')}>
                {tabItems.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        id={tab.tabId}
                        aria-selected={activeTab === tab.id}
                        aria-controls={tab.panelId}
                        onClick={() => setActiveTab(tab.id)}
                        className={`min-h-11 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)] ${
                            activeTab === tab.id
                                ? 'bg-[var(--app-button)] text-[var(--app-button-text)]'
                                : 'text-[var(--app-hint)] hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div
                className="app-scroll-y min-h-0 flex-1 p-3"
                role="tabpanel"
                id={activeTabItem.panelId}
                aria-labelledby={activeTabItem.tabId}
            >
                {!canUseApi ? (
                    <div className="mb-3 rounded-md border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-2 text-xs text-[var(--app-hint)]">
                        {t('sessionLoom.apiUnavailable')}
                    </div>
                ) : null}
                {statusMessage ? (
                    <div
                        className="mb-3 rounded-md border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-2 text-xs text-[var(--app-hint)]"
                        role="status"
                        aria-live="polite"
                    >
                        {statusMessage}
                    </div>
                ) : null}

                {activeTab === 'outline' ? (
                    <div className="space-y-3">
                        {renderStatus(outlineStatus, outlineError)}
                        {props.hasMoreMessages ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={props.onLoadMore}
                                disabled={props.isLoadingMoreMessages}
                                aria-busy={props.isLoadingMoreMessages}
                                className="min-h-11 w-full gap-1.5 text-xs"
                            >
                                {props.isLoadingMoreMessages ? (
                                    <>
                                        <Spinner size="sm" label={null} className="text-current" />
                                        {t('misc.loading')}
                                    </>
                                ) : (
                                    <>
                                        <span aria-hidden="true">↑</span>
                                        {t('session.outline.loadOlder')}
                                    </>
                                )}
                            </Button>
                        ) : null}
                        {outline.length === 0 ? (
                            <div className="px-2 py-8 text-center text-sm text-[var(--app-hint)]">
                                {t('sessionLoom.outline.empty')}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {outline.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => props.onSelect(serverToConversationOutline(item))}
                                        className="group flex min-h-11 w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-[var(--app-subtle-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)]"
                                    >
                                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--app-button)]" aria-hidden="true" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[11px] font-medium text-[var(--app-hint)]">
                                                {t(`sessionLoom.kind.${item.kind}`)}
                                            </span>
                                            <span className="line-clamp-2 text-sm leading-snug text-[var(--app-fg)]">
                                                {item.label}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : null}

                {activeTab === 'export' ? (
                    <div className="space-y-3">
                        <div className="space-y-2 rounded-md border border-[var(--app-border)] p-3">
                            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--app-fg)]">
                                <input
                                    type="checkbox"
                                    checked={filters.redactSecrets}
                                    onChange={(event) => {
                                        const checked = event.currentTarget.checked
                                        setFilters((prev) => ({ ...prev, redactSecrets: checked }))
                                    }}
                                />
                                {t('sessionLoom.filters.redactSecrets')}
                            </label>
                            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--app-fg)]">
                                <input
                                    type="checkbox"
                                    checked={filters.includeSystemEvents}
                                    onChange={(event) => {
                                        const checked = event.currentTarget.checked
                                        setFilters((prev) => ({ ...prev, includeSystemEvents: checked }))
                                    }}
                                />
                                {t('sessionLoom.filters.includeSystemEvents')}
                            </label>
                            <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--app-fg)]">
                                <input
                                    type="checkbox"
                                    checked={filters.includeToolDetails}
                                    onChange={(event) => {
                                        const checked = event.currentTarget.checked
                                        setFilters((prev) => ({ ...prev, includeToolDetails: checked }))
                                    }}
                                />
                                {t('sessionLoom.filters.includeToolDetails')}
                            </label>
                            <select
                                value={template}
                                aria-label={t('sessionLoom.template.label')}
                                onChange={(event) => setTemplate(event.currentTarget.value as SessionLoomTemplate)}
                                className="min-h-11 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-2 text-sm text-[var(--app-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)]"
                            >
                                {TEMPLATE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{t(`sessionLoom.template.${option}`)}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={loadPreview} disabled={!canUseApi || previewStatus === 'loading'} className="min-h-11 flex-1">
                                {t('sessionLoom.preview')}
                            </Button>
                            <Button size="sm" variant="outline" onClick={createExport} disabled={!canUseApi || previewStatus === 'loading'} className="min-h-11 flex-1">
                                {t('sessionLoom.downloadMarkdown')}
                            </Button>
                        </div>
                        {renderStatus(previewStatus, previewError)}
                        {preview ? (
                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-2 text-center" aria-live="polite">
                                    <div className="rounded-md bg-[var(--app-subtle-bg)] p-2">
                                        <div className="text-sm font-semibold">{preview.stats.messageCount}</div>
                                        <div className="text-[11px] text-[var(--app-hint)]">{t('sessionLoom.stats.messages')}</div>
                                    </div>
                                    <div className="rounded-md bg-[var(--app-subtle-bg)] p-2">
                                        <div className="text-sm font-semibold">{preview.stats.redactions}</div>
                                        <div className="text-[11px] text-[var(--app-hint)]">{t('sessionLoom.stats.redactions')}</div>
                                    </div>
                                    <div className="rounded-md bg-[var(--app-subtle-bg)] p-2">
                                        <div className="text-sm font-semibold">{preview.stats.filteredToolDetails}</div>
                                        <div className="text-[11px] text-[var(--app-hint)]">{t('sessionLoom.stats.filteredTools')}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={copyPreview} className="min-h-11 flex-1 gap-1.5">
                                        {copyState === 'copied' ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                                        {copyState === 'copied' ? t('button.copied') : t('button.copy')}
                                    </Button>
                                    {canSharePreview ? (
                                        <Button size="sm" variant="outline" onClick={sharePreview} className="min-h-11 flex-1 gap-1.5">
                                            <ShareIcon className="h-3.5 w-3.5" />
                                            {t('sessionLoom.share')}
                                        </Button>
                                    ) : null}
                                </div>
                                {copyState === 'failed' ? (
                                    <div className="text-xs text-(--hp-danger)">{t('sessionLoom.copyFailed')}</div>
                                ) : null}
                                <pre className="max-h-80 overflow-auto rounded-md border border-[var(--app-border)] bg-[var(--app-subtle-bg)] p-3 text-xs leading-relaxed text-[var(--app-fg)] whitespace-pre-wrap">
                                    {preview.markdown}
                                </pre>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                {activeTab === 'synthesis' ? (
                    <div className="space-y-3">
                        <div className="rounded-md border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-3 py-2 text-xs text-[var(--app-hint)]">
                            {t('sessionLoom.synthesis.externalOff')}
                        </div>
                        <Button size="sm" onClick={createSynthesis} disabled={!canUseApi || synthesisStatus === 'loading'} className="min-h-11 w-full">
                            {t('sessionLoom.synthesis.local')}
                        </Button>
                        {renderStatus(synthesisStatus, synthesisError)}
                        {synthesis ? (
                            <pre className="max-h-96 overflow-auto rounded-md border border-[var(--app-border)] bg-[var(--app-subtle-bg)] p-3 text-xs leading-relaxed text-[var(--app-fg)] whitespace-pre-wrap">
                                {synthesis.markdown}
                            </pre>
                        ) : null}
                    </div>
                ) : null}

                {activeTab === 'assets' ? (
                    <div className="space-y-3">
                        <Button size="sm" variant="outline" onClick={loadAssets} disabled={!canUseApi || assetStatus === 'loading'} className="min-h-11 w-full">
                            {t('sessionLoom.assets.refresh')}
                        </Button>
                        {renderStatus(assetStatus, assetError)}
                        {assets.length === 0 ? (
                            <div className="px-2 py-8 text-center text-sm text-[var(--app-hint)]">
                                {t('sessionLoom.assets.empty')}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {assets.map((asset) => (
                                    <div key={asset.exportId} className="rounded-md border border-[var(--app-border)] p-3">
                                        <div className="min-w-0 text-sm font-medium text-[var(--app-fg)]">{asset.fileName}</div>
                                        <div className="mt-1 text-xs leading-relaxed text-[var(--app-hint)]">
                                            {formatTime(asset.createdAt)} · {formatBytes(asset.sizeBytes)}
                                            <br />
                                            {t('sessionLoom.assets.expiresAt')}: {formatTime(asset.expiresAt)}
                                            <br />
                                            sha256: {asset.checksum.slice(0, 12)}
                                        </div>
                                        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                                            <Button size="sm" variant="outline" onClick={() => void downloadAsset(asset)} className="min-h-11 w-full">
                                                {t('sessionLoom.assets.download')}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => void deleteAsset(asset)}
                                                className="min-h-11 w-11 px-0 text-(--hp-danger)"
                                                aria-label={t('sessionLoom.assets.delete')}
                                                title={t('sessionLoom.assets.delete')}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </aside>
    )
}
