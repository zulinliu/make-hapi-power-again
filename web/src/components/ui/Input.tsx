import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    invalid?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, invalid = false, ...props }, ref) => (
        <input
            ref={ref}
            className={cn(
                'min-h-11 w-full rounded-(--hp-radius-md) border bg-(--hp-surface-0) px-3 text-base text-(--hp-text-primary) outline-none transition-colors placeholder:text-(--hp-text-tertiary) focus:border-(--hp-primary) focus:ring-2 focus:ring-(--hp-primary)/25 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-9 sm:text-sm',
                invalid ? 'border-(--hp-danger) bg-(--hp-danger-subtle)' : 'border-(--hp-border)',
                className
            )}
            aria-invalid={invalid || props['aria-invalid']}
            {...props}
        />
    )
)
Input.displayName = 'Input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    invalid?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, invalid = false, ...props }, ref) => (
        <textarea
            ref={ref}
            className={cn(
                'min-h-24 w-full rounded-(--hp-radius-md) border bg-(--hp-surface-0) px-3 py-2 text-base leading-relaxed text-(--hp-text-primary) outline-none transition-colors placeholder:text-(--hp-text-tertiary) focus:border-(--hp-primary) focus:ring-2 focus:ring-(--hp-primary)/25 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm',
                invalid ? 'border-(--hp-danger) bg-(--hp-danger-subtle)' : 'border-(--hp-border)',
                className
            )}
            aria-invalid={invalid || props['aria-invalid']}
            {...props}
        />
    )
)
Textarea.displayName = 'Textarea'
