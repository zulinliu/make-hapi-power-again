import { describe, expect, it } from 'vitest'
import { sanitizeForLog } from './logger'

describe('sanitizeForLog', () => {
    it('recursively redacts sensitive object fields and string patterns', () => {
        const urlWithCredentials = 'https://test-user:'
            + 'example-password@example.com/repo.git?access_token=raw-token'

        expect(sanitizeForLog({
            token: 'raw-token',
            nested: {
                apiKey: 'raw-api-key',
                url: urlWithCredentials,
                header: 'Authorization: Bearer abc.def.ghi',
                command: 'tool --password raw-password --flag ok'
            }
        })).toEqual({
            token: '[REDACTED]',
            nested: {
                apiKey: '[REDACTED]',
                url: 'https://[REDACTED]@example.com/repo.git?access_token=[REDACTED]',
                header: 'Authorization: Bearer [REDACTED]',
                command: 'tool --password [REDACTED] --flag ok'
            }
        })
    })

    it('does not serialize raw buffer contents or private key blocks', () => {
        const privateKeyBlock = [
            '-----BEGIN ' + 'PRIVATE KEY-----',
            'secret',
            '-----END ' + 'PRIVATE KEY-----'
        ].join('\n')
        const sanitized = sanitizeForLog({
            buffer: Buffer.from('secret-token'),
            pem: privateKeyBlock
        })

        expect(sanitized).toEqual({
            buffer: '[Buffer length=12]',
            pem: '[REDACTED]'
        })
    })
})
