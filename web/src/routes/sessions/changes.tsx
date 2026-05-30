import { useCallback, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { useSession } from '@/hooks/queries/useSession'
import { DiffView } from '@/components/DiffView'

function BackIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
        </svg>
    )
}

function CheckIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}

function XIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    )
}

function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
            <polyline points="9 18 15 12 9 6" />
        </svg>
    )
}

interface FileChange {
    id: string
    filePath: string
    changeType: 'created' | 'modified' | 'deleted'
    beforeContent: string | null
    afterContent: string | null
    reviewStatus: 'pending' | 'approved' | 'rejected'
    reviewedAt: number | null
    timestamp: number
    messageId: string
}

interface ChangeGroup {
    id: string
    changes: FileChange[]
    summary: string
    agentDescription: string | null
    createdAt: number
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

function StatusBadge({ status }: { status: FileChange['reviewStatus'] }) {
    const config = {
        pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: '待审查' },
        approved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: '已批准' },
        rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: '已拒绝' },
    }[status]
    return (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${config.bg} ${config.text}`}>
            {config.label}
        </span>
    )
}

function ChangeTypeBadge({ type }: { type: FileChange['changeType'] }) {
    const config = {
        created: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: '新建' },
        modified: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: '修改' },
        deleted: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: '删除' },
    }[type]
    return (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${config.bg} ${config.text}`}>
            {config.label}
        </span>
    )
}

