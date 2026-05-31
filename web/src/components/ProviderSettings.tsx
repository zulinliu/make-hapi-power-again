import { useState, useCallback } from 'react'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { useProviders, useProviderModels } from '@/hooks/queries/useProviders'
import { useCreateProvider, useUpdateProvider, useDeleteProvider, useAssignProvider } from '@/hooks/mutations/useProviders'
import type { ProviderWithAssignments, ProviderAssignment } from '@hapipower/protocol'
import type { AgentFlavor } from '@hapipower/protocol'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { AGENT_FLAVORS } from '@hapipower/protocol'

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
}

type ProviderFormState = {
    name: string
    baseUrl: string
    apiKey: string
    notes: string
}

const emptyForm: ProviderFormState = { name: '', baseUrl: '', apiKey: '', notes: '' }

function ProviderForm({
    initial,
    onSubmit,
    onCancel,
    isPending,
    submitLabel,
}: {
    initial?: ProviderFormState
    onSubmit: (data: ProviderFormState) => void
    onCancel: () => void
    isPending: boolean
    submitLabel: string
}) {
    const { t } = useTranslation()
    const [form, setForm] = useState<ProviderFormState>(initial ?? emptyForm)

    const update = (key: keyof ProviderFormState, value: string) =>
        setForm(prev => ({ ...prev, [key]: value }))

    return (
        <form
            onSubmit={e => { e.preventDefault(); onSubmit(form) }}
            className="flex flex-col gap-3"
        >
            <div>
                <label className="block text-xs text-[var(--app-hint)] mb-1">{t('settings.providers.name')}</label>
                <input
                    className="w-full rounded-md border border-[var(--app-divider)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder={t('settings.providers.namePlaceholder')}
                    required
                />
            </div>
            <div>
                <label className="block text-xs text-[var(--app-hint)] mb-1">{t('settings.providers.baseUrl')}</label>
                <input
                    className="w-full rounded-md border border-[var(--app-divider)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] font-mono"
                    value={form.baseUrl}
                    onChange={e => update('baseUrl', e.target.value)}
                    placeholder={t('settings.providers.baseUrlPlaceholder')}
                    required
                />
            </div>
            <div>
                <label className="block text-xs text-[var(--app-hint)] mb-1">{t('settings.providers.apiKey')}</label>
                <input
                    type="password"
                    className="w-full rounded-md border border-[var(--app-divider)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)] font-mono"
                    value={form.apiKey}
                    onChange={e => update('apiKey', e.target.value)}
                    placeholder={t('settings.providers.apiKeyPlaceholder')}
                    required={!initial}
                />
            </div>
            <div>
                <label className="block text-xs text-[var(--app-hint)] mb-1">{t('settings.providers.notes')}</label>
                <input
                    className="w-full rounded-md border border-[var(--app-divider)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]"
                    value={form.notes}
                    onChange={e => update('notes', e.target.value)}
                    placeholder={t('settings.providers.notesPlaceholder')}
                />
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-md px-4 py-2 text-sm text-[var(--app-hint)] hover:bg-[var(--app-hover)]"
                >
                    {t('settings.providers.cancel')}
                </button>
                <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-md bg-[var(--app-accent)] px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                    {isPending ? '...' : submitLabel}
                </button>
            </div>
        </form>
    )
}

