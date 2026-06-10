import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import { useAdaptiveContext } from '@/components/layout/AdaptiveContext'

export type OverlayKind = 'dialog' | 'alert' | 'sheet' | 'sidePanel' | 'popover'

export function OverlaySurface({
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
    kind = 'dialog',
    className,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: React.ReactNode
    description?: React.ReactNode
    children: React.ReactNode
    footer?: React.ReactNode
    kind?: OverlayKind
    className?: string
}) {
    const adaptive = useAdaptiveContext()
    const compactSheet = adaptive.isCompact || kind === 'sheet'
    const sidePanel = !adaptive.isCompact && kind === 'sidePanel'
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-(--hp-z-overlay) bg-(--hp-overlay-bg) backdrop-blur-[var(--hp-overlay-blur)] data-[state=open]:animate-fade-in" />
                <DialogPrimitive.Content
                    className={cn(
                        'fixed z-(--hp-z-modal) flex max-h-[100dvh] flex-col border border-(--hp-border) bg-(--hp-surface-0) shadow-(--hp-shadow-xl) focus:outline-none motion-reduce:transition-none',
                        compactSheet
                            ? 'inset-x-0 bottom-0 max-h-[86dvh] rounded-t-(--hp-radius-lg) p-0'
                            : sidePanel
                                ? 'bottom-0 right-0 top-0 w-full max-w-[420px] rounded-none border-y-0 border-r-0'
                                : 'left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-(--hp-radius-lg)',
                        className
                    )}
                >
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
                    <div className="app-scroll-y min-h-0 flex-1 px-5 py-4">
                        {children}
                    </div>
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
