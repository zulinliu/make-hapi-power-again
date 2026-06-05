import { Spinner } from '@/components/Spinner'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/use-translation'

type LoadingStateProps = {
    label?: string
    className?: string
    spinnerSize?: 'sm' | 'md' | 'lg'
    /** Show a shimmer skeleton placeholder instead of a spinner */
    skeleton?: boolean
}

function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-3 w-full max-w-xs mx-auto p-4" role="status" aria-live="polite">
            <div className="skeleton-shimmer h-4 w-3/4 rounded" />
            <div className="skeleton-shimmer h-3 w-full rounded" />
            <div className="skeleton-shimmer h-3 w-5/6 rounded" />
        </div>
    )
}

export function LoadingState({
    label,
    className,
    spinnerSize = 'md',
    skeleton = false
}: LoadingStateProps) {
    const { t } = useTranslation()
    const displayLabel = label ?? t('loading')

    if (skeleton) {
        return <LoadingSkeleton />
    }

    return (
        <div
            className={cn('inline-flex items-center gap-2 text-[var(--app-hint)]', className)}
            role="status"
            aria-live="polite"
        >
            <Spinner size={spinnerSize} label={null} />
            <span>{displayLabel}</span>
        </div>
    )
}
