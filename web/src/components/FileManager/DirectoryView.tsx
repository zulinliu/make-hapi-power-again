import { useCallback } from 'react'
import { useTranslation, type Locale } from '@/lib/use-translation'
import { FileIcon } from './FileIcon'
import type { FileEntry, SortOption, SortField, SortDirection } from './types'

export interface DirectoryViewProps {
    entries: FileEntry[]
    isLoading: boolean
    error: string | null
    sort: SortOption
    onSortChange: (sort: SortOption) => void
    onOpenDirectory: (path: string) => void
    onOpenFile: (path: string) => void
    onContextMenu: (path: string, type: 'file' | 'directory', point: { x: number; y: number }) => void
    selectedPath: string | null
    onSelect: (path: string) => void
    onRetry: () => void
    onCreate: () => void
    /** Batch selection */
    selectedPaths: Set<string>
    onToggleSelect: (path: string, shiftKey: boolean, ctrlKey: boolean) => void
    onSelectAll: () => void
    highlightPath: string | null
    emptyTitle?: string
    emptyHint?: string
    showCreateInEmpty?: boolean
}

type Translate = (key: string, params?: Record<string, string | number>) => string

function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const value = bytes / Math.pow(1024, i)
    return `${i === 0 ? value : value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`
}

function formatDate(iso: string, t: Translate, locale: Locale): string {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays === 0) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return t('fm.date.yesterday')
    if (diffDays < 7) return t('fm.date.daysAgo', { count: diffDays })
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

const OPPOSITE: Record<SortDirection, SortDirection> = { asc: 'desc', desc: 'asc' }

function SkeletonRow() {
    return (
        <div className="fm-file-row fm-file-row-skeleton" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 var(--hp-space-4)', borderBottom: '1px solid var(--hp-divider)' }}>
            <div className="animate-pulse" style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--hp-surface-1)' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="animate-pulse" style={{ height: 12, width: '60%', borderRadius: 4, background: 'var(--hp-surface-1)' }} />
                <div className="animate-pulse" style={{ height: 10, width: '35%', borderRadius: 4, background: 'var(--hp-surface-1)' }} />
            </div>
        </div>
    )
}

interface FileRowProps {
    entry: FileEntry
    index: number
    isSelected: boolean
    isChecked: boolean
    isNew: boolean
    t: Translate
    locale: Locale
    onOpenDirectory: (path: string) => void
    onOpenFile: (path: string) => void
    onContextMenu: (path: string, type: 'file' | 'directory', point: { x: number; y: number }) => void
    onToggleSelect: (path: string, shiftKey: boolean, ctrlKey: boolean) => void
    onSelect: (path: string) => void
}

