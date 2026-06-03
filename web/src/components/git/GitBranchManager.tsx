import { useState, useEffect, useCallback } from 'react'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface Branch {
  name: string
  isCurrent: boolean
  isRemote: boolean
}

export function GitBranchManager({ sessionId }: { sessionId: string }) {
  const { api } = useAppContext()
  const { t } = useTranslation()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBranches = useCallback(async () => {
    if (!api) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.getGitBranchList(sessionId)
      if (res.success && res.stdout) {
        setBranches(parseBranches(res.stdout))
      } else {
        setError(res.error || 'Failed to load branches')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [api, sessionId])

  useEffect(() => { loadBranches() }, [loadBranches])

  const handleCreate = async () => {
    if (!api || !newBranchName.trim()) return
    try {
      const res = await api.createGitBranch(sessionId, newBranchName.trim())
      if (res.success) {
        setNewBranchName('')
        loadBranches()
      } else {
        setError(res.error || t('git.branch.createFailed'))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleSwitch = async (name: string) => {
    if (!api) return
    try {
      const res = await api.switchGitBranch(sessionId, name)
      if (res.success) {
        loadBranches()
      } else {
        setError(res.error || t('git.branch.switchFailed'))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleDelete = useCallback(async (name: string) => {
    if (!api) return
    setDeleteTarget(null)
    setDeleting(true)
    try {
      const res = await api.deleteGitBranch(sessionId, name)
      if (res.success) {
        loadBranches()
      } else {
        setError(res.error || t('git.branch.deleteFailed'))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDeleting(false)
    }
  }, [api, sessionId, loadBranches, t])

  const handleMerge = async (name: string) => {
    if (!api) return
    setError(null)
    try {
      const res = await api.mergeGitBranch(sessionId, name)
      if (res.success) {
        loadBranches()
      } else {
        setError(res.stderr || res.error || t('git.branch.mergeFailed'))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={newBranchName}
          onChange={(e) => setNewBranchName(e.target.value)}
          placeholder={t('git.branch.newPlaceholder')}
          className="flex-1 text-sm px-3 py-1.5 rounded-md border outline-none bg-[var(--app-secondary-bg)] border-[var(--app-border)] text-[var(--app-fg)]"
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={!newBranchName.trim()}
          className="text-xs px-3 py-1.5 rounded-md font-medium bg-[var(--app-link)] text-[var(--app-button-text)]"
          style={{ opacity: newBranchName.trim() ? 1 : 0.5 }}
        >
          {t('git.branch.create')}
        </button>
      </div>

      {error && <p className="text-xs text-[var(--app-danger)]">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--app-hint)]">{t('git.branch.loading')}</p>
      ) : (
        <div className="space-y-1">
          {branches.map((branch) => (
            <div key={branch.name} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded"
              style={{ background: branch.isCurrent ? 'var(--app-primary-subtle)' : 'transparent' }}>
              <span className="w-4 text-center" style={{ color: branch.isCurrent ? 'var(--app-success)' : 'transparent' }}>
                ●
              </span>
              <span className="font-mono text-xs flex-1 truncate" style={{ color: branch.isCurrent ? 'var(--app-link)' : 'var(--app-fg)' }}>
                {branch.name}
              </span>
              {!branch.isCurrent && !branch.isRemote && (
                <>
                  <button onClick={() => handleMerge(branch.name)} className="text-xs px-2 py-0.5 rounded text-[var(--app-hint)]" title={t('git.branch.merge')}>
                    ⊕
                  </button>
                  <button onClick={() => handleSwitch(branch.name)} className="text-xs px-2 py-0.5 rounded text-[var(--app-hint)]" title={t('git.branch.switch')}>
                    ⇄
                  </button>
                  <button onClick={() => setDeleteTarget(branch.name)} className="text-xs px-2 py-0.5 rounded text-[var(--app-hint)]" title={t('git.branch.delete')}>
                    ×
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('git.branch.delete')}
        description={t('git.branch.deleteConfirm', { name: deleteTarget ?? '' })}
        confirmLabel={t('git.branch.delete')}
        confirmingLabel={t('git.branch.delete')}
        onConfirm={async () => { if (deleteTarget) await handleDelete(deleteTarget) }}
        isPending={deleting}
        destructive
      />
    </div>
  )
}

function parseBranches(raw: string): Branch[] {
  if (!raw) return []
  return raw.split('\n').filter(Boolean).map((line) => {
    const isCurrent = line.startsWith('*')
    const isRemote = line.includes('remotes/')
    const cleanName = line.replace(/^\*?\s+/, '').split(/\s+/)[0]
    return { name: cleanName, isCurrent, isRemote }
  })
}
