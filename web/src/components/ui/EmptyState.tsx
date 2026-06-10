import * as React from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
    title,
    description,
    action,
    className,
}: {
    title: React.ReactNode
    description?: React.ReactNode
    action?: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn('grid min-h-64 place-items-center rounded-(--hp-radius-lg) border border-dashed border-(--hp-border) bg-(--hp-surface-0) p-6 text-center', className)}>
            <div className="max-w-sm">
                <div className="text-base font-semibold text-(--hp-text-primary)">{title}</div>
                {description ? <div className="mt-2 text-sm leading-relaxed text-(--hp-text-secondary)">{description}</div> : null}
                {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
            </div>
        </div>
    )
}
