import { useCallback, useId, useMemo, useState } from 'react'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { useProviderOverview } from '@/hooks/queries/useProviders'
import {
    useAssignProvider,
    useCheckProvider,
    useCreateProvider,
    useDeleteProvider,
    useDiscoverProviderModels,
    useRevealProviderKey,
    useUnassignProvider,
    useUpdateProvider,
} from '@/hooks/mutations/useProviders'
import type {
    AgentFlavor,
    ProviderHealthStatus,
    ProviderProtocol,
    ProviderWithAssignments,
} from '@hapipower/protocol'
import { AGENT_FLAVORS } from '@hapipower/protocol'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CheckIcon, CopyIcon, PlusCircleIcon } from '@/components/icons'
import { EyeIcon, GlobeIcon, WrenchIcon } from '@/components/ToolCard/icons'

const protocolOptions: ProviderProtocol[] = ['auto', 'openai', 'anthropic', 'gemini']
const wizardSteps = ['protocol', 'connection', 'capability', 'assignment'] as const

type ProviderFormState = {
    name: string
    baseUrl: string
    apiKey: string
    protocol: ProviderProtocol
    defaultModel: string
    notes: string
}

const emptyForm: ProviderFormState = {
    name: '',
    baseUrl: '',
    apiKey: '',
    protocol: 'auto',
    defaultModel: '',
    notes: '',
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatTime(value: number | null, locale: string): string {
    if (!value) return ''
    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value))
}

function getHostLabel(baseUrl: string): string {
    try {
        return new URL(baseUrl).host
    } catch {
        return baseUrl
    }
}

function formatContextWindow(value: number): string {
    if (value >= 1000) {
        return `${Math.round(value / 1000)}K`
    }
    return String(value)
}

async function copyTextToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return true
        }
    } catch {
        // Fall through to the textarea fallback for restricted PWA contexts.
    }

    try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(textarea)
        return copied
    } catch {
        return false
    }
}

function statusClass(status: ProviderHealthStatus): string {
    if (status === 'online') return 'bg-(--hp-success-subtle) text-(--hp-success)'
    if (status === 'degraded') return 'bg-(--hp-warning-subtle) text-(--hp-warning)'
    if (status === 'offline' || status === 'blocked') return 'bg-(--hp-danger-subtle) text-(--hp-danger)'
    return 'bg-(--hp-surface-1) text-(--hp-text-tertiary)'
}

