import { useCallback, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { useSession } from '@/hooks/queries/useSession'
import { queryKeys } from '@/lib/query-keys'
import { useTranslation } from '@/lib/use-translation'

function BackIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
        </svg>
    )
}

function PuzzleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61-1.61a2.404 2.404 0 0 1 1.705-.707c.618 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02z" />
        </svg>
    )
}

function SearchIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    )
}

type Tab = 'plugins' | 'skills'

interface PluginInfo {
    id: string
    name: string
    version: string
    description?: string
    permissions: string[]
    enabled: boolean
}

interface SkillSearchResult {
    name: string
    description?: string
    repo: string
    path: string
    stars?: number
    author?: string
}

export default function ExtensionsPage() {
    const { sessionId } = useParams({ from: '/sessions/$sessionId/extensions' })
    const { api } = useAppContext()
    const goBack = useAppGoBack()
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState<Tab>('skills')
    const [skillQuery, setSkillQuery] = useState('')
    const [installing, setInstalling] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const { session } = useSession(api, sessionId)

    // Plugin list
    const { data: pluginData, isLoading: pluginsLoading } = useQuery({
        queryKey: ['plugins', sessionId],
        queryFn: () => api!.listPlugins(sessionId),
        enabled: !!api && activeTab === 'plugins',
    })

    // Skill search (external)
    const { data: searchData, isLoading: searchLoading } = useQuery({
        queryKey: ['skill-search', sessionId, skillQuery],
        queryFn: () => api!.searchSkillsExternal(sessionId, skillQuery),
        enabled: !!api && activeTab === 'skills' && skillQuery.length >= 2,
    })

    // Installed skills
    const { data: skillsData } = useQuery({
        queryKey: queryKeys.skills(sessionId),
        queryFn: () => api!.getSkills(sessionId),
        enabled: !!api && activeTab === 'skills',
    })

    const handleInstallSkill = useCallback(async (skill: SkillSearchResult) => {
        if (!api) return
        setInstalling(skill.name)
        setError(null)
        try {
            await api.installSkillFromExternal(sessionId, skill.name, skill.repo, skill.path)
            await queryClient.invalidateQueries({ queryKey: queryKeys.skills(sessionId) })
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Install failed')
        }
        setInstalling(null)
    }, [api, sessionId, queryClient])

    const handleUninstallSkill = useCallback(async (name: string) => {
        if (!api) return
        setInstalling(name)
        setError(null)
        try {
            await api.uninstallSkill(sessionId, name)
            await queryClient.invalidateQueries({ queryKey: queryKeys.skills(sessionId) })
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Uninstall failed')
        }
        setInstalling(null)
    }, [api, sessionId, queryClient])

    const handleUninstallPlugin = useCallback(async (pluginId: string) => {
        if (!api) return
        setError(null)
        try {
            await api.uninstallPlugin(sessionId, pluginId)
            await queryClient.invalidateQueries({ queryKey: ['plugins', sessionId] })
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Uninstall failed')
        }
    }, [api, sessionId, queryClient])

    const plugins = (pluginData as { success: boolean; plugins?: PluginInfo[] } | null)?.plugins ?? []
    const searchResults = (searchData as { success: boolean; results?: SkillSearchResult[] } | null)?.results ?? []
    const installedSkills = (skillsData as { success: boolean; skills?: Array<{ name: string; description?: string }> } | null)?.skills ?? []
    const installedNames = new Set(installedSkills.map(s => s.name.toLowerCase()))

    return (
        <div className="flex h-full min-h-0 flex-col">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
                <button
                    type="button"
                    onClick={goBack}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"
                >
                    <BackIcon />
                </button>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <PuzzleIcon />
                    <span className="font-semibold text-sm truncate">
                        {t('extensions.title')}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--app-border)] bg-[var(--app-bg)]">
                {(['skills', 'plugins'] as Tab[]).map(tab => (
                    <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === tab
                                ? 'text-[var(--app-fg)] border-b-2 border-[var(--app-link)]'
                                : 'text-[var(--app-hint)] hover:text-[var(--app-fg)]'
                        }`}
                    >
                        {tab === 'skills' ? t('extensions.skills') : t('extensions.plugins')}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto app-scroll-y">
                {error && (
                    <div className="mx-3 mt-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                        {error}
                    </div>
                )}
                {activeTab === 'skills' && (
                    <div className="p-3 space-y-3">
                        {/* Search */}
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-hint)]">
                                <SearchIcon />
                            </div>
                            <input
                                type="text"
                                value={skillQuery}
                                onChange={e => setSkillQuery(e.target.value)}
                                placeholder={t('extensions.searchSkills')}
                                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)] py-2 pl-9 pr-3 text-sm text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none focus:ring-1 focus:ring-[var(--app-link)]"
                            />
                        </div>

                        {/* Installed Skills */}
                        {installedSkills.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wider mb-2">
                                    {t('extensions.installed')}
                                </h3>
                                <div className="space-y-1">
                                    {installedSkills.map(skill => (
                                        <div
                                            key={skill.name}
                                            className="flex items-center justify-between rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-3 py-2"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium text-[var(--app-fg)] truncate">{skill.name}</div>
                                                {skill.description && (
                                                    <div className="text-xs text-[var(--app-hint)] truncate">{skill.description}</div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleUninstallSkill(skill.name)}
                                                disabled={installing === skill.name}
                                                className="ml-2 shrink-0 rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50"
                                            >
                                                {installing === skill.name ? '...' : t('extensions.remove')}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Search Results */}
                        {skillQuery.length >= 2 && (
                            <div>
                                <h3 className="text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wider mb-2">
                                    {t('extensions.searchResults')}
                                </h3>
                                {searchLoading ? (
                                    <div className="text-sm text-[var(--app-hint)] py-4 text-center">{t('extensions.searching')}</div>
                                ) : searchResults.length === 0 ? (
                                    <div className="text-sm text-[var(--app-hint)] py-4 text-center">{t('extensions.noResults')}</div>
                                ) : (
                                    <div className="space-y-1">
                                        {searchResults.map(skill => {
                                            const isInstalled = installedNames.has(skill.name.toLowerCase())
                                            return (
                                                <div
                                                    key={`${skill.repo}/${skill.path}`}
                                                    className="flex items-center justify-between rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-3 py-2"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-medium text-[var(--app-fg)] truncate">{skill.name}</div>
                                                        {skill.description && (
                                                            <div className="text-xs text-[var(--app-hint)] truncate">{skill.description}</div>
                                                        )}
                                                        <div className="text-xs text-[var(--app-hint)]">{skill.repo}{skill.stars ? ` * ${skill.stars}` : ''}</div>
                                                    </div>
                                                    {isInstalled ? (
                                                        <span className="ml-2 shrink-0 rounded-md px-2 py-1 text-xs text-green-600 dark:text-green-400">
                                                            {t('extensions.installed')}
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleInstallSkill(skill)}
                                                            disabled={installing === skill.name}
                                                            className="ml-2 shrink-0 rounded-md bg-[var(--app-link)] px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
                                                        >
                                                            {installing === skill.name ? '...' : t('extensions.install')}
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'plugins' && (
                    <div className="p-3 space-y-2">
                        {pluginsLoading ? (
                            <div className="text-sm text-[var(--app-hint)] py-4 text-center">{t('extensions.loading')}</div>
                        ) : plugins.length === 0 ? (
                            <div className="py-8 text-center">
                                <PuzzleIcon />
                                <div className="mt-2 text-sm text-[var(--app-hint)]">{t('extensions.noPlugins')}</div>
                            </div>
                        ) : (
                            plugins.map(plugin => (
                                <div
                                    key={plugin.id}
                                    className="rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-3 py-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-[var(--app-fg)] truncate">{plugin.name}</span>
                                                <span className="text-xs text-[var(--app-hint)]">v{plugin.version}</span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                                    plugin.enabled
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                                }`}>
                                                    {plugin.enabled ? t('extensions.active') : t('extensions.inactive')}
                                                </span>
                                            </div>
                                            {plugin.description && (
                                                <div className="text-xs text-[var(--app-hint)] mt-0.5">{plugin.description}</div>
                                            )}
                                            {plugin.permissions.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {plugin.permissions.map(p => (
                                                        <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-[var(--app-bg)] text-[var(--app-hint)]">{p}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleUninstallPlugin(plugin.id)}
                                            className="ml-2 shrink-0 rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                                        >
                                            {t('extensions.remove')}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
