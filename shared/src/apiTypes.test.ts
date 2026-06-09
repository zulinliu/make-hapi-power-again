import { describe, expect, test } from 'bun:test'
import { SendMessageRequestSchema } from './apiTypes'

describe('SendMessageRequestSchema deliveryMode', () => {
    test('defaults deliveryMode to queue', () => {
        const parsed = SendMessageRequestSchema.parse({ text: 'hello' })

        expect(parsed.deliveryMode).toBe('queue')
    })

    test('rejects guide messages with scheduledAt', () => {
        const result = SendMessageRequestSchema.safeParse({
            text: 'hello',
            localId: 'local-guide-scheduled',
            scheduledAt: Date.now() + 60_000,
            deliveryMode: 'guide'
        })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('deliveryMode'))).toBe(true)
        }
    })

    test('rejects guide messages with attachments', () => {
        const result = SendMessageRequestSchema.safeParse({
            text: 'hello',
            localId: 'local-guide-attachment',
            deliveryMode: 'guide',
            attachments: [{
                id: 'att-1',
                filename: 'a.png',
                mimeType: 'image/png',
                size: 10,
                path: '/tmp/a.png'
            }]
        })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('deliveryMode'))).toBe(true)
        }
    })

    test('rejects guide messages without localId', () => {
        const result = SendMessageRequestSchema.safeParse({
            text: 'hello',
            deliveryMode: 'guide'
        })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('localId'))).toBe(true)
        }
    })
})
