import type {
    AgentFlavor,
    ProviderProtocol,
    SessionLoomSynthesisProvider,
} from '@hapipower/protocol'
import { isKnownFlavor } from '@hapipower/protocol'
import type { Session } from '@hapipower/protocol/types'
import type { IncomingMessage } from 'node:http'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { Store } from '../store'
import type { StoredProvider } from '../store/providerStore'
import { decryptAES256GCM, getEncryptionKey } from '../utils/crypto'
import { createSafeLookup } from './modelDiscovery'
import {
    getProviderSecurityOptionsFromEnv,
    type ProviderSecurityOptions,
    redactSensitiveText,
    validateProviderBaseUrl,
} from './providerSecurity'

const REQUEST_TIMEOUT_MS = 60_000
const MAX_RESPONSE_BYTES = 6_000_000
const BAD_RESPONSE_PREVIEW_BYTES = 2_048

type ProviderHttpResponse = {
    status: number
    headers: {
        get(name: string): string | null
    }
    readText(maxBytes: number, timeoutMs?: number): Promise<string>
}

export type SessionLoomProviderHttpTransport = (
    url: URL,
    options: {
        headers: Record<string, string>
        body: string
        timeoutMs: number
        security?: ProviderSecurityOptions
    }
) => Promise<ProviderHttpResponse>

export type SessionLoomDesignSynthesis = {
    markdown: string
    provider: SessionLoomSynthesisProvider
}

export type SessionLoomDesignSynthesizer = (input: {
    store: Store
    session: Session
    systemPrompt: string
    prompt: string
}) => Promise<SessionLoomDesignSynthesis>

type ProviderRequest = {
    url: URL
    headers: Record<string, string>
    body: string
    protocol: Exclude<ProviderProtocol, 'auto'>
}

type ResolvedProviderConfig = {
    provider: StoredProvider
    providerMetadata: SessionLoomSynthesisProvider
    apiKey: string
}

export class SessionLoomSynthesisError extends Error {
    readonly status: number

    constructor(status: number, message: string) {
        super(message)
        this.name = 'SessionLoomSynthesisError'
        this.status = status
    }
}

export class SessionLoomSynthesisService {
    private readonly transport: SessionLoomProviderHttpTransport
    private readonly security: ProviderSecurityOptions

    constructor(options: {
        transport?: SessionLoomProviderHttpTransport
        security?: ProviderSecurityOptions
    } = {}) {
        this.transport = options.transport ?? createSafeJsonTransport()
        this.security = options.security ?? getProviderSecurityOptionsFromEnv()
    }

    async synthesizeDesign(input: {
        store: Store
        session: Session
        systemPrompt: string
        prompt: string
    }): Promise<SessionLoomDesignSynthesis> {
        const resolved = resolveProviderConfig(input.store, input.session)
        const request = buildProviderRequest({
            provider: resolved.provider,
            apiKey: resolved.apiKey,
            model: resolved.providerMetadata.model,
            systemPrompt: input.systemPrompt,
            prompt: input.prompt,
        })
        const body = await postProviderJson(request, this.transport, this.security)
        const markdown = normalizeMarkdown(extractMarkdown(body, request.protocol))
        if (markdown.length === 0) {
            throw new SessionLoomSynthesisError(502, 'Provider response did not include generated Markdown.')
        }
        return {
            markdown,
            provider: resolved.providerMetadata,
        }
    }
}

const defaultService = new SessionLoomSynthesisService()

export const synthesizeSessionLoomDesign: SessionLoomDesignSynthesizer = async (input) => {
    return await defaultService.synthesizeDesign(input)
}

function resolveProviderConfig(store: Store, session: Session): ResolvedProviderConfig {
    const agentFlavor = resolveAgentFlavor(session)
    const provider = store.providers.getDefaultForFlavor(agentFlavor, session.namespace)
    if (!provider) {
        throw new SessionLoomSynthesisError(409, 'No default provider is configured for the current session agent.')
    }

    const defaultAssignment = store.providers
        .getAssignmentsForFlavor(agentFlavor, session.namespace)
        .find((assignment) => assignment.providerId === provider.id && assignment.isDefault)
    const model = normalizeModel(session.model)
        ?? normalizeModel(defaultAssignment?.model)
        ?? normalizeModel(provider.defaultModel)
        ?? normalizeModel(provider.modelCache[0]?.id)

    if (!model) {
        throw new SessionLoomSynthesisError(409, 'No model is configured for the current session provider.')
    }

    let apiKey: string
    try {
        apiKey = decryptAES256GCM(provider.apiKeyEncrypted, getEncryptionKey())
    } catch {
        throw new SessionLoomSynthesisError(409, 'Provider key could not be decrypted.')
    }

    return {
        provider,
        apiKey,
        providerMetadata: {
            providerId: provider.id,
            providerName: provider.name,
            protocol: inferProtocol(provider.baseUrl, provider.protocol),
            model,
            agentFlavor,
        },
    }
}

