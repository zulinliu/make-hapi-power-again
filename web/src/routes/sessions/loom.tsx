import { useParams } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { useSession } from '@/hooks/queries/useSession'
import { SubPageLayout } from '@/components/ui/SubPageLayout'
import { DataBoundary, loadingState, errorState } from '@/components/ui/DataBoundary'
import { SessionLoomContent } from '@/components/AssistantChat/SessionLoomPanel'
import type { Session } from '@/types/api'

function getSessionLoomTitle(session: Session): string {
    if (session.metadata?.name) {
        return session.metadata.name
    }
    if (session.metadata?.summary?.text) {
        return session.metadata.summary.text
    }
    if (session.metadata?.path) {
        return session.metadata.path
    }
    return session.id.slice(0, 8)
}

export default function LoomPage() {
    const { sessionId } = useParams({ from: '/sessions/$sessionId/loom' })
    const { api } = useAppContext()
    const { t } = useTranslation()
    const { session, isLoading, error } = useSession(api, sessionId)

    // Loading / error states via DataBoundary in a standalone layout
    if (isLoading || !session) {
        const state = isLoading
            ? loadingState(t('loading.session'))
            : errorState(
                t('session.unavailable'),
                error ?? undefined,
                { label: t('common.retry'), onSelect: () => window.location.reload() },
            )
        return (
            <SubPageLayout>
                <DataBoundary state={state}>{() => null}</DataBoundary>
            </SubPageLayout>
        )
    }

    return (
        <SubPageLayout
            toolbar={
                <div className="flex min-w-0 flex-col gap-1">
                    <div className="text-sm font-semibold text-(--hp-text-primary)">{t('sessionLoom.title')}</div>
                    <div className="truncate text-xs text-(--hp-text-secondary)">
                        {session.metadata?.path ?? getSessionLoomTitle(session)}
                    </div>
                </div>
            }
        >
            <SessionLoomContent
                api={api}
                sessionId={sessionId}
                title={getSessionLoomTitle(session)}
                hasMoreMessages={false}
                isLoadingMoreMessages={false}
                className="min-h-[calc(100vh-var(--hp-header-height)-4rem)]"
            />
        </SubPageLayout>
    )
}
