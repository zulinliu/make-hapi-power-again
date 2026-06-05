import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/use-translation'

type ConfirmDialogProps = {
    isOpen: boolean
    onClose: () => void
    title: string
    description: string
    confirmLabel: string
    confirmingLabel: string
    onConfirm: () => Promise<void>
    isPending: boolean
    destructive?: boolean
}

export function ConfirmDialog(props: ConfirmDialogProps) {
    const { t } = useTranslation()
    const {
        isOpen,
        onClose,
        title,
        description,
        confirmLabel,
        confirmingLabel,
        onConfirm,
        isPending,
        destructive = false
    } = props

    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            setError(null)
        }
    }, [isOpen])

    const handleConfirm = async () => {
        setError(null)
        try {
            await onConfirm()
            onClose()
        } catch (err) {
            const message =
                err instanceof Error && err.message
                    ? err.message
                    : t('dialog.error.default')
            setError(message)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && !isPending && onClose()}>
            <DialogContent style={{ maxWidth: '400px' }}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2.5">
                        {destructive && (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                className="shrink-0" style={{ color: 'var(--hp-danger)' }}>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        )}
                        {title}
                    </DialogTitle>
                    <DialogDescription className="mt-1.5">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="mt-3 rounded-[--hp-radius-sm] px-3 py-2 text-sm"
                        style={{ color: 'var(--hp-danger)', background: 'var(--hp-danger-subtle)' }}>
                        {error}
                    </div>
                )}

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isPending}
                        className="min-h-[44px] flex-1 sm:flex-none"
                    >
                        {t('button.cancel')}
                    </Button>
                    <Button
                        type="button"
                        variant={destructive ? 'destructive' : 'default'}
                        onClick={handleConfirm}
                        disabled={isPending}
                        className="min-h-[44px] flex-1 sm:flex-none"
                    >
                        {isPending ? confirmingLabel : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
