import { describe, expect, it } from 'vitest'
import { en, zhCN } from './index'

const SESSION_LOOM_PREFIXES = ['sessionLoom.'] as const

const REQUIRED_SESSION_LOOM_KEYS = [
    'sessionLoom.title',
    'sessionLoom.tabs.outline',
    'sessionLoom.tabs.export',
    'sessionLoom.tabs.synthesis',
    'sessionLoom.tabs.assets',
    'sessionLoom.downloadMarkdown',
    'sessionLoom.filters.redactSecrets',
    'sessionLoom.synthesis.agentDescription',
    'sessionLoom.synthesis.createBackgroundDesign',
    'sessionLoom.synthesis.readyTitle',
    'sessionLoom.assets.download',
] as const

function keysWithPrefixes(locale: Record<string, string>, prefixes: readonly string[]): string[] {
    return Object.keys(locale)
        .filter(key => prefixes.some(prefix => key.startsWith(prefix)))
        .sort()
}

describe('Session Loom i18n', () => {
    it('keeps English and Chinese Session Loom keys in parity', () => {
        expect(keysWithPrefixes(zhCN, SESSION_LOOM_PREFIXES)).toEqual(keysWithPrefixes(en, SESSION_LOOM_PREFIXES))
    })

    it('defines required Session Loom acceptance keys in both locales', () => {
        for (const key of REQUIRED_SESSION_LOOM_KEYS) {
            expect(en[key], key).toBeTruthy()
            expect(zhCN[key], key).toBeTruthy()
        }
    })

    it('uses the canonical branded title in Chinese', () => {
        expect(zhCN['sessionLoom.title']).toBe('会话织锦')
    })
})