export default function ChangesPage() {
    const { sessionId } = useParams({ from: '/sessions/$sessionId/changes' })
    const { api } = useAppContext()
    const goBack = useAppGoBack()
    const queryClient = useQueryClient()
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())

    const { session } = useSession(api, sessionId)

    const { data: changeData, isLoading } = useQuery({
        queryKey: ['changes', sessionId, statusFilter],
        queryFn: () => api!.getChanges(sessionId, statusFilter === 'all' ? undefined : statusFilter),
        enabled: !!api,
    })

    const { data: contextData } = useQuery({
        queryKey: ['context', sessionId],
        queryFn: () => api!.getContext(sessionId),
        enabled: !!api,
    })

    const reviewMutation = useMutation({
        mutationFn: ({ changeId, action }: { changeId: string; action: 'approved' | 'rejected' }) =>
            api!.reviewChange(sessionId, changeId, action),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['changes', sessionId] })
        },
    })

    const bulkReviewMutation = useMutation({
        mutationFn: ({ changeIds, action }: { changeIds: string[]; action: 'approved' | 'rejected' }) =>
            api!.bulkReviewChanges(sessionId, changeIds, action),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['changes', sessionId] })
        },
    })

    const groups = (changeData as { success: boolean; groups?: ChangeGroup[] } | null)?.groups ?? []
    const truncated = (changeData as { truncated?: boolean } | null)?.truncated ?? false
    const context = (contextData as { success: boolean; context?: { usedTokens: number; contextWindow: number; messageCount: number; status: string; inputTokens: number; outputTokens: number } } | null)?.context

    const pendingCount = groups.reduce((sum, g) => sum + g.changes.filter(c => c.reviewStatus === 'pending').length, 0)

    const toggleGroup = useCallback((groupId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(groupId)) next.delete(groupId)
            else next.add(groupId)
            return next
        })
    }, [])

    const toggleFile = useCallback((changeId: string) => {
        setExpandedFiles(prev => {
            const next = new Set(prev)
            if (next.has(changeId)) next.delete(changeId)
            else next.add(changeId)
            return next
        })
    }, [])

    const handleBulkAction = useCallback((action: 'approved' | 'rejected') => {
        const pendingIds = groups.flatMap(g => g.changes.filter(c => c.reviewStatus === 'pending').map(c => c.id))
        if (pendingIds.length === 0) return
        bulkReviewMutation.mutate({ changeIds: pendingIds, action })
    }, [groups, bulkReviewMutation])

    return (
        <div className="flex h-full min-h-0 flex-col">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
                <button
                    type="button"
                    onClick={goBack}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"
                >
                    <BackIcon />
                </button>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-semibold text-sm truncate">变更审查</span>
                    {pendingCount > 0 && (
                        <span className="shrink-0 rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">
                            {pendingCount} 待审查
                        </span>
                    )}
                </div>
            </div>

            {/* Context bar */}
            {context && (
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--app-border)] bg-[var(--app-bg)] text-xs">
                    <span className="text-[var(--app-hint)]">上下文</span>
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--app-secondary-bg)] overflow-hidden max-w-[120px]">
                        <div
                            className="h-full rounded-full transition-all"
                            style={{
                                width: `${Math.min(100, (context.usedTokens / context.contextWindow) * 100)}%`,
                                background: context.status === 'critical' ? '#ef4444' : context.status === 'warning' ? '#f59e0b' : '#22c55e',
                            }}
                        />
                    </div>
                    <span className="text-[var(--app-hint)]">
                        {(context.usedTokens / 1000).toFixed(1)}K / {(context.contextWindow / 1000).toFixed(0)}K
                    </span>
                </div>
            )}

            {/* Filter + Bulk Actions */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--app-border)] bg-[var(--app-bg)]">
                <div className="flex gap-1">
                    {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map(s => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setStatusFilter(s)}
                            className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                statusFilter === s
                                    ? 'bg-[var(--app-link)] text-white'
                                    : 'bg-[var(--app-secondary-bg)] text-[var(--app-hint)] hover:text-[var(--app-fg)]'
                            }`}
                        >
                            {{ all: '全部', pending: '待审查', approved: '已批准', rejected: '已拒绝' }[s]}
                        </button>
                    ))}
                </div>
                <div className="flex-1" />
                {pendingCount > 0 && (
                    <div className="flex gap-1">
                        <button
                            type="button"
                            onClick={() => handleBulkAction('approved')}
                            disabled={bulkReviewMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                            <CheckIcon /> 全部批准
                        </button>
                        <button
                            type="button"
                            onClick={() => handleBulkAction('rejected')}
                            disabled={bulkReviewMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                        >
                            <XIcon /> 全部拒绝
                        </button>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto app-scroll-y">
                {truncated && (
                    <div className="mx-3 mt-2 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
                        消息较多，仅显示最近 200 条消息中的变更
                    </div>
                )}
                {isLoading ? (
                    <div className="py-8 text-center text-sm text-[var(--app-hint)]">加载中...</div>
                ) : groups.length === 0 ? (
                    <div className="py-8 text-center text-sm text-[var(--app-hint)]">暂无变更记录</div>
                ) : (
                    <div className="p-3 space-y-2">
                        {groups.filter(g => g.changes.length > 0).map(group => {
                            const isExpanded = expandedGroups.has(group.id)
                            return (
                                <div key={group.id} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)]">
                                    {/* Group header */}
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(group.id)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-left"
                                    >
                                        <ChevronIcon open={isExpanded} />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-[var(--app-fg)]">{group.summary}</div>
                                            {group.agentDescription && (
                                                <div className="text-xs text-[var(--app-hint)] truncate mt-0.5">{group.agentDescription}</div>
                                            )}
                                        </div>
                                        <span className="text-xs text-[var(--app-hint)]">{new Date(group.createdAt).toLocaleTimeString()}</span>
                                    </button>

                                    {/* Changes list */}
                                    {isExpanded && (
                                        <div className="border-t border-[var(--app-border)]">
                                            {group.changes.map(change => {
                                                const isFileExpanded = expandedFiles.has(change.id)
                                                return (
                                                    <div key={change.id} className="border-b border-[var(--app-border)] last:border-b-0">
                                                        <div className="flex items-center gap-2 px-3 py-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleFile(change.id)}
                                                                className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                                            >
                                                                <ChevronIcon open={isFileExpanded} />
                                                                <ChangeTypeBadge type={change.changeType} />
                                                                <span className="text-sm text-[var(--app-fg)] truncate">{change.filePath}</span>
                                                            </button>
                                                            <StatusBadge status={change.reviewStatus} />
                                                            {change.reviewStatus === 'pending' && (
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => reviewMutation.mutate({ changeId: change.id, action: 'approved' })}
                                                                        disabled={reviewMutation.isPending}
                                                                        className="flex items-center justify-center w-7 h-7 rounded-md bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50"
                                                                        title="批准"
                                                                    >
                                                                        <CheckIcon />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => reviewMutation.mutate({ changeId: change.id, action: 'rejected' })}
                                                                        disabled={reviewMutation.isPending}
                                                                        className="flex items-center justify-center w-7 h-7 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50"
                                                                        title="拒绝"
                                                                    >
                                                                        <XIcon />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Diff preview */}
                                                        {isFileExpanded && (
                                                            <div className="px-3 pb-2">
                                                                <DiffView
                                                                    oldString={change.beforeContent ?? ''}
                                                                    newString={change.afterContent ?? ''}
                                                                    filePath={change.filePath}
                                                                    variant="inline"
                                                                    size="compact"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
