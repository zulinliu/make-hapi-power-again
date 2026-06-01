import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger

const CONFLICT_CLASSES = ['top-1/2', '-translate-y-1/2']

function setupMobileAdjust(el: HTMLDivElement) {
    if (window.innerWidth > 768) return () => {}

    let rafId = 0
    let cleaned = false

    function adjust() {
        if (cleaned) return
        cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(() => {
            if (cleaned) return
            const el = contentRef
            const vv = window.visualViewport
            if (!el || !vv) return

            // Remove CSS classes that conflict with inline positioning
            CONFLICT_CLASSES.forEach(c => {
                if (el.className.includes(c)) el.className = el.className.replace(c, '')
            })

            const offsetTop = vv.offsetTop
            const visibleHeight = vv.height
            const dialogHeight = el.offsetHeight

            if (dialogHeight >= visibleHeight) {
                el.style.top = (offsetTop + 8) + 'px'
                el.style.transform = 'translateX(-50%)'
                el.style.maxHeight = (visibleHeight - 16) + 'px'
                return
            }

            const centered = offsetTop + (visibleHeight - dialogHeight) / 2
            const clamped = Math.max(offsetTop + 8, centered)
            el.style.top = clamped + 'px'
            el.style.transform = 'translateX(-50%)'
            el.style.maxHeight = (visibleHeight - 16) + 'px'
        })
    }

    const contentRef = el

    // Run immediately
    adjust()

    const vv = window.visualViewport
    vv?.addEventListener('resize', adjust)
    vv?.addEventListener('scroll', adjust)
    window.addEventListener('focusin', adjust)

    const ro = new ResizeObserver(adjust)
    ro.observe(el)

    return () => {
        cleaned = true
        cancelAnimationFrame(rafId)
        vv?.removeEventListener('resize', adjust)
        vv?.removeEventListener('scroll', adjust)
        window.removeEventListener('focusin', adjust)
        ro.disconnect()
    }
}

export const DialogContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => {
    const cleanupRef = React.useRef<(() => void) | null>(null)

    const setRef = React.useCallback((node: HTMLDivElement | null) => {
        // Cleanup previous
        cleanupRef.current?.()
        cleanupRef.current = null

        if (node) {
            cleanupRef.current = setupMobileAdjust(node)
        }

        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
    }, [ref])

    React.useEffect(() => () => { cleanupRef.current?.() }, [])

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
