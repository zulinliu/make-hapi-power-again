import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from '@/lib/use-translation'
import { cn } from '@/lib/utils'
import { getHistory, getFavorites, toggleFavorite, detectPlatform } from '@/lib/git-portal-storage'
import type { CloneHistoryEntry, GitPlatform } from '@/lib/git-portal-storage'
import { GitPortalEmptyState } from './GitPortalEmptyState'

interface GitPortalHistoryProps {
  onSelect: (url: string, targetDir: string, branch?: string) => void
  onToggleFavorite: (entryId: string) => void
}

const PLATFORM_ICON: Record<GitPlatform, string> = {
  github: 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z',
  gitlab: 'M22.301 12.203l-1.69-5.199a.517.517 0 00-.466-.353.512.512 0 00-.484.318l-1.093 3.136H5.634L4.54 6.969a.512.512 0 00-.484-.318.517.517 0 00-.466.353L1.9 12.203a.953.953 0 00.344 1.063l9.3 6.793a.5.5 0 00.59 0l9.3-6.793a.953.953 0 00.344-1.063z',
  bitbucket: 'M1 2.5l2.06 17.36a.514.514 0 00.505.44h17.15a.514.514 0 00.505-.44L23.28 2.5H1zm13.7 11.97H8.8l-1.07-6.37h8.93l-1.07 6.37z',
  other: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75v3.75m0 3.75h.008v.008H12v-.008z',
}

