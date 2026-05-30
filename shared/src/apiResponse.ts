/**
 * 统一 API 响应信封格式
 * 所有 API 端点统一使用 ApiResponse<T> 返回
 */

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    total?: number
    page?: number
    limit?: number
    hasMore?: boolean
  }
}

export function apiSuccess<T>(data: T, meta?: ApiResponse<T>['meta']): ApiResponse<T> {
  return { success: true, data, ...(meta ? { meta } : {}) }
}

export function apiError(code: string, message: string, details?: unknown): ApiResponse<never> {
  return { success: false, error: { code, message, details } }
}

export function apiPaginated<T>(
  data: T[],
  opts: { total: number; page: number; limit: number }
): ApiResponse<T[]> {
  return {
    success: true,
    data,
    meta: {
      total: opts.total,
      page: opts.page,
      limit: opts.limit,
      hasMore: opts.page * opts.limit < opts.total,
    },
  }
}

/** 常见错误码 */
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PATH_TRAVERSAL: 'PATH_TRAVERSAL',
  RESOURCE_LIMIT: 'RESOURCE_LIMIT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const
