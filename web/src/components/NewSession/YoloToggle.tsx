import { useTranslation } from '@/lib/use-translation'

export function YoloToggle(props: {
    yoloMode: boolean
    isDisabled: boolean
    onToggle: (value: boolean) => void
}) {
    const { t } = useTranslation()

    return (
        <div className="flex flex-col gap-1.5 px-3 py-3">
            <label className="text-xs font-medium uppercase tracking-wider text-(--hp-text-tertiary)">
                {t('newSession.yolo')}
            </label>
            <div className={`flex items-center justify-between gap-3 rounded-[var(--hp-radius-md,8px)] border p-3 transition-colors ${
                props.yoloMode
                    ? 'border-(--hp-warning) bg-(--hp-warning-subtle)'
                    : 'border-(--hp-border) bg-(--hp-surface-0)'
            }`}>
                <div className="flex flex-col">
                    <span className={`text-sm ${props.yoloMode ? 'text-(--hp-warning)' : 'text-(--hp-text-primary)'}`}>
                        {t('newSession.yolo.title')}
                    </span>
                    <span className="text-xs text-(--hp-text-tertiary)">
                        {t('newSession.yolo.desc')}
                    </span>
                </div>
                <label className="relative inline-flex h-5 w-9 items-center">
                    <input
                        type="checkbox"
                        checked={props.yoloMode}
                        onChange={(e) => props.onToggle(e.target.checked)}
                        disabled={props.isDisabled}
                        className="peer sr-only"
                    />
                    <span className={`absolute inset-0 rounded-full transition-colors peer-disabled:opacity-50 ${
                        props.yoloMode
                            ? 'bg-(--hp-warning)'
                            : 'bg-(--hp-border)'
                    }`} />
                    <span className="absolute left-0.5 h-4 w-4 rounded-full bg-(--hp-surface-0) transition-transform peer-checked:translate-x-4 peer-disabled:opacity-50 shadow-sm" />
                </label>
            </div>
        </div>
    )
}
