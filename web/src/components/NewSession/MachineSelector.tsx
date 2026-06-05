import type { Machine } from '@/types/api'
import { useTranslation } from '@/lib/use-translation'

function getMachineTitle(machine: Machine): string {
    if (machine.metadata?.displayName) return machine.metadata.displayName
    if (machine.metadata?.host) return machine.metadata.host
    return machine.id.slice(0, 8)
}

export function MachineSelector(props: {
    machines: Machine[]
    machineId: string | null
    isLoading?: boolean
    isDisabled: boolean
    onChange: (machineId: string) => void
}) {
    const { t } = useTranslation()

    return (
        <div className="flex flex-col gap-1.5 px-3 py-3">
            <label className="text-xs font-medium uppercase tracking-wider text-(--hp-text-tertiary)">
                {t('newSession.machine')}
            </label>
            <select
                value={props.machineId ?? ''}
                onChange={(e) => props.onChange(e.target.value)}
                disabled={props.isDisabled}
                className="w-full rounded-[var(--hp-radius-sm,6px)] border border-(--hp-border) bg-(--hp-surface-0) p-2 text-sm text-(--hp-text-primary) focus:outline-none focus:ring-2 focus:ring-(--hp-primary) focus:border-transparent disabled:opacity-50 transition-colors"
            >
                {props.isLoading && (
                    <option value="">{t('loading.machines')}</option>
                )}
                {!props.isLoading && props.machines.length === 0 && (
                    <option value="">{t('misc.noMachines')}</option>
                )}
                {props.machines.map((m) => (
                    <option key={m.id} value={m.id}>
                        {getMachineTitle(m)}
                        {m.metadata?.platform ? ` (${m.metadata.platform})` : ''}
                    </option>
                ))}
            </select>
        </div>
    )
}
