import { useState } from 'react'
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

interface GitCloneDialogProps {
    isOpen: boolean
    onClose: () => void
    sessionId: string
    onCloneComplete?: () => void
}

type ClonePhase = 'idle' | 'cloning' | 'done' | 'error'

export function GitCloneDialog({ isOpen, onClose, sessionId, onCloneComplete }: GitCloneDialogProps) {
    const { api } = useAppContext()
    const { t } = useTranslation()
    const [url, setUrl] = useState('')
    const [targetDir, setTargetDir] = useState('')
    const [branch, setBranch] = useState('')
    const [phase, setPhase] = useState<ClonePhase>('idle')
    const [progress, setProgress] = useState('')
    const [error, setError] = useState('')

    const isValidUrl = url.startsWith('https://') || url.startsWith('ssh://') || url.startsWith('git@')

    async function handleClone() {
        if (!url || !isValidUrl) return

        setPhase('cloning')
        setProgress('Starting clone...')
        setError('')

        try {
            const result = await api.gitClone(sessionId, {
                url,
                targetDir: targetDir || undefined,
                branch: branch || undefined,
                cloneId: crypto.randomUUID()
            })

            if (result.success) {
                setPhase('done')
                setProgress(t('git.clone.success'))
                onCloneComplete?.()
            } else {
                setPhase('error')
                setError(result.error ?? result.stderr ?? 'Clone failed')
            }
        } catch (err) {
            setPhase('error')
            setError(err instanceof Error ? err.message : 'Clone failed')
        }
    }

    function handleClose() {
        if (phase === 'cloning') return
        setUrl('')
        setTargetDir('')
        setBranch('')
        setPhase('idle')
        setProgress('')
        setError('')
        onClose()
    }

    const inputClass = "w-full rounded-md border border-[var(--app-border)] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-link)]"

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('git.clone.title')}</DialogTitle>
                    <DialogDescription>
                        {t('git.clone.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div>
                        <label className="text-sm font-medium" style={{ color: 'var(--app-text-muted)' }}>
                            {t('git.clone.url')}
                        </label>
                        <input
                            value={url}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                            placeholder="https://github.com/user/repo.git"
                            disabled={phase === 'cloning'}
                            className={`mt-1 ${inputClass}`}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium" style={{ color: 'var(--app-text-muted)' }}>
                            {t('git.clone.targetDir')}
                        </label>
                        <input
                            value={targetDir}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetDir(e.target.value)}
                            placeholder={t('git.clone.targetDirHint')}
                            disabled={phase === 'cloning'}
                            className={`mt-1 ${inputClass}`}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium" style={{ color: 'var(--app-text-muted)' }}>
                            {t('git.clone.branch')}
                        </label>
                        <input
                            value={branch}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranch(e.target.value)}
                            placeholder={t('git.clone.branchHint')}
                            disabled={phase === 'cloning'}
                            className={`mt-1 ${inputClass}`}
                        />
                    </div>

                    {phase === 'cloning' && (
                        <div className="rounded-md p-3 text-sm" style={{ background: 'var(--app-subtle-bg)' }}>
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--app-accent)] border-t-transparent" />
                                <span>{progress}</span>
                            </div>
                        </div>
                    )}

                    {phase === 'done' && (
                        <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">
                            {t('git.clone.success')}
                        </div>
                    )}

                    {phase === 'error' && (
                        <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={handleClose} disabled={phase === 'cloning'}>
                            {phase === 'done' ? t('button.close') : t('button.cancel')}
                        </Button>
                        {phase === 'idle' && (
                            <Button
                                onClick={handleClone}
                                disabled={!url || !isValidUrl}
                            >
                                {t('git.clone')}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
