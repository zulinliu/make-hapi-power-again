/**
 * 日志脱敏工具
 * 防止敏感信息（token、密码、路径、IP）泄露到日志
 */

const SENSITIVE_PATTERNS: [RegExp, string][] = [
  // Bearer tokens
  [/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]'],
  // JWT tokens (three base64 segments)
  [/[A-Za-z0-9\-._~+/]{40,}\.[A-Za-z0-9\-._~+/]+\.[A-Za-z0-9\-._~+/]+/g, '[JWT_REDACTED]'],
  // API keys (common prefixes)
  [/(api[_-]?key|token|secret|password|credential|auth)\s*[:=]\s*["']?[A-Za-z0-9\-._]{8,}/gi, '$1=[REDACTED]'],
  // Inline secrets in URLs
  [/([?&](?:token|key|secret|password|api_key)=)[^&\s]+/g, '$1[REDACTED]'],
]

export function sanitizeLog(message: string): string {
  let result = message
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

export function createSanitizedLogger(baseLogger: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void; debug?: (...args: unknown[]) => void }) {
  return {
    info: (...args: unknown[]) => baseLogger.info(...args.map(a => typeof a === 'string' ? sanitizeLog(a) : a)),
    warn: (...args: unknown[]) => baseLogger.warn(...args.map(a => typeof a === 'string' ? sanitizeLog(a) : a)),
    error: (...args: unknown[]) => baseLogger.error(...args.map(a => typeof a === 'string' ? sanitizeLog(a) : a)),
    debug: baseLogger.debug
      ? (...args: unknown[]) => baseLogger.debug!(...args.map(a => typeof a === 'string' ? sanitizeLog(a) : a))
      : undefined,
  }
}
