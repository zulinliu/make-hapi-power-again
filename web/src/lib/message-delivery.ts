import type { DecryptedMessage, MessageDeliveryMode } from '@/types/api'

export type GuideMessageStatus = 'requested' | 'fallback-queued' | 'consumed' | 'failed'

export type GuideMessageMeta = {
    requestedAt?: number
    status?: GuideMessageStatus
    fallbackReason?: string
}

export type MessageDeliveryMeta = {
    sentFrom?: string
    deliveryMode?: MessageDeliveryMode
    guide?: GuideMessageMeta
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function parseDeliveryMode(value: unknown): MessageDeliveryMode | undefined {
    return value === 'queue' || value === 'guide' ? value : undefined
}

function parseGuideStatus(value: unknown): GuideMessageStatus | undefined {
    return value === 'requested'
        || value === 'fallback-queued'
        || value === 'consumed'
        || value === 'failed'
        ? value
        : undefined
}

export function getMessageDeliveryMeta(message: DecryptedMessage): MessageDeliveryMeta | null {
    if (!isRecord(message.content)) return null
    const meta = message.content.meta
    if (!isRecord(meta)) return null

    const deliveryMode = parseDeliveryMode(meta.deliveryMode)
    const guide = isRecord(meta.guide)
        ? {
            requestedAt: typeof meta.guide.requestedAt === 'number' ? meta.guide.requestedAt : undefined,
            status: parseGuideStatus(meta.guide.status),
            fallbackReason: typeof meta.guide.fallbackReason === 'string' ? meta.guide.fallbackReason : undefined
        }
        : undefined

    return {
        sentFrom: typeof meta.sentFrom === 'string' ? meta.sentFrom : undefined,
        deliveryMode,
        guide
    }
}

export function isGuideDeliveryMessage(message: DecryptedMessage): boolean {
    return getMessageDeliveryMeta(message)?.deliveryMode === 'guide'
}

export function getGuideMessageStatus(message: DecryptedMessage): GuideMessageStatus | null {
    return getMessageDeliveryMeta(message)?.guide?.status ?? null
}

export function withGuideMessageState(
    message: DecryptedMessage,
    status: GuideMessageStatus,
    fallbackReason?: string
): DecryptedMessage {
    const content = isRecord(message.content) ? message.content : {}
    const previousMeta = isRecord(content.meta) ? content.meta : {}
    const previousGuide = isRecord(previousMeta.guide) ? previousMeta.guide : {}
    const nextGuide = {
        ...previousGuide,
        status,
        ...(fallbackReason ? { fallbackReason } : {})
    }
    const nextMeta = {
        ...previousMeta,
        deliveryMode: 'guide' as const,
        guide: nextGuide
    }
    return {
        ...message,
        content: {
            ...content,
            meta: nextMeta
        }
    }
}
