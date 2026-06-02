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
    const [sign, setSign] = useState(false)
    const [phase, setPhase] = useState<CommitPhase>('idle')
    const [error, setError] = useState('')

    useEffect(() => {
        if (isOpen) {
            setSelectedFiles(new Set(files.map(f => f.path)))
            setMessage('')
            setSign(false)
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
                                className="flex items-center gap-2 text-sm py-1 px-2 rounded cursor-pointer hover:bg-[var(--hp-surface-1)]"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedFiles.has(file.path)}
                                    onChange={() => toggleFile(file.path)}
                                    disabled={phase === 'committing'}
                                    className="rounded"
                                />
                                <span
                                    className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                                    style={{
                                        color: file.status === 'M' ? 'var(--hp-warning)' :
                                            file.status === 'A' ? 'var(--hp-success)' :
                                                file.status === 'D' ? 'var(--hp-danger)' :
                                                    file.status === '?' ? 'var(--hp-text-tertiary)' : 'var(--hp-primary)',
                                        background: file.status === 'M' ? 'var(--hp-warning-subtle)' :
                                            file.status === 'A' ? 'var(--hp-success-subtle)' :
                                                file.status === 'D' ? 'var(--hp-danger-subtle)' :
                                                    file.status === '?' ? 'var(--hp-surface-2)' : 'var(--hp-primary-subtle)',
                                    }}
                                >
                                    {file.status}
                                </span>
                                <span className="font-mono text-xs truncate" style={{ color: 'var(--hp-text-primary)' }}>
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
                        className="w-full rounded-md border border-[var(--app-border)] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] resize-none"
                    />

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={sign}
                                onChange={(e) => setSign(e.target.checked)}
                                disabled={phase === 'committing'}
                                className="rounded"
                            />
                            <span style={{ color: 'var(--app-text-muted)' }}>{t('git.commit.sign')}</span>
                        </label>
                    </div>

                    {phase === 'committing' && (
                        <div className="rounded-md p-3 text-sm" style={{ background: 'var(--app-subtle-bg)' }}>
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--app-accent)] border-t-transparent" />
                                <span>{t('git.commit.committing')}</span>
                            </div>
                        </div>
                    )}

                    {phase === 'done' && (
                        <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">
                            {t('git.commit.success')}
                        </div>
                    )}

                    {phase === 'error' && (
                        <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">
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
