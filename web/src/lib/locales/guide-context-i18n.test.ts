import { describe, expect, it } from 'vitest'
import { en, zhCN } from './index'

const REQUIRED_KEYS = [
    'composer.deliveryMode.label',
    'composer.deliveryMode.queue',
    'composer.deliveryMode.guideNow',
    'composer.deliveryMode.sendGuide',
    'composer.deliveryMode.guideDescription',
    'composer.deliveryMode.queueActiveDescription',
    'composer.deliveryMode.guideActiveDescription',
    'composer.deliveryMode.queueOnlyDescription',
    'composer.deliveryMode.switchToQueue',
    'composer.deliveryMode.switchToGuide',
    'settings.chat.followUpBehavior',
    'settings.chat.followUpBehavior.queue',
    'settings.chat.followUpBehavior.guide',
    'settings.chat.followUpBehavior.description',
    'contextPulse.label',
    'contextPulse.unavailable',
    'contextPulse.cache',
    'contextPulse.detailsLabel',
    'contextPulse.unknown',
    'contextPulse.none',
    'contextPulse.detail.title',
    'contextPulse.detail.used',
    'contextPulse.detail.max',
    'contextPulse.detail.source',
    'contextPulse.detail.model',
    'contextPulse.detail.cache',
    'contextPulse.detail.reason',
    'contextPulse.source.reported',
    'contextPulse.source.fallback',
    'contextPulse.source.unknown',
    'contextPulse.reason.ok',
    'contextPulse.reason.missing-usage',
    'contextPulse.reason.missing-window',
    'status.thinking',
    'status.backgroundTasks',
    'status.reasoning.default',
    'status.reasoning.value',
    'status.fast',
    'status.goal.active',
    'status.goal.budgetLimited',
    'status.goal.status',
    'queuedMessages.title',
    'queuedMessages.ariaLabel',
    'queuedMessages.edit',
    'queuedMessages.cancel',
    'queuedMessages.guide.requested',
    'queuedMessages.guide.fallbackQueued',
    'queuedMessages.guide.consumed',
    'queuedMessages.guide.failed',
] as const

describe('Guide Beam and Context Pulse i18n', () => {
    it('keeps required keys in English and Chinese', () => {
        for (const key of REQUIRED_KEYS) {
            expect(en[key], key).toBeTruthy()
            expect(zhCN[key], key).toBeTruthy()
        }
    })

    it('uses canonical Context Pulse label copy', () => {
        expect(en['contextPulse.label']).toBe('Context: {percent}%')
        expect(zhCN['contextPulse.label']).toBe('上下文：{percent}%')
        expect(en['contextPulse.cache']).toBe('Cache: {tokens}')
        expect(zhCN['contextPulse.cache']).toBe('缓存：{tokens}')
        expect(en['status.thinking']).toBe('Thinking')
        expect(zhCN['status.thinking']).toBe('思考中')
    })

    it('uses canonical Guide Beam composer labels in Chinese', () => {
        expect(zhCN['composer.deliveryMode.queue']).toBe('排队')
        expect(zhCN['composer.deliveryMode.guideNow']).toBe('立即引导')
        expect(zhCN['composer.deliveryMode.guideDescription']).toContain('不会删除普通队列')
        expect(zhCN['settings.chat.followUpBehavior']).toBe('跟进行为')
        expect(zhCN['settings.chat.followUpBehavior.queue']).toBe('排队')
        expect(zhCN['settings.chat.followUpBehavior.guide']).toBe('引导')
    })
})
