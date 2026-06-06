import { useCallback, useEffect, useState } from 'react'

export type SessionListStatusMode = 'standard' | 'detailed'

export const DEFAULT_SESSION_LIST_STATUS_MODE: SessionListStatusMode = 'standard'

export function getSessionListStatusModeOptions(): ReadonlyArray<{ value: SessionListStatusMode; labelKey: string }> {
    return [
        { value: 'standard', labelKey: 'settings.display.sessionListStatus.standard' },
        { value: 'detailed', labelKey: 'settings.display.sessionListStatus.detailed' },
    ]
}

const SESSION_LIST_STATUS_MODE_STORAGE_KEY = 'hapi-power-session-list-status-mode'
const SESSION_LIST_STATUS_MODE_STORAGE_KEY_LEGACY = 'hapi-session-list-status-mode'

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

function parseSessionListStatusMode(raw: string | null): SessionListStatusMode {
    if (raw === 'standard' || raw === 'detailed') {
        return raw
    }
    return DEFAULT_SESSION_LIST_STATUS_MODE
}

function migrateSessionListStatusModeStorage(): void {
    const newValue = safeGetItem(SESSION_LIST_STATUS_MODE_STORAGE_KEY)
    if (newValue !== null) return
    const legacyValue = safeGetItem(SESSION_LIST_STATUS_MODE_STORAGE_KEY_LEGACY)
    if (legacyValue !== null) {
        safeSetItem(SESSION_LIST_STATUS_MODE_STORAGE_KEY, legacyValue)
        safeRemoveItem(SESSION_LIST_STATUS_MODE_STORAGE_KEY_LEGACY)
    }
}

export function getInitialSessionListStatusMode(): SessionListStatusMode {
    migrateSessionListStatusModeStorage()
    return parseSessionListStatusMode(safeGetItem(SESSION_LIST_STATUS_MODE_STORAGE_KEY))
}

export function useSessionListStatusMode(): {
    sessionListStatusMode: SessionListStatusMode
    setSessionListStatusMode: (mode: SessionListStatusMode) => void
} {
    const [sessionListStatusMode, setSessionListStatusModeState] = useState<SessionListStatusMode>(getInitialSessionListStatusMode)

    useEffect(() => {
        if (!isBrowser()) {
            return
        }

        const onStorage = (event: StorageEvent) => {
            if (event.key !== SESSION_LIST_STATUS_MODE_STORAGE_KEY) {
                return
            }
            setSessionListStatusModeState(parseSessionListStatusMode(event.newValue))
        }

        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [])

    const setSessionListStatusMode = useCallback((mode: SessionListStatusMode) => {
        setSessionListStatusModeState(mode)

        if (mode === DEFAULT_SESSION_LIST_STATUS_MODE) {
            safeRemoveItem(SESSION_LIST_STATUS_MODE_STORAGE_KEY)
        } else {
            safeSetItem(SESSION_LIST_STATUS_MODE_STORAGE_KEY, mode)
        }
    }, [])

    return { sessionListStatusMode, setSessionListStatusMode }
}
