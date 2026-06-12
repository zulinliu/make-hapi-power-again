import * as React from 'react'
import { cn } from '@/lib/utils'
import { useAdaptiveContext } from '@/components/layout/AdaptiveContext'
import type { DataState } from '@/components/ui/DataBoundary'

/**
 * Tab definition for PageScaffold tabs
 */
export interface PageTab {
    id: string
    label: React.ReactNode
    icon?: React.ReactNode
    disabled?: boolean
}

/**
 * PageScaffold — unified page layout with header/toolbar/tabs/content/footer/inspector.
 *
 * Provides consistent structure for all pages, with built-in:
 * - Header with eyebrow, title, description, actions
 * - Toolbar row
 * - Tabs with controlled active state
 * - Scrollable content area
 * - Inspector side panel (desktop only)
 * - Footer / BottomCommandBar spacer
 * - Safe-area insets
 * - DataState integration (loading/empty/error/offline/permission)
 */
export function PageScaffold({
    header,
    eyebrow,
    title,
    description,
    actions,
    toolbar,
    tabs,
    activeTabId,
    onTabChange,
    children,
    footer,
    inspector,
    inspectorOpen = true,
    state,
    className,
}: {
    /** Custom header — overrides built-in header if provided */
    header?: React.ReactNode
    /** Eyebrow text above title */
    eyebrow?: React.ReactNode
    /** Page title (used when header not provided) */
    title?: React.ReactNode
    /** Page description */
    description?: React.ReactNode
    /** Header action buttons */
    actions?: React.ReactNode
    /** Toolbar row below header */
    toolbar?: React.ReactNode
    /** Tab items */
    tabs?: PageTab[]
    /** Currently active tab id */
    activeTabId?: string
    /** Tab change callback */
    onTabChange?: (tabId: string) => void
    /** Page content */
    children: React.ReactNode
    /** Footer slot */
    footer?: React.ReactNode
    /** Inspector side panel (desktop workspace only) */
    inspector?: React.ReactNode
    /** Whether inspector is open (default: true when inspector provided) */
    inspectorOpen?: boolean
    /** Data state — renders DataBoundary when provided */
    state?: DataState
    /** Additional class name */
    className?: string
}) {
    const adaptive = useAdaptiveContext()
    const showInspector = adaptive.shellMode === 'workspace' && inspectorOpen && Boolean(inspector)

    // Build header content
    const headerContent = header ?? (title ? (
        <div className="mx-auto flex w-full items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
                {eyebrow ? (
                    <div className="truncate text-xs font-medium uppercase tracking-wider text-(--hp-text-tertiary)">
                        {eyebrow}
                    </div>
                ) : null}
                <h1 className="truncate text-base font-semibold leading-tight text-(--hp-text-primary)">
                    {title}
                </h1>
                {description ? (
                    <div className="truncate text-sm text-(--hp-text-tertiary)">
                        {description}
                    </div>
                ) : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
    ) : null)

    return (
        <div
            className={cn(
                'grid h-full min-h-0 bg-(--hp-canvas)',
                showInspector
                    ? 'grid-cols-[minmax(0,1fr)_minmax(280px,340px)]'
                    : 'grid-cols-1',
                className,
            )}
        >
            <section className="flex min-h-0 flex-col">
                {/* Header */}
                {headerContent ? (
                    <div className="shrink-0 border-b border-(--hp-divider) bg-(--hp-surface-0)">
                        {headerContent}
                    </div>
                ) : null}

                {/* Toolbar */}
                {toolbar ? (
                    <div className="shrink-0 border-b border-(--hp-divider) bg-(--hp-surface-0)">
                        {toolbar}
                    </div>
                ) : null}

                {/* Tabs */}
                {tabs && tabs.length > 0 ? (
                    <div className="shrink-0 border-b border-(--hp-divider) bg-(--hp-surface-0)">
                        <div className="flex gap-0 overflow-x-auto px-3" role="tablist">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    role="tab"
                                    aria-selected={activeTabId === tab.id}
                                    disabled={tab.disabled}
                                    onClick={() => onTabChange?.(tab.id)}
                                    className={cn(
                                        'relative inline-flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors',
                                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--hp-primary)',
                                        'disabled:cursor-not-allowed disabled:opacity-50',
                                        activeTabId === tab.id
                                            ? 'text-(--hp-text-primary)'
                                            : 'text-(--hp-text-tertiary) hover:text-(--hp-text-secondary)',
                                        // Active indicator bar
                                        activeTabId === tab.id
                                            ? 'after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-(--hp-primary)'
                                            : '',
                                        // Touch target
                                        adaptive.isTouch ? 'min-h-[44px]' : '',
                                    )}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}

                {/* Content */}
                <div className="app-scroll-y min-h-0 flex-1">
                    {children}
                </div>

                {/* Footer */}
                {footer ? (
                    <div className="shrink-0 border-t border-(--hp-divider) bg-(--hp-surface-0) pb-[max(0px,env(safe-area-inset-bottom))]">
                        {footer}
                    </div>
                ) : null}
            </section>

            {/* Inspector (desktop workspace only) */}
            {showInspector && inspector ? (
                <aside className="min-h-0 overflow-hidden border-l border-(--hp-divider) bg-(--hp-surface-0)">
                    {inspector}
                </aside>
            ) : null}
        </div>
    )
}

/**
 * ModulePage — convenience wrapper for simple pages with a title bar.
 */
export function ModulePage({
    title,
    description,
    actions,
    children,
}: {
    title: React.ReactNode
    description?: React.ReactNode
    actions?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <PageScaffold
            title={title}
            description={description}
            actions={actions}
        >
            <div className="mx-auto w-full max-w-content p-3">
                {children}
            </div>
        </PageScaffold>
    )
}
