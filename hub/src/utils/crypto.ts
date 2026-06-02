import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const AES_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const KEY_FILE_NAME = 'provider-encryption.key'

export function constantTimeEquals(a: string | null | undefined, b: string | null | undefined): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false
    }

    const bufferA = Buffer.from(a, 'utf8')
    const bufferB = Buffer.from(b, 'utf8')
    const maxLength = Math.max(bufferA.length, bufferB.length)
    const paddedA = Buffer.alloc(maxLength)
    const paddedB = Buffer.alloc(maxLength)

    bufferA.copy(paddedA)
    bufferB.copy(paddedB)

    const matches = timingSafeEqual(paddedA, paddedB)
    return matches && bufferA.length === bufferB.length
}

function getDataDir(): string {
    const envDir = process.env.HAPI_POWER_HOME
    if (envDir) return envDir.replace(/^~/, homedir())
    return join(homedir(), '.hapi-power')
}

function getKeyFilePath(): string {
    return join(getDataDir(), KEY_FILE_NAME)
}

export function getEncryptionKey(): Buffer {
    const envKey = process.env.HAPI_POWER_PROVIDER_ENCRYPTION_KEY
    if (envKey) {
        const buf = Buffer.from(envKey, 'hex')
        if (buf.length !== 32) {
            throw new Error('HAPI_POWER_PROVIDER_ENCRYPTION_KEY must be 32 bytes (64 hex characters)')
        }
        return buf
    }

    const keyPath = getKeyFilePath()
    if (existsSync(keyPath)) {
        const stored = readFileSync(keyPath, 'utf8').trim()
        const buf = Buffer.from(stored, 'hex')
        if (buf.length === 32) return buf
    }

    const dataDir = getDataDir()
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true })
    }

    const key = randomBytes(32)
    writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 })
    return key
}

export function encryptAES256GCM(plaintext: string, key: Buffer): string {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(AES_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

export function decryptAES256GCM(encryptedPayload: string, key: Buffer): string {
    const data = Buffer.from(encryptedPayload, 'base64')
    const iv = data.subarray(0, IV_LENGTH)
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
    const decipher = createDecipheriv(AES_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(authTag)
    return decipher.update(encrypted) + decipher.final('utf8')
}
