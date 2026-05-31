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
        'w-full rounded-md border border-[var(--app-border)] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-link)]'

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Pull from Remote</DialogTitle>
                    <DialogDescription>
                        Fetch and merge changes from a remote repository
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div>
                        <label className="text-sm font-medium" style={{ color: 'var(--app-text-muted)' }}>
                            Remote
                        </label>
                        <select
                            value={remote}
                            onChange={(e) => setRemote(e.target.value)}
                            disabled={phase === 'pulling'}
                            className={`mt-1 ${inputClass}`}
                        >
                            {remotes.length === 0 && (
                                <option value="">No remotes configured</option>
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
                            Branch
                        </label>
                        <input
                            value={branch}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranch(e.target.value)}
                            placeholder={currentBranch || 'current branch'}
                            disabled={phase === 'pulling'}
                            className={`mt-1 ${inputClass}`}
                        />
                    </div>

                    {phase === 'pulling' && (
                        <div className="rounded-md p-3 text-sm" style={{ background: 'var(--app-subtle-bg)' }}>
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--app-accent)] border-t-transparent" />
                                <span>Pulling...</span>
                            </div>
                        </div>
                    )}

                    {phase === 'done' && (
                        <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-400">
                            Pull completed successfully
                            {result && <pre className="mt-1 text-xs opacity-70">{result}</pre>}
                        </div>
                    )}

                    {phase === 'error' && (
                        <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={handleClose} disabled={phase === 'pulling'}>
                            {phase === 'done' ? 'Close' : 'Cancel'}
                        </Button>
                        {phase === 'idle' && (
                            <Button
                                onClick={handlePull}
                                disabled={remotes.length === 0}
                            >
                                Pull
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