function resolveAgentFlavor(session: Session): AgentFlavor {
    const flavor = session.metadata?.flavor
    return isKnownFlavor(flavor) ? flavor : 'claude'
}

function normalizeModel(value: string | null | undefined): string | null {
    const model = value?.trim()
    if (!model || model === 'auto') {
        return null
    }
    return model
}

function buildProviderRequest(input: {
    provider: StoredProvider
    apiKey: string
    model: string
    systemPrompt: string
    prompt: string
}): ProviderRequest {
    const protocol = inferProtocol(input.provider.baseUrl, input.provider.protocol)
    if (protocol === 'anthropic') {
        return {
            protocol,
            url: buildEndpointUrl(input.provider.baseUrl, '/v1/messages'),
            headers: {
                'content-type': 'application/json',
                'x-api-key': input.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: input.model,
                max_tokens: 8192,
                temperature: 0.2,
                system: input.systemPrompt,
                messages: [
                    { role: 'user', content: input.prompt },
                ],
            }),
        }
    }

    if (protocol === 'gemini') {
        const url = buildGeminiGenerateContentUrl(input.provider.baseUrl, input.model)
        url.searchParams.set('key', input.apiKey)
        return {
            protocol,
            url,
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: input.systemPrompt }],
                },
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: input.prompt }],
                    },
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 8192,
                },
            }),
        }
    }

    return {
        protocol,
        url: buildEndpointUrl(input.provider.baseUrl, '/v1/chat/completions'),
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify({
            model: input.model,
            temperature: 0.2,
            messages: [
                { role: 'system', content: input.systemPrompt },
                { role: 'user', content: input.prompt },
            ],
        }),
    }
}

async function postProviderJson(
    request: ProviderRequest,
    transport: SessionLoomProviderHttpTransport,
    security: ProviderSecurityOptions
): Promise<unknown> {
    const securityOptions = buildSynthesisSecurityOptions(request.url, request.protocol, security)
    const validation = await validateProviderBaseUrl(request.url.toString(), securityOptions)
    if (!validation.ok) {
        throw new SessionLoomSynthesisError(409, validation.message)
    }

    const startedAt = Date.now()
    const deadlineAt = startedAt + REQUEST_TIMEOUT_MS
    try {
        const response = await transport(request.url, {
            headers: request.headers,
            body: request.body,
            timeoutMs: getRemainingTimeoutMs(deadlineAt),
            security: securityOptions,
        })
        const postValidation = await validateProviderBaseUrl(request.url.toString(), securityOptions)
        if (!postValidation.ok) {
            throw new SessionLoomSynthesisError(409, postValidation.message)
        }
        if (!sameAddressSet(validation.resolvedAddresses, postValidation.resolvedAddresses)) {
            throw new SessionLoomSynthesisError(409, 'Provider host DNS changed during request.')
        }
        if (response.status < 200 || response.status >= 300) {
            const bodyPreview = await response.readText(BAD_RESPONSE_PREVIEW_BYTES, getRemainingTimeoutMs(deadlineAt)).catch(() => '')
            const safePreview = redactSensitiveText(bodyPreview)
            const suffix = safePreview ? `: ${safePreview}` : ''
            const status = response.status === 401 || response.status === 403 ? 409 : 502
            throw new SessionLoomSynthesisError(status, `Provider synthesis failed with HTTP ${response.status}${suffix}`)
        }

        const text = await response.readText(MAX_RESPONSE_BYTES, getRemainingTimeoutMs(deadlineAt))
        return JSON.parse(text) as unknown
    } catch (error) {
        if (error instanceof SessionLoomSynthesisError) {
            throw error
        }
        const message = error instanceof Error ? error.message : 'Unknown provider synthesis error'
        const safeMessage = redactSensitiveText(message) ?? 'Unknown provider synthesis error'
        const status = error instanceof SyntaxError ? 502 : 502
        throw new SessionLoomSynthesisError(status, `Provider synthesis failed: ${safeMessage}`)
    }
}

function buildSynthesisSecurityOptions(
    url: URL,
    protocol: Exclude<ProviderProtocol, 'auto'>,
    security: ProviderSecurityOptions
): ProviderSecurityOptions {
    const allowedSensitiveQueryParams = new Set(security.allowedSensitiveQueryParams ?? [])
    if (protocol === 'gemini' || url.searchParams.has('key')) {
        allowedSensitiveQueryParams.add('key')
    }
    return {
        ...security,
        allowedSensitiveQueryParams: [...allowedSensitiveQueryParams],
    }
}

