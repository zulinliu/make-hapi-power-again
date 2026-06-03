import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { useSession } from '@/hooks/queries/useSession'
import { useTranslation } from '@/lib/use-translation'
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

const SCOPE_LABEL_KEYS: Record<UndoScope, string> = {
    session: 'undo.scope.session',
    step: 'undo.scope.step',
    file: 'undo.scope.file',
}

export default function UndoPage() {
    const { sessionId } = useParams({ from: '/sessions/$sessionId/undo' })
    const { api } = useAppContext()
    const { t } = useTranslation()
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
                <label className="block text-xs font-medium text-[var(--app-hint)] mb-2">{t('undo.scopeLabel')}</label>
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
                            {t(SCOPE_LABEL_KEYS[s])}
                        </button>
                    ))}
                </div>

                {scope === 'step' && (
                    <div className="mt-2">
                        <label className="block text-xs text-[var(--app-hint)] mb-1">{t('undo.stepSeqLabel')}</label>
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
                        <label className="block text-xs text-[var(--app-hint)] mb-1">{t('undo.filePathLabel')}</label>
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
                    <EyeIcon /> {t('undo.previewImpact')}
                </button>
            </div>

            {/* Preview / Result */}
            {showPreview && preview && (
                <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)]">
                    <div className="px-3 py-2 border-b border-[var(--app-border)]">
                        <span className="text-sm font-medium text-[var(--app-fg)]">{t('undo.impactPreview')}</span>
                        <span className="ml-2 text-xs text-[var(--app-hint)]">{t('undo.affectedFilesCount', { n: preview.affectedFiles.length })}</span>
                    </div>
                    <div className="divide-y divide-[var(--app-border)]">
                        {preview.affectedFiles.map(file => (
                            <div key={file.filePath} className="px-3 py-2 flex items-center gap-2">
                                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full" style={{
                                    background: file.changeType === 'created' ? 'var(--app-primary-subtle)' : file.changeType === 'modified' ? 'var(--app-warning-subtle)' : 'var(--app-badge-error-bg)',
                                    color: file.changeType === 'created' ? 'var(--app-link)' : file.changeType === 'modified' ? 'var(--app-warning)' : 'var(--app-danger)',
                                }}>
                                    {t(file.changeType === 'created' ? 'undo.type.created' : file.changeType === 'modified' ? 'undo.type.modified' : 'undo.type.deleted')}
                                </span>
                                <span className="text-sm text-[var(--app-fg)] truncate flex-1">{file.filePath}</span>
                                {file.canRevert ? (
                                    <span className="text-xs text-[var(--app-success)]">{t('undo.revertible')}</span>
                                ) : (
                                    <span className="text-xs text-[var(--app-danger)]">{file.reason || t('undo.irreversible')}</span>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="px-3 py-2 border-t border-[var(--app-border)]">
                        <button
                            type="button"
                            onClick={() => setShowConfirm(true)}
                            disabled={preview.affectedFiles.length === 0}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md bg-[var(--app-danger)] text-white hover:opacity-90 disabled:opacity-50 transition-colors"
                        >
                            <UndoIcon /> {t('undo.confirmUndo')}
                        </button>
                    </div>
                </div>
            )}

            {showConfirm && (
                <div className="rounded-lg border border-[var(--app-danger)] bg-[var(--app-badge-error-bg)] px-3 py-3">
                    <p className="text-sm text-[var(--app-danger)] mb-2">{t('undo.confirmMessage')}</p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => executeMutation.mutate()}
                            disabled={executeMutation.isPending}
                            className="flex-1 px-3 py-2 text-sm rounded-md bg-[var(--app-danger)] text-white hover:opacity-90 disabled:opacity-50"
                        >
                            {executeMutation.isPending ? t('undo.undoing') : t('undo.confirmExecute')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowConfirm(false)}
                            className="px-3 py-2 text-sm rounded-md bg-[var(--app-secondary-bg)] text-[var(--app-fg)]"
                        >
                            {t('button.cancel')}
                        </button>
                    </div>
                </div>
            )}

            {result && (
                <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-warning-subtle)] px-3 py-3">
                    <p className="text-sm text-[var(--app-warning)] font-medium mb-2">{t('undo.markedPending')}</p>
                    <p className="text-xs text-[var(--app-warning)] mb-2">{t('undo.snapshotNote')}</p>
                    {result.revertedFiles.length > 0 && (
                        <div className="space-y-1">
                            {result.revertedFiles.map(f => (
                                <div key={f} className="text-xs text-[var(--app-success)]">{f}</div>
                            ))}
                        </div>
                    )}
                    {result.skippedFiles.length > 0 && (
                        <div className="mt-2">
                            <span className="text-xs text-[var(--app-warning)]">{t('undo.skipped')}: {result.skippedFiles.join(', ')}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Recent snapshots */}
            {snapshots.length > 0 && (
                <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)]">
                    <div className="px-3 py-2 border-b border-[var(--app-border)]">
                        <span className="text-sm font-medium text-[var(--app-fg)]">{t('undo.snapshotHistory')}</span>
                        <span className="ml-2 text-xs text-[var(--app-hint)]">{t('undo.recordCount', { n: snapshots.length })}</span>
                    </div>
                    <div className="divide-y divide-[var(--app-border)] max-h-64 overflow-y-auto app-scroll-y">
                        {snapshots.slice(0, 20).map(snap => (
                            <div key={snap.id} className="px-3 py-1.5 flex items-center gap-2">
                                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full" style={{
                                    background: snap.snapshotType === 'checkpoint' ? 'var(--app-warning-subtle)' : snap.snapshotType === 'undo' ? 'var(--app-badge-error-bg)' : 'var(--app-subtle-bg)',
                                    color: snap.snapshotType === 'checkpoint' ? 'var(--app-warning)' : snap.snapshotType === 'undo' ? 'var(--app-danger)' : 'var(--app-hint)',
                                }}>
                                    {t(snap.snapshotType === 'checkpoint' ? 'undo.snapshotType.checkpoint' : snap.snapshotType === 'undo' ? 'undo.snapshotType.undo' : snap.snapshotType === 'auto' ? 'undo.snapshotType.auto' : 'undo.snapshotType.manual') ?? snap.snapshotType}
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
