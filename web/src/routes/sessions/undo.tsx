import { useCallback, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { useSession } from '@/hooks/queries/useSession'
import { SubPageLayout } from '@/components/ui/SubPageLayout'

function UndoIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
    )
}

function EyeIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
        </svg>
    )
}

type UndoScope = 'session' | 'step' | 'file'

interface AffectedFile {
    filePath: string
    changeType: 'created' | 'modified' | 'deleted'
    canRevert: boolean
    reason?: string
}

const SCOPE_LABELS: Record<UndoScope, string> = {
    session: '整个会话',
    step: '到指定步骤',
    file: '指定文件',
}

export default function UndoPage() {
    const { sessionId } = useParams({ from: '/sessions/$sessionId/undo' })
    const { api } = useAppContext()
    const queryClient = useQueryClient()
    const [scope, setScope] = useState<UndoScope>('session')
    const [stepSeq, setStepSeq] = useState<number>(0)
    const [filePath, setFilePath] = useState('')
    const [showPreview, setShowPreview] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const { session } = useSession(api, sessionId)

    const { data: snapshotsData } = useQuery({
        queryKey: ['snapshots', sessionId],
        queryFn: () => api!.getSnapshots(sessionId),
        enabled: !!api,
    })

    const previewMutation = useMutation({
        mutationFn: () => {
            const opts = scope === 'step' ? { stepSeq } : scope === 'file' ? { filePath } : {}
            return api!.previewUndo(sessionId, scope, opts)
        },
        onSuccess: () => setShowPreview(true),
    })

    const executeMutation = useMutation({
        mutationFn: () => {
            const baseOpts = scope === 'step' ? { stepSeq } : scope === 'file' ? { filePath } : {}
            const opts = preview ? { ...baseOpts, expectedMaxSeq: preview.currentMaxSeq } : baseOpts
            return api!.executeUndo(sessionId, scope, opts)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['changes', sessionId] })
            queryClient.invalidateQueries({ queryKey: ['snapshots', sessionId] })
            setShowConfirm(false)
            setShowPreview(false)
        },
    })

    const preview = previewMutation.data?.preview
    const result = executeMutation.data?.result
    const snapshots = snapshotsData?.snapshots ?? []

    return (
        <SubPageLayout>
            {/* Scope selector */}
            <div className="py-3 space-y-2">
                <label className="block text-xs font-medium text-[var(--app-hint)] mb-2">撤销范围</label>
                <div className="flex gap-2">
                    {(['session', 'step', 'file'] as UndoScope[]).map(s => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => { setScope(s); setShowPreview(false); setShowConfirm(false) }}
                            className={`flex-1 px-3 py-2 text-xs rounded-md transition-colors text-center ${
                                scope === s
                                    ? 'bg-[var(--app-link)] text-white'
                                    : 'bg-[var(--app-secondary-bg)] text-[var(--app-hint)] hover:text-[var(--app-fg)]'
                            }`}
                        >
                            {SCOPE_LABELS[s]}
                        </button>
                    ))}
                </div>

                {scope === 'step' && (
                    <div className="mt-2">
                        <label className="block text-xs text-[var(--app-hint)] mb-1">回滚到步骤序号</label>
                        <input
                            type="number"
                            value={stepSeq}
                            onChange={e => setStepSeq(Number(e.target.value))}
                            min={0}
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-fg)]"
                        />
                    </div>
                )}

                {scope === 'file' && (
                    <div className="mt-2">
                        <label className="block text-xs text-[var(--app-hint)] mb-1">文件路径</label>
                        <input
                            type="text"
                            value={filePath}
                            onChange={e => setFilePath(e.target.value)}
                            placeholder="src/example.ts"
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-fg)]"
                        />
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => previewMutation.mutate()}
                    disabled={previewMutation.isPending || (scope === 'file' && !filePath)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md bg-[var(--app-secondary-bg)] text-[var(--app-fg)] hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                    <EyeIcon /> 预览影响
                </button>
            </div>

            {/* Preview / Result */}
            {showPreview && preview && (
                <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)]">
                    <div className="px-3 py-2 border-b border-[var(--app-border)]">
                        <span className="text-sm font-medium text-[var(--app-fg)]">影响预览</span>
                        <span className="ml-2 text-xs text-[var(--app-hint)]">{preview.affectedFiles.length} 个文件受影响</span>
                    </div>
                    <div className="divide-y divide-[var(--app-border)]">
                        {preview.affectedFiles.map(file => (
                            <div key={file.filePath} className="px-3 py-2 flex items-center gap-2">
                                <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${
                                    file.changeType === 'created' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                    file.changeType === 'modified' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                }`}>
                                    {{ created: '新建', modified: '修改', deleted: '删除' }[file.changeType]}
                                </span>
                                <span className="text-sm text-[var(--app-fg)] truncate flex-1">{file.filePath}</span>
                                {file.canRevert ? (
                                    <span className="text-xs text-green-600 dark:text-green-400">可恢复</span>
                                ) : (
                                    <span className="text-xs text-red-500">{file.reason || '不可恢复'}</span>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="px-3 py-2 border-t border-[var(--app-border)]">
                        <button
                            type="button"
                            onClick={() => setShowConfirm(true)}
                            disabled={preview.affectedFiles.length === 0}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                        >
                            <UndoIcon /> 确认撤销
                        </button>
                    </div>
                </div>
            )}

            {showConfirm && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 px-3 py-3">
                    <p className="text-sm text-red-700 dark:text-red-400 mb-2">确定要撤销这些变更吗？此操作将标记文件为待恢复。</p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => executeMutation.mutate()}
                            disabled={executeMutation.isPending}
                            className="flex-1 px-3 py-2 text-sm rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                        >
                            {executeMutation.isPending ? '撤销中...' : '确认执行'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowConfirm(false)}
                            className="px-3 py-2 text-sm rounded-md bg-[var(--app-secondary-bg)] text-[var(--app-fg)]"
                        >
                            取消
                        </button>
                    </div>
                </div>
            )}

            {result && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 px-3 py-3">
                    <p className="text-sm text-amber-700 dark:text-amber-400 font-medium mb-2">已标记为待恢复</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">文件已创建撤销快照记录。实际文件恢复需由代理执行。</p>
                    {result.revertedFiles.length > 0 && (
                        <div className="space-y-1">
                            {result.revertedFiles.map(f => (
                                <div key={f} className="text-xs text-green-600 dark:text-green-400">{f}</div>
                            ))}
                        </div>
                    )}
                    {result.skippedFiles.length > 0 && (
                        <div className="mt-2">
                            <span className="text-xs text-amber-600 dark:text-amber-400">跳过: {result.skippedFiles.join(', ')}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Recent snapshots */}
            {snapshots.length > 0 && (
                <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)]">
                    <div className="px-3 py-2 border-b border-[var(--app-border)]">
                        <span className="text-sm font-medium text-[var(--app-fg)]">快照历史</span>
                        <span className="ml-2 text-xs text-[var(--app-hint)]">{snapshots.length} 条记录</span>
                    </div>
                    <div className="divide-y divide-[var(--app-border)] max-h-64 overflow-y-auto app-scroll-y">
                        {snapshots.slice(0, 20).map(snap => (
                            <div key={snap.id} className="px-3 py-1.5 flex items-center gap-2">
                                <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${
                                    snap.snapshotType === 'checkpoint' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                    snap.snapshotType === 'undo' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                    'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                                }`}>
                                    {{ checkpoint: '检查点', undo: '撤销', auto: '自动', manual: '手动' }[snap.snapshotType as 'checkpoint' | 'undo' | 'auto' | 'manual'] ?? snap.snapshotType}
                                </span>
                                <span className="text-xs text-[var(--app-fg)] truncate flex-1">{snap.filePath}</span>
                                <span className="text-xs text-[var(--app-hint)] shrink-0">{new Date(snap.createdAt).toLocaleTimeString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </SubPageLayout>
    )
}
