import { useState, useEffect, useCallback } from 'react'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'

interface CommitEntry {
  hash: string
  message: string
  refs: string
}

export function GitHistory({ sessionId }: { sessionId: string }) {
  const { api } = useAppContext()
  const { t } = useTranslation()
  const [commits, setCommits] = useState<CommitEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    if (!api) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.getGitLog(sessionId, 50)
      if (res.success && res.stdout) {
        setCommits(parseLog(res.stdout))
      } else {
        setError(res.error || t('git.history.failed'))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [api, sessionId, t])

  useEffect(() => { loadHistory() }, [loadHistory])

  if (loading && commits.length === 0) {
    return <div className="p-4 text-sm text-[var(--app-hint)]">{t('git.history.loading')}</div>
  }

  if (error) {
    return <div className="p-4 text-sm text-[var(--app-danger)]">{error}</div>
  }

  if (commits.length === 0) {
    return <div className="p-4 text-sm text-[var(--app-hint)]">{t('git.history.empty')}</div>
  }

  return (
    <div className="divide-y border-[var(--app-border)]">
      {commits.map((commit) => (
        <div key={commit.hash} className="flex items-start gap-3 px-4 py-2">
          <code className="text-xs font-mono shrink-0 mt-0.5 text-[var(--app-link)]">
            {commit.hash.slice(0, 7)}
          </code>
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate text-[var(--app-fg)]">{commit.message}</p>
          </div>
          {commit.refs && (
            <span className="text-xs px-1.5 py-0.5 rounded shrink-0 bg-[var(--app-subtle-bg)] text-[var(--app-text-secondary)]">
              {commit.refs}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function parseLog(raw: string): CommitEntry[] {
  if (!raw) return []
  return raw.split('\n').filter(Boolean).map((line) => {
    const match = line.match(/^(?:[\*|\/\\]\s+)?([a-f0-9]+)\s*(?:\(([^)]*)\))?\s*(.*)/)
    if (!match) return null
    return {
      hash: match[1],
      refs: match[2] || '',
      message: match[3] || '',
    }
  }).filter(Boolean) as CommitEntry[]
}
