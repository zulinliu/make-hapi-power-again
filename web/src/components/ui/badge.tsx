import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
    {
        variants: {
            variant: {
                default: 'border-[var(--hp-border)] bg-[var(--hp-surface-1)] text-[var(--hp-text-primary)]',
                warning: 'border-[var(--app-badge-warning-border)] bg-[var(--hp-warning-subtle)] text-[var(--hp-warning)]',
                success: 'border-[var(--app-badge-success-border)] bg-[var(--hp-success-subtle)] text-[var(--hp-success)]',
                destructive: 'border-[var(--app-badge-error-border)] bg-[var(--hp-danger-subtle)] text-[var(--hp-danger)]',
                subtle: 'border-[var(--hp-border)] bg-[var(--hp-surface-1)] text-[var(--hp-text-secondary)]',
                info: 'border-[var(--hp-info-subtle)] bg-[var(--hp-info-subtle)] text-[var(--hp-info)]'
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
