import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
    'inline-flex items-center justify-center whitespace-nowrap rounded-[var(--hp-radius-md,10px)] text-sm font-medium transition-all duration-[var(--hp-duration-fast,120ms)] ease-[var(--hp-ease-default,cubic-bezier(0.4,0,0.2,1))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hp-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--hp-surface-0,white)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default:
                    'bg-[var(--app-button)] text-[var(--app-button-text)] hover:bg-[var(--hp-primary-hover)]',
                secondary:
                    'bg-[var(--app-secondary-bg)] text-[var(--app-fg)] hover:bg-[var(--hp-surface-2)]',
                outline:
                    'border border-[var(--app-border)] bg-transparent hover:bg-[var(--hp-surface-1)] hover:border-[var(--hp-border-hover)]',
                destructive:
                    'bg-[var(--app-danger)] text-[var(--hp-text-inverse)] hover:bg-[var(--hp-danger)] hover:opacity-90',
                ghost:
                    'bg-transparent text-[var(--app-fg)] hover:bg-[var(--hp-surface-1)]'
            },
            size: {
                default: 'h-9 px-4 py-2',
                sm: 'h-8 rounded-[var(--hp-radius-sm,6px)] px-3',
                lg: 'h-10 rounded-[var(--hp-radius-md,10px)] px-8'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'default'
        }
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button'
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = 'Button'
