import * as React from 'react'
import { cn } from '@/lib/utils'

export function ActionToolbar({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn('flex min-h-11 flex-wrap items-center gap-2 px-3 py-2 sm:min-h-10', className)}>
            {children}
        </div>
    )
}

export function BottomCommandBar({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <div className={cn('grid grid-flow-col auto-cols-fr gap-2 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden', className)}>
            {children}
        </div>
    )
}
