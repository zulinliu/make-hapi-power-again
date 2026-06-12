import * as React from 'react'
import { cn } from '@/lib/utils'
import { useAdaptiveContext } from '@/components/layout/AdaptiveContext'

/**
 * Action tone for visual treatment.
 */
export type ActionTone = 'default' | 'primary' | 'danger' | 'success' | 'warning'

/**
 * Command action descriptor for data-driven components.
 */
export interface CommandAction {
    id: string
    label: string
    description?: string
    icon?: React.ReactNode
    tone?: ActionTone
    shortcut?: string
    disabled?: boolean
    disabledReason?: string
    loading?: boolean
    onSelect: () => void | Promise<void>
}

/**
 * ActionToolbar — horizontal toolbar for page-level actions.
 */
export function ActionToolbar({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn('flex min-h-11 flex-wrap items-center gap-2 px-3 py-2 sm:min-h-10', className)}>
            {children}
        </div>
    )
}

/**
 * BottomCommandBar — data-driven mobile bottom action bar.
 *
 * Features:
 * - Data-driven with primary/secondary/batch actions
 * - env(safe-area-inset-bottom) padding
 * - visualViewport keyboard avoidance
 * - 44px minimum touch targets
 * - Avoidance relationship with Toast / Sheet / Composer
 * - Hidden on desktop by default (visible on touch/mobile)
 */
export function BottomCommandBar({
    visible = true,
    title,
    description,
    primaryAction,
    secondaryActions,
    batchActions,
    safeArea = true,
    avoidKeyboard = true,
    sticky = true,
    className,
}: {
    /** Whether the bar is visible */
    visible?: boolean
    /** Optional title for context */
    title?: string
    /** Optional description */
    description?: string
    /** Primary action (e.g. "Commit", "Sync") */
    primaryAction?: CommandAction
    /** Secondary actions (e.g. "Cancel", "Select All") */
    secondaryActions?: CommandAction[]
    /** Batch actions shown when multiple items selected */
    batchActions?: CommandAction[]
    /** Whether to apply safe-area bottom padding (default: true) */
    safeArea?: boolean
    /** Whether to avoid keyboard (default: true) */
    avoidKeyboard?: boolean
    /** Whether the bar is sticky at bottom (default: true) */
    sticky?: boolean
    /** Additional class name */
    className?: string
}) {
    const adaptive = useAdaptiveContext()
    const [keyboardHeight, setKeyboardHeight] = React.useState(0)

    // Track visual viewport for keyboard avoidance
    React.useEffect(() => {
        if (!avoidKeyboard || !adaptive.isCompact) return
        const vv = window.visualViewport
        if (!vv) return

        function update() {
            if (!window.visualViewport) return
            const offsetBottom = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop)
            setKeyboardHeight(offsetBottom > 80 ? offsetBottom : 0)
        }

        vv.addEventListener('resize', update)
        vv.addEventListener('scroll', update)
        return () => {
            vv.removeEventListener('resize', update)
            vv.removeEventListener('scroll', update)
        }
    }, [avoidKeyboard, adaptive.isCompact])

    if (!visible) return null

    const allActions = [
        ...(batchActions ?? []),
        ...(secondaryActions ?? []),
    ]

    return (
        <div
            className={cn(
                'z-(--hp-z-sticky-footer) flex flex-col gap-1 border-t border-(--hp-divider) bg-(--hp-surface-0) px-3 py-2',
                sticky && 'sticky bottom-0',
                safeArea && 'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
                className,
            )}
            style={keyboardHeight > 0 ? { transform: `translateY(-${keyboardHeight}px)` } : undefined}
            role="toolbar"
            aria-label={title ?? 'Actions'}
        >
            {/* Context line */}
            {title || description ? (
                <div className="flex items-center justify-between px-1">
                    {title ? (
                        <span className="text-xs font-medium text-(--hp-text-secondary)">{title}</span>
                    ) : null}
                    {description ? (
                        <span className="text-xs text-(--hp-text-tertiary)">{description}</span>
                    ) : null}
                </div>
            ) : null}

            {/* Action row */}
            <div className="flex items-center gap-2">
                {allActions.map((action) => (
                    <CommandButton
                        key={action.id}
                        action={action}
                        minTouch={adaptive.isTouch}
                    />
                ))}
                <div className="flex-1" />
                {primaryAction ? (
                    <CommandButton
                        action={primaryAction}
                        minTouch={adaptive.isTouch}
                        primary
                    />
                ) : null}
            </div>
        </div>
    )
}

/**
 * Internal command button with loading, disabled, touch-target support.
 */
function CommandButton({
    action,
    minTouch,
    primary = false,
}: {
    action: CommandAction
    minTouch: boolean
    primary?: boolean
}) {
    const [loading, setLoading] = React.useState(false)

    const isDisabled = action.disabled || loading
    const showLoading = action.loading || loading

    const toneClass = primary
        ? 'bg-(--hp-primary) text-(--hp-primary-text) hover:bg-(--hp-primary-hover) disabled:opacity-50'
        : action.tone === 'danger'
            ? 'border border-(--hp-danger) text-(--hp-danger) hover:bg-(--hp-danger-subtle) disabled:opacity-50'
            : 'border border-(--hp-border) bg-(--hp-surface-0) text-(--hp-text-primary) hover:bg-(--hp-surface-1) disabled:opacity-50'

    return (
        <button
            type="button"
            className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-(--hp-radius-md) text-sm font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--hp-primary)',
                minTouch ? 'min-h-[44px] min-w-[44px] px-3' : 'px-3 py-2',
                toneClass,
            )}
            disabled={isDisabled}
            title={action.disabledReason ?? action.description}
            onClick={async () => {
                setLoading(true)
                try {
                    await action.onSelect()
                } finally {
                    setLoading(false)
                }
            }}
        >
            {action.icon}
            {showLoading ? '…' : action.label}
        </button>
    )
}
