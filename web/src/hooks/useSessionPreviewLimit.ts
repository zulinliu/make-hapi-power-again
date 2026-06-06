import { useCallback, useEffect, useState } from 'react'

export const DEFAULT_SESSION_PREVIEW_LIMIT = 8
export const MIN_SESSION_PREVIEW_LIMIT = 1
export const MAX_SESSION_PREVIEW_LIMIT = 99
const SESSION_PREVIEW_LIMIT_CHANGED_EVENT = 'hapi-power-session-preview-limit-changed'
const SESSION_PREVIEW_LIMIT_STORAGE_KEY = 'hapi-power-session-preview-limit'
const SESSION_PREVIEW_LIMIT_STORAGE_KEY_LEGACY = 'hapi-session-preview-limit'

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

export function normalizeSessionPreviewLimit(value: number): number {
    if (!Number.isInteger(value)) {
        return DEFAULT_SESSION_PREVIEW_LIMIT
    }
    return Math.min(MAX_SESSION_PREVIEW_LIMIT, Math.max(MIN_SESSION_PREVIEW_LIMIT, value))
}

function parseSessionPreviewLimit(raw: string | null): number {
    if (raw === null || raw.trim() === '') {
        return DEFAULT_SESSION_PREVIEW_LIMIT
    }
    const value = Number(raw)
    return normalizeSessionPreviewLimit(value)
}

function migrateSessionPreviewLimitStorage(): void {
    const newValue = safeGetItem(SESSION_PREVIEW_LIMIT_STORAGE_KEY)
    if (newValue !== null) return
    const legacyValue = safeGetItem(SESSION_PREVIEW_LIMIT_STORAGE_KEY_LEGACY)
    if (legacyValue !== null) {
        safeSetItem(SESSION_PREVIEW_LIMIT_STORAGE_KEY, legacyValue)
        safeRemoveItem(SESSION_PREVIEW_LIMIT_STORAGE_KEY_LEGACY)
    }
}

export function getInitialSessionPreviewLimit(): number {
    migrateSessionPreviewLimitStorage()
    return parseSessionPreviewLimit(safeGetItem(SESSION_PREVIEW_LIMIT_STORAGE_KEY))
}

export function useSessionPreviewLimit(): {
    sessionPreviewLimit: number
    setSessionPreviewLimit: (limit: number) => void
} {
    const [sessionPreviewLimit, setSessionPreviewLimitState] = useState<number>(getInitialSessionPreviewLimit)

    useEffect(() => {
        if (!isBrowser()) {
            return
        }

        const onStorage = (event: StorageEvent) => {
            if (event.key !== SESSION_PREVIEW_LIMIT_STORAGE_KEY) {
                return
            }
            setSessionPreviewLimitState(parseSessionPreviewLimit(event.newValue))
        }

        const onLocalChange = (event: Event) => {
            const next = event instanceof CustomEvent ? event.detail : null
            if (typeof next === 'number') {
                setSessionPreviewLimitState(normalizeSessionPreviewLimit(next))
            }
        }

        window.addEventListener('storage', onStorage)
        window.addEventListener(SESSION_PREVIEW_LIMIT_CHANGED_EVENT, onLocalChange)
        return () => {
            window.removeEventListener('storage', onStorage)
            window.removeEventListener(SESSION_PREVIEW_LIMIT_CHANGED_EVENT, onLocalChange)
        }
    }, [])

    const setSessionPreviewLimit = useCallback((limit: number) => {
        const normalized = normalizeSessionPreviewLimit(limit)
        setSessionPreviewLimitState(normalized)

        if (normalized === DEFAULT_SESSION_PREVIEW_LIMIT) {
            safeRemoveItem(SESSION_PREVIEW_LIMIT_STORAGE_KEY)
        } else {
            safeSetItem(SESSION_PREVIEW_LIMIT_STORAGE_KEY, String(normalized))
        }

        if (isBrowser()) {
            window.dispatchEvent(new CustomEvent(SESSION_PREVIEW_LIMIT_CHANGED_EVENT, { detail: normalized }))
        }
    }, [])

    return { sessionPreviewLimit, setSessionPreviewLimit }
}
