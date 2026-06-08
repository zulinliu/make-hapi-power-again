import { describe, expect, it } from 'bun:test'
import { createSanitizedLogger, sanitizeLog, sanitizeLogValue } from './logSanitizer'

describe('logSanitizer', () => {
    it('redacts SSE query tokens and bearer tokens in HTTP logs', () => {
        const message = 'GET /api/events?token=eyJhbGciOiJ.example.signature 200 OK'
        const bearer = 'Authorization: Bearer hp_abcdefghijklmnopqrstuvwxyz123456'

        expect(sanitizeLog(message)).toContain('token=[REDACTED]')
        expect(sanitizeLog(bearer)).toBe('Authorization: Bearer [REDACTED]')
    })

    it('redacts error messages before logging', () => {
        expect(sanitizeLogValue(new Error('secret-token leaked in lower layer'))).not.toContain('secret-token')
    })

    it('sanitizes non-string logger arguments', () => {
        const logs: unknown[][] = []
        const logger = createSanitizedLogger({
            info: (...args: unknown[]) => logs.push(args),
            warn: () => {},
            error: () => {}
        })

        logger.info('request failed', new Error('apiKey=abcdef1234567890'))

        expect(JSON.stringify(logs)).not.toContain('abcdef1234567890')
    })
})
