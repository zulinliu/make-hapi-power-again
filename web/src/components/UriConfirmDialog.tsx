import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/use-translation'

export type UriConfirmDialogProps = {
    /** Whether the dialog is visible. */
    open: boolean
    /** The full URL being navigated to. */
    url: string
    /** The scheme portion of the URL (without the colon), e.g. "obsidian". */
    scheme: string
    /** Called when the user dismisses the dialog without navigating. */
    onCancel: () => void
    /** Called when the user chooses to open the link once. */
    onOpen: () => void
    /** Called when the user chooses to always allow this scheme. */
    onAlwaysAllow: (scheme: string) => void
}

/**
 * Confirmation dialog shown before navigating to a non-IANA URI scheme.
 * Follows the RenameSessionDialog pattern (Radix Dialog + Button + i18n).
 */
export function UriConfirmDialog(props: UriConfirmDialogProps) {
    const { open, url, scheme, onCancel, onOpen, onAlwaysAllow } = props
    const { t } = useTranslation()

    // Split URL into scheme prefix and the rest for visual emphasis.
    const schemePrefix = `${scheme}:`
    const urlRemainder = url.startsWith(schemePrefix) ? url.slice(schemePrefix.length) : url

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('dialog.uri.title')}</DialogTitle>
                </DialogHeader>
                <DialogDescription className="mt-2 flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 mt-0.5 text-[var(--hp-warning)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>{t('dialog.uri.description')}</span>
                </DialogDescription>

                {/* URI display with scheme emphasis */}
                <div className="mt-3 rounded-lg border border-[var(--hp-border)] bg-[var(--hp-surface-1)] px-3 py-2 font-mono text-sm break-all">
                    <span className="font-semibold text-[var(--hp-primary)]">{schemePrefix}</span>
                    <span className="text-[var(--hp-text-secondary)]">{urlRemainder}</span>
                </div>

                <div className="mt-4 flex gap-2 justify-end flex-wrap">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onCancel}
                    >
                        {t('button.cancel')}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onAlwaysAllow(scheme)}
                    >
                        {t('dialog.uri.alwaysAllow', { scheme })}
                    </Button>
                    <Button
                        type="button"
                        onClick={onOpen}
                    >
                        {t('dialog.uri.open')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
