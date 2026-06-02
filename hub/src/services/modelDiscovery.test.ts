import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
import {
    buildModelsUrlCandidates,
    parseModelsResponse,
    isGoogleApi,
    ModelDiscoveryService,
} from './modelDiscovery'

describe('buildModelsUrlCandidates', () => {
    test('appends /v1/models to base URL', () => {
        const candidates = buildModelsUrlCandidates('https://api.example.com')
        expect(candidates[0]).toBe('https://api.example.com/v1/models')
    })

    test('appends /v1/models to base URL with path', () => {
        const candidates = buildModelsUrlCandidates('https://api.example.com/proxy')
        expect(candidates[0]).toBe('https://api.example.com/proxy/v1/models')
    })

    test('strips /anthropic suffix and builds candidate', () => {
        const candidates = buildModelsUrlCandidates('https://api.example.com/anthropic')
        expect(candidates).toHaveLength(2)
        expect(candidates[0]).toBe('https://api.example.com/anthropic/v1/models')
        expect(candidates[1]).toBe('https://api.example.com/v1/models')
    })

    test('strips /v1 suffix and builds stripped candidate', () => {
        const candidates = buildModelsUrlCandidates('https://api.example.com/v1')
        expect(candidates).toHaveLength(2)
        expect(candidates[0]).toBe('https://api.example.com/v1/v1/models')
        expect(candidates[1]).toBe('https://api.example.com/v1/models')
    })

    test('strips /claudecode suffix', () => {
        const candidates = buildModelsUrlCandidates('https://proxy.example.com/claudecode')
        expect(candidates[1]).toBe('https://proxy.example.com/v1/models')
    })

    test('strips /gemini suffix', () => {
        const candidates = buildModelsUrlCandidates('https://proxy.example.com/gemini')
        expect(candidates[1]).toBe('https://proxy.example.com/v1/models')
    })

    test('does not produce duplicate candidates', () => {
        const candidates = buildModelsUrlCandidates('https://api.example.com')
        const unique = [...new Set(candidates)]
        expect(candidates.length).toBe(unique.length)
    })

    test('handles trailing slash', () => {
        const candidates = buildModelsUrlCandidates('https://api.example.com/anthropic/')
        expect(candidates).toHaveLength(2)
        expect(candidates[0]).toBe('https://api.example.com/anthropic/v1/models')
        expect(candidates[1]).toBe('https://api.example.com/v1/models')
    })

    test('handles URL with multiple path segments before known suffix', () => {
        const candidates = buildModelsUrlCandidates('https://proxy.example.com/api/anthropic')
        expect(candidates).toHaveLength(2)
        expect(candidates[0]).toBe('https://proxy.example.com/api/anthropic/v1/models')
        expect(candidates[1]).toBe('https://proxy.example.com/api/v1/models')
    })
})

