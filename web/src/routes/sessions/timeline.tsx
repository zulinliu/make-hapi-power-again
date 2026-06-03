import { useCallback, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { useSession } from '@/hooks/queries/useSession'
import { useTranslation } from '@/lib/use-translation'
import { SubPageLayout } from '@/components/ui/SubPageLayout'

type TimelineEntryType = 'tool_use' | 'file_change' | 'message' | 'summary' | 'checkpoint' | 'error'
type FilterType = 'all' | TimelineEntryType

const TYPE_LABEL_KEYS: Record<TimelineEntryType, string> = {
    tool_use: 'timeline.tab.tool_use',
    file_change: 'timeline.tab.file_change',
    message: 'timeline.tab.message',
    summary: 'timeline.tab.summary',
    checkpoint: 'timeline.tab.checkpoint',
    error: 'timeline.tab.error',
}

const TYPE_COLORS: Record<TimelineEntryType, { bg: string; text: string }> = {
    tool_use: { bg: 'var(--app-primary-subtle)', text: 'var(--app-link)' },
    file_change: { bg: 'var(--app-success-subtle)', text: 'var(--app-success)' },
    message: { bg: 'var(--app-subtle-bg)', text: 'var(--app-hint)' },
    summary: { bg: 'var(--app-success-subtle)', text: 'var(--app-success)' },
    checkpoint: { bg: 'var(--app-warning-subtle)', text: 'var(--app-warning)' },
    error: { bg: 'var(--app-badge-error-bg)', text: 'var(--app-danger)' },
}

interface TimelineEntry {
    id: string
    type: TimelineEntryType
    timestamp: number
    seq: number
    data: Record<string, unknown>
}

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function EntryIcon({ type }: { type: TimelineEntryType }) {
    const icons: Record<TimelineEntryType, React.ReactNode> = {
        tool_use: <circle cx="12" cy="12" r="3" />,
        file_change: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />,
        message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
        summary: <path d="M12 20h9" />,
        checkpoint: <polyline points="20 6 9 17 4 12" />,
        error: <line x1="18" y1="6" x2="6" y2="18" />,
    }
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {icons[type]}
        </svg>
    )
}

function EntryDetail({ entry }: { entry: TimelineEntry }) {
    const { t } = useTranslation()
    const d = entry.data
    switch (entry.type) {
        case 'message': {
            const role = d.role === 'assistant' ? t('timeline.role.assistant') : t('timeline.role.user')
            const text = typeof d.text === 'string' ? d.text : ''
            return (
                <div>
                    <span className="text-xs font-medium text-[var(--app-hint)]">{role}</span>
                    <p className="text-sm text-[var(--app-fg)] mt-0.5 line-clamp-3">{text}</p>
                </div>
            )
        }
        case 'tool_use': {
            const toolName = typeof d.toolName === 'string' ? d.toolName : ''
            const output = typeof d.output === 'string' ? d.output : ''
            return (
                <div>
                    <span className="text-xs font-medium text-[var(--app-hint)]">{toolName}</span>
                    {output && <p className="text-xs text-[var(--app-hint)] mt-0.5 line-clamp-2">{output}</p>}
                </div>
            )
        }
        case 'file_change': {
            const toolName = typeof d.toolName === 'string' ? d.toolName : ''
            const input = d.input as Record<string, unknown> | undefined
            const filePath = input && typeof input.path === 'string' ? input.path : ''
            return (
                <div>
                    <span className="text-xs font-medium text-[var(--app-hint)]">{toolName}</span>
                    {filePath && <p className="text-sm text-[var(--app-fg)] mt-0.5 truncate">{filePath}</p>}
                </div>
            )
        }
        case 'summary': {
            const text = typeof d.text === 'string' ? d.text : ''
            const isAuto = d.isAuto === true
            return (
                <div>
                    <span className="text-xs font-medium text-[var(--app-hint)]">{isAuto ? t('timeline.summary.auto') : t('timeline.summary.manual')}</span>
                    <p className="text-sm text-[var(--app-fg)] mt-0.5 line-clamp-4">{text}</p>
                </div>
            )
        }
        case 'checkpoint': {
            const inputTokens = typeof d.inputTokens === 'number' ? d.inputTokens : 0
            const outputTokens = typeof d.outputTokens === 'number' ? d.outputTokens : 0
            return (
                <div className="text-xs text-[var(--app-hint)]">
                    {t('timeline.checkpoint.tokens', { input: (inputTokens / 1000).toFixed(1), output: (outputTokens / 1000).toFixed(1) })}
                </div>
            )
        }
        case 'error': {
            const output = typeof d.output === 'string' ? d.output : ''
            return <p className="text-xs text-[var(--app-danger)] line-clamp-2">{output || t('timeline.error')}</p>
        }
        default:
            return null
    }
}

