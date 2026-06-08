import { describe, test, expect } from 'bun:test'
import { encryptAES256GCM, decryptAES256GCM } from './crypto'
import { randomBytes } from 'node:crypto'

describe('crypto', () => {
    describe('AES-256-GCM', () => {
        test('encrypts and decrypts correctly', () => {
            const key = randomBytes(32)
            const plaintext = 'example-api-key-12345'
            const encrypted = encryptAES256GCM(plaintext, key)
            const decrypted = decryptAES256GCM(encrypted, key)
            expect(decrypted).toBe(plaintext)
        })

        test('produces different ciphertext for same plaintext (random IV)', () => {
            const key = randomBytes(32)
            const plaintext = 'same-input'
            const encrypted1 = encryptAES256GCM(plaintext, key)
            const encrypted2 = encryptAES256GCM(plaintext, key)
            expect(encrypted1).not.toBe(encrypted2)
        })

        test('fails decryption with wrong key', () => {
            const key1 = randomBytes(32)
            const key2 = randomBytes(32)
            const plaintext = 'secret-data'
            const encrypted = encryptAES256GCM(plaintext, key1)
            expect(() => decryptAES256GCM(encrypted, key2)).toThrow()
        })

        test('fails decryption with tampered ciphertext', () => {
            const key = randomBytes(32)
            const plaintext = 'sensitive-key'
            const encrypted = encryptAES256GCM(plaintext, key)
            const tampered = encrypted.slice(0, -4) + 'XXXX'
            expect(() => decryptAES256GCM(tampered, key)).toThrow()
        })

        test('handles unicode API keys', () => {
            const key = randomBytes(32)
            const plaintext = 'example-密钥-🔑-test'
            const encrypted = encryptAES256GCM(plaintext, key)
            const decrypted = decryptAES256GCM(encrypted, key)
            expect(decrypted).toBe(plaintext)
        })

        test('handles empty string', () => {
            const key = randomBytes(32)
            const plaintext = ''
            const encrypted = encryptAES256GCM(plaintext, key)
            const decrypted = decryptAES256GCM(encrypted, key)
            expect(decrypted).toBe(plaintext)
        })

        test('handles long API keys', () => {
            const key = randomBytes(32)
            const plaintext = 'a'.repeat(4096)
            const encrypted = encryptAES256GCM(plaintext, key)
            const decrypted = decryptAES256GCM(encrypted, key)
            expect(decrypted).toBe(plaintext)
        })
    })
})
