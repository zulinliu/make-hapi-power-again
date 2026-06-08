import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import type { ProviderCapability, SafeProviderDiagnostic } from '@hapipower/protocol'

const METADATA_IPV4 = '169.254.169.254'
const MAX_HOST_LABEL_LENGTH = 80

export type ProviderUrlValidationResult =
    | { ok: true; url: URL; warnings: string[]; resolvedAddresses: string[] }
    | { ok: false; code: string; message: string }

export type ProviderAddressValidationResult =
    | { ok: true }
    | { ok: false; code: string; message: string }

export type ProviderDnsResolver = (hostname: string) => Promise<string[]>

export type ProviderSecurityOptions = {
    resolveHost?: ProviderDnsResolver
    allowNonStandardPorts?: boolean
    allowSensitiveQueryParams?: boolean
    allowedSensitiveQueryParams?: string[]
}

const defaultCapabilities: ProviderCapability = {
    modelsEndpoint: false,
    messagesEndpoint: false,
    streaming: null,
    tokenUsage: null,
    contextWindow: null,
    toolUse: null,
    imageInput: null,
}

export function getDefaultProviderCapabilities(): ProviderCapability {
    return { ...defaultCapabilities }
}

export async function validateProviderBaseUrl(
    rawUrl: string,
    options: ProviderSecurityOptions = {}
): Promise<ProviderUrlValidationResult> {
    let url: URL
    try {
        url = new URL(rawUrl)
    } catch {
        return { ok: false, code: 'invalid-url', message: 'Base URL is not a valid URL.' }
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return { ok: false, code: 'unsupported-scheme', message: 'Only http:// and https:// URLs are allowed.' }
    }

    if (url.username || url.password) {
        return { ok: false, code: 'userinfo-blocked', message: 'Credentials in provider URLs are not allowed.' }
    }

    if (!options.allowSensitiveQueryParams) {
        const allowedSensitiveQueryParams = new Set(
            (options.allowedSensitiveQueryParams ?? []).map(normalizeQueryParamKey)
        )
        for (const key of url.searchParams.keys()) {
            if (isSensitiveQueryParam(key) && !allowedSensitiveQueryParams.has(normalizeQueryParamKey(key))) {
                return { ok: false, code: 'query-secret-blocked', message: 'Sensitive query parameters are not allowed in provider URLs.' }
            }
        }
    }

    const hostname = url.hostname.toLowerCase()
    if (!hostname) {
        return { ok: false, code: 'missing-host', message: 'Provider URL must include a host.' }
    }

    if (isBlockedHostnameLabel(hostname)) {
        return { ok: false, code: 'host-blocked', message: 'Provider URL host must be public.' }
    }

    const literalResult = validateHostAddress(hostname)
    if (!literalResult.ok) {
        return literalResult
    }

    const warnings: string[] = []
    if (url.protocol === 'http:') {
        warnings.push('insecure-http')
    }

    const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return { ok: false, code: 'invalid-port', message: 'Provider URL has an invalid port.' }
    }
    const isDefaultPort = (url.protocol === 'https:' && port === 443) || (url.protocol === 'http:' && port === 80)
    if (!isDefaultPort) {
        if (options.allowNonStandardPorts === false) {
            return { ok: false, code: 'non-standard-port', message: 'Provider URL uses a non-standard port.' }
        }
        warnings.push('non-standard-port')
    }

    let resolvedAddresses: string[] = []
    if (isIP(hostname) === 0) {
        const resolveHost = options.resolveHost ?? resolveHostname
        let addresses: string[]
        try {
            addresses = await resolveHost(hostname)
        } catch {
            return { ok: false, code: 'dns-lookup-failed', message: 'Provider host could not be resolved.' }
        }

        if (addresses.length === 0) {
            return { ok: false, code: 'dns-empty', message: 'Provider host did not resolve to an address.' }
        }
        resolvedAddresses = [...addresses].sort()

        for (const address of addresses) {
            const addressResult = validateHostAddress(address)
            if (!addressResult.ok) {
                return {
                    ok: false,
                    code: `dns-${addressResult.code}`,
                    message: 'Provider host resolves to a private or metadata address.',
                }
            }
        }
    }

    return { ok: true, url, warnings, resolvedAddresses }
}

