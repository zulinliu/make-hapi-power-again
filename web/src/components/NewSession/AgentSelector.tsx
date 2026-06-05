import { AGENT_FLAVORS } from '@hapipower/protocol'
import type { AgentType } from './types'
import { useTranslation } from '@/lib/use-translation'

export function AgentSelector(props: {
    agent: AgentType
    isDisabled: boolean
    onAgentChange: (value: AgentType) => void
}) {
    const { t } = useTranslation()

    return (
        <div className="flex flex-col gap-2 px-3 py-3">
            <label className="text-xs font-medium uppercase tracking-wider text-[var(--hp-text-tertiary)]">
                {t('newSession.agent')}
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {AGENT_FLAVORS.map((agentType) => {
                    const isSelected = props.agent === agentType
                    return (
                        <button
                            key={agentType}
                            type="button"
                            onClick={() => props.onAgentChange(agentType)}
                            disabled={props.isDisabled}
                            className={`
                                flex items-center justify-center gap-2 px-3 py-2.5
                                text-sm capitalize font-medium transition-all duration-150
                                rounded-[var(--hp-radius-md,8px)] border
                                ${isSelected
                                    ? 'border-[var(--hp-primary)] bg-[var(--hp-primary-subtle)] text-[var(--hp-primary)]'
                                    : 'border-[var(--hp-border)] bg-[var(--hp-surface-1)] text-[var(--hp-text-secondary)] hover:bg-[var(--hp-surface-2)] hover:text-[var(--hp-text-primary)]'
                                }
                                disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                        >
                            <span className="capitalize">{agentType}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