describe('parseModelsResponse', () => {
    test('parses OpenAI format {data: [...]}', () => {
        const body = {
            data: [
                { id: 'gpt-4', name: 'GPT-4', owned_by: 'openai' },
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', owned_by: 'openai' },
            ],
        }
        const models = parseModelsResponse(body)
        expect(models).toHaveLength(2)
        expect(models[0]).toEqual({ id: 'gpt-4', name: 'GPT-4', ownedBy: 'openai' })
        expect(models[1]).toEqual({ id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', ownedBy: 'openai' })
    })

    test('parses Google format {models: [...]}', () => {
        const body = {
            models: [
                { name: 'models/gemini-pro', displayName: 'Gemini Pro' },
            ],
        }
        const models = parseModelsResponse(body)
        expect(models).toHaveLength(1)
        expect(models[0]).toEqual({ id: 'models/gemini-pro', name: 'Gemini Pro', ownedBy: undefined })
    })

    test('parses Anthropic format (top-level array)', () => {
        const body = [
            { id: 'claude-3-opus', name: 'Claude 3 Opus' },
        ]
        const models = parseModelsResponse(body)
        expect(models).toHaveLength(1)
        expect(models[0]).toEqual({ id: 'claude-3-opus', name: 'Claude 3 Opus', ownedBy: undefined })
    })

    test('handles model with owner field', () => {
        const body = { data: [{ id: 'model-1', owner: 'custom-org' }] }
        const models = parseModelsResponse(body)
        expect(models[0]?.ownedBy).toBe('custom-org')
    })

    test('returns empty for null body', () => {
        expect(parseModelsResponse(null)).toHaveLength(0)
    })

    test('returns empty for unrecognized format', () => {
        expect(parseModelsResponse({ foo: 'bar' })).toHaveLength(0)
    })

    test('skips models without id or name', () => {
        const body = { data: [{ owned_by: 'test' }, { id: 'valid' }] }
        const models = parseModelsResponse(body)
        expect(models).toHaveLength(1)
        expect(models[0]?.id).toBe('valid')
    })
})

describe('isGoogleApi', () => {
    test('detects generativelanguage', () => {
        expect(isGoogleApi('https://generativelanguage.googleapis.com/v1')).toBe(true)
    })

    test('detects gemini in hostname', () => {
        expect(isGoogleApi('https://gemini.example.com')).toBe(true)
    })

    test('returns false for OpenAI', () => {
        expect(isGoogleApi('https://api.openai.com')).toBe(false)
    })

    test('returns false for Anthropic', () => {
        expect(isGoogleApi('https://api.anthropic.com')).toBe(false)
    })

    test('returns false for generic proxy', () => {
        expect(isGoogleApi('https://my-proxy.example.com')).toBe(false)
    })
})

describe('ModelDiscoveryService', () => {
    let service: ModelDiscoveryService
    let originalFetch: typeof globalThis.fetch

    beforeEach(() => {
        service = new ModelDiscoveryService()
        originalFetch = globalThis.fetch
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
        service.clearCache()
    })

    test('returns cached models on second call', async () => {
        let callCount = 0
        globalThis.fetch = mock(async (url: string | URL | Request) => {
            callCount++
            return new Response(
                JSON.stringify({
                    data: [{ id: 'cached-model', name: 'Cached Model' }],
                }),
                { headers: { 'content-type': 'application/json' } }
            )
        }) as unknown as typeof fetch

        const encryptedKey = 'dGVzdC1hcGkta2V5'  // base64 of something
        // We need a valid encrypted payload — use the real encrypt function
        const { encryptAES256GCM, getEncryptionKey } = await import('../utils/crypto')
        const key = getEncryptionKey()
        const validEncrypted = encryptAES256GCM('test-key', key)

        const r1 = await service.discoverModels('test-id', 'https://api.example.com', validEncrypted)
        const r2 = await service.discoverModels('test-id', 'https://api.example.com', validEncrypted)

        expect(r1.success).toBe(true)
        expect(r1.models).toHaveLength(1)
        expect(r2.success).toBe(true)
        expect(callCount).toBe(1) // second call hits cache
    })

    test('tries fallback URL on 404', async () => {
        const attemptedUrls: string[] = []
        globalThis.fetch = mock(async (url: string | URL | Request) => {
            const urlStr = url.toString()
            attemptedUrls.push(urlStr)
            if (urlStr.includes('/anthropic/v1/models')) {
                return new Response('Not Found', { status: 404 })
            }
            return new Response(
                JSON.stringify({ data: [{ id: 'model-via-fallback' }] }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )
        }) as unknown as typeof fetch

        const { encryptAES256GCM, getEncryptionKey } = await import('../utils/crypto')
        const key = getEncryptionKey()
        const validEncrypted = encryptAES256GCM('test-key', key)

        const result = await service.discoverModels('test-anthropic', 'https://api.example.com/anthropic', validEncrypted)
        expect(result.success).toBe(true)
        expect(result.models).toHaveLength(1)
        expect(result.models![0].id).toBe('model-via-fallback')
        expect(attemptedUrls).toHaveLength(2)
    })

    test('returns error on auth failure', async () => {
        globalThis.fetch = mock(async () => {
            return new Response('Unauthorized', { status: 401 })
        }) as unknown as typeof fetch

        const { encryptAES256GCM, getEncryptionKey } = await import('../utils/crypto')
        const key = getEncryptionKey()
        const validEncrypted = encryptAES256GCM('bad-key', key)

        const result = await service.discoverModels('test-bad-key', 'https://api.example.com', validEncrypted)
        expect(result.success).toBe(false)
        expect(result.error).toContain('Authentication')
    })

    test('returns error when all candidates fail', async () => {
        globalThis.fetch = mock(async () => {
            return new Response('Not Found', { status: 404 })
        }) as unknown as typeof fetch

        const { encryptAES256GCM, getEncryptionKey } = await import('../utils/crypto')
        const key = getEncryptionKey()
        const validEncrypted = encryptAES256GCM('test-key', key)

        const result = await service.discoverModels('test-all-fail', 'https://api.example.com', validEncrypted)
    })
})
