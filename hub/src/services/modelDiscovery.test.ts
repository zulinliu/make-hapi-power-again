import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
import {
    buildModelsUrlCandidates,
    createSafeLookup,
    parseModelsResponse,
    isGoogleApi,
    ModelDiscoveryService,
    type ProviderHttpTransport,
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

describe('createSafeLookup', () => {
    function callLookup(options: { all?: boolean; family?: 4 | 6 } = {}) {
        const lookup = createSafeLookup({
            allowPrivateNetwork: true,
            resolveHost: async () => ['10.0.0.5', '10.0.0.6'],
        })

        return new Promise<{ address: unknown; family: number | undefined }>((resolve, reject) => {
            lookup('api.internal.example.com', options, (err, address, family) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve({ address, family })
            })
        })
    }

    test('returns an address array for Node HTTP all=true lookups', async () => {
        const result = await callLookup({ all: true })

        expect(Array.isArray(result.address)).toBe(true)
        expect(result.address).toEqual([
            { address: '10.0.0.5', family: 4 },
            { address: '10.0.0.6', family: 4 },
        ])
        expect(result.family).toBeUndefined()
    })

    test('returns a single address for normal Node HTTP lookups', async () => {
        const result = await callLookup()

        expect(result.address).toBe('10.0.0.5')
        expect(result.family).toBe(4)
    })
})

