import type {
    DiscoveredModel,
    DiscoverModelsResponse,
    ProviderCapability,
    ProviderHealth,
    ProviderProtocol,
    SafeProviderDiagnostic,
} from '@hapipower/protocol'
import type { LookupAddress, LookupOptions } from 'node:dns'
import { lookup as dnsLookup } from 'node:dns/promises'
import type { IncomingMessage } from 'node:http'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { LookupFunction } from 'node:net'
import { isIP } from 'node:net'
import { decryptAES256GCM, getEncryptionKey } from '../utils/crypto'
import {
    assertSafeRedirect,
    getDefaultProviderCapabilities,
    type ProviderSecurityOptions,
    redactSensitiveText,
    sanitizeProviderDiagnostic,
    validateProviderBaseUrl,
    validateProviderResolvedAddress,
} from './providerSecurity'

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
const MAX_REDIRECTS = 3
const MAX_RESPONSE_BYTES = 1_000_000

type CacheEntry = {
    models: DiscoveredModel[]
    diagnostic: SafeProviderDiagnostic
    health: ProviderHealth
    expiresAt: number
}

type DiscoveryOptions = {
    namespace?: string
    protocol?: ProviderProtocol
    security?: ProviderSecurityOptions
    force?: boolean
    cache?: boolean
    cacheVersion?: string | number
}

type ProviderHttpResponse = {
    status: number
    headers: {
        get(name: string): string | null
    }
    readText(maxBytes: number, timeoutMs?: number): Promise<string>
}

export type ProviderHttpTransport = (
    url: URL,
    options: {
        headers: Record<string, string>
        timeoutMs: number
        security?: ProviderSecurityOptions
    }
) => Promise<ProviderHttpResponse>

type FetchResult =
    | {
        success: true
        models: DiscoveredModel[]
        diagnostic: SafeProviderDiagnostic
        health: ProviderHealth
    }
    | {
        success: false
        status?: number
        error: string
        diagnostic: SafeProviderDiagnostic
        health: ProviderHealth
    }

export class ModelDiscoveryService {
    private cache = new Map<string, CacheEntry>()

    constructor(private readonly transport: ProviderHttpTransport = createSafeHttpTransport()) {}

