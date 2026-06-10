import * as React from 'react'
import { cn } from '@/lib/utils'

export type SegmentedOption<T extends string> = {
    value: T
    label: React.ReactNode
}

export function SegmentedControl<T extends string>({
    value,
    options,
    onChange,
    label,
    className,
}: {
    value: T
    options: readonly SegmentedOption<T>[]
    onChange: (value: T) => void
    label: string
    className?: string
}) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={cn('inline-flex rounded-(--hp-radius-md) border border-(--hp-border) bg-(--hp-surface-1) p-1', className)}
        >
            {options.map((option) => {
                const selected = option.value === value
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            'min-h-9 rounded-(--hp-radius-sm) px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--hp-primary)',
                            selected
                                ? 'bg-(--hp-surface-0) text-(--hp-text-primary) shadow-(--hp-shadow-xs)'
                                : 'text-(--hp-text-tertiary) hover:text-(--hp-text-primary)'
                        )}
                    >
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}
