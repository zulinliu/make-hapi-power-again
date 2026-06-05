import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const toastVariants = cva(
    'pointer-events-auto w-full max-w-sm rounded-[var(--hp-radius-md,10px)] bg-(--hp-surface-0) text-(--hp-text-primary) shadow-(--hp-shadow-lg) border-l-[3px] animate-fade-in-up',
    {
        variants: {
            variant: {
                default: 'border-(--hp-border) border-l-(--hp-primary)',
                success: 'border-(--hp-border) border-l-(--hp-success)',
                error: 'border-(--hp-border) border-l-(--hp-danger)',
                info: 'border-(--hp-border) border-l-(--hp-info)'
            }
        },
        defaultVariants: {
            variant: 'default'
        }
    }
)

export type ToastProps = React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof toastVariants> & {
    title: string
    body: string
    onClose?: () => void
}

export function Toast({ title, body, onClose, className, variant, ...props }: ToastProps) {
    const handleClose = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
        onClose?.()
    }

    return (
        <div className={cn(toastVariants({ variant }), className)} role="status" {...props}>
            <div className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-5">{title}</div>
                    <div className="mt-1 text-xs text-(--hp-text-secondary)">{body}</div>
                </div>
                {onClose ? (
                    <button
                        type="button"
                        className="text-xs text-(--hp-text-tertiary) hover:text-(--hp-text-primary) transition-colors duration-[var(--hp-duration-fast,120ms)]"
                        onClick={handleClose}
                        aria-label="Dismiss"
                    >
                        x
                    </button>
                ) : null}
            </div>
        </div>
    )
}
