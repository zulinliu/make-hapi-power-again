import * as React from 'react'
import { cn } from '@/lib/utils'
import { useAdaptiveContext } from './AdaptiveContext'

export function SessionWorkspace({
    header,
    children,
    inspector,
    bottomBar,
    className,
}: {
    header?: React.ReactNode
    children: React.ReactNode
    inspector?: React.ReactNode
    bottomBar?: React.ReactNode
    className?: string
}) {
    const adaptive = useAdaptiveContext()
    const showInspector = adaptive.shellMode === 'workspace' && Boolean(inspector)
    return (
        <section
            className={cn(
                'grid h-full min-h-0 bg-(--hp-canvas)',
                showInspector ? 'grid-cols-[minmax(0,1fr)_minmax(280px,340px)]' : 'grid-cols-1',
                className
            )}
        >
            <div className="flex min-h-0 min-w-0 flex-col">
                {header ? <div className="shrink-0">{header}</div> : null}
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
                {bottomBar ? (
                    <div className="shrink-0 border-t border-(--hp-divider) bg-(--hp-surface-0) pb-[env(safe-area-inset-bottom)] md:hidden">
                        {bottomBar}
                    </div>
                ) : null}
            </div>
            {showInspector ? (
                <aside className="min-h-0 overflow-auto border-l border-(--hp-divider) bg-(--hp-surface-0)">
                    {inspector}
                </aside>
            ) : null}
        </section>
    )
}
