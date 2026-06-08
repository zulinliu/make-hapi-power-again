import type { SyncEvent } from '@/types/api'
import type { CloneProgressEvent } from './git-portal-api'

export type CloneProgressSyncEvent = Omit<Extract<SyncEvent, { type: 'clone-progress' }>, 'data'> & {
    data: CloneProgressEvent
}

const CLONE_PROGRESS_EVENT_NAME = 'hapi:git-portal:clone-progress'

function isCloneProgressData(value: unknown): value is CloneProgressEvent {
    if (!value || typeof value !== 'object') return false
    const data = value as Record<string, unknown>
    return typeof data.cloneId === 'string' && typeof data.phase === 'string'
}

function isCloneProgressSyncEvent(value: unknown): value is CloneProgressSyncEvent {
    if (!value || typeof value !== 'object') return false
    const event = value as Record<string, unknown>
    return event.type === 'clone-progress' && isCloneProgressData(event.data)
}

export function emitCloneProgressEvent(event: unknown): void {
    if (typeof window === 'undefined') return
    if (!isCloneProgressSyncEvent(event)) return
    window.dispatchEvent(new CustomEvent<CloneProgressSyncEvent>(CLONE_PROGRESS_EVENT_NAME, {
        detail: event
    }))
}

export function subscribeCloneProgressEvents(handler: (event: CloneProgressSyncEvent) => void): () => void {
    if (typeof window === 'undefined') return () => {}

    const listener = (event: Event) => {
        if (!(event instanceof CustomEvent)) return
        if (!isCloneProgressSyncEvent(event.detail)) return
        handler(event.detail)
    }

    window.addEventListener(CLONE_PROGRESS_EVENT_NAME, listener)
    return () => window.removeEventListener(CLONE_PROGRESS_EVENT_NAME, listener)
}
