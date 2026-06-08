import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import type { ApiClient } from '@/api/client'
import type { AttachmentMetadata, DecryptedMessage, MessageDeliveryMode, MessageStatus } from '@/types/api'
import { makeClientSideId } from '@/lib/messages'
import {
    appendOptimisticMessage,
    getMessageWindowState,
    updateMessageStatus,
} from '@/lib/message-window-store'
import { usePlatform } from '@/hooks/usePlatform'

type SendMessageInput = {
    sessionId: string
    text: string
    localId: string
    createdAt: number
    attachments?: AttachmentMetadata[]
    scheduledAt?: number | null
    deliveryMode?: MessageDeliveryMode
}

type BlockedReason = 'no-api' | 'no-session' | 'pending'

type UseSendMessageOptions = {
    resolveSessionId?: (sessionId: string) => Promise<string>
    onSessionResolved?: (sessionId: string) => void
    onBlocked?: (reason: BlockedReason) => void
    onSuccess?: (sessionId: string) => void
    isSessionThinking?: boolean
}

/** Create an optimistic message for display. Extracted as an extension point
 *  so a future floating-UI PR can route queued messages to a separate area. */
function createOptimisticMessage(input: SendMessageInput, status: MessageStatus): DecryptedMessage {
    const deliveryMode = input.deliveryMode ?? 'queue'
    return {
        id: input.localId,
        seq: null,
        localId: input.localId,
        content: {
            role: 'user',
            content: {
                type: 'text',
                text: input.text,
                attachments: input.attachments
            },
            meta: {
                sentFrom: 'webapp',
                deliveryMode,
                ...(deliveryMode === 'guide'
                    ? {
                        guide: {
                            requestedAt: input.createdAt,
                            status: 'requested'
                        }
                    }
                    : {})
            }
        },
        createdAt: input.createdAt,
        // Explicit null so the strict-null queued check matches. A pre-V8 hub
        // response that omits the field entirely (`undefined`) is treated as
        // already-invoked and stays in the thread, not the floating bar.
        invokedAt: null,
        scheduledAt: input.scheduledAt ?? null,
        status,
        originalText: input.text,
    }
}

