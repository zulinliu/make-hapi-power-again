import { useCallback } from 'react'
import { useLocation, useNavigate, useRouter } from '@tanstack/react-router'
import { parseSafeReturnTo } from '@/lib/return-navigation'

export function useAppGoBack(): () => void {
    const navigate = useNavigate()
    const router = useRouter()
    const pathname = useLocation({ select: (location) => location.pathname })
    const search = useLocation({ select: (location) => location.search })

    return useCallback(() => {
        // Use explicit path navigation for consistent behavior across all environments
        if (pathname === '/sessions/new') {
            const returnTo = (search && typeof search === 'object' && 'returnTo' in search)
                ? (search as { returnTo?: unknown }).returnTo
                : undefined
            const target = parseSafeReturnTo(returnTo)
            if (target?.type === 'browse') {
                navigate({ to: '/browse', search: target.search, replace: true })
                return
            }
            if (target?.type === 'sessionFiles') {
                navigate({
                    to: '/sessions/$sessionId/files',
                    params: { sessionId: target.sessionId },
                    search: target.search,
                    replace: true,
                })
                return
            }
            navigate({ to: '/sessions', replace: true })
            return
        }

        if (pathname === '/browse') {
            navigate({ to: '/sessions' })
            return
        }

        // Settings page always goes back to sessions
        if (pathname === '/settings') {
            navigate({ to: '/sessions' })
            return
        }

        // For single file view, go back to files list
        if (pathname.match(/^\/sessions\/[^/]+\/file$/)) {
            const filesPath = pathname.replace(/\/file$/, '/files')

            const tab = (search && typeof search === 'object' && 'tab' in search)
                ? (search as { tab?: unknown }).tab
                : undefined
            const nextSearch = tab === 'directories' ? { tab: 'directories' as const } : {}

            navigate({ to: filesPath, search: nextSearch })
            return
        }

        // For session routes, navigate to parent path
        if (pathname.startsWith('/sessions/')) {
            const parentPath = pathname.replace(/\/[^/]+$/, '') || '/sessions'
            navigate({ to: parentPath })
            return
        }

        // Fallback to history.back() for other cases
        router.history.back()
    }, [navigate, pathname, router, search])
}
