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

    const inputClass = "w-full rounded-(--hp-radius-sm) border border-(--hp-border) bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-(--hp-primary)"

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
                        <label className="text-sm font-medium text-(--hp-text-secondary)">
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
                        <label className="text-sm font-medium text-(--hp-text-secondary)">
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
                        <label className="text-sm font-medium text-(--hp-text-secondary)">
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
                        <div className="rounded-(--hp-radius-sm) p-3 text-sm bg-(--hp-surface-1)">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-(--hp-primary) border-t-transparent" />
                                <span>{progress}</span>
                            </div>
                        </div>
                    )}

                    {phase === 'done' && (
                        <div className="rounded-(--hp-radius-sm) bg-(--hp-success-subtle) p-3 text-sm text-(--hp-success)">
                            {t('git.clone.success')}
                        </div>
                    )}

                    {phase === 'error' && (
                        <div className="rounded-(--hp-radius-sm) bg-(--hp-danger-subtle) p-3 text-sm text-(--hp-danger)">
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
