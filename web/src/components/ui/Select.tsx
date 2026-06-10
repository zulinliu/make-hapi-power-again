import * as React from 'react'
import { cn } from '@/lib/utils'

type SelectValue = string | number

export interface SelectOption<T extends SelectValue> {
    value: T
    label: React.ReactNode
    description?: React.ReactNode
}

export function Select<T extends SelectValue>({
    label,
    value,
    options,
    onChange,
    className,
    disabled,
}: {
    label: string
    value: T
    options: readonly SelectOption<T>[]
    onChange: (value: T) => void
    className?: string
    disabled?: boolean
}) {
    const optionByStringValue = React.useMemo(() => {
        return new Map(options.map((option) => [String(option.value), option.value]))
    }, [options])

    return (
        <label className={cn('grid gap-1.5 text-sm text-(--hp-text-primary)', className)}>
            <span className="font-medium">{label}</span>
            <select
                value={String(value)}
                disabled={disabled}
                onChange={(event) => {
                    const nextValue = optionByStringValue.get(event.target.value)
                    if (nextValue !== undefined) {
                        onChange(nextValue)
                    }
                }}
                className="min-h-11 rounded-(--hp-radius-md) border border-(--hp-border) bg-(--hp-surface-0) px-3 text-base text-(--hp-text-primary) outline-none transition-colors focus:border-(--hp-primary) focus:ring-2 focus:ring-(--hp-primary)/25 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-9 sm:text-sm"
            >
                {options.map((option) => (
                    <option key={String(option.value)} value={String(option.value)}>
                        {typeof option.label === 'string' ? option.label : option.value}
                    </option>
                ))}
            </select>
        </label>
    )
}
