import * as React from 'react'
import { cn } from '@/lib/utils'

export function InspectorPane({
    title,
    children,
    className,
}: {
    title?: React.ReactNode
    children: React.ReactNode
    className?: string
}) {
    return (
        <aside className={cn('flex h-full min-h-0 flex-col bg-(--hp-surface-0)', className)}>
            {title ? (
                <div className="shrink-0 border-b border-(--hp-divider) px-3 py-2 text-sm font-semibold text-(--hp-text-primary)">
                    {title}
                </div>
            ) : null}
            <div className="app-scroll-y min-h-0 flex-1 p-3">
                {children}
            </div>
        </aside>
    )
}
