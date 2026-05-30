import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

interface OrchestrationSkill {
    id: string
    name: string
    description: string
    pattern: 'loop' | 'handoff' | 'advisor' | 'committee' | 'epic'
    config: Record<string, unknown>
}

const PATTERN_ICONS: Record<string, { icon: string; color: string }> = {
    loop: { icon: '⟳', color: 'text-blue-500' },
    handoff: { icon: '⇄', color: 'text-green-500' },
    advisor: { icon: '💡', color: 'text-amber-500' },
    committee: { icon: '⊕', color: 'text-purple-500' },
    epic: { icon: '◆', color: 'text-red-500' },
}

export default function OrchestrationPage() {
    const navigate = useNavigate()

    const { data, isLoading } = useQuery({
        queryKey: ['orchestration-skills'],
        queryFn: async () => {
            const res = await fetch('/api/orchestration/skills')
            if (!res.ok) throw new Error('Failed to load skills')
            return res.json() as Promise<{ success: boolean; skills: OrchestrationSkill[] }>
        }
    })

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--app-border)]">
                <button
                    type="button"
                    onClick={() => navigate({ to: '/sessions' })}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)]"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <div>
                    <h1 className="font-semibold text-[var(--app-fg)] text-sm">Skill 编排系统</h1>
                    <p className="text-xs text-[var(--app-hint)]">5 种代理编排模式</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                    <div className="text-center py-12 text-sm text-[var(--app-hint)]">加载中...</div>
                ) : (
                    <div className="max-w-2xl mx-auto space-y-3">
                        {data?.skills.map((skill) => {
                            const meta = PATTERN_ICONS[skill.pattern] ?? { icon: '?', color: 'text-gray-500' }
                            return (
                                <div
                                    key={skill.id}
                                    className="rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)] p-4 hover:border-[var(--app-fg)]/20 transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`text-2xl leading-none mt-0.5 ${meta.color}`}>
                                            {meta.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-[var(--app-fg)]">{skill.name}</h3>
                                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--app-bg)] text-[var(--app-hint)]">
                                                    {skill.pattern}
                                                </span>
                                            </div>
                                            <p className="text-sm text-[var(--app-hint)] mt-1 leading-relaxed">
                                                {skill.description}
                                            </p>
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {Object.entries(skill.config).map(([key, value]) => (
                                                    <span
                                                        key={key}
                                                        className="text-xs px-2 py-0.5 rounded bg-[var(--app-bg)] text-[var(--app-hint)] font-mono"
                                                    >
                                                        {key}: {String(value)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