    async discoverModels(
        providerId: string,
        baseUrl: string,
        apiKeyEncrypted: string,
        options: DiscoveryOptions = {}
    ): Promise<DiscoverModelsResponse> {
        const namespace = options.namespace ?? 'default'
        const protocol = options.protocol ?? 'auto'
        const useCache = options.cache !== false
        const cacheKey = `${namespace}:${providerId}:${baseUrl}:${protocol}:${options.cacheVersion ?? 'current'}`
        const cached = this.cache.get(cacheKey)
        if (useCache && !options.force && cached && cached.expiresAt > Date.now()) {
            return {
                success: true,
                models: cached.models,
                diagnostic: cached.diagnostic,
                health: cached.health,
            }
        }

        const baseValidation = await validateProviderBaseUrl(baseUrl, options.security)
        if (!baseValidation.ok) {
            const diagnostic = buildDiagnostic(baseUrl, null, null, baseValidation.code, baseValidation.message)
            return {
                success: false,
                error: baseValidation.message,
                diagnostic,
                health: buildHealth('blocked', null, baseValidation.code, baseValidation.message, null, diagnostic.capabilities),
            }
        }

        const key = getEncryptionKey()
        const apiKey = decryptAES256GCM(apiKeyEncrypted, key)

        const googleMode = isGoogleMode(baseUrl, protocol)
        const candidates = googleMode
            ? buildModelsUrlCandidates(baseUrl).map(u => appendQueryParam(u, 'key', apiKey))
            : buildModelsUrlCandidates(baseUrl)

        const totalDeadline = Date.now() + TOTAL_TIMEOUT_MS
        let lastFailure: FetchResult | null = null

        for (const candidate of candidates) {
            if (Date.now() >= totalDeadline) {
                const diagnostic = buildDiagnostic(candidate, null, null, 'timeout', 'Discovery timed out')
                return {
                    success: false,
                    error: 'Discovery timed out',
                    diagnostic,
                    health: buildHealth('offline', null, 'timeout', 'Discovery timed out', null, diagnostic.capabilities),
                }
            }

            const remainingMs = totalDeadline - Date.now()
            const timeoutMs = Math.min(REQUEST_TIMEOUT_MS, remainingMs)
            if (timeoutMs <= 0) {
                const diagnostic = buildDiagnostic(candidate, null, null, 'timeout', 'Discovery timed out')
                return {
                    success: false,
                    error: 'Discovery timed out',
                    diagnostic,
                    health: buildHealth('offline', null, 'timeout', 'Discovery timed out', null, diagnostic.capabilities),
                }
            }

            const result = await tryFetchModels(candidate, apiKey, timeoutMs, {
                protocol,
                security: options.security,
                transport: this.transport,
            })
            if (result.success) {
                const models = result.models
                if (useCache) {
                    this.cache.set(cacheKey, {
                        models,
                        diagnostic: result.diagnostic,
                        health: result.health,
                        expiresAt: Date.now() + CACHE_TTL_MS,
                    })
                }
                return { success: true, models, diagnostic: result.diagnostic, health: result.health }
            }

            lastFailure = result
            if (result.status === 401 || result.status === 403) {
                return {
                    success: false,
                    error: 'Authentication failed: invalid API key',
                    diagnostic: result.diagnostic,
                    health: result.health,
                }
            }
            if (result.health.status === 'blocked') {
                return {
                    success: false,
                    error: result.error,
                    diagnostic: result.diagnostic,
                    health: result.health,
                }
            }
        }

        if (lastFailure && lastFailure.status !== 404 && lastFailure.status !== 405) {
            return {
                success: false,
                error: lastFailure.error,
                diagnostic: lastFailure.diagnostic,
                health: lastFailure.health,
            }
        }

        const diagnostic = lastFailure?.diagnostic
            ?? buildDiagnostic(baseUrl, null, null, 'models-endpoint-not-found', 'No models endpoint found.')
        return {
            success: false,
            error: 'No models endpoint found. All candidates failed.',
            diagnostic,
            health: lastFailure?.health
                ?? buildHealth('offline', null, 'models-endpoint-not-found', 'No models endpoint found.', null, diagnostic.capabilities),
        }
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

async function tryFetchModels(
    url: string,
    apiKey: string,
    timeoutMs: number,
    options: {
        protocol: ProviderProtocol
        security?: ProviderSecurityOptions
        transport: ProviderHttpTransport
    }
): Promise<FetchResult> {
    let currentUrl = new URL(url)
    let redirects = 0
    const startedAt = Date.now()
    const deadlineAt = startedAt + timeoutMs

    while (redirects <= MAX_REDIRECTS) {
        const validationSecurity = buildDiscoverySecurityOptions(currentUrl, options.protocol, options.security)
        const validation = await validateProviderBaseUrl(currentUrl.toString(), validationSecurity)
        if (!validation.ok) {
            const diagnostic = buildDiagnostic(currentUrl.toString(), null, Date.now() - startedAt, validation.code, validation.message)
            return {
                success: false,
                error: validation.message,
                diagnostic,
                health: buildHealth('blocked', diagnostic.latencyMs, validation.code, validation.message, null, diagnostic.capabilities),
            }
        }

        const headers = buildAuthHeaders(currentUrl.toString(), apiKey, options.protocol)
        const expectedAddresses = validation.resolvedAddresses
        try {
            const response = await options.transport(currentUrl, {
                headers,
                timeoutMs: getRemainingTimeoutMs(deadlineAt),
                security: validationSecurity,
            })
                const latencyMs = Date.now() - startedAt
                const postValidation = await validateProviderBaseUrl(currentUrl.toString(), validationSecurity)
                if (!postValidation.ok) {
                    const diagnostic = buildDiagnostic(currentUrl.toString(), response.status, latencyMs, postValidation.code, postValidation.message)
                    return {
                        success: false,
                        status: response.status,
                        error: postValidation.message,
                        diagnostic,
                        health: buildHealth('blocked', latencyMs, postValidation.code, postValidation.message, null, diagnostic.capabilities),
                    }
                }
                if (!sameAddressSet(expectedAddresses, postValidation.resolvedAddresses)) {
                    const message = 'Provider host DNS changed during request.'
                    const diagnostic = buildDiagnostic(currentUrl.toString(), response.status, latencyMs, 'dns-rebinding-blocked', message)
                    return {
                        success: false,
                        status: response.status,
                        error: message,
                        diagnostic,
                        health: buildHealth('blocked', latencyMs, 'dns-rebinding-blocked', message, null, diagnostic.capabilities),
                    }
                }

                if (isRedirectStatus(response.status)) {
                    const location = response.headers.get('location')
                    if (!location) {
                        const diagnostic = buildDiagnostic(currentUrl.toString(), response.status, latencyMs, 'redirect-missing-location', 'Redirect response did not include a Location header.')
                        return {
                            success: false,
                            status: response.status,
                            error: 'Redirect response did not include a Location header.',
                            diagnostic,
                            health: buildHealth('blocked', latencyMs, 'redirect-missing-location', diagnostic.safeMessage, null, diagnostic.capabilities),
                        }
                    }

                    const target = new URL(location, currentUrl)
                    const redirectValidation = assertSafeRedirect(currentUrl, target, validationSecurity)
                    if (!redirectValidation.ok) {
                        const diagnostic = buildDiagnostic(target.toString(), response.status, latencyMs, redirectValidation.code, redirectValidation.message)
                        return {
                            success: false,
                            status: response.status,
                            error: redirectValidation.message,
                            diagnostic,
                            health: buildHealth('blocked', latencyMs, redirectValidation.code, redirectValidation.message, null, diagnostic.capabilities),
                        }
                    }

                    currentUrl = target
                    redirects++
                    continue
                }

                if (response.status === 404 || response.status === 405) {
                    const diagnostic = buildDiagnostic(currentUrl.toString(), response.status, latencyMs, `http-${response.status}`, `Endpoint returned ${response.status}`)
                    return {
                        success: false,
                        status: response.status,
                        error: `Endpoint returned ${response.status}`,
                        diagnostic,
                        health: buildHealth('offline', latencyMs, `http-${response.status}`, diagnostic.safeMessage, null, diagnostic.capabilities),
                    }
                }

                if (response.status === 401 || response.status === 403) {
                    const diagnostic = buildDiagnostic(currentUrl.toString(), response.status, latencyMs, 'authentication-failed', 'Authentication failed')
                    return {
                        success: false,
                        status: response.status,
                        error: 'Authentication failed',
                        diagnostic,
                        health: buildHealth('degraded', latencyMs, 'authentication-failed', diagnostic.safeMessage, null, diagnostic.capabilities),
                    }
                }

                if (response.status < 200 || response.status >= 300) {
                    const bodyPreview = await response.readText(2048, getRemainingTimeoutMs(deadlineAt)).catch(() => null)
                    const diagnostic = buildDiagnostic(currentUrl.toString(), response.status, latencyMs, `http-${response.status}`, bodyPreview ?? `HTTP ${response.status}`)
                    return {
                        success: false,
                        status: response.status,
                        error: `HTTP ${response.status}`,
                        diagnostic,
                        health: buildHealth('offline', latencyMs, `http-${response.status}`, diagnostic.safeMessage, null, diagnostic.capabilities),
                    }
                }

                const bodyText = await response.readText(MAX_RESPONSE_BYTES, getRemainingTimeoutMs(deadlineAt))
                const body = JSON.parse(bodyText) as unknown
                const models = parseModelsResponse(body)
                const protocolDetected = inferProtocol(currentUrl.toString(), options.protocol)
                const capabilities = buildCapabilities(protocolDetected, true)
                const diagnostic = buildDiagnostic(currentUrl.toString(), response.status, latencyMs, null, null, capabilities)
                return {
                    success: true,
                    models,
                    diagnostic,
                    health: buildHealth('online', latencyMs, null, null, protocolDetected, capabilities),
                }
        } catch (err) {
            const latencyMs = Date.now() - startedAt
            const errorCode = err instanceof DOMException && err.name === 'AbortError'
                ? 'timeout'
                : err instanceof SyntaxError
                    ? 'invalid-json'
                    : 'request-failed'
            const message = err instanceof Error ? err.message : 'Unknown error'
            const diagnostic = buildDiagnostic(currentUrl.toString(), null, latencyMs, errorCode, message)
            return {
                success: false,
                error: errorCode === 'timeout' ? 'Request timed out' : `Request failed: ${redactSensitiveText(message) ?? 'Unknown error'}`,
                diagnostic,
                health: buildHealth('offline', latencyMs, errorCode, diagnostic.safeMessage, null, diagnostic.capabilities),
            }
        }
    }

    const diagnostic = buildDiagnostic(currentUrl.toString(), null, Date.now() - startedAt, 'redirect-limit', 'Too many redirects.')
    return {
        success: false,
        error: 'Too many redirects.',
        diagnostic,
        health: buildHealth('blocked', diagnostic.latencyMs, 'redirect-limit', diagnostic.safeMessage, null, diagnostic.capabilities),
    }
}

function buildDiscoverySecurityOptions(
    url: URL,
    protocol: ProviderProtocol,
    security?: ProviderSecurityOptions
): ProviderSecurityOptions {
    const allowedSensitiveQueryParams = new Set(security?.allowedSensitiveQueryParams ?? [])
    if (inferProtocol(url.toString(), protocol) === 'gemini') {
        allowedSensitiveQueryParams.add('key')
    }
    return {
        ...security,
        allowedSensitiveQueryParams: [...allowedSensitiveQueryParams],
    }
}

function buildAuthHeaders(url: string, apiKey: string, explicitProtocol: ProviderProtocol): Record<string, string> {
    const protocol = inferProtocol(url, explicitProtocol)

    if (protocol === 'anthropic') {
        return {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        }
    }

    if (protocol === 'gemini') {
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

function isGoogleMode(baseUrl: string, explicitProtocol: ProviderProtocol): boolean {
    return explicitProtocol === 'gemini' || (explicitProtocol === 'auto' && isGoogleApi(baseUrl))
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

function isRedirectStatus(status: number): boolean {
    return status >= 300 && status < 400
}

function sameAddressSet(left: string[], right: string[]): boolean {
    if (left.length !== right.length) return false
    for (let i = 0; i < left.length; i++) {
        if (left[i] !== right[i]) return false
    }
    return true
}

function createSafeHttpTransport(): ProviderHttpTransport {
    return async (url, options) => {
        const request = url.protocol === 'https:' ? httpsRequest : httpRequest
        return await new Promise<ProviderHttpResponse>((resolve, reject) => {
            if (options.timeoutMs <= 0) {
                reject(createAbortError())
                return
            }
            let settled = false
            let timer: ReturnType<typeof setTimeout> | null = null
            const clearTimer = (): void => {
                if (timer) {
                    clearTimeout(timer)
                    timer = null
                }
            }
            const rejectOnce = (error: unknown): void => {
                if (settled) return
                settled = true
                clearTimer()
                reject(error)
            }
            const resolveOnce = (response: ProviderHttpResponse): void => {
                if (settled) return
                settled = true
                clearTimer()
                resolve(response)
            }
            const req = request(url, {
                method: 'GET',
                headers: options.headers,
                lookup: createSafeLookup(options.security),
            }, response => {
                resolveOnce({
                    status: response.statusCode ?? 0,
                    headers: {
                        get: name => {
                            const value = response.headers[name.toLowerCase()]
                            if (Array.isArray(value)) return value[0] ?? null
                            return typeof value === 'string' ? value : null
                        },
                    },
                    readText: (maxBytes, timeoutMs) => readIncomingMessageText(response, maxBytes, timeoutMs),
                })
            })

            timer = setTimeout(() => {
                req.destroy(createAbortError())
            }, options.timeoutMs)
            req.on('error', rejectOnce)
            req.end()
        })
    }
}

type SafeLookupAddress = {
    address: string
    family: 4 | 6
}

export function createSafeLookup(security?: ProviderSecurityOptions): LookupFunction {
    return (hostname: string, options: LookupOptions, callback): void => {
        const familyHint = normalizeLookupFamily(options.family)
        resolveSafeLookupAddresses(hostname, familyHint, security)
            .then(results => {
                if (options.all) {
                    callback(null, results.map(toLookupAddress))
                    return
                }
                const result = results[0]
                if (!result) {
                    callback(toLookupError(new Error('Provider host did not resolve to a public address.')), '', 0)
                    return
                }
                callback(null, result.address, result.family)
            })
            .catch(error => callback(toLookupError(error), '', 0))
    }
}

function toLookupAddress(result: SafeLookupAddress): LookupAddress {
    return {
        address: result.address,
        family: result.family,
    }
}

function normalizeLookupFamily(family: LookupOptions['family']): 4 | 6 | null {
    if (family === 4 || family === 'IPv4') return 4
    if (family === 6 || family === 'IPv6') return 6
    return null
}

async function resolveSafeLookupAddresses(
    hostname: string,
    familyHint: 4 | 6 | null,
    security?: ProviderSecurityOptions
): Promise<SafeLookupAddress[]> {
    const literalFamily = isIP(hostname)
    if (literalFamily === 4 || literalFamily === 6) {
        const validation = validateProviderResolvedAddress(hostname, security)
        if (!validation.ok) {
            throw new Error(validation.message)
        }
        if (familyHint && literalFamily !== familyHint) {
            throw new Error('Provider host did not resolve to an address for the requested IP family.')
        }
        return [{ address: hostname, family: literalFamily }]
    }

    const resolveHost = security?.resolveHost ?? resolveHostname
    const addresses = await resolveHost(hostname)
    const safeAddresses: SafeLookupAddress[] = []
    for (const address of addresses) {
        const family = isIP(address)
        if (family !== 4 && family !== 6) continue
        if (familyHint && family !== familyHint) continue
        const validation = validateProviderResolvedAddress(address, security)
        if (!validation.ok) {
            throw new Error('Provider host resolves to a private or metadata address.')
        }
        safeAddresses.push({ address, family })
    }
    if (safeAddresses.length > 0) {
        return safeAddresses
    }
    throw new Error('Provider host did not resolve to a public address.')
}

function toLookupError(error: unknown): NodeJS.ErrnoException {
    const err = error instanceof Error
        ? error as NodeJS.ErrnoException
        : new Error(String(error)) as NodeJS.ErrnoException
    err.code = err.code ?? 'EAI_FAIL'
    return err
}

async function resolveHostname(hostname: string): Promise<string[]> {
    const results = await dnsLookup(hostname, { all: true, verbatim: true })
    return results.map(result => result.address)
}

function getRemainingTimeoutMs(deadlineAt: number): number {
    const remaining = deadlineAt - Date.now()
    if (remaining <= 0) {
        throw createAbortError()
    }
    return remaining
}

function createAbortError(): DOMException {
    return new DOMException('The operation was aborted.', 'AbortError')
}

async function readIncomingMessageText(response: IncomingMessage, maxBytes: number, timeoutMs?: number): Promise<string> {
    const chunks: Buffer[] = []
    let total = 0
    let timeoutError: DOMException | null = null
    const timer = timeoutMs === undefined
        ? null
        : setTimeout(() => {
            timeoutError = createAbortError()
            response.destroy(timeoutError)
        }, timeoutMs)

    try {
        for await (const chunk of response) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            total += buffer.byteLength
            if (total > maxBytes) {
                response.destroy()
                throw new Error('Provider response exceeded the maximum diagnostic size.')
            }
            chunks.push(buffer)
        }
    } catch (error) {
        response.destroy()
        throw timeoutError ?? error
    } finally {
        if (timer) {
            clearTimeout(timer)
        }
    }

    return Buffer.concat(chunks, total).toString('utf8')
}

function inferProtocol(url: string, explicit: ProviderProtocol): ProviderProtocol {
    if (explicit !== 'auto') return explicit
    const hostname = new URL(url).hostname.toLowerCase()
    if (hostname.includes('generativelanguage') || hostname.includes('aiplatform') || hostname.includes('gemini')) {
        return 'gemini'
    }
    if (hostname.includes('anthropic') || hostname.includes('claude')) {
        return 'anthropic'
    }
    return 'openai'
}

function buildCapabilities(protocol: ProviderProtocol | null, modelsEndpoint: boolean): ProviderCapability {
    const capabilities = getDefaultProviderCapabilities()
    capabilities.modelsEndpoint = modelsEndpoint
    capabilities.messagesEndpoint = protocol !== null
    capabilities.streaming = protocol === null ? null : true
    return capabilities
}

function buildDiagnostic(
    url: string,
    statusCode: number | null,
    latencyMs: number | null,
    errorCode: string | null,
    message: string | null,
    capabilities?: ProviderCapability
): SafeProviderDiagnostic {
    return sanitizeProviderDiagnostic({
        url,
        statusCode,
        latencyMs,
        errorCode,
        message,
        capabilities,
    })
}

function buildHealth(
    status: ProviderHealth['status'],
    latencyMs: number | null,
    errorCode: string | null,
    errorMessage: string | null,
    protocolDetected: ProviderProtocol | null,
    capabilities: ProviderCapability
): ProviderHealth {
    return {
        status,
        latencyMs,
        checkedAt: Date.now(),
        errorCode,
        errorMessage: redactSensitiveText(errorMessage),
        protocolDetected,
        capabilities,
    }
}
