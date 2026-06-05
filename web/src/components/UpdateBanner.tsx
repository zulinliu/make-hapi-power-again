import { useSWUpdate } from '@/hooks/useSWUpdate'
import { useTranslation } from '@/lib/use-translation'

declare const __APP_VERSION__: string

export function UpdateBanner() {
    const { t } = useTranslation()
    const { updateAvailable, applying, applyUpdate } = useSWUpdate()

    if (!updateAvailable) {
        return null
    }

    return (
        <div className="fixed top-0 left-0 right-0 bg-[--hp-success-subtle] text-[--hp-success] text-center h-[28px] text-sm font-medium z-50 flex items-center justify-center gap-3 animate-[fade-in-down_0.3s_var(--hp-ease-default,cubic-bezier(0.4,0,0.2,1))]">
            <span>
                {t('update.available', { version: __APP_VERSION__ })}
            </span>
            <button
                onClick={applyUpdate}
                disabled={applying}
                className="px-3 py-1 bg-[--hp-success]/20 hover:bg-[--hp-success]/30 rounded text-xs font-semibold active:opacity-80 transition-colors disabled:opacity-50"
            >
                {applying ? t('update.applying') : t('update.button')}
            </button>
        </div>
    )
}
