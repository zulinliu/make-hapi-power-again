import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import { Autocomplete } from '@/components/ChatInput/Autocomplete'
import { FloatingOverlay } from '@/components/ChatInput/FloatingOverlay'
import { useTranslation } from '@/lib/use-translation'

function FolderIcon(props: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
    )
}

export function DirectorySection(props: {
    directory: string
    suggestions: readonly Suggestion[]
    selectedIndex: number
    isDisabled: boolean
    recentPaths: string[]
    statusMessage?: string | null
    statusTone?: 'warning' | 'error' | null
    onDirectoryChange: (value: string) => void
    onDirectoryFocus: () => void
    onDirectoryBlur: () => void
    onDirectoryKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void
    onSuggestionSelect: (index: number) => void
    onPathClick: (path: string) => void
    onChooseFolder?: () => void
}) {
    const { t } = useTranslation()

    return (
        <div className="flex flex-col gap-1.5 px-3 py-3">
            <label className="text-xs font-medium uppercase tracking-wider text-[var(--hp-text-tertiary)]">
                {t('newSession.directory')}
            </label>
            <div className="flex items-start gap-2">
                <div className="relative flex-1 min-w-0">
                    <div className="relative">
                        <FolderIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--hp-text-tertiary)] pointer-events-none" />
                        <input
                            type="text"
                            placeholder={t('newSession.placeholder')}
                            value={props.directory}
                            onChange={(event) => props.onDirectoryChange(event.target.value)}
                            onKeyDown={props.onDirectoryKeyDown}
                            onFocus={props.onDirectoryFocus}
                            onBlur={props.onDirectoryBlur}
                            disabled={props.isDisabled}
                            className="w-full rounded-[var(--hp-radius-sm,6px)] border border-[var(--hp-border)] bg-[var(--hp-surface-0)] p-2 pl-8 text-sm text-[var(--hp-text-primary)] placeholder:text-[var(--hp-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--hp-primary)] focus:border-transparent disabled:opacity-50 transition-colors"
                        />
                    </div>
                    {props.suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-10 mt-1">
                            <FloatingOverlay maxHeight={200}>
                                <Autocomplete
                                    suggestions={props.suggestions}
                                    selectedIndex={props.selectedIndex}
                                    onSelect={props.onSuggestionSelect}
                                />
                            </FloatingOverlay>
                        </div>
                    )}
                </div>
                {props.onChooseFolder && (
                    <button
                        type="button"
                        onClick={props.onChooseFolder}
                        disabled={props.isDisabled}
                        className="shrink-0 flex items-center gap-1 rounded-[var(--hp-radius-sm,6px)] border border-[var(--hp-border)] bg-[var(--hp-surface-1)] px-2 py-2 text-xs text-[var(--hp-text-secondary)] hover:bg-[var(--hp-surface-2)] hover:text-[var(--hp-text-primary)] transition-colors disabled:opacity-50"
                        title={t('newSession.browse')}
                    >
                        <FolderIcon className="h-3.5 w-3.5" />
                        {t('newSession.browse')}
                    </button>
                )}
            </div>

            {props.recentPaths.length > 0 && (
                <div className="flex flex-col gap-1 mt-1">
                    <span className="text-xs text-[var(--hp-text-tertiary)]">{t('newSession.recent')}:</span>
                    <div className="flex flex-wrap gap-1">
                        {props.recentPaths.map((path) => (
                            <button
                                key={path}
                                type="button"
                                onClick={() => props.onPathClick(path)}
                                disabled={props.isDisabled}
                                className="rounded-[var(--hp-radius-sm,6px)] bg-[var(--hp-surface-1)] px-2 py-1 text-xs text-[var(--hp-text-secondary)] hover:bg-[var(--hp-surface-2)] hover:text-[var(--hp-text-primary)] transition-colors truncate max-w-[200px] disabled:opacity-50"
                                title={path}
                            >
                                {path}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {props.statusMessage ? (
                <div
                    className={`mt-1 rounded-[var(--hp-radius-sm,6px)] px-2 py-1 text-xs ${
                        props.statusTone === 'error'
                            ? 'bg-[var(--hp-danger-subtle)] text-[var(--hp-danger)]'
                            : 'bg-[var(--hp-warning-subtle)] text-[var(--hp-text-tertiary)]'
                    }`}
                >
                    {props.statusMessage}
                </div>
            ) : null}
        </div>
    )
}
