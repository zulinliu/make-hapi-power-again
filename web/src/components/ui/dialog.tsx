import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger

export const DialogContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
            <div className="min-h-[100dvh] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
                <DialogPrimitive.Content
                    ref={ref}
                    className={cn(
                        'pointer-events-auto w-full sm:max-w-lg max-h-[85dvh] sm:max-h-[calc(100dvh_-_32px)] overflow-y-auto',
                        'rounded-t-2xl sm:rounded-xl bg-[var(--app-dialog-bg)] p-5 sm:p-4',
                        'shadow-2xl overscroll-contain',
                        'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
                        className
                    )}
                    {...props}
                />
            </div>
        </div>
    </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'

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
    <div className={cn('flex gap-3 justify-end pt-4', className)} {...props} />
)
