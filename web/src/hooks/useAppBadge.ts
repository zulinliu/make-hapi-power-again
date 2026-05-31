import { useCallback, useEffect, useRef } from 'react'

type BadgeSupport = {
    setBadge: (count: number) => void
    clearBadge: () => void
}

export function useAppBadge(): BadgeSupport {
    const countRef = useRef(0)

    const setBadge = useCallback((count: number) => {
        countRef.current = count
        if (!navigator.setAppBadge) return

        if (count <= 0) {
            navigator.clearAppBadge().catch(() => {})
            return
        }

        navigator.setAppBadge(count).catch(() => {})
    }, [])

    const clearBadge = useCallback(() => {
        countRef.current = 0
        if (!navigator.clearAppBadge) return
        navigator.clearAppBadge().catch(() => {})
    }, [])

    // Clear badge when page becomes visible (user opened the app)
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                clearBadge()
            }
        }

        document.addEventListener('visibilitychange', handleVisibility)
        return () => document.removeEventListener('visibilitychange', handleVisibility)
    }, [clearBadge])

    return { setBadge, clearBadge }
}