export function assertSafeRedirect(from: URL, to: URL): ProviderUrlValidationResult {
    if (to.protocol !== 'https:' && to.protocol !== 'http:') {
        return { ok: false, code: 'redirect-scheme-blocked', message: 'Redirect target uses an unsupported scheme.' }
    }
    if (to.username || to.password) {
        return { ok: false, code: 'redirect-userinfo-blocked', message: 'Redirect target includes credentials.' }
    }
    if (from.protocol === 'https:' && to.protocol === 'http:') {
        return { ok: false, code: 'redirect-scheme-downgrade', message: 'HTTPS to HTTP redirects are blocked for provider checks.' }
    }
    if (from.hostname.toLowerCase() !== to.hostname.toLowerCase()) {
        return { ok: false, code: 'redirect-cross-host', message: 'Cross-host redirects are blocked for provider checks.' }
    }
    const addressResult = validateHostAddress(to.hostname.toLowerCase())
    if (!addressResult.ok) {
        return { ok: false, code: `redirect-${addressResult.code}`, message: 'Redirect target host must be public.' }
    }
    return { ok: true, url: to, warnings: [], resolvedAddresses: [] }
}

export function validateProviderResolvedAddress(address: string): ProviderAddressValidationResult {
    return validateHostAddress(address)
}

export function sanitizeProviderDiagnostic(input: {
    url: string
    statusCode?: number | null
    latencyMs?: number | null
    errorCode?: string | null
    message?: string | null
    capabilities?: ProviderCapability
}): SafeProviderDiagnostic {
    const parsed = safeParseUrl(input.url)
    return {
        hostLabel: parsed ? redactHostLabel(parsed.hostname) : 'redacted-host',
        path: parsed ? sanitizePath(parsed.pathname) : '/',
        statusCode: input.statusCode ?? null,
        latencyMs: input.latencyMs ?? null,
        errorCode: input.errorCode ?? null,
        safeMessage: redactSensitiveText(input.message ?? null),
        capabilities: input.capabilities ? { ...input.capabilities } : getDefaultProviderCapabilities(),
    }
}

