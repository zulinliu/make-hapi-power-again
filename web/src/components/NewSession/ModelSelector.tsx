import type { AgentType } from './types'
import { MODEL_OPTIONS } from './types'
import { useTranslation } from '@/lib/use-translation'

export function ModelSelector(props: {
    agent: AgentType
    model: string
    options?: Array<{ value: string; label: string; providerId?: string }>
    isDisabled: boolean
    isLoading?: boolean
    error?: string | null
    onModelChange: (value: string, providerId?: string) => void
}) {
    const { t } = useTranslation()
    const options: Array<{ value: string; label: string; providerId?: string }> = props.options ?? MODEL_OPTIONS[props.agent]
    if (options.length === 0) {
        return null
    }

    const providerIdMap = new Map(options.map((o) => [o.value, o.providerId]))

    return (
        <div className="flex flex-col gap-1.5 px-3 py-3">
            <label className="text-xs font-medium uppercase tracking-wider text-(--hp-text-tertiary)">
                {t('newSession.model')}{' '}
                <span className="font-normal normal-case tracking-normal">({t('newSession.model.optional')})</span>
            </label>
            <select
                value={props.model}
                onChange={(e) => props.onModelChange(e.target.value, providerIdMap.get(e.target.value))}
                disabled={props.isDisabled || props.isLoading}
                className="w-full px-3 py-2 text-sm rounded-[var(--hp-radius-sm,6px)] border border-(--hp-border) bg-(--hp-surface-0) text-(--hp-text-primary) focus:outline-none focus:ring-2 focus:ring-(--hp-primary) focus:border-transparent disabled:opacity-50 transition-colors"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {props.error ? (
                <div className="text-xs text-(--hp-danger)">
                    {props.error}
                </div>
            ) : null}
        </div>
    )
}
