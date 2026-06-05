import type { AgentType, ClaudeEffort } from './types'
import { CLAUDE_EFFORT_OPTIONS } from './types'
import { useTranslation } from '@/lib/use-translation'

export function ClaudeEffortSelector(props: {
    agent: AgentType
    effort: ClaudeEffort
    isDisabled: boolean
    onEffortChange: (value: ClaudeEffort) => void
}) {
    const { t } = useTranslation()

    if (props.agent !== 'claude') {
        return null
    }

    return (
        <div className="flex flex-col gap-1.5 px-3 py-3">
            <label className="text-xs font-medium uppercase tracking-wider text-[var(--hp-text-tertiary)]">
                {t('newSession.effort')}{' '}
                <span className="font-normal normal-case tracking-normal">({t('newSession.model.optional')})</span>
            </label>
            <select
                value={props.effort}
                onChange={(e) => props.onEffortChange(e.target.value as ClaudeEffort)}
                disabled={props.isDisabled}
                className="w-full px-3 py-2 text-sm rounded-[var(--hp-radius-sm,6px)] border border-[var(--hp-border)] bg-[var(--hp-surface-0)] text-[var(--hp-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--hp-primary)] focus:border-transparent disabled:opacity-50 transition-colors"
            >
                {CLAUDE_EFFORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    )
}
