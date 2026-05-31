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
        <div className="fixed top-0 left-0 right-0 bg-accent text-white text-center py-2 text-sm font-medium z-50 flex items-center justify-center gap-3">
            <span>
                {t('update.available', { version: __APP_VERSION__ })}
            </span>
            <button
                onClick={applyUpdate}
                disabled={applying}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold active:opacity-80 transition-colors disabled:opacity-50"
            >
                {applying ? t('update.applying') : t('update.button')}
            </button>
        </div>
    )
}
