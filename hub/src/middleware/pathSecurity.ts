/**
 * Hub 端路径安全中间件
 * 供 Hono 路由使用，验证请求中的文件路径参数
 */
import type { Context, Next } from 'hono'

function sanitizePath(input: string): string {
  let path = input
  let prev = ''
  let iterations = 0
  while (prev !== path && iterations < 5) {
    prev = path
    try {
      path = decodeURIComponent(path)
    } catch {
      break
    }
    iterations++
  }
  path = path.replace(/\0/g, '')
  if (typeof path.normalize === 'function') {
    path = path.normalize('NFC')
  }
  return path
}

interface PathSecurityOptions {
  paramName?: string
  queryParam?: string
  workspaceRoot?: string
}

export function createPathSecurityMiddleware(opts: PathSecurityOptions = {}) {
  const { paramName = 'path', queryParam, workspaceRoot } = opts

  return async (c: Context, next: Next) => {
    let rawPath: string | undefined

    if (paramName) {
      rawPath = c.req.param(paramName)
    }
    if (!rawPath && queryParam) {
      rawPath = c.req.query(queryParam)
    }

    if (!rawPath) {
      return next()
    }

    const sanitized = sanitizePath(rawPath)

    // Reject null bytes after sanitization
    if (sanitized.includes('\0')) {
      return c.json({ success: false, error: { code: 'PATH_TRAVERSAL', message: 'Null bytes in path' } }, 400)
    }

    // Reject path traversal patterns after normalization
    if (sanitized.includes('..')) {
      const resolved = new URL(sanitized, 'file:///').pathname
      if (resolved.includes('..')) {
        return c.json({ success: false, error: { code: 'PATH_TRAVERSAL', message: 'Path traversal detected' } }, 400)
      }
    }

    // If workspace root is configured, validate prefix
    if (workspaceRoot) {
      const { resolve } = await import('node:path')
      const fullPath = resolve(workspaceRoot, sanitized)
      if (!fullPath.startsWith(resolve(workspaceRoot))) {
        return c.json({ success: false, error: { code: 'PATH_TRAVERSAL', message: 'Path outside workspace' } }, 403)
      }
    }

    // Store sanitized path for downstream handlers
    c.set('sanitizedPath' as never, sanitized as never)
    return next()
  }
}
