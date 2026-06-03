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

interface GitPushDialogProps {
    isOpen: boolean
    onClose: () => void
    sessionId: string
    currentBranch?: string
    remotes: { name: string; url: string }[]
    onPushComplete?: () => void
}

type PushPhase = 'idle' | 'pushing' | 'done' | 'error'

export function GitPushDialog({
    isOpen,
    onClose,
    sessionId,
    currentBranch,
    remotes,
    onPushComplete,
}: GitPushDialogProps) {
    const { api } = useAppContext()
    const { t } = useTranslation()
    const [remote, setRemote] = useState('origin')
    const [branch, setBranch] = useState('')
    const [forcePush, setForcePush] = useState(false)
    const [upstream, setUpstream] = useState(true)
    const [confirmForce, setConfirmForce] = useState(false)
    const [phase, setPhase] = useState<PushPhase>('idle')
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

    async function handlePush() {
        if (forcePush && !confirmForce) return

        setPhase('pushing')
        setError('')
        setResult('')

        try {
            const args: Record<string, unknown> = {}
            if (remote) args.remote = remote
            if (branch) args.branch = branch
            if (forcePush) args.force = true
            if (upstream) args.setUpstream = true

            const res = await api.gitPush(sessionId, args)
            if (res.success) {
                setPhase('done')
                setResult(res.stdout || 'Push completed')
                onPushComplete?.()
            } else {
                setPhase('error')
                setError(res.stderr || res.error || 'Push failed')
            }
        } catch (err) {
            setPhase('error')
            setError(err instanceof Error ? err.message : 'Push failed')
        }
    }

    function handleClose() {
        if (phase === 'pushing') return
        setPhase('idle')
        setError('')
        setResult('')
        setForcePush(false)
        setConfirmForce(false)
        setUpstream(true)
        onClose()
    }

    const inputClass =
        'w-full rounded-md border border-[var(--app-border)] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-link)]'

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('git.push.title')}</DialogTitle>
                    <DialogDescription>
                        {t('git.push.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div>
                        <label className="text-sm font-medium" style={{ color: 'var(--app-text-muted)' }}>
                            {t('git.push.remote')}
                        </label>
                        <select
                            value={remote}
                            onChange={(e) => setRemote(e.target.value)}
                            disabled={phase === 'pushing'}
                            className={`mt-1 ${inputClass}`}
                        >
                            {remotes.length === 0 && (
                                <option value="">{t('git.push.noRemotes')}</option>
                            )}
                            {remotes.map((r) => (
                                <option key={r.name} value={r.name}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-medium" style={{ color: 'var(--app-text-muted)' }}>
                            {t('git.push.branch')}
                        </label>
                        <input
                            value={branch}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranch(e.target.value)}
                            placeholder={currentBranch || t('git.push.currentBranch')}
                            disabled={phase === 'pushing'}
                            className={`mt-1 ${inputClass}`}
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={upstream}
                                onChange={(e) => setUpstream(e.target.checked)}
                                disabled={phase === 'pushing'}
                                className="rounded"
                            />
                            <span style={{ color: 'var(--app-text-muted)' }}>{t('git.push.setUpstream')}</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={forcePush}
                                onChange={(e) => {
                                    setForcePush(e.target.checked)
                                    setConfirmForce(false)
                                }}
                                disabled={phase === 'pushing'}
                                className="rounded"
                            />
                            <span className="text-[var(--app-danger)]">{t('git.push.force')}</span>
                        </label>
                    </div>

                    {forcePush && (
                        <div className="rounded-md bg-red-500/10 p-3 text-sm">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={confirmForce}
                                    onChange={(e) => setConfirmForce(e.target.checked)}
                                    className="rounded"
                                />
                                <span className="text-red-400">
                                    {t('git.push.forceConfirm')}
                                </span>
                            </label>
                        </div>
                    )}

                    {phase === 'pushing' && (
                        <div className="rounded-md p-3 text-sm" style={{ background: 'var(--app-subtle-bg)' }}>
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--app-accent)] border-t-transparent" />
                                <span>{t('git.push.pushing')}</span>
                            </div>
                        </div>
                    )}

                    {phase === 'done' && (
                        <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">
                            {t('git.push.success')}
                            {result && <pre className="mt-1 text-xs opacity-70">{result}</pre>}
                        </div>
                    )}

                    {phase === 'error' && (
                        <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={handleClose} disabled={phase === 'pushing'}>
                            {phase === 'done' ? t('button.close') : t('button.cancel')}
                        </Button>
                        {phase === 'idle' && (
                            <Button
                                onClick={handlePush}
                                disabled={remotes.length === 0 || (forcePush && !confirmForce)}
                            >
                                {t('git.push')}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