function inferProtocol(baseUrl: string, explicit: ProviderProtocol): Exclude<ProviderProtocol, 'auto'> {
    if (explicit === 'anthropic' || explicit === 'openai' || explicit === 'gemini') {
        return explicit
    }
    const hostname = new URL(baseUrl).hostname.toLowerCase()
    if (hostname.includes('generativelanguage') || hostname.includes('aiplatform') || hostname.includes('gemini')) {
        return 'gemini'
    }
    if (hostname.includes('anthropic') || hostname.includes('claude')) {
        return 'anthropic'
    }
    return 'openai'
}

function buildEndpointUrl(baseUrl: string, endpointPath: '/v1/chat/completions' | '/v1/messages'): URL {
    const url = new URL(baseUrl)
    const path = stripTrailingSlash(url.pathname)
    if (path.endsWith(endpointPath)) {
        return url
    }
    if (path.endsWith('/v1')) {
        url.pathname = `${path}${endpointPath.slice('/v1'.length)}`
        return url
    }
    url.pathname = `${path}${endpointPath}`
    return url
}

function buildGeminiGenerateContentUrl(baseUrl: string, model: string): URL {
    const url = new URL(baseUrl)
    const path = stripTrailingSlash(url.pathname)
    if (path.endsWith(':generateContent')) {
        return url
    }
    if (path.includes('/models/')) {
        url.pathname = path
        url.pathname = `${stripTrailingSlash(url.pathname)}:generateContent`
        return url
    }
    const versionPath = path.endsWith('/v1') || path.endsWith('/v1beta')
        ? path
        : `${path}/v1beta`
    url.pathname = `${versionPath}/${geminiModelPath(model)}:generateContent`
    return url
}

function geminiModelPath(model: string): string {
    if (model.startsWith('models/')) {
        return model
            .split('/')
            .map((part) => encodeURIComponent(part))
            .join('/')
    }
    return `models/${encodeURIComponent(model)}`
}

function stripTrailingSlash(value: string): string {
    const stripped = value.replace(/\/+$/, '')
    return stripped.length > 0 ? stripped : ''
}

function extractMarkdown(body: unknown, protocol: Exclude<ProviderProtocol, 'auto'>): string {
    if (protocol === 'anthropic') {
        return extractAnthropicText(body)
    }
    if (protocol === 'gemini') {
        return extractGeminiText(body)
    }
    return extractOpenAIText(body)
}

function extractOpenAIText(body: unknown): string {
    if (!isRecord(body) || !Array.isArray(body.choices)) {
        return ''
    }
    for (const choice of body.choices) {
        if (!isRecord(choice)) continue
        const message = isRecord(choice.message) ? choice.message : null
        const content = extractText(message?.content)
        if (content) return content
        const text = extractText(choice.text)
        if (text) return text
    }
    return ''
}

function extractAnthropicText(body: unknown): string {
    if (!isRecord(body)) {
        return ''
    }
    return extractText(body.content)
}

function extractGeminiText(body: unknown): string {
    if (!isRecord(body) || !Array.isArray(body.candidates)) {
        return ''
    }
    for (const candidate of body.candidates) {
        if (!isRecord(candidate)) continue
        const content = isRecord(candidate.content) ? candidate.content : null
        const text = extractText(content?.parts)
        if (text) return text
    }
    return ''
}

function extractText(value: unknown): string {
    if (typeof value === 'string') {
        return value
    }
    if (Array.isArray(value)) {
        return value
            .map((item) => extractText(item))
            .filter((item) => item.trim().length > 0)
            .join('\n')
    }
    if (!isRecord(value)) {
        return ''
    }
    if (typeof value.text === 'string') {
        return value.text
    }
    if (typeof value.content === 'string') {
        return value.content
    }
    return extractText(value.content) || extractText(value.parts)
}

function normalizeMarkdown(markdown: string): string {
    const trimmed = markdown.trim()
    const fenced = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i)
    return (fenced?.[1] ?? trimmed).trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sameAddressSet(left: string[], right: string[]): boolean {
    if (left.length !== right.length) return false
    for (let i = 0; i < left.length; i++) {
        if (left[i] !== right[i]) return false
    }
    return true
}

function createSafeJsonTransport(): SessionLoomProviderHttpTransport {
    return async (url, options) => {
        const request = url.protocol === 'https:' ? httpsRequest : httpRequest
        return await new Promise<ProviderHttpResponse>((resolve, reject) => {
            if (options.timeoutMs <= 0) {
                reject(createAbortError())
                return
            }
            let settled = false
            let timer: ReturnType<typeof setTimeout> | null = null
            const bodyBuffer = Buffer.from(options.body, 'utf8')
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
                method: 'POST',
                headers: {
                    ...options.headers,
                    'content-length': `${bodyBuffer.byteLength}`,
                },
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
            req.write(bodyBuffer)
            req.end()
        })
    }
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
                throw new Error('Provider response exceeded the maximum size.')
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
