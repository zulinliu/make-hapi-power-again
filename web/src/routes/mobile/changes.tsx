import { useCallback, useRef, useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'

interface FileChange {
    id: string
    filePath: string
    changeType: 'created' | 'modified' | 'deleted'
    beforeContent: string | null
    afterContent: string | null
    reviewStatus: 'pending' | 'approved' | 'rejected'
}

interface ChangeGroup {
    id: string
    changes: FileChange[]
    summary: string
    agentDescription: string | null
    createdAt: number
}

export default function MobileChangesPage() {
    const { sessionId } = useParams({ strict: false }) as { sessionId: string }
    const { api } = useAppContext()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [currentIndex, setCurrentIndex] = useState(0)
    const [swipeOffset, setSwipeOffset] = useState(0)
    const touchStartX = useRef(0)
    const touchStartY = useRef(0)
    const containerRef = useRef<HTMLDivElement>(null)

    const { data: changeData, isLoading } = useQuery({
        queryKey: ['changes', sessionId, 'pending'],
        queryFn: () => api!.getChanges(sessionId, 'pending'),
        enabled: !!api,
    })

    const reviewMutation = useMutation({
        mutationFn: ({ changeId, action }: { changeId: string; action: 'approved' | 'rejected' }) =>
            api!.reviewChange(sessionId, changeId, action),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['changes', sessionId] })
        },
    })

    const groups = (changeData as { groups?: ChangeGroup[] } | null)?.groups ?? []
    const allPending = groups.flatMap(g => g.changes.filter(c => c.reviewStatus === 'pending'))

    const currentChange = allPending[currentIndex] ?? null
    const currentGroup = currentChange
        ? groups.find(g => g.changes.some(c => c.id === currentChange.id))
        : null

    const handleAction = useCallback((action: 'approved' | 'rejected') => {
        if (!currentChange) return
        reviewMutation.mutate(
            { changeId: currentChange.id, action },
            {
                onSuccess: () => {
                    if (currentIndex < allPending.length - 1) {
                        setCurrentIndex(currentIndex + 1)
                    }
                },
            },
        )
    }, [currentChange, currentIndex, allPending.length, reviewMutation])

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX
        touchStartY.current = e.touches[0].clientY
        setSwipeOffset(0)
    }, [])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        const dx = e.touches[0].clientX - touchStartX.current
        const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
        if (dy > Math.abs(dx) * 1.5) return
        setSwipeOffset(dx)
    }, [])

    const handleTouchEnd = useCallback(() => {
        const threshold = 80
        if (swipeOffset > threshold) {
            handleAction('approved')
        } else if (swipeOffset < -threshold) {
            handleAction('rejected')
        }
        setSwipeOffset(0)
    }, [swipeOffset, handleAction])

    const getSwipeColor = () => {
        if (swipeOffset > 40) return 'bg-green-500/20'
        if (swipeOffset < -40) return 'bg-red-500/20'
        return 'bg-transparent'
    }

    const getSwipeIcon = () => {
        if (swipeOffset > 60) return { icon: '✓', color: 'text-green-500', label: '批准' }
        if (swipeOffset < -60) return { icon: '✗', color: 'text-red-500', label: '拒绝' }
        return null
    }

    const swipeHint = getSwipeIcon()

    return (
        <div className="flex flex-col h-[100dvh] bg-[var(--app-bg)]">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--app-border)] pt-[calc(0.75rem+env(safe-area-inset-top))]">
                <button
                    type="button"
                    onClick={() => navigate({ to: '/sessions' })}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)]"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">变更审查</div>
                    <div className="text-xs text-[var(--app-hint)]">
                        {allPending.length > 0 ? `${currentIndex + 1} / ${allPending.length}` : '无待审查'}
                    </div>
                </div>
            </div>

            {/* Card area with swipe */}
            <div
                ref={containerRef}
                className="flex-1 min-h-0 overflow-y-auto app-scroll-y p-4"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {isLoading ? (
                    <div className="py-12 text-center text-sm text-[var(--app-hint)]">加载中...</div>
                ) : !currentChange ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-2xl text-green-600">
                            {'✓'}
                        </div>
                        <div>
                            <div className="font-semibold text-[var(--app-fg)]">全部审查完成</div>
                            <div className="text-sm text-[var(--app-hint)] mt-1">所有变更已处理</div>
                        </div>
                    </div>
                ) : (
                    <div
                        className="rounded-xl border border-[var(--app-border)] bg-[var(--app-secondary-bg)] overflow-hidden transition-transform"
                        style={{ transform: `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.05}deg)` }}
                    >
                        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${getSwipeColor()} transition-colors rounded-xl`} />
                        {swipeHint && (
                            <div className={`absolute top-4 ${swipeOffset > 0 ? 'left-4' : 'right-4'} text-4xl font-bold ${swipeHint.color} pointer-events-none`}>
                                {swipeHint.icon}
                            </div>
                        )}

                        {/* Group info */}
                        {currentGroup && (
                            <div className="px-4 py-2 border-b border-[var(--app-border)] bg-[var(--app-bg)]">
                                <div className="text-xs text-[var(--app-hint)]">{currentGroup.summary}</div>
                            </div>
                        )}

                        {/* File info */}
                        <div className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    currentChange.changeType === 'created' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                    currentChange.changeType === 'modified' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                }`}>
                                    {{ created: '新建', modified: '修改', deleted: '删除' }[currentChange.changeType]}
                                </span>
                                <span className="text-sm font-medium text-[var(--app-fg)] truncate">{currentChange.filePath}</span>
                            </div>

                            {/* Diff preview */}
                            {currentChange.changeType !== 'deleted' && currentChange.afterContent && (
                                <div className="mt-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] overflow-hidden">
                                    <pre className="text-xs text-[var(--app-fg)] p-3 overflow-x-auto max-h-[40dvh] whitespace-pre-wrap break-all">
                                        {currentChange.afterContent.length > 2000
                                            ? currentChange.afterContent.slice(0, 2000) + '\n... (已截断)'
                                            : currentChange.afterContent}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom action bar */}
            {currentChange && (
                <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--app-border)] bg-[var(--app-bg)] pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                    <button
                        type="button"
                        onClick={() => handleAction('rejected')}
                        disabled={reviewMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 text-white font-medium text-sm active:bg-red-600 disabled:opacity-50"
                    >
                        {'✗'} 拒绝
                    </button>
                    <button
                        type="button"
                        onClick={() => handleAction('approved')}
                        disabled={reviewMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-medium text-sm active:bg-green-700 disabled:opacity-50"
                    >
                        {'✓'} 批准
                    </button>
                </div>
            )}

            {/* Swipe hint (only for first card) */}
            {currentChange && currentIndex === 0 && (
                <div className="text-center text-xs text-[var(--app-hint)] pb-2">
                    左滑拒绝，右滑批准
                </div>
            )}
        </div>
    )
}