describe('ModelDiscoveryService', () => {
    let service: ModelDiscoveryService
    let originalFetch: typeof globalThis.fetch

    beforeEach(() => {
        originalFetch = globalThis.fetch
        service = new ModelDiscoveryService(createFetchTransport())
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
        service.clearCache()
    })

    async function encryptTestKey(value: string = 'test-key'): Promise<string> {
        const { encryptAES256GCM, getEncryptionKey } = await import('../utils/crypto')
        const key = getEncryptionKey()
        return encryptAES256GCM(value, key)
    }

    function publicDnsOptions() {
        return {
            security: {
                resolveHost: async () => ['93.184.216.34'],
            },
        }
    }

    function createFetchTransport(): ProviderHttpTransport {
        return async (url, options) => {
            const response = await globalThis.fetch(url.toString(), {
                method: 'GET',
                headers: options.headers,
                redirect: 'manual',
            })
            return {
                status: response.status,
                headers: {
                    get: name => response.headers.get(name),
                },
                readText: async maxBytes => {
                    const text = await response.text()
                    if (new TextEncoder().encode(text).byteLength > maxBytes) {
                        throw new Error('Provider response exceeded the maximum diagnostic size.')
                    }
                    return text
                },
            }
        }
    }

    test('returns cached models with diagnostic and health on second call', async () => {
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

        const validEncrypted = await encryptTestKey()

        const r1 = await service.discoverModels('test-id', 'https://api.example.com', validEncrypted, publicDnsOptions())
        const r2 = await service.discoverModels('test-id', 'https://api.example.com', validEncrypted, publicDnsOptions())

        expect(r1.success).toBe(true)
        expect(r1.models).toHaveLength(1)
        expect(r2.success).toBe(true)
        expect(r2.diagnostic?.statusCode).toBe(200)
        expect(r2.health?.status).toBe('online')
        expect(callCount).toBe(1) // second call hits cache
    })

    test('force bypasses cached discovery results', async () => {
        let callCount = 0
        globalThis.fetch = mock(async () => {
            callCount++
            return new Response(
                JSON.stringify({
                    data: [{ id: `model-${callCount}`, name: `Model ${callCount}` }],
                }),
                { headers: { 'content-type': 'application/json' } }
            )
        }) as unknown as typeof fetch

        const validEncrypted = await encryptTestKey()

        const r1 = await service.discoverModels('force-id', 'https://api.example.com', validEncrypted, publicDnsOptions())
        const r2 = await service.discoverModels('force-id', 'https://api.example.com', validEncrypted, {
            ...publicDnsOptions(),
            force: true,
        })

        expect(r1.models?.[0]?.id).toBe('model-1')
        expect(r2.models?.[0]?.id).toBe('model-2')
        expect(callCount).toBe(2)
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

        const validEncrypted = await encryptTestKey()

        const result = await service.discoverModels('test-anthropic', 'https://api.example.com/anthropic', validEncrypted, publicDnsOptions())
        expect(result.success).toBe(true)
        expect(result.models).toHaveLength(1)
        expect(result.models![0].id).toBe('model-via-fallback')
        expect(attemptedUrls).toHaveLength(2)
    })

    test('returns error on auth failure', async () => {
        globalThis.fetch = mock(async () => {
            return new Response('Unauthorized', { status: 401 })
        }) as unknown as typeof fetch

        const validEncrypted = await encryptTestKey('bad-key')

        const result = await service.discoverModels('test-bad-key', 'https://api.example.com', validEncrypted, publicDnsOptions())
        expect(result.success).toBe(false)
        expect(result.error).toContain('Authentication')
    })

    test('returns error when all candidates fail', async () => {
        globalThis.fetch = mock(async () => {
            return new Response('Not Found', { status: 404 })
        }) as unknown as typeof fetch

        const validEncrypted = await encryptTestKey()

        const result = await service.discoverModels('test-all-fail', 'https://api.example.com', validEncrypted, publicDnsOptions())
        expect(result.success).toBe(false)
        expect(result.error).toContain('No models endpoint found')
        expect(result.diagnostic?.statusCode).toBe(404)
        expect(result.health?.status).toBe('offline')
    })

    test('follows safe same-host manual redirect and preserves auth headers only there', async () => {
        const attemptedUrls: string[] = []
        const authHeaders: Array<string | null> = []
        globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
            const urlStr = url.toString()
            attemptedUrls.push(urlStr)
            const headers = new Headers(init?.headers)
            authHeaders.push(headers.get('authorization'))
            if (urlStr === 'https://api.example.com/v1/models') {
                return new Response('', {
                    status: 302,
                    headers: { location: '/openai/v1/models' },
                })
            }
            return new Response(
                JSON.stringify({ data: [{ id: 'redirected-model' }] }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )
        }) as unknown as typeof fetch

        const result = await service.discoverModels('redirect-ok', 'https://api.example.com', await encryptTestKey(), publicDnsOptions())

        expect(result.success).toBe(true)
        expect(result.models?.[0]?.id).toBe('redirected-model')
        expect(attemptedUrls).toEqual([
            'https://api.example.com/v1/models',
            'https://api.example.com/openai/v1/models',
        ])
        expect(authHeaders.every(value => value?.startsWith('Bearer '))).toBe(true)
    })

    test('blocks cross-host redirect before following it', async () => {
        const attemptedUrls: string[] = []
        globalThis.fetch = mock(async (url: string | URL | Request) => {
            attemptedUrls.push(url.toString())
            return new Response('', {
                status: 302,
                headers: { location: 'https://evil.example.com/v1/models' },
            })
        }) as unknown as typeof fetch

        const result = await service.discoverModels('redirect-blocked', 'https://api.example.com', await encryptTestKey(), publicDnsOptions())

        expect(result.success).toBe(false)
        expect(result.error).toContain('Cross-host redirects')
        expect(result.health?.status).toBe('blocked')
        expect(result.diagnostic?.errorCode).toBe('redirect-cross-host')
        expect(attemptedUrls).toEqual(['https://api.example.com/v1/models'])
    })

    test('blocks provider base URLs that resolve to private DNS addresses', async () => {
        globalThis.fetch = mock(async () => {
            throw new Error('fetch should not be called')
        }) as unknown as typeof fetch

        const result = await service.discoverModels('dns-private', 'https://api.example.com', await encryptTestKey(), {
            security: { resolveHost: async () => ['10.0.0.5'] },
        })

        expect(result.success).toBe(false)
        expect(result.health?.status).toBe('blocked')
        expect(result.diagnostic?.errorCode).toBe('dns-private-ip-blocked')
    })

    test('allows intranet provider discovery only when private-network policy is explicit', async () => {
        globalThis.fetch = mock(async () => {
            return new Response(
                JSON.stringify({ data: [{ id: 'internal-model', name: 'Internal Model' }] }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )
        }) as unknown as typeof fetch

        const result = await service.discoverModels('dns-private-allowed', 'https://api.internal.example.com', await encryptTestKey(), {
            security: {
                allowPrivateNetwork: true,
                resolveHost: async () => ['10.0.0.5'],
            },
        })

        expect(result.success).toBe(true)
        expect(result.models?.[0]?.id).toBe('internal-model')
        expect(result.health?.status).toBe('online')
    })

    test('blocks DNS rebinding when host resolution changes during request', async () => {
        let resolveCount = 0
        globalThis.fetch = mock(async () => {
            return new Response(
                JSON.stringify({ data: [{ id: 'rebound-model' }] }),
                { status: 200, headers: { 'content-type': 'application/json' } }
            )
        }) as unknown as typeof fetch

        const result = await service.discoverModels('dns-rebind', 'https://api.example.com', await encryptTestKey(), {
            security: {
                resolveHost: async () => {
                    resolveCount++
                    return resolveCount === 1 ? ['93.184.216.34'] : ['10.0.0.5']
                },
            },
        })

        expect(result.success).toBe(false)
        expect(result.health?.status).toBe('blocked')
        expect(result.diagnostic?.errorCode).toBe('dns-private-ip-blocked')
    })

    test('uses protocol-specific auth for Google and Anthropic providers', async () => {
        const observed: Array<{ url: string; authorization: string | null; apiKey: string | null; anthropicVersion: string | null }> = []
        globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
            const headers = new Headers(init?.headers)
            observed.push({
                url: url.toString(),
                authorization: headers.get('authorization'),
                apiKey: headers.get('x-api-key'),
                anthropicVersion: headers.get('anthropic-version'),
            })
            return new Response(JSON.stringify({ data: [{ id: 'ok' }] }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }) as unknown as typeof fetch

        await service.discoverModels('google-auth', 'https://generativelanguage.googleapis.com', await encryptTestKey('google-key'), publicDnsOptions())
        await service.discoverModels('anthropic-auth', 'https://api.anthropic.com', await encryptTestKey('anthropic-key'), publicDnsOptions())

        expect(observed[0]?.url).toContain('key=google-key')
        expect(observed[0]?.authorization).toBeNull()
        expect(observed[0]?.apiKey).toBeNull()
        expect(observed[1]?.authorization).toBeNull()
        expect(observed[1]?.apiKey).toBe('anthropic-key')
        expect(observed[1]?.anthropicVersion).toBe('2023-06-01')
    })

    test('honors explicit Anthropic protocol on generic proxy hosts', async () => {
        const observed: Array<{ authorization: string | null; apiKey: string | null; anthropicVersion: string | null }> = []
        globalThis.fetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
            const headers = new Headers(init?.headers)
            observed.push({
                authorization: headers.get('authorization'),
                apiKey: headers.get('x-api-key'),
                anthropicVersion: headers.get('anthropic-version'),
            })
            return new Response(JSON.stringify([{ id: 'claude-proxy' }]), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }) as unknown as typeof fetch

        const result = await service.discoverModels('anthropic-proxy', 'https://proxy.example.com', await encryptTestKey('anthropic-proxy-key'), {
            ...publicDnsOptions(),
            protocol: 'anthropic',
        })

        expect(result.success).toBe(true)
        expect(observed[0]?.authorization).toBeNull()
        expect(observed[0]?.apiKey).toBe('anthropic-proxy-key')
        expect(observed[0]?.anthropicVersion).toBe('2023-06-01')
    })

    test('honors explicit Gemini protocol on generic proxy hosts', async () => {
        const observed: Array<{ url: string; authorization: string | null; apiKey: string | null }> = []
        globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
            const headers = new Headers(init?.headers)
            observed.push({
                url: url.toString(),
                authorization: headers.get('authorization'),
                apiKey: headers.get('x-api-key'),
            })
            return new Response(JSON.stringify({ models: [{ name: 'models/gemini-proxy' }] }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }) as unknown as typeof fetch

        const result = await service.discoverModels('gemini-proxy', 'https://proxy.example.com', await encryptTestKey('gemini-proxy-key'), {
            ...publicDnsOptions(),
            protocol: 'gemini',
        })

        expect(result.success).toBe(true)
        expect(observed[0]?.url).toContain('key=gemini-proxy-key')
        expect(observed[0]?.authorization).toBeNull()
        expect(observed[0]?.apiKey).toBeNull()
    })

    test('limits response body size and redacts diagnostics', async () => {
        const tooLarge = 'x'.repeat(1_000_001)
        globalThis.fetch = mock(async () => {
            return new Response(tooLarge, { status: 200, headers: { 'content-type': 'application/json' } })
        }) as unknown as typeof fetch

        const result = await service.discoverModels('large-body', 'https://api.example.com', await encryptTestKey('sk-secret-token'), publicDnsOptions())

        expect(result.success).toBe(false)
        expect(result.error).toContain('Request failed')
        expect(result.diagnostic?.errorCode).toBe('request-failed')
        expect(result.diagnostic?.safeMessage).not.toContain('sk-secret-token')
        expect(result.diagnostic?.safeMessage).toContain('maximum diagnostic size')
    })

    test('redacts upstream error body from diagnostic', async () => {
        globalThis.fetch = mock(async () => {
            return new Response('Authorization: Bearer sk-leaked token=secret-key', { status: 500 })
        }) as unknown as typeof fetch

        const result = await service.discoverModels('redact-error', 'https://api.example.com', await encryptTestKey(), publicDnsOptions())

        expect(result.success).toBe(false)
        expect(result.diagnostic?.safeMessage).not.toContain('sk-leaked')
        expect(result.diagnostic?.safeMessage).not.toContain('secret-key')
        expect(result.diagnostic?.safeMessage).toContain('[redacted]')
    })
})
