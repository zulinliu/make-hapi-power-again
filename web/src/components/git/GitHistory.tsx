import { useState, useEffect, useCallback } from 'react'
import { useAppContext } from '@/lib/app-context'

interface CommitEntry {
  hash: string
  message: string
  refs: string
  author: string
  date: string
}

export function GitHistory({ cwd }: { cwd: string }) {
  const { api } = useAppContext()
  const [commits, setCommits] = useState<CommitEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    if (!api) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.gitLog?.({ cwd, maxCount: 50 })
      if (res && res.success) {
        setCommits(parseLog(res.stdout))
      } else {
        setError(res?.stderr || 'Failed to load history')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [api, cwd])

  useEffect(() => { loadHistory() }, [loadHistory])

  if (loading && commits.length === 0) {
    return <div className="p-4 text-sm" style={{ color: 'var(--hp-text-tertiary)' }}>Loading history...</div>
  }

  if (error) {
    return <div className="p-4 text-sm" style={{ color: 'var(--hp-danger)' }}>{error}</div>
  }

  return (
    <div className="divide-y" style={{ borderColor: 'var(--hp-divider)' }}>
      {commits.map((commit) => (
        <div key={commit.hash} className="flex items-start gap-3 px-4 py-2 hover:opacity-80 cursor-pointer"
          style={{ background: 'transparent' }}>
          <code className="text-xs font-mono shrink-0 mt-0.5" style={{ color: 'var(--hp-primary)' }}>
            {commit.hash.slice(0, 7)}
          </code>
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate" style={{ color: 'var(--hp-text-primary)' }}>{commit.message}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--hp-text-tertiary)' }}>
              {commit.author} · {commit.date}
            </p>
          </div>
          {commit.refs && (
            <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--hp-surface-2)', color: 'var(--hp-text-secondary)' }}>
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
    // Format: * abc1234 (HEAD -> main) commit message
    const match = line.match(/^(\*|\||\/|\\)\s+([a-f0-9]+)\s*(?:\(([^)]*)\))?\s*(.*)/)
    if (!match) return null
    return {
      hash: match[2],
      refs: match[3] || '',
      message: match[4] || '',
      author: '',
      date: '',
    }
  }).filter(Boolean) as CommitEntry[]
}
