import { useCallback, useEffect, useState } from 'react'

export type FollowUpBehavior = 'queue' | 'guide'

export const DEFAULT_FOLLOW_UP_BEHAVIOR: FollowUpBehavior = 'queue'

export function getFollowUpBehaviorOptions(): ReadonlyArray<{ value: FollowUpBehavior; labelKey: string }> {
    return [
        { value: 'queue', labelKey: 'settings.chat.followUpBehavior.queue' },
        { value: 'guide', labelKey: 'settings.chat.followUpBehavior.guide' },
    ]
}

const FOLLOW_UP_BEHAVIOR_STORAGE_KEY = 'hapi-power-follow-up-behavior'

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function safeGetItem(key: string): string | null {
    if (!isBrowser()) {
        return null
    }
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

function safeSetItem(key: string, value: string): void {
    if (!isBrowser()) {
        return
    }
    try {
        localStorage.setItem(key, value)
    } catch {
        // Ignore storage errors
    }
}

function safeRemoveItem(key: string): void {
    if (!isBrowser()) {
        return
    }
    try {
        localStorage.removeItem(key)
    } catch {
        // Ignore storage errors
    }
}

function parseFollowUpBehavior(raw: string | null): FollowUpBehavior {
    if (raw === 'queue' || raw === 'guide') {
        return raw
    }
    return DEFAULT_FOLLOW_UP_BEHAVIOR
}

export function getInitialFollowUpBehavior(): FollowUpBehavior {
    return parseFollowUpBehavior(safeGetItem(FOLLOW_UP_BEHAVIOR_STORAGE_KEY))
}

export function useFollowUpBehavior(): {
    followUpBehavior: FollowUpBehavior
    setFollowUpBehavior: (behavior: FollowUpBehavior) => void
} {
    const [followUpBehavior, setFollowUpBehaviorState] = useState<FollowUpBehavior>(getInitialFollowUpBehavior)

    useEffect(() => {
        if (!isBrowser()) {
            return
        }

        const onStorage = (event: StorageEvent) => {
            if (event.key !== FOLLOW_UP_BEHAVIOR_STORAGE_KEY) {
                return
            }
            setFollowUpBehaviorState(parseFollowUpBehavior(event.newValue))
        }

        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [])

    const setFollowUpBehavior = useCallback((behavior: FollowUpBehavior) => {
        setFollowUpBehaviorState(behavior)

        if (behavior === DEFAULT_FOLLOW_UP_BEHAVIOR) {
            safeRemoveItem(FOLLOW_UP_BEHAVIOR_STORAGE_KEY)
        } else {
            safeSetItem(FOLLOW_UP_BEHAVIOR_STORAGE_KEY, behavior)
        }
    }, [])

    return { followUpBehavior, setFollowUpBehavior }
}
