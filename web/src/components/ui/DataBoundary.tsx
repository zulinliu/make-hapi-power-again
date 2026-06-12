import * as React from 'react'
import { cn } from '@/lib/utils'
import { useAdaptiveContext } from '@/components/layout/AdaptiveContext'

/**
 * DataState represents the current state of a data-fetching operation.
 */
export interface DataState {
    status: 'idle' | 'loading' | 'empty' | 'error' | 'offline' | 'permission-denied' | 'stale'
    title?: string
    description?: string
    /** Primary action for recovery or next step */
    primaryAction?: {
        label: string
        onSelect: () => void | Promise<void>
        tone?: 'default' | 'primary' | 'danger'
    }
    /** Secondary action */
    secondaryAction?: {
        label: string
        onSelect: () => void | Promise<void>
    }
}

/**
 * DataBoundary — unified data state rendering component.
 *
 * Handles:
 * - loading: skeleton grid (not isolated spinner)
 * - empty: illustration + title + next step action
 * - error: cause + impact + recovery path
 * - offline: reconnection prompt
 * - permission-denied: access request path
 * - stale: stale data indicator with refresh option
 * - idle: transparent pass-through
 *
 * Each state has a built-in fallback that can be overridden with custom fallback props.
 */
export function DataBoundary<T = unknown>({
    state,
    data,
    loadingFallback,
    emptyFallback,
    errorFallback,
    offlineFallback,
    permissionFallback,
    staleFallback,
    children,
    className,
}: {
    state: DataState
    data?: T
    /** Custom loading fallback */
    loadingFallback?: React.ReactNode
    /** Custom empty state fallback */
    emptyFallback?: React.ReactNode
    /** Custom error fallback */
    errorFallback?: React.ReactNode
    /** Custom offline fallback */
    offlineFallback?: React.ReactNode
    /** Custom permission denied fallback */
    permissionFallback?: React.ReactNode
    /** Custom stale data fallback */
    staleFallback?: React.ReactNode
    /** Render children when data is available */
    children: (data: T) => React.ReactNode
    /** Additional class name */
    className?: string
}) {
    const adaptive = useAdaptiveContext()

    // Loading state: skeleton grid
    if (state.status === 'loading') {
        if (loadingFallback) return <>{loadingFallback}</>
        return (
            <div className={cn('flex flex-col gap-3 p-4', className)} role="status" aria-live="polite">
                <span className="sr-only">{state.title ?? 'Loading...'}</span>
                {Array.from({ length: 6 }, (_, i) => (
                    <div
                        key={i}
                        className="animate-pulse rounded-(--hp-radius-md) bg-(--hp-surface-2)"
                        style={{
                            height: 18,
                            width: `${[68, 94, 48, 82, 56, 72][i % 6]}%`,
                        }}
                    />
                ))}
            </div>
        )
    }

    // Empty state
    if (state.status === 'empty') {
        if (emptyFallback) return <>{emptyFallback}</>
        return (
            <div className={cn('grid min-h-64 place-items-center p-6 text-center', className)}>
                <div className="max-w-sm">
                    <EmptyStateIllustration />
                    <div className="mt-4 text-base font-semibold text-(--hp-text-primary)">
                        {state.title ?? 'No data'}
                    </div>
                    {state.description ? (
                        <div className="mt-2 text-sm leading-relaxed text-(--hp-text-secondary)">
                            {state.description}
                        </div>
                    ) : null}
                    {state.primaryAction ? (
                        <div className="mt-4 flex justify-center gap-2">
                            {state.secondaryAction ? (
                                <ActionButton
                                    label={state.secondaryAction.label}
                                    onSelect={state.secondaryAction.onSelect}
                                    tone="default"
                                    minTouch={adaptive.isTouch}
                                />
                            ) : null}
                            <ActionButton
                                label={state.primaryAction.label}
                                onSelect={state.primaryAction.onSelect}
                                tone={state.primaryAction.tone ?? 'primary'}
                                minTouch={adaptive.isTouch}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        )
    }

    // Error state
    if (state.status === 'error') {
        if (errorFallback) return <>{errorFallback}</>
        return (
            <div className={cn('grid min-h-64 place-items-center p-6 text-center', className)} role="alert">
                <div className="max-w-sm">
                    <ErrorStateIllustration />
                    <div className="mt-4 text-base font-semibold text-(--hp-text-primary)">
                        {state.title ?? 'Something went wrong'}
                    </div>
                    {state.description ? (
                        <div className="mt-2 text-sm leading-relaxed text-(--hp-text-secondary)">
                            {state.description}
                        </div>
                    ) : null}
                    {state.primaryAction ? (
                        <div className="mt-4 flex justify-center gap-2">
                            <ActionButton
                                label={state.primaryAction.label}
                                onSelect={state.primaryAction.onSelect}
                                tone={state.primaryAction.tone ?? 'primary'}
                                minTouch={adaptive.isTouch}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        )
    }

    // Offline state
    if (state.status === 'offline') {
        if (offlineFallback) return <>{offlineFallback}</>
        return (
            <div className={cn('grid min-h-64 place-items-center p-6 text-center', className)} role="alert">
                <div className="max-w-sm">
                    <OfflineStateIllustration />
                    <div className="mt-4 text-base font-semibold text-(--hp-text-primary)">
                        {state.title ?? 'You are offline'}
                    </div>
                    {state.description ? (
                        <div className="mt-2 text-sm leading-relaxed text-(--hp-text-secondary)">
                            {state.description}
                        </div>
                    ) : null}
                    {state.primaryAction ? (
                        <div className="mt-4 flex justify-center">
                            <ActionButton
                                label={state.primaryAction.label}
                                onSelect={state.primaryAction.onSelect}
                                tone="primary"
                                minTouch={adaptive.isTouch}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        )
    }

    // Permission denied state
    if (state.status === 'permission-denied') {
        if (permissionFallback) return <>{permissionFallback}</>
        return (
            <div className={cn('grid min-h-64 place-items-center p-6 text-center', className)} role="alert">
                <div className="max-w-sm">
                    <PermissionStateIllustration />
                    <div className="mt-4 text-base font-semibold text-(--hp-text-primary)">
                        {state.title ?? 'Access denied'}
                    </div>
                    {state.description ? (
                        <div className="mt-2 text-sm leading-relaxed text-(--hp-text-secondary)">
                            {state.description}
                        </div>
                    ) : null}
                    {state.primaryAction ? (
                        <div className="mt-4 flex justify-center">
                            <ActionButton
                                label={state.primaryAction.label}
                                onSelect={state.primaryAction.onSelect}
                                tone="primary"
                                minTouch={adaptive.isTouch}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        )
    }

    // Stale state: render children with stale indicator
    if (state.status === 'stale') {
        return (
            <div className={cn('relative', className)}>
                {staleFallback ? (
                    <>{staleFallback}</>
                ) : (
                    <div className="mb-2 flex items-center gap-2 rounded-(--hp-radius-md) border border-(--hp-border) bg-(--hp-surface-1) px-3 py-2 text-xs text-(--hp-text-tertiary)">
                        <StaleIndicatorIcon />
                        <span>{state.title ?? 'Data may be outdated'}</span>
                        {state.primaryAction ? (
                            <button
                                type="button"
                                className="ml-auto text-(--hp-primary) hover:underline"
                                onClick={state.primaryAction.onSelect}
                            >
                                {state.primaryAction.label}
                            </button>
                        ) : null}
                    </div>
                )}
                {data !== undefined ? children(data) : null}
            </div>
        )
    }

    // Idle / data available: render children
    if (data !== undefined) {
        return <>{children(data)}</>
    }

    // Fallback: no data, no special state
    return null
}

// --- Internal sub-components ---

function ActionButton({
    label,
    onSelect,
    tone = 'default',
    minTouch,
}: {
    label: string
    onSelect: () => void | Promise<void>
    tone: 'default' | 'primary' | 'danger'
    minTouch: boolean
}) {
    const [loading, setLoading] = React.useState(false)
    const baseClass = cn(
        'inline-flex items-center justify-center gap-2 rounded-(--hp-radius-md) text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--hp-primary)',
        'disabled:cursor-not-allowed disabled:opacity-50',
        minTouch ? 'min-h-[44px] min-w-[44px] px-4' : 'px-3 py-2',
        tone === 'primary' && 'bg-(--hp-primary) text-(--hp-primary-text) hover:bg-(--hp-primary-hover)',
        tone === 'danger' && 'bg-(--hp-danger-action) text-(--hp-danger-action-text) hover:bg-(--hp-danger-action-hover)',
        tone === 'default' && 'border border-(--hp-border) bg-(--hp-surface-0) text-(--hp-text-primary) hover:bg-(--hp-surface-1)',
    )

    return (
        <button
            type="button"
            className={baseClass}
            disabled={loading}
            onClick={async () => {
                setLoading(true)
                try {
                    await onSelect()
                } finally {
                    setLoading(false)
                }
            }}
        >
            {loading ? '…' : label}
        </button>
    )
}

function EmptyStateIllustration() {
    return (
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-(--hp-radius-lg) bg-(--hp-surface-2) text-(--hp-text-tertiary)">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="13 2 13 9 20 9" />
            </svg>
        </div>
    )
}

function ErrorStateIllustration() {
    return (
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-(--hp-radius-lg) bg-(--hp-danger-subtle) text-(--hp-danger)">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
        </div>
    )
}

function OfflineStateIllustration() {
    return (
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-(--hp-radius-lg) bg-(--hp-warning-subtle) text-(--hp-warning)">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="2" y1="2" x2="22" y2="22" />
                <path d="M8.5 16.5a5 5 0 0 1 7 0" />
                <path d="M2 8.82a14.43 14.43 0 0 1 4 2.56" />
                <path d="M5 12.859a10.37 10.37 0 0 1 5.17-2.46" />
            </svg>
        </div>
    )
}

function PermissionStateIllustration() {
    return (
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-(--hp-radius-lg) bg-(--hp-info-subtle) text-(--hp-info)">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        </div>
    )
}

function StaleIndicatorIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    )
}

// --- Utility: construct DataState from common patterns ---

export function loadingState(title?: string): DataState {
    return { status: 'loading', title }
}

export function emptyState(title: string, description?: string, primaryAction?: DataState['primaryAction']): DataState {
    return { status: 'empty', title, description, primaryAction }
}

export function errorState(title: string, description?: string, primaryAction?: DataState['primaryAction']): DataState {
    return { status: 'error', title, description, primaryAction }
}

export function offlineState(title?: string, primaryAction?: DataState['primaryAction']): DataState {
    return { status: 'offline', title: title ?? 'You are offline', primaryAction }
}

export function permissionDeniedState(title?: string, description?: string, primaryAction?: DataState['primaryAction']): DataState {
    return { status: 'permission-denied', title: title ?? 'Access denied', description, primaryAction }
}

export function staleState(title?: string, primaryAction?: DataState['primaryAction']): DataState {
    return { status: 'stale', title, primaryAction }
}