function findMessageByLocalId(
    sessionId: string,
    localId: string,
): DecryptedMessage | null {
    const state = getMessageWindowState(sessionId)
    for (const message of state.messages) {
        if (message.localId === localId) return message
    }
    for (const message of state.pending) {
        if (message.localId === localId) return message
    }
    return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function getRetryDeliveryMode(message: DecryptedMessage): MessageDeliveryMode | undefined {
    const content = message.content
    if (!isRecord(content)) return undefined
    const meta = content.meta
    if (!isRecord(meta)) return undefined
    const deliveryMode = meta.deliveryMode
    return deliveryMode === 'guide' || deliveryMode === 'queue' ? deliveryMode : undefined
}

function isAttachmentMetadata(value: unknown): value is AttachmentMetadata {
    if (!isRecord(value)) return false
    return typeof value.id === 'string'
        && typeof value.filename === 'string'
        && typeof value.mimeType === 'string'
        && typeof value.size === 'number'
        && typeof value.path === 'string'
        && (value.previewUrl === undefined || typeof value.previewUrl === 'string')
}

function getRetryAttachments(message: DecryptedMessage): AttachmentMetadata[] | undefined {
    const content = message.content
    if (!isRecord(content)) return undefined
    const payload = content.content
    if (!isRecord(payload)) return undefined
    const attachments = payload.attachments
    if (!Array.isArray(attachments)) return undefined
    const parsed = attachments.filter(isAttachmentMetadata)
    return parsed.length > 0 && parsed.length === attachments.length ? parsed : undefined
}

export function useSendMessage(
    api: ApiClient | null,
    sessionId: string | null,
    options?: UseSendMessageOptions
): {
    // Resolves true when a mutation was actually started, false when the call was
    // rejected pre-mutation (no-api / no-session / pending) OR the async
    // resolveSessionId step threw. Async is required because inactive-session
    // resume happens before mutation.mutate(), and a sync `true` would let the
    // caller clear UI state (e.g. pendingSchedule) before knowing whether
    // resume succeeded — see SessionChat.handleSend.
    sendMessage: (text: string, attachments?: AttachmentMetadata[], scheduledAt?: number | null, deliveryMode?: MessageDeliveryMode) => Promise<boolean>
    retryMessage: (localId: string) => boolean
    isSending: boolean
} {
    const { haptic } = usePlatform()
    const [isResolving, setIsResolving] = useState(false)
    const resolveGuardRef = useRef(false)
    const isSessionThinkingRef = useRef(options?.isSessionThinking ?? false)
    isSessionThinkingRef.current = options?.isSessionThinking ?? false

    const mutation = useMutation({
        mutationFn: async (input: SendMessageInput) => {
            if (!api) {
                throw new Error('API unavailable')
            }
            await api.sendMessage(input.sessionId, input.text, input.localId, input.attachments, input.scheduledAt, input.deliveryMode)
        },
        onMutate: async (input) => {
            const status: MessageStatus = input.deliveryMode === 'guide'
                ? 'guiding'
                : isSessionThinkingRef.current
                    ? 'queued'
                    : 'sending'
            appendOptimisticMessage(input.sessionId, createOptimisticMessage(input, status))
            return { status }
        },
        onSuccess: (_, input, context) => {
            updateMessageStatus(
                input.sessionId,
                input.localId,
                input.deliveryMode === 'guide'
                    ? 'guiding'
                    : context?.status === 'queued'
                        ? 'queued'
                        : 'sent'
            )
            haptic.notification('success')
            options?.onSuccess?.(input.sessionId)
        },
        onError: (_, input) => {
            updateMessageStatus(input.sessionId, input.localId, 'failed')
            haptic.notification('error')
        },
    })

    const sendMessage = async (
        text: string,
        attachments?: AttachmentMetadata[],
        scheduledAt?: number | null,
        deliveryMode?: MessageDeliveryMode
    ): Promise<boolean> => {
        if (!api) {
            options?.onBlocked?.('no-api')
            haptic.notification('error')
            return false
        }
        if (!sessionId) {
            options?.onBlocked?.('no-session')
            haptic.notification('error')
            return false
        }
        if (mutation.isPending || resolveGuardRef.current) {
            options?.onBlocked?.('pending')
            return false
        }
        const localId = makeClientSideId('local')
        const createdAt = Date.now()
        let targetSessionId = sessionId
        if (options?.resolveSessionId) {
            resolveGuardRef.current = true
            setIsResolving(true)
            try {
                const resolved = await options.resolveSessionId(sessionId)
                if (resolved && resolved !== sessionId) {
                    options.onSessionResolved?.(resolved)
                    targetSessionId = resolved
                }
            } catch (error) {
                haptic.notification('error')
                console.error('Failed to resolve session before send:', error)
                return false
            } finally {
                resolveGuardRef.current = false
                setIsResolving(false)
            }
        }
        mutation.mutate({
            sessionId: targetSessionId,
            text,
            localId,
            createdAt,
            attachments,
            scheduledAt,
            deliveryMode,
        })
        return true
    }

    const retryMessage = (localId: string): boolean => {
        if (!api) {
            options?.onBlocked?.('no-api')
            haptic.notification('error')
            return false
        }
        if (!sessionId) {
            options?.onBlocked?.('no-session')
            haptic.notification('error')
            return false
        }
        if (mutation.isPending || resolveGuardRef.current) {
            options?.onBlocked?.('pending')
            return false
        }

        const message = findMessageByLocalId(sessionId, localId)
        if (!message?.originalText) return false

        const deliveryMode = getRetryDeliveryMode(message)
        const attachments = getRetryAttachments(message)

        updateMessageStatus(sessionId, localId, deliveryMode === 'guide' ? 'guiding' : 'sending')

        mutation.mutate({
            sessionId,
            text: message.originalText,
            localId,
            createdAt: message.createdAt,
            attachments,
            scheduledAt: message.scheduledAt ?? null,
            deliveryMode,
        })
        return true
    }

    return {
        sendMessage,
        retryMessage,
        isSending: mutation.isPending || isResolving,
    }
}
