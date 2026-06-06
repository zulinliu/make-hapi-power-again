import { useCallback, useEffect, useState } from 'react'

const TERMINAL_FONT_SIZES = [9, 11, 13, 15, 17] as const

export type TerminalFontSize = typeof TERMINAL_FONT_SIZES[number]

export const DEFAULT_TERMINAL_FONT_SIZE: TerminalFontSize = 13

export function getTerminalFontSizeOptions(): ReadonlyArray<{ value: TerminalFontSize; label: string }> {
    return TERMINAL_FONT_SIZES.map(value => ({ value, label: `${value}px` }))
}

const TERMINAL_FONT_SIZE_STORAGE_KEY = 'hapi-power-terminal-font-size'
const TERMINAL_FONT_SIZE_STORAGE_KEY_LEGACY = 'hapi-terminal-font-size'

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

function parseTerminalFontSize(raw: string | null): TerminalFontSize {
    const value = Number(raw)
    return TERMINAL_FONT_SIZES.find(size => size === value) ?? DEFAULT_TERMINAL_FONT_SIZE
}

function migrateTerminalFontSizeStorage(): void {
    const newValue = safeGetItem(TERMINAL_FONT_SIZE_STORAGE_KEY)
    if (newValue !== null) return
    const legacyValue = safeGetItem(TERMINAL_FONT_SIZE_STORAGE_KEY_LEGACY)
    if (legacyValue !== null) {
        safeSetItem(TERMINAL_FONT_SIZE_STORAGE_KEY, legacyValue)
        safeRemoveItem(TERMINAL_FONT_SIZE_STORAGE_KEY_LEGACY)
    }
}

export function getInitialTerminalFontSize(): TerminalFontSize {
    migrateTerminalFontSizeStorage()
    return parseTerminalFontSize(safeGetItem(TERMINAL_FONT_SIZE_STORAGE_KEY))
}

export function useTerminalFontSize(): {
    terminalFontSize: TerminalFontSize
    setTerminalFontSize: (size: TerminalFontSize) => void
} {
    const [terminalFontSize, setTerminalFontSizeState] = useState<TerminalFontSize>(getInitialTerminalFontSize)

    useEffect(() => {
        if (!isBrowser()) {
            return
        }

        const onStorage = (event: StorageEvent) => {
            if (event.key !== TERMINAL_FONT_SIZE_STORAGE_KEY) {
                return
            }
            setTerminalFontSizeState(parseTerminalFontSize(event.newValue))
        }

        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [])

    const setTerminalFontSize = useCallback((size: TerminalFontSize) => {
        setTerminalFontSizeState(size)

        if (size === DEFAULT_TERMINAL_FONT_SIZE) {
            safeRemoveItem(TERMINAL_FONT_SIZE_STORAGE_KEY)
        } else {
            safeSetItem(TERMINAL_FONT_SIZE_STORAGE_KEY, String(size))
        }
    }, [])

    return { terminalFontSize, setTerminalFontSize }
}
