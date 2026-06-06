import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger

export const DialogContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => {
    const handleOpenAutoFocus = React.useCallback((e: Event) => {
        // Prevent Radix from auto-focusing inputs inside dialog on mobile,
        // which can trigger iOS zoom and virtual keyboard before user interaction.
        e.preventDefault()
    }, [])

    return (
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in" style={{ background: 'var(--app-overlay-bg)', backdropFilter: 'blur(var(--app-overlay-blur))', WebkitBackdropFilter: 'blur(var(--app-overlay-blur))' }} />
            <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain dialog-container-ios-safe">
                <div className="min-h-[100dvh] flex items-start sm:items-center justify-center p-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-4 pointer-events-none">
                    <DialogPrimitive.Content
                        ref={ref}
                        className={cn(
                            'pointer-events-auto animate-scale-in relative w-full sm:max-w-lg max-h-[85dvh] sm:max-h-[calc(100dvh_-_32px)] overflow-y-auto',
                            'p-5 sm:p-6 overscroll-contain',
                            className
                        )}
                        style={{
                            borderRadius: 'var(--hp-radius-lg)',
                            background: 'var(--app-dialog-bg)',
                            boxShadow: 'var(--hp-shadow-xl)',
                        }}
                        onOpenAutoFocus={handleOpenAutoFocus}
                        {...props}
                    />
                </div>
            </div>
        </DialogPrimitive.Portal>
    )
})
DialogContent.displayName = 'DialogContent'

export const DialogClose = DialogPrimitive.Close

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />
)

export const DialogTitle = React.forwardRef<
    HTMLHeadingElement,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn('text-base font-semibold leading-tight text-[var(--app-fg)]', className)}
        {...props}
    />
))
DialogTitle.displayName = 'DialogTitle'

export const DialogDescription = React.forwardRef<
    HTMLParagraphElement,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn('text-sm leading-relaxed text-[var(--app-hint)]', className)}
        {...props}
    />
))
DialogDescription.displayName = 'DialogDescription'

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('flex gap-3 justify-end pt-5', className)} {...props} />
)
