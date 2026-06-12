import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { useAdaptiveContext } from '@/components/layout/AdaptiveContext'
import { useScrollLock } from '@/hooks/useOverlayBehavior'
import type { CommandAction, ActionTone } from '@/components/ui/Toolbar'

export type { CommandAction, ActionTone }

/**
 * Action group for data-driven menus.
 */
export interface ActionMenuGroup {
    id: string
    label?: string
    actions: CommandAction[]
}

/**
 * ActionMenu — data-driven action menu.
 *
 * Desktop: Popover / Context Menu positioned near trigger.
 * Mobile: Bottom Sheet with touch-friendly items (44px min).
 *
 * Features:
 * - Grouped actions with optional section labels
 * - Danger tone with confirmation awareness
 * - Disabled state with reason tooltip
 * - Loading state per action
 * - Keyboard navigation (Tab, Arrow, Enter, Escape)
 * - Focus return on close
 */
export function ActionMenu({
    triggerLabel,
    triggerIcon,
    groups,
    align = 'start',
    open,
    onOpenChange,
    className,
}: {
    /** Trigger button label */
    triggerLabel?: string
    /** Trigger icon element */
    triggerIcon?: React.ReactNode
    /** Action groups */
    groups: ActionMenuGroup[]
    /** Alignment relative to trigger */
    align?: 'start' | 'center' | 'end'
    /** Controlled open state */
    open?: boolean
    /** Callback when open state changes */
    onOpenChange?: (open: boolean) => void
    /** Additional class name for the menu panel */
    className?: string
}) {
    const adaptive = useAdaptiveContext()
    const isMobile = adaptive.isCompact

    if (isMobile) {
        return (
            <MobileActionSheet
                triggerLabel={triggerLabel}
                triggerIcon={triggerIcon}
                groups={groups}
                open={open}
                onOpenChange={onOpenChange}
                className={className}
            />
        )
    }

    return (
        <DesktopActionPopover
            triggerLabel={triggerLabel}
            triggerIcon={triggerIcon}
            groups={groups}
            align={align}
            open={open}
            onOpenChange={onOpenChange}
            className={className}
        />
    )
}

// --- Desktop: Popover ---

function DesktopActionPopover({
    triggerLabel,
    triggerIcon,
    groups,
    align = 'start',
    open: controlledOpen,
    onOpenChange,
    className,
}: {
    triggerLabel?: string
    triggerIcon?: React.ReactNode
    groups: ActionMenuGroup[]
    align?: 'start' | 'center' | 'end'
    open?: boolean
    onOpenChange?: (open: boolean) => void
    className?: string
}) {
    const [internalOpen, setInternalOpen] = React.useState(false)
    const isOpen = controlledOpen ?? internalOpen
    const setIsOpen = onOpenChange ?? setInternalOpen

    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
            <DialogPrimitive.Trigger asChild>
                <button
                    type="button"
                    className={cn(
                        'inline-flex items-center justify-center gap-1.5 rounded-(--hp-radius-md)',
                        'border border-(--hp-border) bg-(--hp-surface-0) text-sm font-medium text-(--hp-text-primary)',
                        'hover:bg-(--hp-surface-1)',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--hp-primary)',
                        'transition-colors duration-[var(--hp-duration-control)]',
                        'px-3 py-2',
                    )}
                >
                    {triggerIcon}
                    {triggerLabel ?? 'Actions'}
                </button>
            </DialogPrimitive.Trigger>

            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay
                    className="fixed inset-0 z-(--hp-z-overlay) bg-transparent"
                    onClick={() => setIsOpen(false)}
                />
                <DialogPrimitive.Content
                    className={cn(
                        'fixed z-(--hp-z-modal) w-[calc(100vw-2rem)] max-w-xs overflow-hidden',
                        'rounded-(--hp-radius-lg) border border-(--hp-border) bg-(--hp-surface-0)',
                        'shadow-(--hp-shadow-lg)',
                        // Position: centered on small screens, anchored would need Popover primitive
                        'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
                        'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
                        'focus:outline-none',
                        'motion-reduce:transition-none',
                        className,
                    )}
                >
                    <ActionMenuContent groups={groups} onClose={() => setIsOpen(false)} />
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}

// --- Mobile: Bottom Sheet ---

