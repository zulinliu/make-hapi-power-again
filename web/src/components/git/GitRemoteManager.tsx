import { useState, useEffect, useCallback } from 'react'
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

    const inputClass = "rounded-(--hp-radius-sm) border border-(--hp-border) bg-(--hp-surface-0) px-3 py-1.5 text-sm text-(--hp-text-primary) focus:outline-none focus:ring-1 focus:ring-(--hp-primary)"

    return (
        <div className="space-y-3 p-3">
            {error && (
                <div className="rounded-(--hp-radius-sm) bg-(--hp-danger-subtle) px-3 py-2 text-sm text-(--hp-danger)">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="text-sm text-(--hp-text-tertiary)">{t('git.remote.loading')}</div>
            ) : remotes.length === 0 ? (
                <div className="text-sm text-(--hp-text-tertiary)">{t('git.remote.empty')}</div>
            ) : (
                <div className="space-y-2">
                    {remotes.map((remote) => (
                        <div
                            key={remote.name}
                            className="flex items-center justify-between rounded-(--hp-radius-md) border border-(--hp-border) bg-(--hp-surface-1) px-3 py-2 hover:bg-(--hp-surface-2)"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-(--hp-text-primary)">{remote.name}</div>
                                <div className="truncate text-xs font-mono text-(--hp-text-secondary)">
                                    {remote.url}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleRemove(remote.name)}
                                className="ml-2 shrink-0 rounded-(--hp-radius-sm) px-2 py-1 text-xs text-(--hp-danger) hover:opacity-80"
                            >
                                {t('git.remote.remove')}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="border-t border-(--hp-border) pt-3">
                <div className="mb-2 text-xs font-medium text-(--hp-text-tertiary)">{t('git.remote.addTitle')}</div>
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <input
                            value={newName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                            placeholder="origin"
                            className={`w-28 shrink-0 ${inputClass}`}
                        />
                        <input
                            value={newUrl}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUrl(e.target.value)}
                            placeholder="https://github.com/user/repo.git"
                            className={`min-w-0 flex-1 ${inputClass}`}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={!newName || !newUrl}
                        className="self-end px-3 py-1.5 text-xs rounded-(--hp-radius-sm) bg-(--hp-primary) text-(--hp-primary-text) hover:opacity-90 disabled:opacity-50"
                    >
                        {t('git.remote.add')}
                    </button>
                </div>
            </div>
        </div>
    )
}
