import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { Spinner } from '@/components/Spinner'
import { useTranslation } from '@/lib/use-translation'

export function SyncingBanner({ isSyncing }: { isSyncing: boolean }) {
    const { t } = useTranslation()
    const isOnline = useOnlineStatus()

    // Don't show syncing banner when offline (OfflineBanner takes precedence)
    if (!isSyncing || !isOnline) {
        return null
    }

    return (
        <div className="fixed top-0 left-0 right-0 bg-[var(--hp-primary-subtle)] text-[var(--hp-primary)] text-center h-[28px] text-sm font-medium z-50 flex items-center justify-center gap-2 border-b border-[var(--hp-divider)] animate-[fade-in-down_0.3s_var(--hp-ease-default,cubic-bezier(0.4,0,0.2,1))]">
            <Spinner size="sm" label={null} className="text-[var(--hp-primary)]" />
            {t('syncing.title')}
        </div>
    )
}
