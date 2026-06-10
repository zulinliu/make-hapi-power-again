import * as React from 'react'
import { cn } from '@/lib/utils'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label: string
    size?: 'sm' | 'md' | 'touch'
    variant?: 'ghost' | 'secondary' | 'primary' | 'danger'
}

const sizeClass = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    touch: 'h-11 w-11',
}

const variantClass = {
    ghost: 'text-(--hp-text-tertiary) hover:bg-(--hp-surface-1) hover:text-(--hp-text-primary)',
    secondary: 'border border-(--hp-border) bg-(--hp-surface-0) text-(--hp-text-primary) hover:bg-(--hp-surface-1)',
    primary: 'bg-(--hp-primary) text-(--hp-primary-text) hover:bg-(--hp-primary-hover)',
    danger: 'bg-(--hp-danger-action) text-(--hp-danger-action-text) hover:bg-(--hp-danger-action-hover)',
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ label, size = 'md', variant = 'ghost', className, children, ...props }, ref) => (
        <button
            ref={ref}
            type="button"
            aria-label={label}
            title={props.title ?? label}
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-(--hp-radius-md) text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--hp-primary) disabled:pointer-events-none disabled:opacity-50',
                sizeClass[size],
                variantClass[variant],
                className
            )}
            {...props}
        >
            {children}
        </button>
    )
)
IconButton.displayName = 'IconButton'
