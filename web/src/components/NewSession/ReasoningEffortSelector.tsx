import type { AgentType, CodexReasoningEffort } from './types'
import { CODEX_REASONING_EFFORT_OPTIONS } from './types'
import { useTranslation } from '@/lib/use-translation'

export function ReasoningEffortSelector(props: {
    agent: AgentType
    value: CodexReasoningEffort
    isDisabled: boolean
    onChange: (value: CodexReasoningEffort) => void
}) {
    const { t } = useTranslation()

    if (props.agent !== 'codex' && props.agent !== 'opencode') {
        return null
    }

    const filteredOptions = CODEX_REASONING_EFFORT_OPTIONS.filter((option) =>
        props.agent === 'opencode' ? option.value !== 'xhigh' : option.value !== 'max'
    )

    return (
        <div className="flex flex-col gap-1.5 px-3 py-3">
            <label className="text-xs font-medium uppercase tracking-wider text-[--hp-text-tertiary]">
                {t('newSession.reasoningEffort')}{' '}
                <span className="font-normal normal-case tracking-normal">({t('newSession.model.optional')})</span>
            </label>
            <div className="flex rounded-[--hp-radius-sm,6px] bg-[--hp-surface-1] p-0.5 gap-0.5">
                {filteredOptions.map((option) => {
                    const isActive = props.value === option.value
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => props.onChange(option.value as CodexReasoningEffort)}
                            disabled={props.isDisabled}
                            className={`
                                flex-1 px-2 py-1.5 text-xs font-medium rounded-[--hp-radius-xs,4px] transition-all duration-150
                                ${isActive
                                    ? 'bg-[--hp-primary] text-[--hp-primary-text] shadow-sm'
                                    : 'text-[--hp-text-tertiary] hover:text-[--hp-text-secondary] hover:bg-[--hp-surface-2]'
                                }
                                disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                        >
                            {option.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