function FileRow({ entry, index, isSelected, isChecked, isNew, t, locale, onOpenDirectory, onOpenFile, onContextMenu, onToggleSelect, onSelect }: FileRowProps) {
    const handleClick = useCallback(() => {
        onSelect(entry.path)
        if (entry.type === 'directory') onOpenDirectory(entry.path)
        else onOpenFile(entry.path)
    }, [entry.path, entry.type, onOpenDirectory, onOpenFile, onSelect])

    const handleContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation()
            const rect = e.currentTarget.getBoundingClientRect()
            onContextMenu(entry.path, entry.type, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        },
        [entry.path, entry.type, onContextMenu],
    )

    const animClass = isNew ? 'fm-row-new' : 'fm-row-enter'
    const selectedClass = isChecked || isSelected ? ' fm-file-row-selected' : ''
    const bg = isChecked ? 'var(--hp-primary-subtle)' : isSelected ? 'var(--hp-primary-subtle)' : undefined
    const modifiedLabel = formatDate(entry.modified, t, locale)
    const sizeLabel = formatSize(entry.size)

    return (
        <div
            role="listitem"
            className={`fm-file-row ${animClass}${selectedClass}`}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0 var(--hp-space-4)',
                borderBottom: '1px solid var(--hp-divider)',
                cursor: 'pointer',
                position: 'relative',
                background: bg,
                animationDelay: `${Math.min(index, 10) * 18}ms`,
            }}
            onMouseEnter={(e) => { if (!isSelected && !isChecked) e.currentTarget.style.background = 'var(--hp-surface-1)' }}
            onMouseLeave={(e) => { if (!isSelected && !isChecked) e.currentTarget.style.background = '' }}
        >
            {/* Desktop checkbox */}
            <label
                className="fm-row-checkbox"
                onClick={(e) => e.stopPropagation()}
                style={{
                    display: 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 44,
                    flexShrink: 0,
                    cursor: 'pointer',
                }}
            >
                <input
                    type="checkbox"
                    checked={isChecked}
                    aria-label={t('fm.select.entry', { name: entry.name })}
                    onChange={(e) => {
                        const ne = e.nativeEvent as MouseEvent
                        onToggleSelect(entry.path, ne.shiftKey, ne.ctrlKey || ne.metaKey)
                    }}
                    className="fm-checkbox"
                    style={{ width: 18, height: 18, accentColor: 'var(--hp-primary)', cursor: 'pointer' }}
                />
            </label>

            <button
                type="button"
                onClick={handleClick}
                onFocus={() => onSelect(entry.path)}
                className="fm-file-row-main"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flex: 1,
                    minWidth: 0,
                    alignSelf: 'stretch',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <FileIcon fileName={entry.name} size={28} isHidden={entry.isHidden} isGitRepo={entry.isGitRepo} />
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div title={entry.name} style={{ fontSize: 14, fontWeight: 560, color: 'var(--hp-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.name}
                        </div>
                        <div className="fm-row-subtitle" style={{ fontSize: 11, color: 'var(--hp-text-tertiary)', marginTop: 2 }}>
                            {sizeLabel} &middot; {modifiedLabel}
                        </div>
                    </div>
                </div>

                <div className="fm-row-size-desktop" style={{ width: 70, textAlign: 'right', fontSize: 12, fontFamily: 'var(--hp-font-mono, ui-monospace, monospace)', color: 'var(--hp-text-tertiary)', flexShrink: 0, display: 'none' }}>
                    {entry.type === 'file' ? sizeLabel : t('fm.size.folder')}
                </div>
                <div className="fm-row-modified-desktop" style={{ width: 70, textAlign: 'right', fontSize: 12, color: 'var(--hp-text-tertiary)', flexShrink: 0, display: 'none' }}>
                    {modifiedLabel}
                </div>
            </button>

            <button
                type="button"
                onClick={handleContextMenu}
                className="fm-icon-button"
                style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid transparent', cursor: 'pointer', color: 'var(--hp-text-tertiary)', fontSize: 18, lineHeight: 1, borderRadius: 'var(--hp-radius-md)', flexShrink: 0 }}
                aria-label={t('fm.actions.openFor', { name: entry.name })}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hp-surface-2)'; e.currentTarget.style.color = 'var(--hp-text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--hp-text-tertiary)' }}
            >
                &#8943;
            </button>
        </div>
    )
}

