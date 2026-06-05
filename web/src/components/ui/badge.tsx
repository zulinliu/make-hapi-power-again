import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
    {
        variants: {
            variant: {
                default: 'border-(--hp-border) bg-(--hp-surface-1) text-(--hp-text-primary)',
                warning: 'border-[var(--app-badge-warning-border)] bg-(--hp-warning-subtle) text-(--hp-warning)',
                success: 'border-[var(--app-badge-success-border)] bg-(--hp-success-subtle) text-(--hp-success)',
                destructive: 'border-[var(--app-badge-error-border)] bg-(--hp-danger-subtle) text-(--hp-danger)',
                subtle: 'border-(--hp-border) bg-(--hp-surface-1) text-(--hp-text-secondary)',
                info: 'border-(--hp-info-subtle) bg-(--hp-info-subtle) text-(--hp-info)'
            }
        },
        defaultVariants: {
            variant: 'default'
        }
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