export default function TimelinePage() {
    const { sessionId } = useParams({ from: '/sessions/$sessionId/timeline' })
    const { api } = useAppContext()
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [filter, setFilter] = useState<FilterType>('all')

    const { session } = useSession(api, sessionId)

    const { data: timelineData, isLoading } = useQuery({
        queryKey: ['timeline', sessionId, filter],
        queryFn: () => api!.getTimeline(sessionId, filter === 'all' ? undefined : filter),
        enabled: !!api,
    })

    const { data: summariesData } = useQuery({
        queryKey: ['summaries', sessionId],
        queryFn: () => api!.getSummaries(sessionId),
        enabled: !!api,
    })

    const checkpointMutation = useMutation({
        mutationFn: (label?: string) => api!.createCheckpoint(sessionId, label),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeline', sessionId] })
        },
    })

    const entries = timelineData?.entries ?? []
    const truncated = timelineData?.truncated ?? false
    const summaries = summariesData?.summaries ?? []

    return (
        <SubPageLayout
            tabs={[
                { id: 'all', label: t('timeline.tab.all') },
                { id: 'message', label: t('timeline.tab.message') },
                { id: 'tool_use', label: t('timeline.tab.tool_use') },
                { id: 'file_change', label: t('timeline.tab.file_change') },
                { id: 'summary', label: t('timeline.tab.summary') },
                { id: 'checkpoint', label: t('timeline.tab.checkpoint') },
                { id: 'error', label: t('timeline.tab.error') },
            ]}
            activeTab={filter}
            onTabChange={(id) => setFilter(id as FilterType)}
            toolbar={
                <div className="flex items-center justify-end">
                    <button
                        type="button"
                        onClick={() => checkpointMutation.mutate(undefined)}
                        disabled={checkpointMutation.isPending}
                        className="px-3 py-1.5 text-xs rounded-md bg-[var(--app-link)] text-white hover:opacity-90 disabled:opacity-50"
                    >
                        {t('timeline.createCheckpoint')}
                    </button>
                </div>
            }
        >
            {truncated && (
                <div className="mx-3 mt-2 rounded-md border border-[var(--app-border)] bg-[var(--app-warning-subtle)] px-3 py-2 text-xs text-[var(--app-warning)]">
                    {t('timeline.truncated')}
                </div>
            )}
            {isLoading ? (
                <div className="py-8 text-center text-sm text-[var(--app-hint)]">{t('timeline.loading')}</div>
            ) : entries.length === 0 ? (
                <div className="py-8 text-center text-sm text-[var(--app-hint)]">{t('timeline.empty')}</div>
            ) : (
                <div className="relative p-3 pl-8">
                    {/* Timeline line */}
                    <div className="absolute left-5 top-3 bottom-3 w-px bg-[var(--app-border)]" />
                    <div className="space-y-2">
                        {entries.map(entry => (
                            <div key={entry.id} className="relative flex gap-3">
                                {/* Timeline dot */}
                                <div className={`absolute -left-3 top-2 w-2.5 h-2.5 rounded-full border-2 border-[var(--app-bg)]`} style={{ background: TYPE_COLORS[entry.type].bg }} />
                                <div className="flex-1 min-w-0 rounded-md border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-3 py-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full" style={{ background: TYPE_COLORS[entry.type].bg, color: TYPE_COLORS[entry.type].text }}>
                                            {t(TYPE_LABEL_KEYS[entry.type])}
                                        </span>
                                        <span className="text-xs text-[var(--app-hint)]">{formatTime(entry.timestamp)}</span>
                                    </div>
                                    <EntryDetail entry={entry} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </SubPageLayout>
    )
}