function SortHeader({ sort, t, onSortChange, allSelected, onSelectAll }: { sort: SortOption; t: Translate; onSortChange: (s: SortOption) => void; allSelected: boolean; onSelectAll: () => void }) {
    const cells: { field: SortField; label: string; flex?: number; width?: number; align: 'left' | 'right' }[] = [
        { field: 'name', label: t('fm.sort.name'), flex: 1, align: 'left' },
        { field: 'size', label: t('fm.sort.size'), width: 70, align: 'right' },
        { field: 'modified', label: t('fm.sort.modified'), width: 70, align: 'right' },
    ]

    return (
        <div className="fm-sort-header" style={{ minHeight: 36, display: 'none', alignItems: 'center', gap: 12, padding: '0 var(--hp-space-4)', background: 'var(--hp-surface-1)', borderBottom: '1px solid var(--hp-divider)' }}>
            <label className="fm-row-checkbox" style={{ display: 'none', alignItems: 'center', justifyContent: 'center', width: 32, minHeight: 36, flexShrink: 0, cursor: 'pointer' }}>
                <input type="checkbox" checked={allSelected} onChange={onSelectAll} aria-label={t('fm.select.all')} className="fm-checkbox" style={{ width: 18, height: 18, accentColor: 'var(--hp-primary)', cursor: 'pointer' }} />
            </label>
            {cells.map((cell) => {
                const active = sort.field === cell.field
                return (
                    <button key={cell.field} type="button" onClick={() => onSortChange({ field: cell.field, direction: active ? OPPOSITE[sort.direction] : 'asc' })}
                        aria-label={active ? t(sort.direction === 'asc' ? 'fm.sort.activeAsc' : 'fm.sort.activeDesc', { field: cell.label }) : t('fm.sort.activate', { field: cell.label })}
                        aria-pressed={active}
                        className="fm-sort-button"
                        style={{ ...(cell.flex != null ? { flex: cell.flex } : { width: cell.width }), textAlign: cell.align, fontSize: 11, fontWeight: 650, color: active ? 'var(--hp-text-primary)' : 'var(--hp-text-tertiary)', textTransform: 'uppercase', background: 'transparent', border: '1px solid transparent', cursor: 'pointer', padding: '6px 0', letterSpacing: '0.02em', userSelect: 'none', borderRadius: 'var(--hp-radius-sm)' }}>
                        {cell.label}{active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                )
            })}
            <div style={{ width: 32, flexShrink: 0 }} />
        </div>
    )
}

function EmptyState({
    t,
    onCreate,
    title,
    hint,
    showCreate,
}: {
    t: Translate
    onCreate: () => void
    title?: string
    hint?: string
    showCreate: boolean
}) {
    return (
        <div className="fm-state" style={{ display: 'flex', minHeight: 300, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--hp-space-8) var(--hp-space-5)', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, display: 'grid', placeItems: 'center', borderRadius: 'var(--hp-radius-lg)', background: 'var(--hp-primary-subtle)', color: 'var(--hp-primary)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--hp-text-primary)' }}>{title ?? t('fm.empty.title')}</div>
            <div style={{ fontSize: 13, color: 'var(--hp-text-secondary)', maxWidth: 340, lineHeight: 1.55 }}>{hint ?? t('fm.empty.hintDetailed')}</div>
            {showCreate ? (
                <button type="button" className="fm-primary-button" onClick={onCreate} style={{ marginTop: 4 }}>{t('fm.toolbar.new')}</button>
            ) : null}
        </div>
    )
}

function ErrorState({ message, t, onRetry }: { message: string; t: Translate; onRetry: () => void }) {
    return (
        <div className="fm-state" style={{ display: 'flex', minHeight: 300, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--hp-space-8) var(--hp-space-5)', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, display: 'grid', placeItems: 'center', borderRadius: 'var(--hp-radius-lg)', background: 'var(--hp-danger-subtle)', color: 'var(--hp-danger)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--hp-text-primary)' }}>{t('fm.error.title')}</div>
            <div style={{ fontSize: 13, color: 'var(--hp-text-secondary)', textAlign: 'center', maxWidth: 360, lineHeight: 1.55, overflowWrap: 'anywhere' }}>{message}</div>
            <button type="button" onClick={onRetry} className="fm-secondary-button" style={{ marginTop: 4 }}>
                {t('fm.error.retry')}
            </button>
        </div>
    )
}

export default function DirectoryView({
    entries, isLoading, error, sort, onSortChange, onOpenDirectory, onOpenFile, onContextMenu,
    selectedPath, onSelect, onRetry, onCreate, selectedPaths, onToggleSelect, onSelectAll, highlightPath,
    emptyTitle, emptyHint, showCreateInEmpty = true,
}: DirectoryViewProps) {
    const { t, locale } = useTranslation()
    const sorted = entries
    const allSelected = entries.length > 0 && entries.every((e) => selectedPaths.has(e.path))

    return (
        <div className="fm-dir-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <SortHeader sort={sort} t={t} onSortChange={onSortChange} allSelected={allSelected} onSelectAll={onSelectAll} />

            {isLoading ? (
                <div role="status" aria-live="polite">
                    <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>{t('fm.loading')}</span>
                    {Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} />)}
                </div>
            ) : error ? (
                <ErrorState message={error} t={t} onRetry={onRetry} />
            ) : sorted.length === 0 ? (
                <EmptyState t={t} onCreate={onCreate} title={emptyTitle} hint={emptyHint} showCreate={showCreateInEmpty} />
            ) : (
                <div role="list" aria-label={t('fm.directoryContents')}>
                    {sorted.map((entry, index) => (
                        <FileRow
                            key={entry.path}
                            entry={entry}
                            index={index}
                            isSelected={selectedPath === entry.path}
                            isChecked={selectedPaths.has(entry.path)}
                            isNew={highlightPath === entry.path}
                            t={t}
                            locale={locale}
                            onOpenDirectory={onOpenDirectory}
                            onOpenFile={onOpenFile}
                            onContextMenu={onContextMenu}
                            onToggleSelect={onToggleSelect}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
