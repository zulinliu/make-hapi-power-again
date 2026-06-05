import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'

interface GitFile {
    status: string
    path: string
}

interface GitCommitDialogProps {
    isOpen: boolean
    onClose: () => void
    sessionId: string
    files: GitFile[]
    onCommitComplete?: () => void
}

type CommitPhase = 'idle' | 'committing' | 'done' | 'error'

export function GitCommitDialog({
    isOpen,
    onClose,
    sessionId,
    files,
    onCommitComplete,
}: GitCommitDialogProps) {
    const { api } = useAppContext()
    const { t } = useTranslation()
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
    const [message, setMessage] = useState('')
    const [phase, setPhase] = useState<CommitPhase>('idle')
    const [error, setError] = useState('')

    useEffect(() => {
        if (isOpen) {
            setSelectedFiles(new Set(files.map(f => f.path)))
            setMessage('')
            setPhase('idle')
            setError('')
        }
    }, [isOpen, files])

    function toggleFile(path: string) {
        setSelectedFiles(prev => {
            const next = new Set(prev)
            if (next.has(path)) {
                next.delete(path)
            } else {
                next.add(path)
            }
            return next
        })
    }

    async function handleCommit() {
        if (selectedFiles.size === 0 || !message.trim()) return

        setPhase('committing')
        setError('')

        try {
            const res = await api.createGitCommit(
                sessionId,
                message.trim(),
                Array.from(selectedFiles)
            )
            if (res.success) {
                setPhase('done')
                onCommitComplete?.()
            } else {
                setPhase('error')
                setError(res.stderr || res.error || 'Commit failed')
            }
        } catch (err) {
            setPhase('error')
            setError(err instanceof Error ? err.message : 'Commit failed')
        }
    }

    function handleClose() {
        if (phase === 'committing') return
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('git.commit.title')}</DialogTitle>
                    <DialogDescription>
                        {t('git.commit.selectFiles')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 max-h-[60dvh] overflow-y-auto">
                    <div className="space-y-1">
                        {files.map((file) => (
                            <label
                                key={file.path}
                                className="flex items-center gap-2 text-sm py-1 px-2 rounded-[var(--hp-radius-sm)] cursor-pointer hover:bg-[var(--hp-surface-1)]"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedFiles.has(file.path)}
                                    onChange={() => toggleFile(file.path)}
                                    disabled={phase === 'committing'}
                                    className="rounded"
                                />
                                <span
                                    className="text-xs font-mono font-bold px-1.5 py-0.5 rounded-[var(--hp-radius-xs)]"
                                    style={{
                                        color: file.status === 'M' ? 'var(--hp-warning)' :
                                            file.status === 'A' ? 'var(--hp-success)' :
                                                file.status === 'D' ? 'var(--hp-danger)' :
                                                    file.status === '?' ? 'var(--hp-text-tertiary)' : 'var(--hp-primary)',
                                        background: file.status === 'M' ? 'var(--hp-warning-subtle)' :
                                            file.status === 'A' ? 'var(--hp-success-subtle)' :
                                                file.status === 'D' ? 'var(--hp-danger-subtle)' :
                                                    file.status === '?' ? 'var(--hp-surface-1)' : 'var(--hp-primary-subtle)',
                                    }}
                                >
                                    {file.status}
                                </span>
                                <span className="font-mono text-xs truncate text-[var(--hp-text-primary)]">
                                    {file.path}
                                </span>
                            </label>
                        ))}
                    </div>

                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={t('git.commit.messagePlaceholder')}
                        disabled={phase === 'committing'}
                        rows={3}
                        className="w-full rounded-[var(--hp-radius-sm)] border border-[var(--hp-border)] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hp-primary)] resize-none min-h-[80px]"
                    />

                    {phase === 'committing' && (
                        <div className="rounded-[var(--hp-radius-sm)] p-3 text-sm bg-[var(--hp-surface-1)]">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--hp-primary)] border-t-transparent" />
                                <span>{t('git.commit.committing')}</span>
                            </div>
                        </div>
                    )}

                    {phase === 'done' && (
                        <div className="rounded-[var(--hp-radius-sm)] bg-[var(--hp-success-subtle)] p-3 text-sm text-[var(--hp-success)]">
                            {t('git.commit.success')}
                        </div>
                    )}

                    {phase === 'error' && (
                        <div className="rounded-[var(--hp-radius-sm)] bg-[var(--hp-danger-subtle)] p-3 text-sm text-[var(--hp-danger)]">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={handleClose} disabled={phase === 'committing'}>
                            {phase === 'done' ? t('button.close') : t('button.cancel')}
                        </Button>
                        {phase === 'idle' && (
                            <Button
                                onClick={handleCommit}
                                disabled={selectedFiles.size === 0 || !message.trim()}
                            >
                                {t('git.commit')}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
