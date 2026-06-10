import * as React from 'react'
import { cn } from '@/lib/utils'
import { useAdaptiveContext } from './AdaptiveContext'

export function WorkbenchShell({
    sidebar,
    children,
    inspector,
    className,
}: {
    sidebar?: React.ReactNode
    children: React.ReactNode
    inspector?: React.ReactNode
    className?: string
}) {
    const adaptive = useAdaptiveContext()
    const showSidebar = adaptive.shellMode !== 'stack' && Boolean(sidebar)
    const showInspector = adaptive.shellMode === 'workspace' && Boolean(inspector)
    return (
        <div
            className={cn(
                'grid h-full min-h-0 bg-(--hp-canvas)',
                showSidebar && showInspector
                    ? 'grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(280px,340px)]'
                    : showSidebar
                        ? 'grid-cols-[minmax(240px,280px)_minmax(0,1fr)]'
                        : 'grid-cols-1',
                className
            )}
        >
            {showSidebar ? (
                <aside className="min-h-0 overflow-hidden border-r border-(--hp-divider) bg-(--hp-surface-0)">
                    {sidebar}
                </aside>
            ) : null}
            <main className="min-h-0 min-w-0 overflow-hidden">
                {children}
            </main>
            {showInspector ? (
                <aside className="min-h-0 overflow-hidden border-l border-(--hp-divider) bg-(--hp-surface-0)">
                    {inspector}
                </aside>
            ) : null}
        </div>
    )
}
