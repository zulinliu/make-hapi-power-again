import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/Spinner'
import { useTranslation } from '@/lib/use-translation'

export function ActionButtons(props: {
    isPending: boolean
    canCreate: boolean
    isDisabled: boolean
    createLabel?: string
    onCancel: () => void
    onCreate: () => void
}) {
    const { t } = useTranslation()

    return (
        <div className="sticky bottom-0 z-10 border-t border-(--hp-border) bg-(--hp-surface-0) px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
            <div className="flex gap-2">
                <Button
                    variant="secondary"
                    onClick={props.onCancel}
                    disabled={props.isDisabled}
                    className="flex-1"
                >
                    {t('button.cancel')}
                </Button>
                <Button
                    onClick={props.onCreate}
                    disabled={!props.canCreate}
                    aria-busy={props.isPending}
                    className="gap-2 flex-1"
                >
                    {props.isPending ? (
                        <>
                            <Spinner size="sm" label={null} className="text-(--hp-primary-text)" />
                            {t('newSession.creating')}
                        </>
                    ) : (
                        (props.createLabel ?? t('newSession.create'))
                    )}
                </Button>
            </div>
        </div>
    )
}
