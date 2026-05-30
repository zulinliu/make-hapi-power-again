import { useState, useEffect, useCallback } from 'react'
import { useAppContext } from '@/lib/app-context'

interface Branch {
  name: string
  isCurrent: boolean
  isRemote: boolean
  lastCommit: string
}

export function GitBranchManager({ cwd }: { cwd: string }) {
  const { api } = useAppContext()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadBranches = useCallback(async () => {
    if (!api) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.gitBranchList?.({ cwd })
      if (res && res.success) {
        setBranches(parseBranches(res.stdout))
      } else {
        setError(res?.stderr || 'Failed to load branches')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [api, cwd])

  useEffect(() => { loadBranches() }, [loadBranches])

  const handleCreate = async () => {
    if (!api || !newBranchName.trim()) return
    try {
      const res = await api.gitBranchCreate?.({ cwd, name: newBranchName.trim() })
      if (res && res.success) {
        setNewBranchName('')
        loadBranches()
      } else {
        setError(res?.stderr || 'Failed to create branch')
      }
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleSwitch = async (name: string) => {
    if (!api) return
    try {
      await api.gitBranchSwitch?.({ cwd, name })
      loadBranches()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleDelete = async (name: string) => {
    if (!api) return
    try {
      await api.gitBranchDelete?.({ cwd, name })
      loadBranches()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div className="p-4 space-y-3">
      {/* Create Branch */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newBranchName}
          onChange={(e) => setNewBranchName(e.target.value)}
          placeholder="New branch name..."
          className="flex-1 text-sm px-3 py-1.5 rounded-md border outline-none"
          style={{
            background: 'var(--hp-surface-1)',
            borderColor: 'var(--hp-border)',
            color: 'var(--hp-text-primary)',
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={!newBranchName.trim()}
          className="text-xs px-3 py-1.5 rounded-md font-medium"
          style={{
            background: 'var(--hp-primary)',
            color: 'var(--hp-primary-text)',
            opacity: newBranchName.trim() ? 1 : 0.5,
          }}
        >
          Create
        </button>
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--hp-danger)' }}>{error}</p>}

      {/* Branch List */}
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--hp-text-tertiary)' }}>Loading...</p>
      ) : (
        <div className="space-y-1">
          {branches.map((branch) => (
            <div key={branch.name} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded"
              style={{ background: branch.isCurrent ? 'var(--hp-primary-subtle)' : 'transparent' }}>
              <span className="w-4 text-center" style={{ color: branch.isCurrent ? 'var(--hp-success)' : 'transparent' }}>
                ●
              </span>
              <span className="font-mono text-xs flex-1 truncate" style={{ color: branch.isCurrent ? 'var(--hp-primary)' : 'var(--hp-text-primary)' }}>
                {branch.name}
              </span>
              {!branch.isCurrent && !branch.isRemote && (
                <>
                  <button onClick={() => handleSwitch(branch.name)} className="text-xs px-2 py-0.5 rounded"
                    style={{ color: 'var(--hp-text-tertiary)' }} title="Switch">
                    ⇄
                  </button>
                  <button onClick={() => handleDelete(branch.name)} className="text-xs px-2 py-0.5 rounded"
                    style={{ color: 'var(--hp-text-tertiary)' }} title="Delete">
                    ×
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function parseBranches(raw: string): Branch[] {
  if (!raw) return []
  return raw.split('\n').filter(Boolean).map((line) => {
    const isCurrent = line.startsWith('*')
    const isRemote = line.includes('remotes/')
    const cleanName = line.replace(/^\*?\s+/, '').split(/\s+/)[0]
    const lastCommit = line.replace(/^\*?\s+\S+\s+/, '')
    return { name: cleanName, isCurrent, isRemote, lastCommit }
  })
}
