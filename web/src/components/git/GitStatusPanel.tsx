import { useState, useEffect, useCallback } from 'react'
import { useAppContext } from '@/lib/app-context'

interface GitFile {
  status: string
  path: string
}

interface StatusData {
  branch: string
  ahead: number
  behind: number
  files: GitFile[]
}

export function GitStatusPanel({ sessionId }: { sessionId: string }) {
  const { api } = useAppContext()
  const [status, setStatus] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!api) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.getGitStatus(sessionId)
      if (res.success && res.stdout) {
        setStatus(parseGitStatus(res.stdout))
      } else {
        setError(res.error || 'Git status failed')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [api, sessionId])

  useEffect(() => { refresh() }, [refresh])

  if (loading && !status) {
    return <div className="p-4 text-sm" style={{ color: 'var(--hp-text-tertiary)' }}>Loading...</div>
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm" style={{ color: 'var(--hp-danger)' }}>{error}</p>
        <button onClick={refresh} className="text-xs mt-2 underline" style={{ color: 'var(--hp-primary)' }}>Retry</button>
      </div>
    )
  }

  if (!status) return null

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--hp-primary-subtle)', color: 'var(--hp-primary)' }}>
          {status.branch}
        </span>
        {(status.ahead > 0 || status.behind > 0) && (
          <span className="text-xs" style={{ color: 'var(--hp-text-tertiary)' }}>
            {status.ahead > 0 && `↑${status.ahead}`}
            {status.behind > 0 && `↓${status.behind}`}
          </span>
        )}
        <button onClick={refresh} className="ml-auto text-xs" style={{ color: 'var(--hp-text-tertiary)' }} title="Refresh">↻</button>
      </div>

      {status.files.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--hp-text-tertiary)' }}>Working tree clean</p>
      ) : (
        <div className="space-y-1">
          {status.files.map((file, i) => (
            <div key={i} className="flex items-center gap-2 text-sm py-1 px-2 rounded" style={{ background: 'var(--hp-surface-1)' }}>
              <GitStatusBadge status={file.status} />
              <span className="font-mono text-xs truncate flex-1" style={{ color: 'var(--hp-text-primary)' }}>
                {file.path}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GitStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    'M': 'var(--hp-warning)',
    'A': 'var(--hp-success)',
    'D': 'var(--hp-danger)',
    'R': 'var(--hp-primary)',
    '?': 'var(--hp-text-tertiary)',
  }
  const bgMap: Record<string, string> = {
    'M': 'var(--hp-warning-subtle)',
    'A': 'var(--hp-success-subtle)',
    'D': 'var(--hp-danger-subtle)',
    'R': 'var(--hp-primary-subtle)',
    '?': 'var(--hp-surface-2)',
  }

  const color = colorMap[status] || 'var(--hp-text-tertiary)'
  const bg = bgMap[status] || 'var(--hp-surface-2)'

  return (
    <span
      className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
      style={{ color, background: bg }}
    >
      {status}
    </span>
  )
}

function parseGitStatus(raw: string): StatusData {
  const lines = raw.split('\n').filter(Boolean)
  let branch = 'HEAD'
  let ahead = 0
  let behind = 0
  const files: GitFile[] = []

  for (const line of lines) {
    if (line.startsWith('# branch.head')) {
      branch = line.split(' ').pop() || 'HEAD'
    } else if (line.startsWith('# branch.ab')) {
      const parts = line.split(' ')
      ahead = Math.abs(Number(parts.find(p => p.startsWith('+'))?.slice(1) || '0'))
      behind = Math.abs(Number(parts.find(p => p.startsWith('-'))?.slice(1) || '0'))
    } else if (line.startsWith('1 ') || line.startsWith('? ')) {
      const xy = line.startsWith('1 ') ? line.split(' ')[1] : '??'
      const statusChar = xy === '??' ? '?' : (xy[0] !== '.' ? xy[0] : xy[1])
      const pathPart = line.startsWith('1 ')
        ? line.split(' ').slice(8).join(' ')
        : line.slice(2)
      files.push({ status: statusChar, path: pathPart })
    } else if (line.startsWith('2 ')) {
      const parts = line.split(' ')
      const xy = parts[1]
      const statusChar = xy[0] !== '.' ? xy[0] : xy[1]
      const path = parts.slice(8).join(' ')
      files.push({ status: statusChar, path })
    }
  }

  return { branch, ahead, behind, files }
}
