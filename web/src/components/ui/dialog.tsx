import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger

export const DialogContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => {
    const contentRef = React.useRef<HTMLDivElement | null>(null)

    const setRef = React.useCallback((node: HTMLDivElement | null) => {
        contentRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
    }, [ref])

    React.useEffect(() => {
        function adjust() {
            const el = contentRef.current
            const vv = window.visualViewport
            if (!el || !vv) return
            if (window.innerWidth > 768) return
            const offsetTop = vv.offsetTop
            const visibleHeight = vv.height
            const dialogHeight = el.scrollHeight
            const maxTop = offsetTop + visibleHeight - dialogHeight
            const centered = offsetTop + (visibleHeight - dialogHeight) / 2
            el.style.top = Math.max(offsetTop + 16, Math.min(centered, maxTop)) + 'px'
            el.style.transform = 'translateX(-50%)'
            el.style.maxHeight = (visibleHeight - 32) + 'px'
        }

        adjust()
        window.visualViewport?.addEventListener('resize', adjust)
        window.visualViewport?.addEventListener('scroll', adjust)
        return () => {
            window.visualViewport?.removeEventListener('resize', adjust)
            window.visualViewport?.removeEventListener('scroll', adjust)
        }
    }, [])

    return (
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
            <DialogPrimitive.Content
                ref={setRef}
                className={cn(
                    'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-24px)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[var(--app-dialog-bg)] p-4 shadow-2xl overflow-y-auto overscroll-contain',
                    className
                )}
                {...props}
            />
        </DialogPrimitive.Portal>
    )
})
DialogContent.displayName = 'DialogContent'

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)

export const DialogTitle = React.forwardRef<
    HTMLHeadingElement,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn('text-base font-semibold leading-none tracking-tight', className)}
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
        className={cn('text-sm text-[var(--app-hint)]', className)}
        {...props}
    />
))
DialogDescription.displayName = 'DialogDescription'
