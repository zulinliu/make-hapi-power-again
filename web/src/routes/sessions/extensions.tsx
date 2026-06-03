import { useCallback, useMemo, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { useSession } from '@/hooks/queries/useSession'
import { queryKeys } from '@/lib/query-keys'
import { useTranslation } from '@/lib/use-translation'
import { SubPageLayout } from '@/components/ui/SubPageLayout'

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

function CloudDownloadIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V8m0 0l-3 3m3-3l3 3" /><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
        </svg>
    )
}

function TrashIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
    )
}

function CheckIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}

type Tab = 'plugins' | 'skills'
type SkillSubTab = 'installed' | 'online'

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
    stars?: number
    author?: string
}

export default function ExtensionsPage() {
    const { sessionId } = useParams({ from: '/sessions/$sessionId/extensions' })
    const { api } = useAppContext()
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState<Tab>('skills')
    const [skillSubTab, setSkillSubTab] = useState<SkillSubTab>('installed')
    const [skillQuery, setSkillQuery] = useState('')
    const [skillSearchTrigger, setSkillSearchTrigger] = useState('')
    const [installedFilter, setInstalledFilter] = useState('')
    const [installedFilterTrigger, setInstalledFilterTrigger] = useState('')
    const [installing, setInstalling] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)
    const [pluginIdInput, setPluginIdInput] = useState('')
    const [pluginSourceInput, setPluginSourceInput] = useState('')

    useSession(api, sessionId)

    // Plugin list
    const { data: pluginData, isLoading: pluginsLoading } = useQuery({
        queryKey: ['plugins', sessionId],
        queryFn: () => api!.listPlugins(sessionId),
        enabled: !!api && activeTab === 'plugins',
    })

    // Skill search (external) — triggered manually by search button
    const { data: searchData, isLoading: searchLoading, error: searchError } = useQuery({
        queryKey: ['skill-search', sessionId, skillSearchTrigger],
        queryFn: async () => {
            const result = await api!.searchSkillsExternal(sessionId, skillSearchTrigger)
            const typed = result as { success?: boolean; error?: string; results?: SkillSearchResult[] }
            if (typed.success === false && typed.error) {
                throw new Error(typed.error)
            }
            return result
        },
        enabled: !!api && activeTab === 'skills' && skillSubTab === 'online' && skillSearchTrigger.length >= 2,
        retry: false,
    })

    // Installed skills — always fetch when on skills tab
    const { data: skillsData } = useQuery({
        queryKey: queryKeys.skills(sessionId),
        queryFn: () => api!.getSkills(sessionId),
        enabled: !!api && activeTab === 'skills',
    })

    const handleInstallSkill = useCallback(async (skill: SkillSearchResult) => {
        if (!api) return
        setInstalling(skill.name)
        setError(null)
        setSuccessMsg(null)
        try {
            const res = await api.installSkillFromExternal(sessionId, skill.name, skill.repo) as { success?: boolean; error?: string }
            if (!res.success) {
                const serverError = res.error || ''
                if (serverError.includes('already installed')) {
                    setSuccessMsg(t('extensions.installSuccess', { name: skill.name }))
                    await queryClient.refetchQueries({ queryKey: queryKeys.skills(sessionId) })
                } else {
                    setError(serverError || t('extensions.installFailed'))
                }
                return
            }
            setSuccessMsg(t('extensions.installSuccess', { name: skill.name }))
            // Force refetch to ensure the installed list updates immediately
            await queryClient.refetchQueries({ queryKey: queryKeys.skills(sessionId) })
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Install failed')
        }
        setInstalling(null)
    }, [api, sessionId, queryClient, t])

    const handleUninstallSkill = useCallback(async (name: string) => {
        if (!api) return
        setInstalling(name)
        setError(null)
        try {
            const res = await api.uninstallSkill(sessionId, name)
            if (res && typeof res === 'object' && 'success' in res && !res.success) {
                throw new Error((res as { error?: string }).error || 'Uninstall failed')
            }
            await queryClient.refetchQueries({ queryKey: queryKeys.skills(sessionId) })
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
        setInstalling(null)
    }, [api, sessionId, queryClient])

    const handleInstallPlugin = useCallback(async () => {
        if (!api || !pluginIdInput.trim()) return
        setInstalling(pluginIdInput)
        setError(null)
        try {
            await api.installPlugin(sessionId, pluginIdInput.trim(), pluginSourceInput.trim() || undefined)
            setPluginIdInput('')
            setPluginSourceInput('')
            await queryClient.invalidateQueries({ queryKey: ['plugins', sessionId] })
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Install failed')
        }
        setInstalling(null)
    }, [api, sessionId, queryClient, pluginIdInput, pluginSourceInput])

    const plugins = (pluginData as { success: boolean; plugins?: PluginInfo[] } | null)?.plugins ?? []
    const searchResults = (searchData as { success: boolean; results?: SkillSearchResult[] } | null)?.results ?? []
    const installedSkills = (skillsData as { success: boolean; skills?: Array<{ name: string; description?: string }> } | null)?.skills ?? []
    const installedNames = useMemo(() => new Set(installedSkills.map(s => s.name.toLowerCase())), [installedSkills])

    const filteredInstalled = useMemo(() => {
        if (!installedFilterTrigger.trim()) return installedSkills
        const q = installedFilterTrigger.toLowerCase()
        return installedSkills.filter(s =>
            s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)
        )
    }, [installedSkills, installedFilterTrigger])

    return (
        <SubPageLayout
            tabs={[
                { id: 'skills', label: t('extensions.skills') },
                { id: 'plugins', label: t('extensions.plugins') },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as Tab)}
        >
            {error && (
                <div className="mx-3 mt-2 rounded-lg px-3 py-2 text-sm text-[var(--app-danger)] bg-[var(--app-badge-error-bg)]">
                    {error}
                </div>
            )}
            {successMsg && (
                <div className="mx-3 mt-2 rounded-lg px-3 py-2 text-sm text-[var(--app-success)] bg-[var(--app-success-subtle)]">
                    {successMsg}
                </div>
            )}

            {activeTab === 'skills' && (
                <div className="flex flex-col">
                    {/* Skill sub-tabs */}
                    <div className="flex border-b border-[var(--app-border)] bg-[var(--app-bg)]">
                        <button
                            type="button"
                            onClick={() => setSkillSubTab('installed')}
                            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
                                skillSubTab === 'installed'
                                    ? 'text-[var(--app-fg)] border-b-2 border-[var(--app-link)]'
                                    : 'text-[var(--app-hint)] hover:text-[var(--app-fg)]'
                            }`}
                        >
                            {t('extensions.installedSkills')} ({installedSkills.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSkillSubTab('online')}
                            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
                                skillSubTab === 'online'
                                    ? 'text-[var(--app-fg)] border-b-2 border-[var(--app-link)]'
                                    : 'text-[var(--app-hint)] hover:text-[var(--app-fg)]'
                            }`}
                        >
                            <span className="inline-flex items-center gap-1.5">
                                <CloudDownloadIcon />
                                {t('extensions.onlineInstall')}
                            </span>
                        </button>
                    </div>

                    {/* Installed skills tab */}
                    {skillSubTab === 'installed' && (
                        <div className="p-3 space-y-2">
                            {installedSkills.length > 0 && (
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-hint)]">
                                            <SearchIcon />
                                        </div>
                                        <input
                                            type="text"
                                            value={installedFilter}
                                            onChange={e => setInstalledFilter(e.target.value)}
                                            placeholder={t('extensions.filterInstalled')}
                                            enterKeyHint="search"
                                            className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)] py-2 pl-9 pr-3 text-sm text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none focus:ring-1 focus:ring-[var(--app-link)]"
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') setInstalledFilterTrigger(installedFilter.trim())
                                            }}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setInstalledFilterTrigger(installedFilter.trim())}
                                        className="shrink-0 rounded-lg bg-[var(--app-link)] px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                                    >
                                        {t('extensions.search')}
                                    </button>
                                </div>
                            )}
                            {filteredInstalled.length === 0 ? (
                                installedSkills.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--app-secondary-bg)] mb-3">
                                            <PuzzleIcon />
                                        </div>
                                        <div className="text-sm text-[var(--app-hint)]">{t('extensions.noSkills')}</div>
                                        <button
                                            type="button"
                                            onClick={() => setSkillSubTab('online')}
                                            className="mt-3 text-sm text-[var(--app-link)] hover:underline"
                                        >
                                            {t('extensions.goOnlineInstall')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="py-6 text-center text-sm text-[var(--app-hint)]">
                                        {t('extensions.noFilterResults')}
                                    </div>
                                )
                            ) : (
                                <div className="space-y-1">
                                    {filteredInstalled.map(skill => (
                                        <div
                                            key={skill.name}
                                            className="flex items-center justify-between rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)] px-3 py-2.5"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium text-[var(--app-fg)] truncate">{skill.name}</div>
                                                {skill.description && (
                                                    <div className="text-xs text-[var(--app-hint)] truncate mt-0.5">{skill.description}</div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleUninstallSkill(skill.name)}
                                                disabled={installing === skill.name}
                                                className="ml-2 shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50 text-[var(--app-danger)]"
                                            >
                                                {installing === skill.name ? '...' : <><TrashIcon /> {t('extensions.remove')}</>}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Online install tab */}
                    {skillSubTab === 'online' && (
                        <div className="p-3 space-y-3">
                            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)] p-3 space-y-2">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-hint)]">
                                            <SearchIcon />
                                        </div>
                                        <input
                                            type="text"
                                            value={skillQuery}
                                            onChange={e => setSkillQuery(e.target.value)}
                                            placeholder={t('extensions.searchOnlinePlaceholder')}
                                            enterKeyHint="search"
                                            className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] py-2 pl-9 pr-3 text-sm text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none focus:ring-1 focus:ring-[var(--app-link)]"
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && skillQuery.trim().length >= 2) {
                                                    setSkillSearchTrigger(skillQuery.trim())
                                                }
                                            }}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        disabled={skillQuery.trim().length < 2 || searchLoading}
                                        onClick={() => setSkillSearchTrigger(skillQuery.trim())}
                                        className="shrink-0 rounded-lg bg-[var(--app-link)] px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                                    >
                                        {searchLoading ? '...' : t('extensions.search')}
                                    </button>
                                </div>

                                {/* Search Results */}
                                {skillSearchTrigger.length >= 2 && (
                                    <div className="space-y-1 pt-1">
                                        {searchLoading ? (
                                            <div className="text-sm text-[var(--app-hint)] py-3 text-center">{t('extensions.searching')}</div>
                                        ) : searchError ? (
                                            <div className="text-sm py-3 text-center text-[var(--app-danger)]">{t('extensions.searchError')}</div>
                                        ) : searchResults.length === 0 ? (
                                            <div className="text-sm text-[var(--app-hint)] py-3 text-center">{t('extensions.noResults')}</div>
                                        ) : (
                                            <>
                                                <div className="text-xs text-[var(--app-hint)] pb-1">{t('extensions.foundCount', { count: searchResults.length })}</div>
                                                {searchResults.map(skill => {
                                                    const isInstalled = installedNames.has(skill.name.toLowerCase())
                                                    return (
                                                        <div
                                                            key={`${skill.repo}/${skill.name}`}
                                                            className="flex items-center justify-between rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2"
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-sm font-medium text-[var(--app-fg)] truncate">{skill.name}</span>
                                                                    {isInstalled && (
                                                                        <span className="shrink-0 inline-flex items-center gap-0.5 text-xs text-[var(--app-success)]">
                                                                            <CheckIcon />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-[var(--app-hint)] truncate">{skill.repo}{skill.stars ? ` · ${(skill.stars / 1000).toFixed(skill.stars >= 1000 ? 1 : 0)}k` : ''}</div>
                                                            </div>
                                                            {isInstalled ? (
                                                                <span className="ml-2 shrink-0 rounded-md px-2 py-1 text-xs text-[var(--app-success)]">
                                                                    {t('extensions.installed')}
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleInstallSkill(skill)}
                                                                    disabled={installing === skill.name}
                                                                    className="ml-2 shrink-0 rounded-md bg-[var(--app-link)] px-2.5 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
                                                                >
                                                                    {installing === skill.name ? '...' : t('extensions.install')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'plugins' && (
                <div className="p-3 space-y-3">
                    {/* Install Plugin Form */}
                    <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-secondary-bg)] p-3 space-y-2">
                        <h3 className="text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wider">
                            {t('extensions.installPlugin')}
                        </h3>
                        <input
                            type="text"
                            value={pluginIdInput}
                            onChange={e => setPluginIdInput(e.target.value)}
                            placeholder={t('extensions.pluginId')}
                            className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] py-1.5 px-3 text-sm text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none focus:ring-1 focus:ring-[var(--app-link)]"
                        />
                        <input
                            type="text"
                            value={pluginSourceInput}
                            onChange={e => setPluginSourceInput(e.target.value)}
                            placeholder={t('extensions.pluginSource')}
                            className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] py-1.5 px-3 text-sm text-[var(--app-fg)] placeholder:text-[var(--app-hint)] focus:outline-none focus:ring-1 focus:ring-[var(--app-link)]"
                        />
                        <button
                            type="button"
                            onClick={handleInstallPlugin}
                            disabled={!pluginIdInput.trim() || installing === pluginIdInput}
                            className="rounded-md bg-[var(--app-link)] px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
                        >
                            {installing === pluginIdInput ? t('extensions.installing') : t('extensions.pluginInstallBtn')}
                        </button>
                    </div>

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
        </SubPageLayout>
    )
}
