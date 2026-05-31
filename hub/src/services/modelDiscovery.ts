import type { DiscoveredModel, DiscoverModelsResponse } from '@hapipower/protocol'
import { decryptAES256GCM, getEncryptionKey } from '../utils/crypto'

const KNOWN_SUFFIXES = [
    '/anthropic',
    '/claudecode',
    '/claude',
    '/v1',
    '/v1/chat/completions',
    '/v1/messages',
    '/api',
    '/api/v1',
    '/openai',
    '/gemini',
]

const REQUEST_TIMEOUT_MS = 15_000
const TOTAL_TIMEOUT_MS = 30_000
const CACHE_TTL_MS = 5 * 60 * 1000

type CacheEntry = { models: DiscoveredModel[]; expiresAt: number }

export class ModelDiscoveryService {
    private cache = new Map<string, CacheEntry>()

    async discoverModels(
        baseUrl: string,
        apiKeyEncrypted: string
    ): Promise<DiscoverModelsResponse> {
        const cacheKey = `${baseUrl}:${apiKeyEncrypted.slice(0, 8)}`
        const cached = this.cache.get(cacheKey)
        if (cached && cached.expiresAt > Date.now()) {
            return { success: true, models: cached.models }
        }

        const key = getEncryptionKey()
        const apiKey = decryptAES256GCM(apiKeyEncrypted, key)

        const googleMode = isGoogleApi(baseUrl)
        let candidates: string[]
        if (googleMode) {
            candidates = buildModelsUrlCandidates(baseUrl).map(u => appendQueryParam(u, 'key', apiKey))
        } else {
            candidates = buildModelsUrlCandidates(baseUrl)
        }

        const totalDeadline = Date.now() + TOTAL_TIMEOUT_MS

        for (const candidate of candidates) {
            if (Date.now() >= totalDeadline) {
                return { success: false, error: 'Discovery timed out' }
            }

            const remainingMs = totalDeadline - Date.now()
            const timeoutMs = Math.min(REQUEST_TIMEOUT_MS, remainingMs)
            if (timeoutMs <= 0) {
                return { success: false, error: 'Discovery timed out' }
            }

            const result = await tryFetchModels(candidate, apiKey, timeoutMs)
            if (result.success) {
                const models = result.models
                this.cache.set(cacheKey, { models, expiresAt: Date.now() + CACHE_TTL_MS })
                return { success: true, models }
            }
            if (result.status === 401 || result.status === 403) {
                return { success: false, error: 'Authentication failed: invalid API key' }
            }
        }

        return { success: false, error: 'No models endpoint found. All candidates failed.' }
    }

    clearCache(): void {
        this.cache.clear()
    }
}

export function buildModelsUrlCandidates(baseUrl: string): string[] {
    const url = new URL(baseUrl)
    const path = url.pathname.replace(/\/+$/, '')
    const candidates: string[] = []

    const modelsPath = `${path}/v1/models`
    candidates.push(`${url.origin}${modelsPath}`)

    for (const suffix of KNOWN_SUFFIXES) {
        if (path.toLowerCase().endsWith(suffix)) {
            const stripped = path.slice(0, -suffix.length)
            const strippedModels = `${stripped}/v1/models`
            const candidate = `${url.origin}${strippedModels}`
            if (!candidates.includes(candidate)) {
                candidates.push(candidate)
            }
            break
        }
    }

    return candidates
}

type FetchResult =
    | { success: true; models: DiscoveredModel[] }
    | { success: false; status?: number; error: string }

async function tryFetchModels(url: string, apiKey: string, timeoutMs: number): Promise<FetchResult> {
    const headers = buildAuthHeaders(url, apiKey)

    try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)

        const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: controller.signal,
        }).finally(() => clearTimeout(timer))

        if (response.status === 404 || response.status === 405) {
            return { success: false, status: response.status, error: `Endpoint returned ${response.status}` }
        }

        if (response.status === 401 || response.status === 403) {
            return { success: false, status: response.status, error: 'Authentication failed' }
        }

        if (!response.ok) {
            return { success: false, status: response.status, error: `HTTP ${response.status}` }
        }

        const body = await response.json() as unknown
        const models = parseModelsResponse(body)
        return { success: true, models }
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            return { success: false, error: 'Request timed out' }
        }
        const message = err instanceof Error ? err.message : 'Unknown error'
        return { success: false, error: `Request failed: ${message}` }
    }
}

function buildAuthHeaders(url: string, apiKey: string): Record<string, string> {
    const hostname = new URL(url).hostname.toLowerCase()

    if (hostname.includes('anthropic') || hostname.includes('claude')) {
        return {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        }
    }

    if (hostname.includes('generativelanguage') || hostname.includes('aiplatform') || hostname.includes('gemini')) {
        return {
            'content-type': 'application/json',
        }
    }

    return {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
    }
}

export function isGoogleApi(baseUrl: string): boolean {
    const hostname = new URL(baseUrl).hostname.toLowerCase()
    return hostname.includes('generativelanguage') || hostname.includes('aiplatform') || hostname.includes('gemini')
}

export function parseModelsResponse(body: unknown): DiscoveredModel[] {
    if (!body || typeof body !== 'object') return []

    if (Array.isArray(body)) {
        return body.map(normalizeModel).filter((m): m is DiscoveredModel => m !== null)
    }

    const obj = body as Record<string, unknown>

    if (Array.isArray(obj.data)) {
        return (obj.data as unknown[]).map(normalizeModel).filter((m): m is DiscoveredModel => m !== null)
    }

    if (Array.isArray(obj.models)) {
        return (obj.models as unknown[]).map(normalizeModel).filter((m): m is DiscoveredModel => m !== null)
    }

    return []
}

function normalizeModel(raw: unknown): DiscoveredModel | null {
    if (!raw || typeof raw !== 'object') return null
    const obj = raw as Record<string, unknown>

    const id = typeof obj.id === 'string' ? obj.id : typeof obj.name === 'string' ? String(obj.name) : null
    if (!id) return null

    const name = typeof obj.display_name === 'string' ? obj.display_name
        : typeof obj.displayName === 'string' ? obj.displayName
        : typeof obj.name === 'string' ? obj.name : id

    return {
        id,
        name,
        ownedBy: typeof obj.owned_by === 'string' ? obj.owned_by : typeof obj.owner === 'string' ? obj.owner : undefined,
    }
}

function appendQueryParam(url: string, key: string, value: string): string {
    const u = new URL(url)
    u.searchParams.set(key, value)
    return u.toString()
}
