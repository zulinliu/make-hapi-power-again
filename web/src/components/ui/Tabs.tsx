import * as React from 'react'
import { cn } from '@/lib/utils'

export type TabItem<T extends string> = {
    value: T
    label: React.ReactNode
}

export function Tabs<T extends string>({
    value,
    items,
    onChange,
    label,
    className,
}: {
    value: T
    items: readonly TabItem<T>[]
    onChange: (value: T) => void
    label: string
    className?: string
}) {
    return (
        <div role="tablist" aria-label={label} className={cn('flex gap-1 border-b border-(--hp-divider)', className)}>
            {items.map((item) => {
                const selected = item.value === value
                return (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onChange(item.value)}
                        className={cn(
                            'relative min-h-11 px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--hp-primary) sm:min-h-9',
                            selected
                                ? 'text-(--hp-text-primary)'
                                : 'text-(--hp-text-tertiary) hover:text-(--hp-text-primary)'
                        )}
                    >
                        {item.label}
                        {selected ? <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-(--hp-primary)" /> : null}
                    </button>
                )
            })}
        </div>
    )
}
