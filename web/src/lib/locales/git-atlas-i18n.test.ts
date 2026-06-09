import { describe, expect, it } from 'vitest'
import { en, zhCN } from './index'

const GIT_ATLAS_PREFIXES = ['gitAtlas.'] as const

const REQUIRED_GIT_ATLAS_KEYS = [
    'gitAtlas.title',
    'gitAtlas.recommendation.push',
    'gitAtlas.recommendation.pushDesc',
    'gitAtlas.changeMap.title',
    'gitAtlas.diff.truncated',
    'gitAtlas.basket.commitSelected',
    'gitAtlas.sync.forceConfirm',
    'gitAtlas.management.title',
] as const

function keysWithPrefixes(locale: Record<string, string>, prefixes: readonly string[]): string[] {
    return Object.keys(locale)
        .filter(key => prefixes.some(prefix => key.startsWith(prefix)))
        .sort()
}

describe('Git Atlas i18n', () => {
    it('keeps English and Chinese Git Atlas keys in parity', () => {
        expect(keysWithPrefixes(zhCN, GIT_ATLAS_PREFIXES)).toEqual(keysWithPrefixes(en, GIT_ATLAS_PREFIXES))
    })

    it('defines required Git Atlas acceptance keys in both locales', () => {
        for (const key of REQUIRED_GIT_ATLAS_KEYS) {
            expect(en[key], key).toBeTruthy()
            expect(zhCN[key], key).toBeTruthy()
        }
    })

    it('uses the canonical branded title in Chinese', () => {
        expect(zhCN['gitAtlas.title']).toBe('Git 脉络')
    })
})
