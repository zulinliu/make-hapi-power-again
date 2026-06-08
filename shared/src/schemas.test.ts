import { describe, expect, test } from 'bun:test'
import { SessionCapabilitiesSchema, SyncEventSchema } from './schemas'

describe('SessionCapabilitiesSchema guideInterrupt', () => {
    test('accepts guide capability handshake fields', () => {
        const parsed = SessionCapabilitiesSchema.parse({
            guideInterrupt: {
                supported: true,
                preservesQueue: true,
                isolatedDelivery: true,
                version: 1
            }
        })

        expect(parsed.guideInterrupt?.supported).toBe(true)
        expect(parsed.guideInterrupt?.preservesQueue).toBe(true)
        expect(parsed.guideInterrupt?.isolatedDelivery).toBe(true)
    })
})

describe('SyncEventSchema guide events', () => {
    test('accepts guide requested and fallback events', () => {
        expect(SyncEventSchema.safeParse({
            type: 'guide-requested',
            sessionId: 'session-1',
            messageId: 'message-1',
            localId: 'local-1'
        }).success).toBe(true)

        expect(SyncEventSchema.safeParse({
            type: 'guide-fallback-queued',
            sessionId: 'session-1',
            messageId: 'message-1',
            localId: 'local-1',
            reason: 'unsupported-capability'
        }).success).toBe(true)
    })

    test('accepts permission and interrupt fallback reasons', () => {
        for (const reason of ['permission-pending', 'interrupt-failed'] as const) {
            expect(SyncEventSchema.safeParse({
                type: 'guide-fallback-queued',
                sessionId: 'session-1',
                messageId: 'message-1',
                localId: 'local-1',
                reason
            }).success).toBe(true)
        }
    })

    test('accepts guide consumed and failed events', () => {
        expect(SyncEventSchema.safeParse({
            type: 'guide-consumed',
            sessionId: 'session-1',
            localIds: ['local-1'],
            invokedAt: Date.now()
        }).success).toBe(true)

        expect(SyncEventSchema.safeParse({
            type: 'guide-failed',
            sessionId: 'session-1',
            localId: 'local-1',
            reason: 'interrupted by session end'
        }).success).toBe(true)
    })
})
