import { useCallback, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { useSession } from '@/hooks/queries/useSession'
import { SubPageLayout } from '@/components/ui/SubPageLayout'

type TimelineEntryType = 'tool_use' | 'file_change' | 'message' | 'summary' | 'checkpoint' | 'error'
type FilterType = 'all' | TimelineEntryType

const TYPE_LABELS: Record<TimelineEntryType, string> = {
    tool_use: '工具调用',
    file_change: '文件变更',
    message: '消息',
    summary: '摘要',
    checkpoint: '检查点',
    error: '错误',
}

const TYPE_COLORS: Record<TimelineEntryType, string> = {
    tool_use: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    file_change: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    message: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400',
    summary: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    checkpoint: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

interface TimelineEntry {
    id: string
    type: TimelineEntryType
    timestamp: number
    seq: number
    data: Record<string, unknown>
}

function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
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
    const d = entry.data
    switch (entry.type) {
        case 'message': {
            const role = d.role === 'assistant' ? '助手' : '用户'
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
                    <span className="text-xs font-medium text-[var(--app-hint)]">{isAuto ? '自动摘要' : '手动摘要'}</span>
                    <p className="text-sm text-[var(--app-fg)] mt-0.5 line-clamp-4">{text}</p>
                </div>
            )
        }
        case 'checkpoint': {
            const inputTokens = typeof d.inputTokens === 'number' ? d.inputTokens : 0
            const outputTokens = typeof d.outputTokens === 'number' ? d.outputTokens : 0
            return (
                <div className="text-xs text-[var(--app-hint)]">
                    输入 {(inputTokens / 1000).toFixed(1)}K / 输出 {(outputTokens / 1000).toFixed(1)}K tokens
                </div>
            )
        }
        case 'error': {
            const output = typeof d.output === 'string' ? d.output : ''
            return <p className="text-xs text-red-600 dark:text-red-400 line-clamp-2">{output || '错误'}</p>
        }
        default:
            return null
    }
}

export default function TimelinePage() {
    const { sessionId } = useParams({ from: '/sessions/$sessionId/timeline' })
    const { api } = useAppContext()
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
                { id: 'all', label: '全部' },
                { id: 'message', label: '消息' },
                { id: 'tool_use', label: '工具调用' },
                { id: 'file_change', label: '文件变更' },
                { id: 'summary', label: '摘要' },
                { id: 'checkpoint', label: '检查点' },
                { id: 'error', label: '错误' },
            ]}
            activeTab={filter}
            onTabChange={(id) => setFilter(id as FilterType)}
            toolbar={
                <div className="flex items-center justify-end">
                    <button
                        type="button"
                        onClick={() => checkpointMutation.mutate(undefined)}
                        disabled={checkpointMutation.isPending}
                        className="px-2 py-1 text-xs rounded-md bg-[var(--app-link)] text-white hover:opacity-90 disabled:opacity-50"
                    >
                        创建检查点
                    </button>
                </div>
            }
        >
            {truncated && (
                <div className="mx-3 mt-2 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
                    消息较多，仅显示最近 200 条消息
                </div>
            )}
            {isLoading ? (
                <div className="py-8 text-center text-sm text-[var(--app-hint)]">加载中...</div>
            ) : entries.length === 0 ? (
                <div className="py-8 text-center text-sm text-[var(--app-hint)]">暂无时间线记录</div>
            ) : (
                <div className="relative p-3 pl-8">
                    {/* Timeline line */}
                    <div className="absolute left-5 top-3 bottom-3 w-px bg-[var(--app-border)]" />
                    <div className="space-y-2">
                        {entries.map(entry => (
                            <div key={entry.id} className="relative flex gap-3">
                                {/* Timeline dot */}
                                <div className={`absolute -left-3 top-2 w-2.5 h-2.5 rounded-full border-2 border-[var(--app-bg)] ${TYPE_COLORS[entry.type].split(' ')[0]}`} />
                                <div className="flex-1 min-w-0 rounded-md border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-3 py-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${TYPE_COLORS[entry.type]}`}>
                                            {TYPE_LABELS[entry.type]}
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