function ProviderRow({
    provider,
    onEdit,
    onDelete,
    onAssign,
    onUnassign,
}: {
    provider: ProviderWithAssignments
    onEdit: (p: ProviderWithAssignments) => void
    onDelete: (id: string) => void
    onAssign: (providerId: string, flavor: AgentFlavor, isDefault: boolean) => void
    onUnassign: (providerId: string, flavor: string) => void
}) {
    const { t } = useTranslation()
    const { api } = useAppContext()
    const { models, isLoading, error, refetch } = useProviderModels(api, provider.id, false)
    const [expanded, setExpanded] = useState(false)
    const [discovering, setDiscovering] = useState(false)

    const handleDiscover = useCallback(async () => {
        setDiscovering(true)
        await refetch()
        setDiscovering(false)
    }, [refetch])

    const assignedFlavors = provider.assignments.map((a: ProviderAssignment) => a.agentFlavor)
    const unassignedFlavors = AGENT_FLAVORS.filter(f => !assignedFlavors.includes(f))

    return (
        <div className="border-b border-[var(--app-divider)] last:border-b-0">
            <button
                className="flex w-full items-center justify-between px-3 py-3 text-left hover:bg-[var(--app-hover)]"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{provider.name}</div>
                    <div className="truncate text-xs text-[var(--app-hint)] font-mono">{provider.baseUrl}</div>
                </div>
                <svg className={`h-4 w-4 shrink-0 text-[var(--app-hint)] transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {expanded && (
                <div className="px-3 pb-3 space-y-3">
                    {provider.notes && (
                        <div className="text-xs text-[var(--app-hint)]">{provider.notes}</div>
                    )}

                    {assignedFlavors.length > 0 && (
                        <div>
                            <div className="text-xs font-semibold text-[var(--app-hint)] mb-1">{t('settings.providers.assignments')}</div>
                            <div className="flex flex-wrap gap-1">
                                {provider.assignments.map((a: ProviderAssignment) => (
                                    <span key={a.agentFlavor} className="inline-flex items-center gap-1 rounded-full bg-[var(--app-accent)]/10 px-2 py-0.5 text-xs">
                                        {capitalize(a.agentFlavor)}
                                        {a.isDefault && <span className="text-[var(--app-accent)]">*</span>}
                                        <button
                                            onClick={() => onUnassign(provider.id, a.agentFlavor)}
                                            className="text-[var(--app-hint)] hover:text-[var(--app-danger)]"
                                            title={t('settings.providers.unassign')}
                                        >
                                            x
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {unassignedFlavors.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {unassignedFlavors.map(flavor => (
                                <button
                                    key={flavor}
                                    onClick={() => onAssign(provider.id, flavor, false)}
                                    className="rounded-full border border-dashed border-[var(--app-divider)] px-2 py-0.5 text-xs text-[var(--app-hint)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
                                >
                                    + {capitalize(flavor)}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDiscover}
                            disabled={discovering || isLoading}
                            className="rounded-md border border-[var(--app-divider)] px-3 py-1 text-xs hover:bg-[var(--app-hover)] disabled:opacity-50"
                        >
                            {discovering || isLoading ? t('settings.providers.discovering') : t('settings.providers.discoverModels')}
                        </button>
                        <button
                            onClick={() => onEdit(provider)}
                            className="rounded-md border border-[var(--app-divider)] px-3 py-1 text-xs hover:bg-[var(--app-hover)]"
                        >
                            {t('settings.providers.edit')}
                        </button>
                        <button
                            onClick={() => { if (confirm(t('settings.providers.deleteConfirm'))) onDelete(provider.id) }}
                            className="rounded-md border border-[var(--app-divider)] px-3 py-1 text-xs text-red-500 hover:bg-red-500/10"
                        >
                            {t('settings.providers.delete')}
                        </button>
                    </div>

                    {error && (
                        <div className="text-xs text-red-500">
                            {t('settings.providers.discoveryError', { error: error })}
                        </div>
                    )}
                    {models.length > 0 && (
                        <div className="text-xs text-[var(--app-hint)]">
                            {t('settings.providers.modelsFound', { count: String(models.length) })}
                        </div>
                    )}
                    {!isLoading && !error && models.length === 0 && discovering === false && (
                        <div className="text-xs text-[var(--app-hint)]">{t('settings.providers.noModels')}</div>
                    )}
                </div>
            )}
        </div>
    )
}

export function ProviderSettings() {
    const { t } = useTranslation()
    const { api } = useAppContext()
    const { providers, isLoading, error } = useProviders(api)
    const { createProvider, isPending: isCreating } = useCreateProvider(api)
    const { updateProvider, isPending: isUpdating } = useUpdateProvider(api)
    const { deleteProvider } = useDeleteProvider(api)
    const { assignProvider } = useAssignProvider(api)

    const [showAdd, setShowAdd] = useState(false)
    const [editing, setEditing] = useState<ProviderWithAssignments | null>(null)

    const handleCreate = useCallback(async (form: ProviderFormState) => {
        await createProvider({ name: form.name, baseUrl: form.baseUrl, apiKey: form.apiKey, notes: form.notes || undefined })
        setShowAdd(false)
    }, [createProvider])

    const handleUpdate = useCallback(async (form: ProviderFormState) => {
        if (!editing) return
        await updateProvider({
            id: editing.id,
            name: form.name,
            baseUrl: form.baseUrl,
            ...(form.apiKey ? { apiKey: form.apiKey } : {}),
            notes: form.notes,
        })
        setEditing(null)
    }, [editing, updateProvider])

    return (
        <div className="border-b border-[var(--app-divider)]">
            <div className="px-3 py-2 text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wide">
                {t('settings.providers.title')}
            </div>

            <div className="px-3 py-2">
                {isLoading ? (
                    <div className="text-xs text-[var(--app-hint)]">Loading...</div>
                ) : error ? (
                    <div className="text-xs text-red-500">{error}</div>
                ) : providers.length === 0 ? (
                    <div className="text-xs text-[var(--app-hint)]">{t('settings.providers.empty')}</div>
                ) : (
                    <div className="rounded-lg border border-[var(--app-divider)] overflow-hidden">
                        {providers.map(p => (
                            <ProviderRow
                                key={p.id}
                                provider={p}
                                onEdit={setEditing}
                                onDelete={deleteProvider}
                                onAssign={(providerId, flavor, isDefault) => assignProvider({ providerId, agentFlavor: flavor, isDefault })}
                                onUnassign={(providerId, flavor) => {
                                    api?.unassignProvider(providerId, flavor)
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div className="px-3 pb-3">
                <button
                    onClick={() => setShowAdd(true)}
                    className="rounded-md border border-dashed border-[var(--app-divider)] w-full px-3 py-2 text-xs text-[var(--app-hint)] hover:border-[var(--app-accent)] hover:text-[var(--app-accent)]"
                >
                    + {t('settings.providers.add')}
                </button>
            </div>

            <Dialog open={showAdd} onOpenChange={setShowAdd}>
                <DialogContent className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md rounded-xl border border-[var(--app-divider)] bg-[var(--app-surface)] p-4 shadow-xl">
                    <h3 className="text-sm font-semibold mb-3">{t('settings.providers.add')}</h3>
                    <ProviderForm
                        onSubmit={handleCreate}
                        onCancel={() => setShowAdd(false)}
                        isPending={isCreating}
                        submitLabel={t('settings.providers.save')}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null) }}>
                <DialogContent className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md rounded-xl border border-[var(--app-divider)] bg-[var(--app-surface)] p-4 shadow-xl">
                    <h3 className="text-sm font-semibold mb-3">{t('settings.providers.edit')}</h3>
                    {editing && (
                        <ProviderForm
                            initial={{
                                name: editing.name,
                                baseUrl: editing.baseUrl,
                                apiKey: '',
                                notes: editing.notes ?? '',
                            }}
                            onSubmit={handleUpdate}
                            onCancel={() => setEditing(null)}
                            isPending={isUpdating}
                            submitLabel={t('settings.providers.save')}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
