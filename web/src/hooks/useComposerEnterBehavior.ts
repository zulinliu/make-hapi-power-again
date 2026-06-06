import { useCallback, useEffect, useState } from 'react'

export type ComposerEnterBehavior = 'send' | 'newline'

export const DEFAULT_COMPOSER_ENTER_BEHAVIOR: ComposerEnterBehavior = 'send'

export function getComposerEnterBehaviorOptions(): ReadonlyArray<{ value: ComposerEnterBehavior; labelKey: string }> {
    return [
        { value: 'send', labelKey: 'settings.chat.enterBehavior.send' },
        { value: 'newline', labelKey: 'settings.chat.enterBehavior.newline' },
    ]
}

const COMPOSER_ENTER_BEHAVIOR_STORAGE_KEY = 'hapi-power-composer-enter-behavior'
const COMPOSER_ENTER_BEHAVIOR_STORAGE_KEY_LEGACY = 'hapi-composer-enter-behavior'

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

function parseComposerEnterBehavior(raw: string | null): ComposerEnterBehavior {
    if (raw === 'send' || raw === 'newline') {
        return raw
    }
    return DEFAULT_COMPOSER_ENTER_BEHAVIOR
}

function migrateComposerEnterBehaviorStorage(): void {
    const newValue = safeGetItem(COMPOSER_ENTER_BEHAVIOR_STORAGE_KEY)
    if (newValue !== null) return
    const legacyValue = safeGetItem(COMPOSER_ENTER_BEHAVIOR_STORAGE_KEY_LEGACY)
    if (legacyValue !== null) {
        safeSetItem(COMPOSER_ENTER_BEHAVIOR_STORAGE_KEY, legacyValue)
        safeRemoveItem(COMPOSER_ENTER_BEHAVIOR_STORAGE_KEY_LEGACY)
    }
}

export function getInitialComposerEnterBehavior(): ComposerEnterBehavior {
    migrateComposerEnterBehaviorStorage()
    return parseComposerEnterBehavior(safeGetItem(COMPOSER_ENTER_BEHAVIOR_STORAGE_KEY))
}

export function useComposerEnterBehavior(): {
    composerEnterBehavior: ComposerEnterBehavior
    setComposerEnterBehavior: (behavior: ComposerEnterBehavior) => void
} {
    const [composerEnterBehavior, setComposerEnterBehaviorState] = useState<ComposerEnterBehavior>(getInitialComposerEnterBehavior)

    useEffect(() => {
        if (!isBrowser()) {
            return
        }

        const onStorage = (event: StorageEvent) => {
            if (event.key !== COMPOSER_ENTER_BEHAVIOR_STORAGE_KEY) {
                return
            }
            setComposerEnterBehaviorState(parseComposerEnterBehavior(event.newValue))
        }

        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [])

    const setComposerEnterBehavior = useCallback((behavior: ComposerEnterBehavior) => {
        setComposerEnterBehaviorState(behavior)

        if (behavior === DEFAULT_COMPOSER_ENTER_BEHAVIOR) {
            safeRemoveItem(COMPOSER_ENTER_BEHAVIOR_STORAGE_KEY)
        } else {
            safeSetItem(COMPOSER_ENTER_BEHAVIOR_STORAGE_KEY, behavior)
        }
    }, [])

    return { composerEnterBehavior, setComposerEnterBehavior }
}