function formatRelativeTime(dateStr: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('gitPortal.time.justNow')
  if (minutes < 60) return t('gitPortal.time.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('gitPortal.time.hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('gitPortal.time.daysAgo', { count: days })
  return t('gitPortal.time.monthsAgo', { count: Math.floor(days / 30) })
}

export function GitPortalHistory({ onSelect, onToggleFavorite }: GitPortalHistoryProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'recent' | 'favorites'>('recent')
  const [refreshKey, setRefreshKey] = useState(0)

  const history = useMemo(() => getHistory(50), [activeTab, refreshKey])
  const favorites = useMemo(() => getFavorites(), [activeTab, refreshKey])

  const items = activeTab === 'recent'
    ? (expanded ? history : history.slice(0, 4))
    : favorites

  const handleToggleFavorite = useCallback((e: React.MouseEvent, entryId: string) => {
    toggleFavorite(entryId)
    onToggleFavorite(entryId)
    setRefreshKey(k => k + 1)
  }, [onToggleFavorite])

  const hasItems = items.length > 0
  const canExpand = activeTab === 'recent' && history.length > 4

  return (
    <div className="gp-history">
      <div className="flex border-b border-[var(--hp-border)] mb-3">
        <button
          type="button"
          className={cn(
            'flex-1 min-h-11 pb-2 text-xs font-medium transition-colors border-b-2',
            activeTab === 'recent'
              ? 'text-[var(--hp-primary-readable,var(--hp-primary))] border-[var(--hp-primary)]'
              : 'text-[var(--hp-text-tertiary)] border-transparent hover:text-[var(--hp-text-primary)]'
          )}
          onClick={() => setActiveTab('recent')}
        >
          {t('gitPortal.history.title')}
        </button>
        <button
          type="button"
          className={cn(
            'flex-1 min-h-11 pb-2 text-xs font-medium transition-colors border-b-2',
            activeTab === 'favorites'
              ? 'text-[var(--hp-primary-readable,var(--hp-primary))] border-[var(--hp-primary)]'
              : 'text-[var(--hp-text-tertiary)] border-transparent hover:text-[var(--hp-text-primary)]'
          )}
          onClick={() => setActiveTab('favorites')}
        >
          {t('gitPortal.favorites.title')}
        </button>
      </div>

      {!hasItems ? (
        <GitPortalEmptyState
          variant={activeTab === 'favorites' ? 'noFavorites' : 'noHistory'}
        />
      ) : (
        <>
          <div className={cn(
            'gp-history-list',
            activeTab === 'recent' && !expanded ? 'flex gap-2 overflow-x-auto pb-1' : 'space-y-1.5'
          )}>
            {items.map(entry => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                compact={activeTab === 'recent' && !expanded}
                onSelect={onSelect}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>

          {canExpand && (
            <button
              type="button"
              className="w-full min-h-11 mt-2 py-2 text-xs text-[var(--hp-primary-readable,var(--hp-primary))] hover:text-[var(--hp-primary-hover)] transition-colors"
              onClick={() => setExpanded(v => !v)}
            >
              {expanded ? t('gitPortal.history.less') : t('gitPortal.history.more')}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function HistoryCard({
  entry,
  compact,
  onSelect,
  onToggleFavorite,
}: {
  entry: CloneHistoryEntry
  compact: boolean
  onSelect: (url: string, targetDir: string, branch?: string) => void
  onToggleFavorite: (e: React.MouseEvent, entryId: string) => void
}) {
  const { t } = useTranslation()
  const platform = entry.platform ?? detectPlatform(entry.url)

  if (compact) {
    return (
      <div className="gp-history-card min-h-11 flex-shrink-0 flex items-center gap-1 rounded-lg border border-[var(--hp-border)] bg-[var(--hp-surface-0)] hover:border-[var(--hp-primary)] transition-colors min-w-[172px] max-w-[224px]">
        <button
          type="button"
          className="min-h-11 flex-1 min-w-0 flex items-center gap-2 px-3 py-2 text-left rounded-lg"
          onClick={() => onSelect(entry.url, entry.targetDir, entry.branch)}
        >
          <PlatformBadge platform={platform} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[var(--hp-text-primary)] truncate">
              {entry.repoName}
            </p>
            <p className="text-[10px] text-[var(--hp-text-tertiary)] truncate">
              {entry.owner}
            </p>
          </div>
        </button>
        <FavoriteStar
          isFavorite={entry.isFavorite}
          onClick={e => onToggleFavorite(e, entry.id)}
        />
      </div>
    )
  }

  return (
    <div className="gp-history-card min-h-11 w-full flex items-center gap-1 rounded-lg border border-[var(--hp-border)] bg-[var(--hp-surface-0)] hover:border-[var(--hp-primary)] transition-colors">
      <button
        type="button"
        className="min-h-11 flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 text-left rounded-lg"
        onClick={() => onSelect(entry.url, entry.targetDir, entry.branch)}
      >
        <PlatformBadge platform={platform} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--hp-text-primary)] truncate">
            {entry.owner}/{entry.repoName}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {entry.branch && (
              <span className="text-[10px] text-[var(--hp-text-tertiary)]">
                {entry.branch}
              </span>
            )}
            <span className="text-[10px] text-[var(--hp-text-tertiary)]">
              {formatRelativeTime(entry.lastClonedAt, t)}
            </span>
            {entry.cloneCount > 1 && (
              <span className="text-[10px] text-[var(--hp-text-tertiary)]">
                x{entry.cloneCount}
              </span>
            )}
          </div>
        </div>
      </button>
      <FavoriteStar
        isFavorite={entry.isFavorite}
        onClick={e => onToggleFavorite(e, entry.id)}
      />
    </div>
  )
}

function PlatformBadge({ platform }: { platform: GitPlatform }) {
  return (
    <span className={cn(
      'flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-[var(--hp-surface-2)]',
    )}>
      <svg className="w-4 h-4 text-[var(--hp-text-tertiary)]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={PLATFORM_ICON[platform]} />
      </svg>
    </span>
  )
}

function FavoriteStar({ isFavorite, onClick }: { isFavorite: boolean; onClick: (e: React.MouseEvent) => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      className={cn(
        'flex-shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center rounded transition-colors',
        isFavorite
          ? 'text-amber-500 hover:text-amber-600'
          : 'text-[var(--hp-text-tertiary)] hover:text-amber-500'
      )}
      onClick={onClick}
      aria-label={isFavorite ? t('gitPortal.result.unfavorite') : t('gitPortal.result.favorite')}
      aria-pressed={isFavorite}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  )
}
