import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'

interface GitRemoteManagerProps {
    sessionId: string
}

interface RemoteEntry {
    name: string
    url: string
}

function parseRemotes(stdout: string): RemoteEntry[] {
    const lines = stdout.trim().split('\n').filter(Boolean)
    const map = new Map<string, RemoteEntry>()

    for (const line of lines) {
        const match = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)$/)
        if (match) {
            const [, name, url] = match
            map.set(name, { name, url })
        }
    }

    return Array.from(map.values())
}

export function GitRemoteManager({ sessionId, onRemotesLoaded }: { sessionId: string; onRemotesLoaded?: (remotes: RemoteEntry[]) => void }) {
    const { api } = useAppContext()
    const { t } = useTranslation()
    const [remotes, setRemotes] = useState<RemoteEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [newName, setNewName] = useState('')
    const [newUrl, setNewUrl] = useState('')
    const [error, setError] = useState('')

    const fetchRemotes = useCallback(async () => {
        setLoading(true)
        try {
            const result = await api.getGitRemotes(sessionId)
            if (result.success) {
                const parsed = parseRemotes(result.stdout ?? '')
                setRemotes(parsed)
                onRemotesLoaded?.(parsed)
            }
        } finally {
            setLoading(false)
        }
    }, [api, sessionId, onRemotesLoaded])

    useEffect(() => {
        fetchRemotes()
    }, [fetchRemotes])

    async function handleAdd() {
        if (!newName || !newUrl) return
        setError('')

        const result = await api.addGitRemote(sessionId, newName, newUrl)
        if (result.success) {
            setNewName('')
            setNewUrl('')
            fetchRemotes()
        } else {
            setError(result.error ?? 'Failed to add remote')
        }
    }

    async function handleRemove(name: string) {
        setError('')
        const result = await api.removeGitRemote(sessionId, name)
        if (result.success) {
            fetchRemotes()
        } else {
            setError(result.error ?? 'Failed to remove remote')
        }
    }

    const inputClass = "rounded-md border border-[var(--app-border)] bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-link)]"

    return (
        <div className="space-y-4 p-4">
            {error && (
                <div className="rounded-md bg-red-500/10 p-2 text-sm text-red-400">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="text-sm" style={{ color: 'var(--app-text-muted)' }}>{t('git.remote.loading')}</div>
            ) : remotes.length === 0 ? (
                <div className="text-sm" style={{ color: 'var(--app-text-muted)' }}>{t('git.remote.empty')}</div>
            ) : (
                <div className="space-y-2">
                    {remotes.map((remote) => (
                        <div
                            key={remote.name}
                            className="flex items-center justify-between rounded-md p-3"
                            style={{ background: 'var(--app-subtle-bg)' }}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="font-medium">{remote.name}</div>
                                <div className="truncate text-sm" style={{ color: 'var(--app-text-muted)' }}>
                                    {remote.url}
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemove(remote.name)}
                                className="ml-2 text-red-400 hover:text-red-300"
                            >
                                {t('git.remote.remove')}
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            <div className="border-t pt-4" style={{ borderColor: 'var(--app-border)' }}>
                <div className="mb-2 text-sm font-medium">{t('git.remote.addTitle')}</div>
                <div className="flex gap-2">
                    <input
                        value={newName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                        placeholder="origin"
                        className={`w-32 ${inputClass}`}
                    />
                    <input
                        value={newUrl}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUrl(e.target.value)}
                        placeholder="https://github.com/user/repo.git"
                        className={`flex-1 ${inputClass}`}
                    />
                    <Button
                        onClick={handleAdd}
                        disabled={!newName || !newUrl}
                        size="sm"
                    >
                        {t('git.remote.add')}
                    </Button>
                </div>
            </div>
        </div>
    )
}
