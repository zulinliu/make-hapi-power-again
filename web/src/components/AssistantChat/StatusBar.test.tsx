import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '@/lib/i18n-context'
import { getContextPulseView, StatusBar } from './StatusBar'

function t(key: string, params?: Record<string, string | number>): string {
    if (key === 'contextPulse.label') return `上下文：${params?.percent}%`
    if (key === 'contextPulse.unavailable') return '上下文：--'
    return key
}

describe('getContextPulseView', () => {
    it.each([
        { percent: 59, tone: 'success' },
        { percent: 60, tone: 'warning' },
        { percent: 80, tone: 'warning' },
        { percent: 81, tone: 'danger' },
    ] as const)('uses Context Pulse threshold at $percent%', ({ percent, tone }) => {
        const view = getContextPulseView({
            contextSize: percent,
            contextWindow: 100,
            t,
        })

        expect(view).toMatchObject({
            label: `上下文：${percent}%`,
            tone,
            percent,
            usedTokens: percent,
            maxTokens: 100,
            source: 'reported',
            reason: 'ok',
        })
    })

    it('uses fallback model context window when reported window is missing', () => {
        const view = getContextPulseView({
            contextSize: 99_360,
            contextWindow: null,
            model: 'gpt-5-codex',
            agentFlavor: 'codex',
            t,
        })

        expect(view.label).toBe('上下文：40%')
        expect(view.tone).toBe('success')
        expect(view.percent).toBe(40)
        expect(view.usedTokens).toBe(99_360)
        expect(view.maxTokens).toBe(248_400)
        expect(view.source).toBe('fallback')
        expect(view.reason).toBe('ok')
    })

    it('shows unavailable label when usage is missing', () => {
        expect(getContextPulseView({ contextSize: undefined, contextWindow: 100, t })).toMatchObject({
            label: '上下文：--',
            tone: 'unknown',
            percent: null,
            usedTokens: null,
            maxTokens: 100,
            source: 'reported',
            reason: 'missing-usage',
        })
    })

    it('shows unavailable label when context window is unknown', () => {
        expect(getContextPulseView({ contextSize: 40, contextWindow: null, model: 'custom-model', agentFlavor: 'custom', t })).toMatchObject({
            label: '上下文：--',
            tone: 'unknown',
            percent: null,
            usedTokens: 40,
            maxTokens: null,
            source: 'unknown',
            reason: 'missing-window',
        })
    })
})

describe('StatusBar', () => {
    it('uses localized thinking status copy', () => {
        localStorage.setItem('hapi-power-lang', 'zh-CN')

        render(
            <I18nProvider>
                <StatusBar
                    active={true}
                    thinking={true}
                    agentState={null}
                />
            </I18nProvider>
        )

        expect(screen.getByText('思考中')).toBeInTheDocument()
    })
})
