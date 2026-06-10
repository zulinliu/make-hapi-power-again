import * as React from 'react'
import { cn } from '@/lib/utils'

export function PageScaffold({
    header,
    children,
    footer,
    className,
}: {
    header?: React.ReactNode
    children: React.ReactNode
    footer?: React.ReactNode
    className?: string
}) {
    return (
        <section className={cn('flex h-full min-h-0 flex-col bg-(--hp-canvas)', className)}>
            {header ? (
                <div className="shrink-0 border-b border-(--hp-divider) bg-(--hp-surface-0)">
                    {header}
                </div>
            ) : null}
            <div className="app-scroll-y min-h-0 flex-1">
                {children}
            </div>
            {footer ? (
                <div className="shrink-0 border-t border-(--hp-divider) bg-(--hp-surface-0)">
                    {footer}
                </div>
            ) : null}
        </section>
    )
}

export function ModulePage({
    title,
    description,
    actions,
    children,
}: {
    title: React.ReactNode
    description?: React.ReactNode
    actions?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <PageScaffold
            header={(
                <div className="mx-auto flex min-h-14 w-full max-w-content items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                        <h1 className="truncate text-base font-semibold leading-tight text-(--hp-text-primary)">
                            {title}
                        </h1>
                        {description ? (
                            <div className="truncate text-sm text-(--hp-text-tertiary)">
                                {description}
                            </div>
                        ) : null}
                    </div>
                    {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
                </div>
            )}
        >
            <div className="mx-auto w-full max-w-content p-3">
                {children}
            </div>
        </PageScaffold>
    )
}