function ProviderWizard({
    onSubmit,
    onCancel,
    isPending,
}: {
    onSubmit: (data: ProviderFormState, assignedAgents: AgentFlavor[]) => void | Promise<void>
    onCancel: () => void
    isPending: boolean
}) {
    const { t } = useTranslation()
    const formId = useId()
    const [stepIndex, setStepIndex] = useState(0)
    const [form, setForm] = useState<ProviderFormState>(emptyForm)
    const [assignedAgents, setAssignedAgents] = useState<Set<AgentFlavor>>(() => new Set())
    const step = wizardSteps[stepIndex]
    const nameId = `${formId}-wizard-name`
    const baseUrlId = `${formId}-wizard-base-url`
    const apiKeyId = `${formId}-wizard-api-key`
    const defaultModelId = `${formId}-wizard-default-model`
    const notesId = `${formId}-wizard-notes`

    const update = (key: keyof ProviderFormState, value: string) =>
        setForm(prev => ({ ...prev, [key]: value }))

    const canContinue = step !== 'connection'
        || (form.name.trim().length > 0 && form.baseUrl.trim().length > 0 && form.apiKey.trim().length > 0)

    const toggleAgent = (flavor: AgentFlavor) => {
        setAssignedAgents(prev => {
            const next = new Set(prev)
            if (next.has(flavor)) {
                next.delete(flavor)
            } else {
                next.add(flavor)
            }
            return next
        })
    }

    const goNext = () => {
        if (!canContinue) return
        setStepIndex(prev => Math.min(prev + 1, wizardSteps.length - 1))
    }

    const goBack = () => {
        setStepIndex(prev => Math.max(prev - 1, 0))
    }

    const submit = () => {
        if (!canContinue) return
        onSubmit(form, Array.from(assignedAgents))
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t('settings.modelNexus.wizard.steps')}>
                {wizardSteps.map((item, index) => (
                    <div
                        key={item}
                        className={`rounded-(--hp-radius-md) border px-3 py-2 text-xs ${
                            index === stepIndex
                                ? 'border-(--hp-primary) bg-(--hp-primary-subtle) text-(--hp-text-primary)'
                                : index < stepIndex
                                    ? 'border-(--hp-border) bg-(--hp-surface-1) text-(--hp-text-secondary)'
                                    : 'border-(--hp-border) text-(--hp-text-tertiary)'
                        }`}
                    >
                        <div className="font-medium">{t(`settings.modelNexus.wizard.${item}`)}</div>
                        <div className="mt-0.5 font-mono text-[11px]">{index + 1}/{wizardSteps.length}</div>
                    </div>
                ))}
            </div>

            {step === 'protocol' ? (
                <div className="space-y-3">
                    <div>
                        <h4 className="text-sm font-semibold text-(--hp-text-primary)">{t('settings.modelNexus.wizard.protocolTitle')}</h4>
                        <p className="mt-1 text-xs leading-5 text-(--hp-text-tertiary)">{t('settings.modelNexus.wizard.protocolBody')}</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('settings.modelNexus.protocol')}>
                        {protocolOptions.map(protocol => {
                            const selected = form.protocol === protocol
                            return (
                                <button
                                    key={protocol}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => update('protocol', protocol)}
                                    className={`min-h-[44px] rounded-(--hp-radius-md) border px-3 py-2 text-left text-sm transition-colors ${
                                        selected
                                            ? 'border-(--hp-primary) bg-(--hp-primary-subtle) text-(--hp-text-primary)'
                                            : 'border-(--hp-border) hover:bg-(--hp-surface-1)'
                                    }`}
                                >
                                    {t(`settings.modelNexus.protocol.${protocol}`)}
                                </button>
                            )
                        })}
                    </div>
                </div>
            ) : null}

            {step === 'connection' ? (
                <div className="space-y-3">
                    <div>
                        <h4 className="text-sm font-semibold text-(--hp-text-primary)">{t('settings.modelNexus.wizard.connectionTitle')}</h4>
                        <p className="mt-1 text-xs leading-5 text-(--hp-text-tertiary)">{t('settings.modelNexus.wizard.connectionBody')}</p>
                    </div>
                    <div>
                        <label htmlFor={nameId} className="block text-xs text-(--hp-text-tertiary) mb-1">{t('settings.providers.name')}</label>
                        <input
                            id={nameId}
                            className="min-h-[44px] w-full rounded-(--hp-radius-md) border border-(--hp-border) bg-transparent px-3 py-2.5 text-base outline-none focus:border-(--hp-primary) focus:ring-1 focus:ring-(--hp-primary) sm:text-sm"
                            value={form.name}
                            onChange={e => update('name', e.target.value)}
                            placeholder={t('settings.providers.namePlaceholder')}
                            autoComplete="off"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor={baseUrlId} className="block text-xs text-(--hp-text-tertiary) mb-1">{t('settings.providers.baseUrl')}</label>
                        <input
                            id={baseUrlId}
                            className="min-h-[44px] w-full rounded-(--hp-radius-md) border border-(--hp-border) bg-transparent px-3 py-2.5 font-mono text-base outline-none focus:border-(--hp-primary) focus:ring-1 focus:ring-(--hp-primary) sm:text-sm"
                            value={form.baseUrl}
                            onChange={e => update('baseUrl', e.target.value)}
                            placeholder={t('settings.providers.baseUrlPlaceholder')}
                            autoComplete="off"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor={apiKeyId} className="block text-xs text-(--hp-text-tertiary) mb-1">{t('settings.providers.apiKey')}</label>
                        <input
                            id={apiKeyId}
                            type="password"
                            className="min-h-[44px] w-full rounded-(--hp-radius-md) border border-(--hp-border) bg-transparent px-3 py-2.5 font-mono text-base outline-none focus:border-(--hp-primary) focus:ring-1 focus:ring-(--hp-primary) sm:text-sm"
                            value={form.apiKey}
                            onChange={e => update('apiKey', e.target.value)}
                            placeholder={t('settings.providers.apiKeyPlaceholder')}
                            autoComplete="new-password"
                            required
                        />
                    </div>
                </div>
            ) : null}

            {step === 'capability' ? (
                <div className="space-y-3">
                    <div>
                        <h4 className="text-sm font-semibold text-(--hp-text-primary)">{t('settings.modelNexus.wizard.capabilityTitle')}</h4>
                        <p className="mt-1 text-xs leading-5 text-(--hp-text-tertiary)">{t('settings.modelNexus.wizard.capabilityBody')}</p>
                    </div>
                    <div className="rounded-(--hp-radius-md) border border-(--hp-border) bg-(--hp-surface-1) px-3 py-3 text-xs leading-5 text-(--hp-text-secondary)">
                        {t('settings.modelNexus.wizard.capabilityHint')}
                    </div>
                    <div>
                        <label htmlFor={defaultModelId} className="block text-xs text-(--hp-text-tertiary) mb-1">{t('settings.modelNexus.defaultModel')}</label>
                        <input
                            id={defaultModelId}
                            className="min-h-[44px] w-full rounded-(--hp-radius-md) border border-(--hp-border) bg-transparent px-3 py-2.5 font-mono text-base outline-none focus:border-(--hp-primary) focus:ring-1 focus:ring-(--hp-primary) sm:text-sm"
                            value={form.defaultModel}
                            onChange={e => update('defaultModel', e.target.value)}
                            placeholder={t('settings.modelNexus.defaultModelPlaceholder')}
                            autoComplete="off"
                        />
                    </div>
                    <div>
                        <label htmlFor={notesId} className="block text-xs text-(--hp-text-tertiary) mb-1">{t('settings.providers.notes')}</label>
                        <input
                            id={notesId}
                            className="min-h-[44px] w-full rounded-(--hp-radius-md) border border-(--hp-border) bg-transparent px-3 py-2.5 text-base outline-none focus:border-(--hp-primary) focus:ring-1 focus:ring-(--hp-primary) sm:text-sm"
                            value={form.notes}
                            onChange={e => update('notes', e.target.value)}
                            placeholder={t('settings.providers.notesPlaceholder')}
                            autoComplete="off"
                        />
                    </div>
                </div>
            ) : null}

            {step === 'assignment' ? (
                <div className="space-y-3">
                    <div>
                        <h4 className="text-sm font-semibold text-(--hp-text-primary)">{t('settings.modelNexus.wizard.assignmentTitle')}</h4>
                        <p className="mt-1 text-xs leading-5 text-(--hp-text-tertiary)">{t('settings.modelNexus.wizard.assignmentBody')}</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {AGENT_FLAVORS.map(flavor => {
                            const checkboxId = `${formId}-agent-${flavor}`
                            return (
                                <label
                                    key={flavor}
                                    htmlFor={checkboxId}
                                    className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-(--hp-radius-md) border border-(--hp-border) px-3 py-2 text-sm hover:bg-(--hp-surface-1)"
                                >
                                    <input
                                        id={checkboxId}
                                        type="checkbox"
                                        checked={assignedAgents.has(flavor)}
                                        onChange={() => toggleAgent(flavor)}
                                        className="h-4 w-4 accent-(--hp-primary)"
                                    />
                                    <span className="font-medium text-(--hp-text-primary)">{capitalize(flavor)}</span>
                                </label>
                            )
                        })}
                    </div>
                    <div className="rounded-(--hp-radius-md) border border-(--hp-border) bg-(--hp-surface-1) px-3 py-3 text-xs leading-5 text-(--hp-text-secondary)">
                        {assignedAgents.size > 0
                            ? t('settings.modelNexus.wizard.assignmentSummary', { count: assignedAgents.size })
                            : t('settings.modelNexus.wizard.assignmentNone')}
                    </div>
                </div>
            ) : null}

            <div className="flex justify-between gap-2 pt-2">
                <button
                    type="button"
                    onClick={stepIndex === 0 ? onCancel : goBack}
                    className="h-[46px] rounded-(--hp-radius-md) px-4 text-sm text-(--hp-text-tertiary) hover:bg-(--hp-surface-1) transition-colors"
                >
                    {stepIndex === 0 ? t('settings.providers.cancel') : t('settings.modelNexus.wizard.back')}
                </button>
                {stepIndex < wizardSteps.length - 1 ? (
                    <button
                        type="button"
                        onClick={goNext}
                        disabled={!canContinue}
                        className="h-[46px] rounded-(--hp-radius-md) bg-(--hp-primary) px-4 text-sm text-(--hp-primary-text) hover:bg-(--hp-primary-hover) disabled:opacity-50 transition-colors"
                    >
                        {t('settings.modelNexus.wizard.next')}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={submit}
                        disabled={isPending}
                        className="h-[46px] rounded-(--hp-radius-md) bg-(--hp-primary) px-4 text-sm text-(--hp-primary-text) hover:bg-(--hp-primary-hover) disabled:opacity-50 transition-colors"
                    >
                        {isPending ? t('settings.providers.saving') : t('settings.modelNexus.wizard.finish')}
                    </button>
                )}
            </div>
        </div>
    )
}

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
    const formId = useId()
    const [form, setForm] = useState<ProviderFormState>(initial ?? emptyForm)
    const nameId = `${formId}-name`
    const baseUrlId = `${formId}-base-url`
    const protocolId = `${formId}-protocol`
    const defaultModelId = `${formId}-default-model`
    const apiKeyId = `${formId}-api-key`
    const notesId = `${formId}-notes`

    const update = (key: keyof ProviderFormState, value: string) =>
        setForm(prev => ({ ...prev, [key]: value }))

    return (
        <form
            onSubmit={e => { e.preventDefault(); onSubmit(form) }}
            className="flex flex-col gap-3"
        >
            <div>
                <label htmlFor={nameId} className="block text-xs text-(--hp-text-tertiary) mb-1">{t('settings.providers.name')}</label>
                <input
                    id={nameId}
                    className="min-h-[44px] w-full rounded-(--hp-radius-md) border border-(--hp-border) bg-transparent px-3 py-2.5 text-base outline-none focus:border-(--hp-primary) focus:ring-1 focus:ring-(--hp-primary) sm:text-sm"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder={t('settings.providers.namePlaceholder')}
                    autoComplete="off"
                    required
                />
            </div>
            <div>
                <label htmlFor={baseUrlId} className="block text-xs text-(--hp-text-tertiary) mb-1">{t('settings.providers.baseUrl')}</label>
                <input
                    id={baseUrlId}
                    className="min-h-[44px] w-full rounded-(--hp-radius-md) border border-(--hp-border) bg-transparent px-3 py-2.5 font-mono text-base outline-none focus:border-(--hp-primary) focus:ring-1 focus:ring-(--hp-primary) sm:text-sm"
                    value={form.baseUrl}
                    onChange={e => update('baseUrl', e.target.value)}
                    placeholder={t('settings.providers.baseUrlPlaceholder')}
                    autoComplete="off"
                    required
                />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <label htmlFor={protocolId} className="block text-xs text-(--hp-text-tertiary) mb-1">{t('settings.modelNexus.protocol')}</label>
                    <select
                        id={protocolId}
                        className="min-h-[44px] w-full rounded-(--hp-radius-md) border border-(--hp-border) bg-(--hp-surface-0) px-3 py-2 text-base outline-none focus:border-(--hp-primary) focus:ring-1 focus:ring-(--hp-primary) sm:text-sm"
                        value={form.protocol}
                        onChange={e => update('protocol', e.target.value)}
                    >
                        {protocolOptions.map(protocol => (
                            <option key={protocol} value={protocol}>{t(`settings.modelNexus.protocol.${protocol}`)}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor={defaultModelId} className="block text-xs text-(--hp-text-tertiary) mb-1">{t('settings.modelNexus.defaultModel')}</label>
                    <input
                        id={defaultModelId}
                        className="min-h-[44px] w-full rounded-(--hp-radius-md) border border-(--hp-border) bg-transparent px-3 py-2.5 font-mono text-base outline-none focus:border-(--hp-primary) focus:ring-1 focus:ring-(--hp-primary) sm:text-sm"
                        value={form.defaultModel}
                        onChange={e => update('defaultModel', e.target.value)}
                        placeholder={t('settings.modelNexus.defaultModelPlaceholder')}
                        autoComplete="off"
                    />
                </div>
            </div>
            <div>
                <label htmlFor={apiKeyId} className="block text-xs text-(--hp-text-tertiary) mb-1">{t('settings.providers.apiKey')}</label>
                <input
                    id={apiKeyId}
                    type="password"
                    className="min-h-[44px] w-full rounded-(--hp-radius-md) border border-(--hp-border) bg-transparent px-3 py-2.5 font-mono text-base outline-none focus:border-(--hp-primary) focus:ring-1 focus:ring-(--hp-primary) sm:text-sm"
                    value={form.apiKey}
                    onChange={e => update('apiKey', e.target.value)}
                    placeholder={t('settings.providers.apiKeyPlaceholder')}
                    autoComplete="new-password"
                    required={!initial}
                />
            </div>
            <div>
                <label htmlFor={notesId} className="block text-xs text-(--hp-text-tertiary) mb-1">{t('settings.providers.notes')}</label>
                <input
                    id={notesId}
                    className="min-h-[44px] w-full rounded-(--hp-radius-md) border border-(--hp-border) bg-transparent px-3 py-2.5 text-base outline-none focus:border-(--hp-primary) focus:ring-1 focus:ring-(--hp-primary) sm:text-sm"
                    value={form.notes}
                    onChange={e => update('notes', e.target.value)}
                    placeholder={t('settings.providers.notesPlaceholder')}
                    autoComplete="off"
                />
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="min-h-[44px] rounded-(--hp-radius-md) px-4 py-2 text-sm text-(--hp-text-tertiary) hover:bg-(--hp-surface-1) transition-colors"
                >
                    {t('settings.providers.cancel')}
                </button>
                <button
                    type="submit"
                    disabled={isPending}
                    className="min-h-[44px] rounded-(--hp-radius-md) bg-(--hp-primary) px-4 py-2 text-sm text-(--hp-primary-text) hover:bg-(--hp-primary-hover) disabled:opacity-50 transition-colors"
                >
                    {isPending ? t('settings.providers.saving') : submitLabel}
                </button>
            </div>
        </form>
    )
}

function SummaryMetric({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="rounded-(--hp-radius-md) border border-(--hp-border) bg-(--hp-surface-0) px-3 py-2">
            <div className="text-[11px] text-(--hp-text-tertiary)">{label}</div>
            <div className="text-sm font-semibold text-(--hp-text-primary)">{value}</div>
        </div>
    )
}

function ProviderCard({
    provider,
    busy,
    onCheck,
    onDiscover,
    onReveal,
    onEdit,
    onDeleteClick,
}: {
    provider: ProviderWithAssignments
    busy: boolean
    onCheck: (providerId: string) => void
    onDiscover: (providerId: string) => void
    onReveal: (provider: ProviderWithAssignments) => void
    onEdit: (provider: ProviderWithAssignments) => void
    onDeleteClick: (id: string) => void
}) {
    const { t, locale } = useTranslation()
    const checkedAt = formatTime(provider.health.checkedAt, locale)
    const protocol = provider.health.protocolDetected ?? provider.protocol
    const models = provider.modelCache.length
    const hostLabel = getHostLabel(provider.baseUrl)
    const capabilities = provider.health.capabilities
    const capabilityChips = [
        capabilities.tokenUsage === true
            ? t('settings.modelNexus.capability.usage')
            : capabilities.tokenUsage === false
                ? t('settings.modelNexus.capability.usageUnavailable')
                : t('settings.modelNexus.capability.usageUnknown'),
        capabilities.contextWindow
            ? t('settings.modelNexus.capability.context', { value: formatContextWindow(capabilities.contextWindow) })
            : t('settings.modelNexus.capability.contextUnknown'),
        capabilities.toolUse ? t('settings.modelNexus.capability.tools') : null,
        capabilities.imageInput ? t('settings.modelNexus.capability.vision') : null,
    ].filter((chip): chip is string => chip !== null)

    return (
        <article className="rounded-(--hp-radius-lg) border border-(--hp-border) bg-(--hp-surface-0) p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-sm font-semibold text-(--hp-text-primary)">{provider.name}</h4>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(provider.health.status)}`}>
                            {t(`settings.modelNexus.status.${provider.health.status}`)}
                        </span>
                    </div>
                    <div className="mt-1 truncate font-mono text-xs text-(--hp-text-tertiary)" title={provider.baseUrl}>{hostLabel}</div>
                </div>
                <span className="shrink-0 rounded-(--hp-radius-sm) border border-(--hp-border) px-2 py-1 font-mono text-[11px] text-(--hp-text-tertiary)">
                    {provider.apiKeyMasked}
                </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                    <div className="text-(--hp-text-tertiary)">{t('settings.modelNexus.protocol')}</div>
                    <div className="font-medium text-(--hp-text-primary)">{t(`settings.modelNexus.protocol.${protocol}`)}</div>
                </div>
                <div>
                    <div className="text-(--hp-text-tertiary)">{t('settings.modelNexus.models')}</div>
                    <div className="font-medium text-(--hp-text-primary)">{models}</div>
                </div>
                <div>
                    <div className="text-(--hp-text-tertiary)">{t('settings.modelNexus.latency')}</div>
                    <div className="font-medium text-(--hp-text-primary)">
                        {provider.health.latencyMs === null ? t('settings.modelNexus.unknown') : `${provider.health.latencyMs} ms`}
                    </div>
                </div>
                <div>
                    <div className="text-(--hp-text-tertiary)">{t('settings.modelNexus.defaultModel')}</div>
                    <div className="truncate font-medium text-(--hp-text-primary)">{provider.defaultModel || t('settings.modelNexus.unset')}</div>
                </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                {capabilityChips.map(chip => (
                    <span key={chip} className="rounded-full border border-(--hp-border) bg-(--hp-surface-1) px-2.5 py-1 text-xs text-(--hp-text-secondary)">
                        {chip}
                    </span>
                ))}
            </div>

            {provider.health.errorMessage && (
                <div className="mt-3 rounded-(--hp-radius-md) bg-(--hp-danger-subtle) px-3 py-2 text-xs text-(--hp-danger)">
                    {provider.health.errorMessage}
                </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
                {provider.assignments.length > 0 ? provider.assignments.map(assignment => (
                    <span key={assignment.agentFlavor} className="inline-flex items-center rounded-full bg-(--hp-primary-subtle) px-2.5 py-1 text-xs text-(--hp-text-primary)">
                        {capitalize(assignment.agentFlavor)}
                        {assignment.isDefault ? <span className="ml-1 text-(--hp-primary)">{t('settings.modelNexus.defaultBadge')}</span> : null}
                    </span>
                )) : (
                    <span className="text-xs text-(--hp-text-tertiary)">{t('settings.modelNexus.noAssignments')}</span>
                )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => onCheck(provider.id)}
                    disabled={busy}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-(--hp-radius-md) border border-(--hp-border) px-3 py-2 text-xs hover:bg-(--hp-surface-1) disabled:opacity-50 transition-colors"
                >
                    <WrenchIcon className="h-4 w-4" />
                    {busy ? t('settings.modelNexus.checking') : t('settings.modelNexus.check')}
                </button>
                <button
                    type="button"
                    onClick={() => onDiscover(provider.id)}
                    disabled={busy}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-(--hp-radius-md) border border-(--hp-border) px-3 py-2 text-xs hover:bg-(--hp-surface-1) disabled:opacity-50 transition-colors"
                >
                    <GlobeIcon className="h-4 w-4" />
                    {t('settings.providers.discoverModels')}
                </button>
                <button
                    type="button"
                    onClick={() => onReveal(provider)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-(--hp-radius-md) border border-(--hp-border) px-3 py-2 text-xs hover:bg-(--hp-surface-1) transition-colors"
                >
                    <EyeIcon className="h-4 w-4" />
                    {t('settings.modelNexus.revealKey')}
                </button>
                <button
                    type="button"
                    onClick={() => onEdit(provider)}
                    className="min-h-[44px] rounded-(--hp-radius-md) border border-(--hp-border) px-3 py-2 text-xs hover:bg-(--hp-surface-1) transition-colors"
                >
                    {t('settings.providers.edit')}
                </button>
                <button
                    type="button"
                    onClick={() => onDeleteClick(provider.id)}
                    className="min-h-[44px] rounded-(--hp-radius-md) border border-(--hp-border) px-3 py-2 text-xs text-(--hp-danger) hover:bg-(--hp-danger-subtle) transition-colors"
                >
                    {t('settings.providers.delete')}
                </button>
                {checkedAt ? <span className="text-xs text-(--hp-text-tertiary)">{t('settings.modelNexus.checkedAt', { time: checkedAt })}</span> : null}
            </div>
        </article>
    )
}

function RouteMatrix({
    providers,
    onAssign,
    onUnassign,
}: {
    providers: ProviderWithAssignments[]
    onAssign: (providerId: string, flavor: AgentFlavor, isDefault: boolean, model?: string | null) => void
    onUnassign: (providerId: string, flavor: AgentFlavor) => void
}) {
    const { t } = useTranslation()
    const assignedByFlavor = useMemo(() => {
        const map = new Map<AgentFlavor, { provider: ProviderWithAssignments; model: string | null; isDefault: boolean }>()
        for (const provider of providers) {
            for (const assignment of provider.assignments) {
                if (!assignment.isDefault) continue
                map.set(assignment.agentFlavor, {
                    provider,
                    model: assignment.model ?? provider.defaultModel,
                    isDefault: assignment.isDefault,
                })
            }
        }
        return map
    }, [providers])

    return (
        <div className="rounded-(--hp-radius-lg) border border-(--hp-border) bg-(--hp-surface-0)">
            <div className="border-b border-(--hp-border) px-3 py-2">
                <div className="text-sm font-semibold text-(--hp-text-primary)">{t('settings.modelNexus.matrixTitle')}</div>
                <div className="text-xs text-(--hp-text-tertiary)">{t('settings.modelNexus.matrixSubtitle')}</div>
            </div>
            <div className="divide-y divide-(--hp-border)">
                {AGENT_FLAVORS.map(flavor => {
                    const current = assignedByFlavor.get(flavor)
                    const selectId = `provider-route-${flavor}`
                    return (
                        <div key={flavor} className="grid grid-cols-1 gap-2 px-3 py-3 sm:grid-cols-[96px_1fr_auto] sm:items-center">
                            <label htmlFor={selectId} className="text-sm font-medium text-(--hp-text-primary)">
                                {capitalize(flavor)}
                            </label>
                            <div className="min-w-0">
                                <select
                                    id={selectId}
                                    className="min-h-[44px] w-full rounded-(--hp-radius-md) border border-(--hp-border) bg-(--hp-surface-0) px-3 py-2 text-sm outline-none focus:border-(--hp-primary) focus:ring-1 focus:ring-(--hp-primary)"
                                    value={current?.provider.id ?? ''}
                                    disabled={providers.length === 0}
                                    onChange={event => {
                                        const providerId = event.target.value
                                        if (!providerId) {
                                            if (current) onUnassign(current.provider.id, flavor)
                                            return
                                        }
                                        const provider = providers.find(item => item.id === providerId)
                                        onAssign(providerId, flavor, true, provider?.defaultModel ?? null)
                                    }}
                                >
                                    <option value="">{t('settings.modelNexus.matrixUnassigned')}</option>
                                    {providers.map(provider => (
                                        <option key={provider.id} value={provider.id}>
                                            {provider.name}{provider.defaultModel ? ` · ${provider.defaultModel}` : ''}
                                        </option>
                                    ))}
                                </select>
                                <div className="mt-1 truncate text-xs text-(--hp-text-tertiary)">
                                    {current
                                        ? t('settings.modelNexus.matrixCurrent', { provider: current.provider.name, model: current.model ?? t('settings.modelNexus.unset') })
                                        : t('settings.modelNexus.matrixNoRoute')}
                                </div>
                            </div>
                            {current ? (
                                <button
                                    type="button"
                                    onClick={() => onUnassign(current.provider.id, flavor)}
                                    className="min-h-[44px] rounded-(--hp-radius-md) border border-(--hp-border) px-3 py-2 text-xs text-(--hp-text-tertiary) hover:bg-(--hp-surface-1) transition-colors"
                                >
                                    {t('settings.providers.unassign')}
                                </button>
                            ) : null}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export function ProviderSettings() {
    const { t } = useTranslation()
    const { api } = useAppContext()
    const { overview, isLoading, error } = useProviderOverview(api)
    const { createProvider, isPending: isCreating } = useCreateProvider(api)
    const { updateProvider, isPending: isUpdating } = useUpdateProvider(api)
    const { deleteProvider, isPending: isDeleting } = useDeleteProvider(api)
    const { assignProvider, isPending: isAssigning } = useAssignProvider(api)
    const { unassignProvider } = useUnassignProvider(api)
    const { checkProvider, isPending: isChecking } = useCheckProvider(api)
    const { discoverProviderModels, isPending: isDiscovering } = useDiscoverProviderModels(api)
    const { revealProviderKey, isPending: isRevealing } = useRevealProviderKey(api)

    const [showAdd, setShowAdd] = useState(false)
    const [editing, setEditing] = useState<ProviderWithAssignments | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
    const [revealTarget, setRevealTarget] = useState<ProviderWithAssignments | null>(null)
    const [revealedKey, setRevealedKey] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const handleCreate = useCallback(async (form: ProviderFormState, assignedAgents: AgentFlavor[]) => {
        const defaultModel = form.defaultModel.trim() ? form.defaultModel.trim() : null
        const response = await createProvider({
            name: form.name,
            baseUrl: form.baseUrl,
            apiKey: form.apiKey,
            protocol: form.protocol,
            defaultModel,
            notes: form.notes || undefined,
        })
        for (const agentFlavor of assignedAgents) {
            await assignProvider({
                providerId: response.provider.id,
                agentFlavor,
                isDefault: true,
                model: defaultModel,
            })
        }
        setShowAdd(false)
    }, [assignProvider, createProvider])

    const handleUpdate = useCallback(async (form: ProviderFormState) => {
        if (!editing) return
        await updateProvider({
            id: editing.id,
            name: form.name,
            baseUrl: form.baseUrl,
            ...(form.apiKey ? { apiKey: form.apiKey } : {}),
            protocol: form.protocol,
            defaultModel: form.defaultModel.trim() ? form.defaultModel.trim() : null,
            notes: form.notes,
        })
        setEditing(null)
    }, [editing, updateProvider])

    const handleDelete = useCallback(async () => {
        if (!deleteTarget) return
        await deleteProvider(deleteTarget)
        setDeleteTarget(null)
    }, [deleteTarget, deleteProvider])

    const handleReveal = useCallback(async () => {
        if (!revealTarget) return
        const response = await revealProviderKey(revealTarget.id)
        setRevealedKey(response.apiKey)
    }, [revealProviderKey, revealTarget])

    const handleCopyKey = useCallback(async () => {
        if (!revealedKey) return
        const ok = await copyTextToClipboard(revealedKey)
        if (ok) {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
        }
    }, [revealedKey])

    const busy = isChecking || isDiscovering
    const summary = isLoading ? null : overview.summary

    return (
        <section className="border-b border-(--hp-border)">
            <div className="px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-(--hp-text-primary)">
                            <GlobeIcon className="h-4 w-4 text-(--hp-primary)" />
                            {t('settings.modelNexus.title')}
                        </div>
                        <p className="mt-1 max-w-[60ch] text-xs leading-5 text-(--hp-text-tertiary)">
                            {t('settings.modelNexus.subtitle')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowAdd(true)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-(--hp-radius-md) bg-(--hp-primary) px-3 py-2 text-xs text-(--hp-primary-text) hover:bg-(--hp-primary-hover) transition-colors"
                    >
                        <PlusCircleIcon className="h-4 w-4" />
                        {t('settings.modelNexus.addCta')}
                    </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    <SummaryMetric label={t('settings.modelNexus.summary.total')} value={summary?.total ?? '--'} />
                    <SummaryMetric label={t('settings.modelNexus.summary.online')} value={summary?.online ?? '--'} />
                    <SummaryMetric label={t('settings.modelNexus.summary.degraded')} value={summary?.degraded ?? '--'} />
                    <SummaryMetric label={t('settings.modelNexus.summary.offline')} value={summary?.offline ?? '--'} />
                    <SummaryMetric label={t('settings.modelNexus.summary.blocked')} value={summary?.blocked ?? '--'} />
                    <SummaryMetric label={t('settings.modelNexus.summary.unknown')} value={summary?.unknown ?? '--'} />
                    <SummaryMetric label={t('settings.modelNexus.summary.assigned')} value={summary?.assignedAgents ?? '--'} />
                </div>
            </div>

            <div className="px-3 pb-3">
                {isLoading ? (
                    <div className="rounded-(--hp-radius-md) border border-(--hp-border) px-3 py-3 text-xs text-(--hp-text-tertiary)">
                        {t('settings.modelNexus.loading')}
                    </div>
                ) : error ? (
                    <div className="rounded-(--hp-radius-md) bg-(--hp-danger-subtle) px-3 py-3 text-xs text-(--hp-danger)">
                        {error}
                    </div>
                ) : overview.providers.length === 0 ? (
                    <div className="rounded-(--hp-radius-lg) border border-dashed border-(--hp-border) px-3 py-4">
                        <div className="text-sm font-medium text-(--hp-text-primary)">{t('settings.modelNexus.emptyTitle')}</div>
                        <div className="mt-1 text-xs text-(--hp-text-tertiary)">{t('settings.modelNexus.emptyBody')}</div>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {overview.providers.map(provider => (
                            <ProviderCard
                                key={provider.id}
                                provider={provider}
                                busy={busy}
                                onCheck={(providerId) => { void checkProvider(providerId) }}
                                onDiscover={(providerId) => { void discoverProviderModels(providerId) }}
                                onReveal={(target) => { setRevealTarget(target); setRevealedKey(null); setCopied(false) }}
                                onEdit={setEditing}
                                onDeleteClick={setDeleteTarget}
                            />
                        ))}
                        <RouteMatrix
                            providers={overview.providers}
                            onAssign={(providerId, flavor, isDefault, model) => {
                                void assignProvider({ providerId, agentFlavor: flavor, isDefault, model })
                            }}
                            onUnassign={(providerId, flavor) => {
                                void unassignProvider({ providerId, flavor })
                            }}
                        />
                    </div>
                )}
            </div>

            <Dialog open={showAdd} onOpenChange={setShowAdd}>
                <DialogContent className="max-w-md">
                    <DialogTitle className="mb-2 text-sm">{t('settings.modelNexus.addDialogTitle')}</DialogTitle>
                    <DialogDescription className="mb-3 text-xs leading-5 text-(--hp-text-tertiary)">
                        {t('settings.modelNexus.formDescription')}
                    </DialogDescription>
                    <ProviderWizard
                        onSubmit={handleCreate}
                        onCancel={() => setShowAdd(false)}
                        isPending={isCreating || isAssigning}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null) }}>
                <DialogContent className="max-w-md">
                    <DialogTitle className="mb-2 text-sm">{t('settings.modelNexus.editDialogTitle')}</DialogTitle>
                    <DialogDescription className="mb-3 text-xs leading-5 text-(--hp-text-tertiary)">
                        {t('settings.modelNexus.formDescription')}
                    </DialogDescription>
                    {editing && (
                        <ProviderForm
                            initial={{
                                name: editing.name,
                                baseUrl: editing.baseUrl,
                                apiKey: '',
                                protocol: editing.protocol,
                                defaultModel: editing.defaultModel ?? '',
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

            <Dialog
                open={!!revealTarget}
                onOpenChange={open => {
                    if (!open) {
                        setRevealTarget(null)
                        setRevealedKey(null)
                        setCopied(false)
                    }
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogTitle className="mb-2 text-sm">{t('settings.modelNexus.revealTitle')}</DialogTitle>
                    <DialogDescription className="text-xs leading-5 text-(--hp-text-tertiary)">
                        {t('settings.modelNexus.revealBody')}
                    </DialogDescription>
                    {revealedKey ? (
                        <div className="mt-3 rounded-(--hp-radius-md) border border-(--hp-border) bg-(--hp-surface-1) p-3">
                            <div className="break-all font-mono text-xs text-(--hp-text-primary)">{revealedKey}</div>
                            <button
                                type="button"
                                onClick={() => { void handleCopyKey() }}
                                className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-(--hp-radius-md) border border-(--hp-border) px-3 py-2 text-xs hover:bg-(--hp-surface-0) transition-colors"
                            >
                                {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                                {copied ? t('button.copied') : t('button.copy')}
                            </button>
                        </div>
                    ) : null}
                    <div className="mt-4 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setRevealTarget(null)}
                            className="min-h-[44px] rounded-(--hp-radius-md) px-4 py-2 text-sm text-(--hp-text-tertiary) hover:bg-(--hp-surface-1) transition-colors"
                        >
                            {t('button.cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={() => { void handleReveal() }}
                            disabled={isRevealing || !!revealedKey}
                            className="min-h-[44px] rounded-(--hp-radius-md) bg-(--hp-danger) px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                            {isRevealing ? t('settings.modelNexus.revealing') : t('settings.modelNexus.revealConfirm')}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                title={t('settings.providers.delete')}
                description={t('settings.providers.deleteConfirm')}
                confirmLabel={t('settings.providers.delete')}
                confirmingLabel={t('settings.providers.delete')}
                onConfirm={handleDelete}
                isPending={isDeleting}
                destructive
            />
        </section>
    )
}
