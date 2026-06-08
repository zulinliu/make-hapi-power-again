import { describe, expect, test } from 'bun:test'
import {
    assertSafeRedirect,
    redactSensitiveText,
    sanitizeProviderDiagnostic,
    validateProviderBaseUrl,
} from './providerSecurity'

describe('Provider SSRF 防护', () => {
    test('允许公开 http/https host，并记录非标准端口 warning', async () => {
        const result = await validateProviderBaseUrl('https://api.example.com:8443/v1', {
            resolveHost: async () => ['93.184.216.34'],
        })

        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.url.hostname).toBe('api.example.com')
            expect(result.warnings).toContain('non-standard-port')
        }
    })

    test('可按策略拒绝非标准端口', async () => {
        const result = await validateProviderBaseUrl('https://api.example.com:8443/v1', {
            allowNonStandardPorts: false,
            resolveHost: async () => ['93.184.216.34'],
        })

        expect(result).toMatchObject({ ok: false, code: 'non-standard-port' })
    })

    test('拒绝不支持的 scheme、userinfo 与 localhost', async () => {
        await expect(validateProviderBaseUrl('file:///etc/passwd')).resolves.toMatchObject({ ok: false, code: 'unsupported-scheme' })
        await expect(validateProviderBaseUrl('https://user:pass@api.example.com')).resolves.toMatchObject({ ok: false, code: 'userinfo-blocked' })
        await expect(validateProviderBaseUrl('http://localhost:3016')).resolves.toMatchObject({ ok: false, code: 'host-blocked' })
    })

    test('拒绝私网、metadata 与 IPv4 变体 literal', async () => {
        const blocked = [
            'http://127.0.0.1',
            'http://10.0.0.1',
            'http://172.16.0.10',
            'http://192.168.1.10',
            'http://169.254.169.254',
            'http://2130706433',
            'http://0177.0.0.1',
            'http://0x7f000001',
            'http://[::1]',
            'http://[fe80::1]',
            'http://[fe90::1]',
            'http://[fea0::1]',
            'http://[febf::1]',
            'http://[::ffff:127.0.0.1]',
            'http://[::ffff:169.254.169.254]',
            'http://[::ffff:c0a8:1]',
            'http://[::ffff:ac10:a]',
        ]

        for (const url of blocked) {
            const result = await validateProviderBaseUrl(url)
            expect({ url, result }).toMatchObject({ result: { ok: false, code: 'private-ip-blocked' } })
        }
    })

    test('拒绝解析到私网地址的 DNS host', async () => {
        const result = await validateProviderBaseUrl('https://api.example.com', {
            resolveHost: async () => ['192.168.1.20'],
        })

        expect(result).toMatchObject({ ok: false, code: 'dns-private-ip-blocked' })
    })

    test('拒绝用户提交的敏感 query 参数', async () => {
        const result = await validateProviderBaseUrl('https://api.example.com/v1?key=abc', {
            resolveHost: async () => ['93.184.216.34'],
        })

        expect(result).toMatchObject({ ok: false, code: 'query-secret-blocked' })
    })

    test('内部探测可显式允许临时 query key，但不放开其它 secret', async () => {
        const result = await validateProviderBaseUrl('https://api.example.com/v1/models?key=abc', {
            allowedSensitiveQueryParams: ['key'],
            resolveHost: async () => ['93.184.216.34'],
        })

        expect(result.ok).toBe(true)

        const tokenResult = await validateProviderBaseUrl('https://api.example.com/v1/models?token=abc', {
            allowedSensitiveQueryParams: ['key'],
            resolveHost: async () => ['93.184.216.34'],
        })
        expect(tokenResult).toMatchObject({ ok: false, code: 'query-secret-blocked' })
    })

    test('拒绝空 DNS 和 DNS 查询失败', async () => {
        await expect(validateProviderBaseUrl('https://api.example.com', {
            resolveHost: async () => [],
        })).resolves.toMatchObject({ ok: false, code: 'dns-empty' })

        await expect(validateProviderBaseUrl('https://api.example.com', {
            resolveHost: async () => { throw new Error('lookup failed') },
        })).resolves.toMatchObject({ ok: false, code: 'dns-lookup-failed' })
    })
})

describe('Provider redirect 安全', () => {
    test('允许同 host 且不降级的 redirect', () => {
        const result = assertSafeRedirect(
            new URL('https://api.example.com/v1/models'),
            new URL('https://api.example.com/v1/openai/models')
        )

        expect(result.ok).toBe(true)
    })

    test('拒绝 HTTPS 到 HTTP 的同 host 降级 redirect', () => {
        const result = assertSafeRedirect(
            new URL('https://api.example.com/v1/models'),
            new URL('http://api.example.com/v1/models')
        )

        expect(result).toMatchObject({ ok: false, code: 'redirect-scheme-downgrade' })
    })

    test('拒绝跨 host、userinfo、非 http(s) 与私网 literal redirect', () => {
        expect(assertSafeRedirect(
            new URL('https://api.example.com/v1/models'),
            new URL('https://evil.example.com/v1/models')
        )).toMatchObject({ ok: false, code: 'redirect-cross-host' })

        expect(assertSafeRedirect(
            new URL('https://api.example.com/v1/models'),
            new URL('https://user:pass@api.example.com/v1/models')
        )).toMatchObject({ ok: false, code: 'redirect-userinfo-blocked' })

        expect(assertSafeRedirect(
            new URL('https://api.example.com/v1/models'),
            new URL('file:///etc/passwd')
        )).toMatchObject({ ok: false, code: 'redirect-scheme-blocked' })

        expect(assertSafeRedirect(
            new URL('http://127.0.0.1/v1/models'),
            new URL('http://127.0.0.1/internal')
        )).toMatchObject({ ok: false, code: 'redirect-private-ip-blocked' })
    })
})

describe('Provider 诊断脱敏', () => {
    test('只返回 host label、path 和脱敏后的安全消息', () => {
        const diagnostic = sanitizeProviderDiagnostic({
            url: 'https://tenant.api.example.com/v1/models?key=real-secret',
            statusCode: 500,
            latencyMs: 42,
            errorCode: 'http-500',
            message: 'Authorization: Bearer sk-real-secret token=secret password=hunter2 key=abc',
        })

        expect(diagnostic.hostLabel).toBe('*.example.com')
        expect(diagnostic.path).toBe('/v1/models')
        expect(diagnostic.statusCode).toBe(500)
        expect(diagnostic.safeMessage).not.toContain('sk-real-secret')
        expect(diagnostic.safeMessage).not.toContain('hunter2')
        expect(diagnostic.safeMessage).not.toContain('secret')
        expect(diagnostic.safeMessage).toContain('[redacted]')
    })

    test('redactSensitiveText 脱敏 query、bearer 和 key-like 字段', () => {
        const redacted = redactSensitiveText('url=?key=abc&token=def Authorization Bearer sk-test apiKey: value password=value sk-ant-api03-abcdef1234567890 AIzaSyExampleExampleExampleExample')

        expect(redacted).not.toContain('abc')
        expect(redacted).not.toContain('def')
        expect(redacted).not.toContain('sk-test')
        expect(redacted).not.toContain('sk-ant-api03')
        expect(redacted).not.toContain('AIzaSy')
        expect(redacted).toContain('[redacted]')
    })
})