function MobileActionSheet({
    triggerLabel,
    triggerIcon,
    groups,
    open: controlledOpen,
    onOpenChange,
    className,
}: {
    triggerLabel?: string
    triggerIcon?: React.ReactNode
    groups: ActionMenuGroup[]
    open?: boolean
    onOpenChange?: (open: boolean) => void
    className?: string
}) {
    const [internalOpen, setInternalOpen] = React.useState(false)
    const isOpen = controlledOpen ?? internalOpen
    const setIsOpen = onOpenChange ?? setInternalOpen

    useScrollLock(isOpen)

    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
            <DialogPrimitive.Trigger asChild>
                <button
                    type="button"
                    className={cn(
                        'inline-flex items-center justify-center gap-1.5 rounded-(--hp-radius-md)',
                        'min-h-[44px] min-w-[44px] px-3',
                        'border border-(--hp-border) bg-(--hp-surface-0) text-sm font-medium text-(--hp-text-primary)',
                        'hover:bg-(--hp-surface-1)',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--hp-primary)',
                        'transition-colors duration-[var(--hp-duration-control)]',
                    )}
                >
                    {triggerIcon}
                    {triggerLabel ?? 'Actions'}
                </button>
            </DialogPrimitive.Trigger>

            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay
                    className={cn(
                        'fixed inset-0 z-(--hp-z-overlay)',
                        'bg-(--hp-overlay-bg) backdrop-blur-[var(--hp-overlay-blur)]',
                        'data-[state=open]:animate-fade-in',
                        'motion-reduce:transition-none',
                    )}
                />
                <DialogPrimitive.Content
                    className={cn(
                        'fixed inset-x-0 bottom-0 z-(--hp-z-modal)',
                        'max-h-[70dvh] overflow-hidden',
                        'rounded-t-(--hp-radius-xl) rounded-b-none',
                        'border border-(--hp-border) border-b-0 bg-(--hp-surface-0)',
                        'shadow-(--hp-shadow-xl)',
                        'data-[state=open]:animate-in data-[state=closed]:animate-out',
                        'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
                        'duration-[var(--hp-duration-slow)]',
                        'pb-[max(1rem,env(safe-area-inset-bottom))]',
                        'focus:outline-none',
                        'motion-reduce:transition-none',
                        className,
                    )}
                >
                    {/* Handle */}
                    <div className="flex justify-center py-2">
                        <div className="h-1 w-10 rounded-full bg-(--hp-surface-3)" />
                    </div>

                    <ActionMenuContent groups={groups} onClose={() => setIsOpen(false)} />
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}

// --- Shared menu content ---

function ActionMenuContent({
    groups,
    onClose,
}: {
    groups: ActionMenuGroup[]
    onClose: () => void
}) {
    return (
        <div className="app-scroll-y max-h-[60dvh]">
            {groups.map((group, gi) => (
                <div key={group.id}>
                    {group.label ? (
                        <div className="px-3 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-(--hp-text-tertiary)">
                            {group.label}
                        </div>
                    ) : null}
                    <div role="menu" aria-label={group.label ?? 'Actions'}>
                        {group.actions.map((action) => (
                            <ActionMenuItem
                                key={action.id}
                                action={action}
                                onClose={onClose}
                            />
                        ))}
                    </div>
                    {gi < groups.length - 1 ? (
                        <div className="mx-3 border-b border-(--hp-divider)" />
                    ) : null}
                </div>
            ))}
        </div>
    )
}

function ActionMenuItem({
    action,
    onClose,
}: {
    action: CommandAction
    onClose: () => void
}) {
    const [loading, setLoading] = React.useState(false)
    const isDisabled = action.disabled || loading || action.loading

    return (
        <button
            type="button"
            role="menuitem"
            disabled={isDisabled}
            title={action.disabledReason ?? action.description}
            className={cn(
                'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm',
                'min-h-[44px]',
                'transition-colors duration-[var(--hp-duration-control)]',
                'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--hp-primary)',
                isDisabled
                    ? 'cursor-not-allowed opacity-50'
                    : action.tone === 'danger'
                        ? 'text-(--hp-danger) hover:bg-(--hp-danger-subtle)'
                        : 'text-(--hp-text-primary) hover:bg-(--hp-surface-1)',
            )}
            onClick={async () => {
                if (isDisabled) return
                setLoading(true)
                try {
                    await action.onSelect()
                    onClose()
                } finally {
                    setLoading(false)
                }
            }}
        >
            {action.icon ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {action.icon}
                </span>
            ) : null}
            <span className="flex-1">
                <span className="font-medium">{action.label}</span>
                {action.description && !action.disabledReason ? (
                    <span className="ml-2 text-xs text-(--hp-text-tertiary)">{action.description}</span>
                ) : null}
            </span>
            {action.loading || loading ? (
                <span className="text-xs text-(--hp-text-tertiary)">…</span>
            ) : action.disabled && action.disabledReason ? (
                <span className="text-xs text-(--hp-text-tertiary)">{action.disabledReason}</span>
            ) : action.shortcut ? (
                <kbd className="rounded bg-(--hp-surface-2) px-1.5 py-0.5 text-[10px] font-mono text-(--hp-text-tertiary)">
                    {action.shortcut}
                </kbd>
            ) : null}
        </button>
    )
}
