import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { useAdaptiveContext } from '@/components/layout/AdaptiveContext'
import {
    useScrollLock,
    useFocusTrap,
    useFocusReturn,
    useInertOthers,
} from '@/hooks/useOverlayBehavior'

export type OverlayKind =
    | 'dialog'
    | 'alert'
    | 'side-panel'
    | 'bottom-sheet'
    | 'full-screen-sheet'
    | 'popover'
    | 'context-menu'
    | 'command-palette'
    | 'preview'

export interface OverlaySurfaceProps {
    /** Whether the overlay is open */
    open: boolean
    /** Callback when open state changes */
    onOpenChange: (open: boolean) => void
    /** Accessible title */
    title: React.ReactNode
    /** Optional description */
    description?: React.ReactNode
    /** Overlay kind — determines visual treatment */
    kind?: OverlayKind
    /** Optional ref for initial focus target inside the overlay */
    initialFocusRef?: React.RefObject<HTMLElement | null>
    /** Optional ref to return focus to after closing */
    returnFocusRef?: React.RefObject<HTMLElement | null>
    /** Whether the overlay can be dismissed by clicking outside or pressing Escape (default: true) */
    dismissible?: boolean
    /** Footer actions */
    footer?: React.ReactNode
    /** Content */
    children: React.ReactNode
    /** Additional class name for the overlay panel */
    className?: string
}

/**
 * Mobile kind mapping:
 * popover/context-menu → bottom-sheet
 * command-palette → full-screen-sheet
 * Other kinds pass through unchanged on mobile
 */
function mapMobileKind(kind: OverlayKind): OverlayKind {
    switch (kind) {
        case 'popover':
        case 'context-menu':
            return 'bottom-sheet'
        case 'command-palette':
            return 'full-screen-sheet'
        default:
            return kind
    }
}

function isAlertDialog(kind: OverlayKind): boolean {
    return kind === 'alert'
}

export function OverlaySurface({
    open,
    onOpenChange,
    title,
    description,
    kind = 'dialog',
    initialFocusRef,
    returnFocusRef,
    dismissible = true,
    footer,
    children,
    className,
}: OverlaySurfaceProps) {
    const adaptive = useAdaptiveContext()
    const contentRef = React.useRef<HTMLDivElement>(null)
    const triggerRef = React.useRef<HTMLElement | null>(null)

    // Resolve effective kind with mobile mapping
    const effectiveKind = adaptive.isCompact ? mapMobileKind(kind) : kind

    // Hooks
    useScrollLock(open)
    useFocusTrap(contentRef, open)
    useInertOthers(contentRef, open)

    // Save trigger element before opening
    React.useEffect(() => {
        if (open && document.activeElement instanceof HTMLElement) {
            triggerRef.current = document.activeElement
        }
    }, [open])

    // Focus return on close
    React.useEffect(() => {
        if (!open) {
            const target = returnFocusRef?.current ?? triggerRef.current
            if (target && target.isConnected) {
                requestAnimationFrame(() => {
                    target.focus({ preventScroll: true })
                })
            }
        }
    }, [open, returnFocusRef])

    // Determine visual treatment
    const isSidePanel = effectiveKind === 'side-panel'
    const isBottomSheet = effectiveKind === 'bottom-sheet' || effectiveKind === 'alert'
    const isFullScreenSheet = effectiveKind === 'full-screen-sheet'
    const isPopoverStyle = effectiveKind === 'popover' || effectiveKind === 'context-menu'

    const role = isAlertDialog(kind) ? 'alertdialog' : 'dialog'

    return (
        <DialogPrimitive.Root
            open={open}
            onOpenChange={(nextOpen) => {
                if (!dismissible && !nextOpen) return
                onOpenChange(nextOpen)
            }}
        >
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
                    ref={contentRef}
                    role={role}
                    className={cn(
                        'fixed z-(--hp-z-modal) flex max-h-[100dvh] flex-col',
                        'border border-(--hp-border) bg-(--hp-surface-0)',
                        'shadow-(--hp-shadow-xl)',
                        'focus:outline-none',
                        'motion-reduce:transition-none',
                        // Default: centered dialog
                        !isSidePanel && !isBottomSheet && !isFullScreenSheet && !isPopoverStyle && cn(
                            'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
                            'w-[calc(100vw-2rem)] max-w-lg',
                            'rounded-(--hp-radius-lg)',
                            'data-[state=open]:animate-in data-[state=closed]:animate-out',
                            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
                            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
                        ),
                        // Side panel: slides from right
                        isSidePanel && cn(
                            'bottom-0 right-0 top-0',
                            'w-full max-w-[420px]',
                            'rounded-none border-y-0 border-r-0',
                            'data-[state=open]:animate-in data-[state=closed]:animate-out',
                            'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
                            'duration-[var(--hp-duration-overlay)]',
                        ),
                        // Bottom sheet: rises from bottom
                        isBottomSheet && cn(
                            'inset-x-0 bottom-0',
                            'max-h-[86dvh]',
                            'rounded-t-(--hp-radius-xl) rounded-b-none',
                            'data-[state=open]:animate-in data-[state=closed]:animate-out',
                            'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
                            'duration-[var(--hp-duration-slow)]',
                            'pb-[max(1rem,env(safe-area-inset-bottom))]',
                        ),
                        // Full screen sheet
                        isFullScreenSheet && cn(
                            'inset-0',
                            'rounded-none border-0',
                            'data-[state=open]:animate-in data-[state=closed]:animate-out',
                            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
                            'data-[state=open]:slide-in-from-bottom-[10%] data-[state=closed]:slide-out-to-bottom-[10%]',
                            'duration-[var(--hp-duration-overlay)]',
                        ),
                        // Popover style: smaller, less padding
                        isPopoverStyle && cn(
                            'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
                            'w-[calc(100vw-2rem)] max-w-xs',
                            'rounded-(--hp-radius-lg)',
                            'data-[state=open]:animate-in data-[state=closed]:animate-out',
                            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
                            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
                        ),
                        className,
                    )}
                    onOpenAutoFocus={(e) => {
                        if (initialFocusRef?.current) {
                            e.preventDefault()
                            initialFocusRef.current.focus()
                        }
                    }}
                    onPointerDownOutside={(e) => {
                        if (!dismissible) {
                            e.preventDefault()
                        }
                    }}
                    onInteractOutside={(e) => {
                        if (!dismissible) {
                            e.preventDefault()
                        }
                    }}
                >
                    {/* Header */}
                    <div className="border-b border-(--hp-divider) px-5 py-4">
                        <DialogPrimitive.Title className="text-base font-semibold text-(--hp-text-primary)">
                            {title}
                        </DialogPrimitive.Title>
                        {description ? (
                            <DialogPrimitive.Description className="mt-1 text-sm leading-relaxed text-(--hp-text-secondary)">
                                {description}
                            </DialogPrimitive.Description>
                        ) : null}
                    </div>

                    {/* Body */}
                    <div className="app-scroll-y min-h-0 flex-1 px-5 py-4">
                        {children}
                    </div>

                    {/* Footer */}
                    {footer ? (
                        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-(--hp-divider) px-5 py-4 sm:flex-row sm:justify-end">
                            {footer}
                        </div>
                    ) : null}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}
