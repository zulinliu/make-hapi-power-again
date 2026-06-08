import { describe, expect, it } from 'vitest'
import { en, zhCN } from './index'

const MODEL_NEXUS_PREFIXES = [
    'settings.modelNexus.',
    'settings.providers.',
] as const

const REQUIRED_MODEL_NEXUS_KEYS = [
    'settings.modelNexus.addCta',
    'settings.modelNexus.addDialogTitle',
    'settings.modelNexus.editDialogTitle',
    'settings.modelNexus.formDescription',
    'settings.modelNexus.summary.blocked',
    'settings.modelNexus.summary.unknown',
    'settings.modelNexus.capability.usage',
    'settings.modelNexus.capability.usageUnavailable',
    'settings.modelNexus.capability.usageUnknown',
    'settings.modelNexus.capability.context',
    'settings.modelNexus.capability.contextUnknown',
    'settings.modelNexus.capability.tools',
    'settings.modelNexus.capability.vision',
    'settings.modelNexus.wizard.steps',
    'settings.modelNexus.wizard.protocol',
    'settings.modelNexus.wizard.connection',
    'settings.modelNexus.wizard.capability',
    'settings.modelNexus.wizard.assignment',
    'settings.modelNexus.wizard.protocolTitle',
    'settings.modelNexus.wizard.connectionTitle',
    'settings.modelNexus.wizard.capabilityTitle',
    'settings.modelNexus.wizard.assignmentTitle',
    'settings.modelNexus.wizard.finish',
] as const

function keysWithPrefixes(locale: Record<string, string>, prefixes: readonly string[]): string[] {
    return Object.keys(locale)
        .filter(key => prefixes.some(prefix => key.startsWith(prefix)))
        .sort()
}

describe('Model Nexus i18n', () => {
    it('keeps English and Chinese Model Nexus settings keys in parity', () => {
        const enKeys = keysWithPrefixes(en, MODEL_NEXUS_PREFIXES)
        const zhKeys = keysWithPrefixes(zhCN, MODEL_NEXUS_PREFIXES)

        expect(zhKeys).toEqual(enKeys)
    })

    it('uses the canonical branded title in both locales', () => {
        expect(en['settings.modelNexus.title']).toBe('Model Nexus')
        expect(zhCN['settings.modelNexus.title']).toBe('模型星桥')
    })

    it('defines required Model Nexus acceptance keys in both locales', () => {
        for (const key of REQUIRED_MODEL_NEXUS_KEYS) {
            expect(en[key], key).toBeTruthy()
            expect(zhCN[key], key).toBeTruthy()
        }
    })
})
