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
            <DialogContent className="confirm-dialog" style={{ maxWidth: 400 }}>
                {destructive && (
                    <div className="confirm-dialog-danger-strip" aria-hidden="true" />
                )}

                <DialogHeader className={destructive ? 'pt-1' : undefined}>
                    <DialogTitle className="flex items-center gap-3">
                        {destructive && (
                            <span className="confirm-dialog-icon" aria-hidden="true">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Z"
                                        fill="var(--hp-danger-subtle)" stroke="var(--hp-danger)"
                                        strokeWidth="1.5" />
                                    <path d="M12 7v5" stroke="var(--hp-danger)" strokeWidth="2"
                                        strokeLinecap="round" />
                                    <circle cx="12" cy="16.5" r="1.2" fill="var(--hp-danger)" />
                                </svg>
                            </span>
                        )}
                        <span>{title}</span>
                    </DialogTitle>
                    <DialogDescription className="mt-1.5 leading-relaxed">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="confirm-dialog-error">
                        {error}
                    </div>
                )}

                <DialogFooter className={destructive ? 'confirm-dialog-footer-danger' : undefined}>
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
                        {isPending ? (
                            <span className="flex items-center gap-2">
                                <svg className="confirm-dialog-spinner" width="16" height="16"
                                    viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor"
                                        strokeWidth="3" strokeDasharray="31.4 31.4"
                                        strokeLinecap="round" />
                                </svg>
                                {confirmingLabel}
                            </span>
                        ) : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