export function redactSensitiveText(value: string | null): string | null {
    if (!value) return value
    return value
        .replace(/(authorization["'\s:=]+bearer\s+)[a-z0-9._~+/=-]+/gi, '$1[redacted]')
        .replace(/(authorization["'\s:=]+)[^\s"',}]+/gi, '$1[redacted]')
        .replace(/(authorization|x-api-key|api[-_]?key|token|password|secret|credential)(["'\s:=]+)[^\s"',}]+/gi, '$1$2[redacted]')
        .replace(/(bearer\s+)[a-z0-9._~+/=-]+/gi, '$1[redacted]')
        .replace(/([?&](?:key|api_key|token|access_token|password|secret)=)[^&\s]+/gi, '$1[redacted]')
        .replace(/\bsk-(?:ant-)?[a-z0-9][a-z0-9._-]{6,}\b/gi, '[redacted]')
        .replace(/\bAIza[a-z0-9_-]{20,}\b/gi, '[redacted]')
        .slice(0, 500)
}

function safeParseUrl(url: string): URL | null {
    try {
        return new URL(url)
    } catch {
        return null
    }
}

function sanitizePath(pathname: string): string {
    const path = pathname || '/'
    return path.length > 160 ? `${path.slice(0, 157)}...` : path
}

function redactHostLabel(hostname: string): string {
    if (isIP(hostname) !== 0) {
        return '[ip-redacted]'
    }
    const labels = hostname.split('.').filter(Boolean)
    if (labels.length <= 2) {
        return trimHostLabel(hostname)
    }
    const publicSuffix = labels.slice(-2).join('.')
    return trimHostLabel(`*.${publicSuffix}`)
}

function trimHostLabel(hostname: string): string {
    return hostname.length > MAX_HOST_LABEL_LENGTH
        ? `${hostname.slice(0, MAX_HOST_LABEL_LENGTH - 3)}...`
        : hostname
}

async function resolveHostname(hostname: string): Promise<string[]> {
    const results = await dnsLookup(hostname, { all: true, verbatim: true })
    return results.map(result => result.address)
}

function isBlockedHostnameLabel(hostname: string): boolean {
    const normalized = hostname.replace(/\.$/, '')
    return normalized === 'localhost'
        || normalized.endsWith('.localhost')
        || normalized === 'metadata.google.internal'
}

function isSensitiveQueryParam(key: string): boolean {
    const normalized = normalizeQueryParamKey(key)
    if (!normalized) return false
    const exact = new Set([
        'key',
        'apikey',
        'apitoken',
        'token',
        'accesstoken',
        'password',
        'secret',
        'credential',
        'credentials',
        'auth',
        'authorization',
        'bearer',
        'signature',
        'sig',
    ])
    return exact.has(normalized)
        || normalized.endsWith('apikey')
        || normalized.endsWith('token')
        || normalized.endsWith('password')
        || normalized.endsWith('secret')
        || normalized.endsWith('credential')
}

function normalizeQueryParamKey(key: string): string {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function validateHostAddress(hostnameOrAddress: string): ProviderAddressValidationResult {
    const address = normalizeAddress(hostnameOrAddress)
    if (!address) {
        return { ok: true }
    }

    if (address.family === 4 && isPrivateIpv4(address.value)) {
        return { ok: false, code: 'private-ip-blocked', message: 'Private IPv4 addresses are not allowed.' }
    }
    if (address.family === 6 && isPrivateIpv6(address.value)) {
        return { ok: false, code: 'private-ip-blocked', message: 'Private IPv6 addresses are not allowed.' }
    }
    return { ok: true }
}

function normalizeAddress(value: string): { family: 4 | 6; value: string } | null {
    const unwrapped = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value
    const family = isIP(unwrapped)
    if (family === 4) return { family: 4, value: unwrapped }
    if (family === 6) {
        const mapped = parseIpv4MappedIpv6(unwrapped)
        return mapped ? { family: 4, value: mapped } : { family: 6, value: unwrapped.toLowerCase() }
    }
    return null
}

function parseIpv4MappedIpv6(value: string): string | null {
    const lower = value.toLowerCase()
    const prefix = '::ffff:'
    if (!lower.startsWith(prefix)) return null
    const tail = lower.slice(prefix.length)
    if (isIP(tail) === 4) return tail

    let n: number
    const words = tail.split(':')
    if (words.length === 1) {
        if (!/^[0-9a-f]{1,8}$/.test(words[0])) return null
        n = Number.parseInt(words[0], 16)
    } else if (words.length === 2) {
        if (!words.every(word => /^[0-9a-f]{1,4}$/.test(word))) return null
        n = (Number.parseInt(words[0], 16) * 0x10000) + Number.parseInt(words[1], 16)
    } else {
        return null
    }

    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return null
    return [
        Math.floor(n / 0x1000000) % 0x100,
        Math.floor(n / 0x10000) % 0x100,
        Math.floor(n / 0x100) % 0x100,
        n % 0x100,
    ].join('.')
}

function ipv4ToNumber(address: string): number | null {
    const parts = address.split('.')
    if (parts.length !== 4) return null
    let result = 0
    for (const part of parts) {
        if (!/^\d+$/.test(part)) return null
        const value = Number(part)
        if (!Number.isInteger(value) || value < 0 || value > 255) return null
        result = (result << 8) + value
    }
    return result >>> 0
}

function isPrivateIpv4(address: string): boolean {
    if (address === METADATA_IPV4) return true
    const n = ipv4ToNumber(address)
    if (n === null) return true
    return inIpv4Range(n, '0.0.0.0', 8)
        || inIpv4Range(n, '10.0.0.0', 8)
        || inIpv4Range(n, '100.64.0.0', 10)
        || inIpv4Range(n, '127.0.0.0', 8)
        || inIpv4Range(n, '169.254.0.0', 16)
        || inIpv4Range(n, '172.16.0.0', 12)
        || inIpv4Range(n, '192.0.0.0', 24)
        || inIpv4Range(n, '192.0.2.0', 24)
        || inIpv4Range(n, '192.168.0.0', 16)
        || inIpv4Range(n, '198.18.0.0', 15)
        || inIpv4Range(n, '198.51.100.0', 24)
        || inIpv4Range(n, '203.0.113.0', 24)
        || inIpv4Range(n, '224.0.0.0', 4)
        || inIpv4Range(n, '240.0.0.0', 4)
}

function inIpv4Range(address: number, base: string, prefix: number): boolean {
    const baseNumber = ipv4ToNumber(base)
    if (baseNumber === null) return false
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
    return (address & mask) === (baseNumber & mask)
}

function isPrivateIpv6(address: string): boolean {
    const lower = address.toLowerCase()
    return lower === '::'
        || lower === '::1'
        || isIpv6Prefix(lower, 0xfe80, 0xffc0)
        || lower.startsWith('fc')
        || lower.startsWith('fd')
        || lower.startsWith('ff')
        || lower.startsWith('2001:db8:')
}

function isIpv6Prefix(address: string, base: number, mask: number): boolean {
    const firstGroupText = address.split(':', 1)[0]
    if (!firstGroupText || !/^[0-9a-f]{1,4}$/.test(firstGroupText)) return false
    const firstGroup = Number.parseInt(firstGroupText, 16)
    return (firstGroup & mask) === (base & mask)
}
