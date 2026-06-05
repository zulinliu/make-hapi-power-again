import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useTranslation } from '@/lib/use-translation'

export function OfflineBanner() {
    const { t } = useTranslation()
    const isOnline = useOnlineStatus()

    if (isOnline) {
        return null
    }

    return (
        <div className="fixed top-0 left-0 right-0 bg-[--hp-danger-subtle] text-[--hp-danger] text-center h-[28px] text-sm font-medium z-50 flex items-center justify-center animate-[fade-in-down_0.3s_var(--hp-ease-default,cubic-bezier(0.4,0,0.2,1))]">
            {t('offline.message')}
        </div>
    )
}
