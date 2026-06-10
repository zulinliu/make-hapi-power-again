import * as React from 'react'
import { cn } from '@/lib/utils'

const toneClass = {
    info: 'border-(--hp-info-subtle) bg-(--hp-info-subtle) text-(--hp-text-primary)',
    success: 'border-(--hp-success-subtle) bg-(--hp-success-subtle) text-(--hp-text-primary)',
    warning: 'border-(--hp-warning-subtle) bg-(--hp-warning-subtle) text-(--hp-text-primary)',
    danger: 'border-(--hp-danger-subtle) bg-(--hp-danger-subtle) text-(--hp-danger)',
}

export function Banner({
    tone = 'info',
    title,
    children,
    action,
    className,
}: {
    tone?: keyof typeof toneClass
    title?: React.ReactNode
    children: React.ReactNode
    action?: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn('flex items-start justify-between gap-3 rounded-(--hp-radius-md) border px-3 py-2 text-sm', toneClass[tone], className)}>
            <div className="min-w-0">
                {title ? <div className="font-semibold">{title}</div> : null}
                <div className="leading-relaxed">{children}</div>
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    )
}
