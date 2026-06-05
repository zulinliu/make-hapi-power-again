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

interface GitPullDialogProps {
    isOpen: boolean
    onClose: () => void
    sessionId: string
    currentBranch?: string
    remotes: { name: string; url: string }[]
    onPullComplete?: () => void
}

type PullPhase = 'idle' | 'pulling' | 'done' | 'error'

export function GitPullDialog({
    isOpen,
    onClose,
    sessionId,
    currentBranch,
    remotes,
    onPullComplete,
}: GitPullDialogProps) {
    const { api } = useAppContext()
    const { t } = useTranslation()
    const [remote, setRemote] = useState('origin')
    const [branch, setBranch] = useState('')
    const [phase, setPhase] = useState<PullPhase>('idle')
    const [error, setError] = useState('')
    const [result, setResult] = useState('')

    useEffect(() => {
        if (isOpen) {
            setBranch(currentBranch || '')
            if (remotes.length > 0 && !remotes.find(r => r.name === remote)) {
                setRemote(remotes[0].name)
            }
        }
    }, [isOpen, currentBranch, remotes])

    async function handlePull() {
        setPhase('pulling')
        setError('')
        setResult('')

        try {
            const args: Record<string, unknown> = {}
            if (remote) args.remote = remote
            if (branch) args.branch = branch

            const res = await api.gitPull(sessionId, args)
            if (res.success) {
                setPhase('done')
                setResult(res.stdout || 'Pull completed')
                onPullComplete?.()
            } else {
                setPhase('error')
                setError(res.stderr || res.error || 'Pull failed')
            }
        } catch (err) {
            setPhase('error')
            setError(err instanceof Error ? err.message : 'Pull failed')
        }
    }

    function handleClose() {
        if (phase === 'pulling') return
        setPhase('idle')
        setError('')
        setResult('')
        onClose()
    }

    const inputClass =
        'w-full rounded-[var(--hp-radius-sm)] border border-[var(--hp-border)] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--hp-primary)]'

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('git.pull.title')}</DialogTitle>
                    <DialogDescription>
                        {t('git.pull.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div>
                        <label className="text-sm font-medium text-[var(--hp-text-secondary)]">
                            {t('git.pull.remote')}
                        </label>
                        <select
                            value={remote}
                            onChange={(e) => setRemote(e.target.value)}
                            disabled={phase === 'pulling'}
                            className={`mt-1 ${inputClass}`}
                        >
                            {remotes.length === 0 && (
                                <option value="">{t('git.pull.noRemotes')}</option>
                            )}
                            {remotes.map((r) => (
                                <option key={r.name} value={r.name}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-[var(--hp-text-secondary)]">
                            {t('git.pull.branch')}
                        </label>
                        <input
                            value={branch}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranch(e.target.value)}
                            placeholder={currentBranch || t('git.pull.branch')}
                            disabled={phase === 'pulling'}
                            className={`mt-1 ${inputClass}`}
                        />
                    </div>

                    {phase === 'pulling' && (
                        <div className="rounded-[var(--hp-radius-sm)] p-3 text-sm bg-[var(--hp-surface-1)]">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--hp-primary)] border-t-transparent" />
                                <span>{t('git.pull.pulling')}</span>
                            </div>
                        </div>
                    )}

                    {phase === 'done' && (
                        <div className="rounded-[var(--hp-radius-sm)] bg-[var(--hp-success-subtle)] p-3 text-sm text-[var(--hp-success)]">
                            {t('git.pull.success')}
                            {result && <pre className="mt-1 text-xs opacity-70">{result}</pre>}
                        </div>
                    )}

                    {phase === 'error' && (
                        <div className="rounded-[var(--hp-radius-sm)] bg-[var(--hp-danger-subtle)] p-3 text-sm text-[var(--hp-danger)]">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={handleClose} disabled={phase === 'pulling'}>
                            {phase === 'done' ? t('button.close') : t('button.cancel')}
                        </Button>
                        {phase === 'idle' && (
                            <Button
                                onClick={handlePull}
                                disabled={remotes.length === 0}
                            >
                                {t('git.pull')}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
