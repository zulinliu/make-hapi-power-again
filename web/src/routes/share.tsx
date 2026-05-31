import { useState, useCallback } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

export default function ShareViewPage() {
    const { shareId } = useParams({ strict: false }) as { shareId: string }
    const [error, setError] = useState<string | null>(null)
    const [password, setPassword] = useState('')
    const [passwordRequired, setPasswordRequired] = useState(false)

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['share', shareId],
        queryFn: async () => {
            const res = await fetch(`/api/s/${shareId}`)
            const body = await res.json().catch(() => ({}))

            if (!res.ok) {
                throw new Error(body.error || 'Failed to load share')
            }

            if (body.requiresPassword) {
                setPasswordRequired(true)
                return body
            }

            return body
        },
        retry: false,
    })

    const handlePasswordSubmit = useCallback(async () => {
        if (!password.trim()) return
        try {
            const res = await fetch(`/api/s/${shareId}/access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            })
            const body = await res.json()

            if (!res.ok) {
                setError(body.error || '密码错误')
                return
            }

            setPasswordRequired(false)
            setError(null)
            refetch()
        } catch {
            setError('请求失败，请重试')
        }
    }, [shareId, password, refetch])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[100dvh] bg-[var(--app-bg)]">
                <div className="text-sm text-[var(--app-hint)]">加载中...</div>
            </div>
        )
    }

    if (passwordRequired && !data?.success) {
        return (
            <div className="flex items-center justify-center min-h-[100dvh] bg-[var(--app-bg)] px-6">
                <div className="w-full max-w-sm">
                    <div className="text-center mb-6">
                        <div className="text-4xl mb-3">🔒</div>
                        <div className="font-semibold text-[var(--app-fg)] text-lg">需要密码</div>
                        <div className="text-sm text-[var(--app-hint)] mt-1">此分享链接已设置密码保护</div>
                    </div>
                    {error && (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 px-3 py-2 text-xs text-red-700 dark:text-red-400 text-center">
                            {error}
                        </div>
                    )}
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(null) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit() }}
                        placeholder="输入密码"
                        autoFocus
                        className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-3 py-2.5 text-sm text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none focus:ring-1 focus:ring-[var(--app-link)]"
                    />
                    <button
                        type="button"
                        onClick={handlePasswordSubmit}
                        className="w-full mt-3 rounded-lg bg-[var(--app-link)] py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                    >
                        确认
                    </button>
                </div>
            </div>
        )
    }

    if (error || !data?.success) {
        return (
            <div className="flex items-center justify-center min-h-[100dvh] bg-[var(--app-bg)] px-6">
                <div className="text-center">
                    <div className="text-4xl mb-4">🔗</div>
                    <div className="font-semibold text-[var(--app-fg)] text-lg">链接不可用</div>
                    <div className="text-sm text-[var(--app-hint)] mt-2">{error || data?.error || '分享链接不存在或已过期'}</div>
                </div>
            </div>
        )
    }

    const share = data.share as { scope: string; createdAt: number; expiresAt: number | null }
    const snapshot = data.snapshot as { changes?: Array<{ filePath: string; changeType: string; afterContent: string }>; truncated?: boolean }
    const changes = snapshot.changes ?? []

    return (
        <div className="flex flex-col min-h-[100dvh] bg-[var(--app-bg)]">
            <div className="px-4 py-3 border-b border-[var(--app-border)] pt-[calc(0.75rem+env(safe-area-inset-top))]">
                <div className="font-semibold text-[var(--app-fg)]">共享快照</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--app-hint)]">
                    <span>创建于 {new Date(share.createdAt).toLocaleString()}</span>
                    {share.expiresAt && (
                        <span>有效期至 {new Date(share.expiresAt).toLocaleString()}</span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-[var(--app-secondary-bg)]">{share.scope}</span>
                </div>
            </div>

            {snapshot.truncated && (
                <div className="mx-4 mt-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
                    数据较多，快照仅包含最近 200 条消息中的变更
                </div>
            )}

            {changes.length > 0 ? (
                <div className="flex-1 p-4 space-y-2">
                    {changes.map((change) => (
                        <div key={change.filePath} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)] overflow-hidden">
                            <div className="px-3 py-2 flex items-center gap-2">
                                <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${
                                    change.changeType === 'created' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                    change.changeType === 'modified' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                }`}>
                                    {{ created: '新建', modified: '修改', deleted: '删除' }[change.changeType as 'created' | 'modified' | 'deleted'] ?? change.changeType}
                                </span>
                                <span className="text-sm text-[var(--app-fg)] truncate">{change.filePath}</span>
                            </div>
                            {change.afterContent && (
                                <div className="border-t border-[var(--app-border)] bg-[var(--app-bg)]">
                                    <pre className="text-xs text-[var(--app-fg)] p-3 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                                        {change.afterContent.length > 1500
                                            ? change.afterContent.slice(0, 1500) + '\n... (已截断)'
                                            : change.afterContent}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-[var(--app-hint)]">
                    无文件变更记录
                </div>
            )}
        </div>
    )
}
