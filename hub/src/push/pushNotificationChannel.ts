import type { Session } from '../sync/syncEngine'
import type { NotificationChannel, TaskNotification } from '../notifications/notificationTypes'
import { getAgentName, getSessionName } from '../notifications/sessionInfo'
import type { SSEManager } from '../sse/sseManager'
import type { VisibilityTracker } from '../visibility/visibilityTracker'
import type { PushPayload, PushService } from './pushService'

interface ToastPayload {
    type: 'toast'
    data: {
        title: string
        body: string
        sessionId: string
        url: string
    }
}

export class PushNotificationChannel implements NotificationChannel {
    constructor(
        private readonly pushService: PushService,
        private readonly sseManager: SSEManager,
        private readonly visibilityTracker: VisibilityTracker,
        _appUrl: string
    ) {}

    async sendPermissionRequest(session: Session): Promise<void> {
        if (!session.active) return

        const name = getSessionName(session)
        const request = session.agentState?.requests
            ? Object.values(session.agentState.requests)[0]
            : null
        const toolName = request?.tool ? ` (${request.tool})` : ''

        await this.sendWithFallback(session.namespace, {
            title: 'Permission Request',
            body: `${name}${toolName}`,
            tag: `permission-${session.id}`,
            data: {
                type: 'permission-request',
                sessionId: session.id,
                url: this.buildSessionPath(session.id)
            }
        })
    }

    async sendReady(session: Session): Promise<void> {
        if (!session.active) return

        const agentName = getAgentName(session)
        const name = getSessionName(session)

        await this.sendWithFallback(session.namespace, {
            title: 'Ready for input',
            body: `${agentName} is waiting in ${name}`,
            tag: `ready-${session.id}`,
            data: {
                type: 'ready',
                sessionId: session.id,
                url: this.buildSessionPath(session.id)
            }
        })
    }

    async sendTaskNotification(session: Session, notification: TaskNotification): Promise<void> {
        if (!session.active) return

        const agentName = getAgentName(session)
        const name = getSessionName(session)
        const normalizedStatus = notification.status?.trim().toLowerCase()
        const isFailure = normalizedStatus === 'failed'
            || normalizedStatus === 'error'
            || normalizedStatus === 'killed'
            || normalizedStatus === 'aborted'

        await this.sendWithFallback(session.namespace, {
            title: isFailure ? 'Task failed' : 'Task completed',
            body: `${agentName} · ${name} · ${notification.summary}`,
            data: {
                type: 'task-notification',
                sessionId: session.id,
                url: this.buildSessionPath(session.id)
            }
        })
    }

    /**
     * Sends a notification via SSE toast when the client is visible, and always
     * sends a Web Push as a fallback. iOS PWA can suspend SSE connections while
     * the app is backgrounded — the visibility state may not update in time,
     * causing notifications to be silently lost if we rely on SSE alone.
     *
     * The notification tag ensures the push replaces itself (no duplicates).
     */
    private async sendWithFallback(namespace: string, payload: PushPayload): Promise<void> {
        const url = payload.data?.url ?? this.buildSessionPath(payload.data?.sessionId ?? '')
        const sseToast: ToastPayload = {
            type: 'toast',
            data: {
                title: payload.title,
                body: payload.body ?? '',
                sessionId: payload.data?.sessionId ?? '',
                url
            }
        }

        const isVisible = this.visibilityTracker.hasVisibleConnection(namespace)
        if (isVisible) {
            // SSE toast for visible clients — fire and don't await
            this.sseManager.sendToast(namespace, sseToast).catch(() => {})
        }

        // Always send Web Push as fallback — iOS PWA needs this because SSE
        // may be suspended even when the server thinks the client is visible.
        await this.pushService.sendToNamespace(namespace, payload)
    }

    private buildSessionPath(sessionId: string): string {
        return `/sessions/${sessionId}`
    }
}
