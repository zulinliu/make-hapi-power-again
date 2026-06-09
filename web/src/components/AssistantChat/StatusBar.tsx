import {
    getCodexCollaborationModeLabel,
    getPermissionModeLabel,
    getPermissionModeTone,
    isPermissionModeAllowedForFlavor
} from '@hapipower/protocol'
import type { PermissionModeTone } from '@hapipower/protocol'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentState, CodexCollaborationMode, PermissionMode } from '@/types/api'
import type { ThreadGoal } from '@/types/api'
import { CloseIcon } from '@/components/icons'
import { getContextBudgetTokens } from '@/chat/modelConfig'
import { useTranslation } from '@/lib/use-translation'

const PERMISSION_TONE_CLASSES: Record<PermissionModeTone, string> = {
    neutral: 'text-[var(--app-hint)]',
    info: 'text-(--hp-info)',
    warning: 'text-(--hp-warning)',
    danger: 'text-(--hp-danger)'
}

function getConnectionStatus(
    active: boolean,
    thinking: boolean,
    agentState: AgentState | null | undefined,
    backgroundTaskCount: number,
    t: TranslationFn
): { text: string; color: string; dotColor: string; isPulsing: boolean } {
    const hasPermissions = agentState?.requests && Object.keys(agentState.requests).length > 0

    if (!active) {
        return {
            text: t('misc.offline'),
            color: 'text-(--hp-text-tertiary)',
            dotColor: 'bg-(--hp-text-tertiary)',
            isPulsing: false
        }
    }

    if (hasPermissions) {
        return {
            text: t('misc.permissionRequired'),
            color: 'text-(--hp-warning)',
            dotColor: 'bg-(--hp-warning)',
            isPulsing: true
        }
    }

    if (thinking) {
        return {
            text: t('status.thinking'),
            color: 'text-(--hp-info)',
            dotColor: 'bg-(--hp-info)',
            isPulsing: true
        }
    }

    if (backgroundTaskCount > 0) {
        return {
            text: t('status.backgroundTasks', { count: backgroundTaskCount }),
            color: 'text-(--hp-info)',
            dotColor: 'bg-(--hp-info)',
            isPulsing: true
        }
    }

    return {
        text: t('misc.online'),
        color: 'text-(--hp-success)',
        dotColor: 'bg-(--hp-success)',
        isPulsing: false
    }
}

function formatTokenCount(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${Math.round(value / 1_000)}k`
    return String(value)
}

export type ContextPulseTone = 'success' | 'warning' | 'danger' | 'unknown'
export type ContextPulseSource = 'reported' | 'fallback' | 'unknown'
export type ContextPulseReason = 'ok' | 'missing-usage' | 'missing-window'

type TranslationFn = (key: string, params?: Record<string, string | number>) => string

export type ContextPulseView = {
    label: string
    tone: ContextPulseTone
    percent: number | null
    usedTokens: number | null
    maxTokens: number | null
    source: ContextPulseSource
    reason: ContextPulseReason
}

export function getContextPulseView(props: {
    contextSize?: number
    contextWindow?: number | null
    model?: string | null
    agentFlavor?: string | null
    t: TranslationFn
}): ContextPulseView {
    const reportedContextWindow = typeof props.contextWindow === 'number' && Number.isFinite(props.contextWindow) && props.contextWindow > 0
        ? props.contextWindow
        : null
    const fallbackContextWindow = getContextBudgetTokens(props.model, props.agentFlavor)
    const maxContextSize = reportedContextWindow ?? fallbackContextWindow
    const source: ContextPulseSource = reportedContextWindow
        ? 'reported'
        : fallbackContextWindow
            ? 'fallback'
            : 'unknown'

    if (
        props.contextSize === undefined
        || !Number.isFinite(props.contextSize)
    ) {
        return {
            label: props.t('contextPulse.unavailable'),
            tone: 'unknown',
            percent: null,
            usedTokens: null,
            maxTokens: maxContextSize ?? null,
            source,
            reason: 'missing-usage'
        }
    }

    if (!maxContextSize || maxContextSize <= 0) {
        return {
            label: props.t('contextPulse.unavailable'),
            tone: 'unknown',
            percent: null,
            usedTokens: Math.max(0, Math.round(props.contextSize)),
            maxTokens: null,
            source,
            reason: 'missing-window'
        }
    }

    const percent = Math.max(0, Math.min(100, Math.round((props.contextSize / maxContextSize) * 100)))
    const tone: ContextPulseTone = percent < 60
        ? 'success'
        : percent <= 80
            ? 'warning'
            : 'danger'
    return {
        label: props.t('contextPulse.label', { percent }),
        tone,
        percent,
        usedTokens: Math.max(0, Math.round(props.contextSize)),
        maxTokens: maxContextSize,
        source,
        reason: 'ok'
    }
}

const CONTEXT_PULSE_TONE_CLASSES: Record<ContextPulseTone, string> = {
    success: 'text-(--hp-success)',
    warning: 'text-(--hp-warning)',
    danger: 'text-(--hp-danger)',
    unknown: 'text-[var(--app-hint)]'
}

function formatCodexReasoningLabel(effort: string | null | undefined, t: TranslationFn): string {
    const normalized = effort?.trim().toLowerCase()
    if (!normalized || normalized === 'default') return t('status.reasoning.default')
    return t('status.reasoning.value', { effort: normalized })
}

function isCodexFastMode(model?: string | null, effort?: string | null): boolean {
    const normalizedEffort = effort?.trim().toLowerCase()
    if (normalizedEffort === 'none' || normalizedEffort === 'minimal' || normalizedEffort === 'low') {
        return true
    }

    const normalizedModel = model?.trim().toLowerCase() ?? ''
    return normalizedModel.includes('mini') || normalizedModel.includes('fast')
}

export function StatusBar(props: {
    active: boolean
    thinking: boolean
    agentState: AgentState | null | undefined
    backgroundTaskCount?: number
    contextSize?: number
    contextCacheRead?: number
    contextWindow?: number | null
    model?: string | null
    modelReasoningEffort?: string | null
    permissionMode?: PermissionMode
    collaborationMode?: CodexCollaborationMode
    threadGoal?: ThreadGoal | null
    agentFlavor?: string | null
}) {
    const { t } = useTranslation()
    const [contextDetailsOpen, setContextDetailsOpen] = useState(false)
    const contextButtonRef = useRef<HTMLButtonElement | null>(null)
    const contextPanelRef = useRef<HTMLDivElement | null>(null)
    const connectionStatus = useMemo(
        () => getConnectionStatus(props.active, props.thinking, props.agentState, props.backgroundTaskCount ?? 0, t),
        [props.active, props.thinking, props.agentState, props.backgroundTaskCount, t]
    )

    const contextPulse = useMemo(
        () => getContextPulseView({
            contextSize: props.contextSize,
            contextWindow: props.contextWindow,
            model: props.model,
            agentFlavor: props.agentFlavor,
            t
        }),
        [props.contextSize, props.contextWindow, props.model, props.agentFlavor, t]
    )
    const cacheHitLabel = useMemo(() => {
        if (!props.contextCacheRead || props.contextCacheRead <= 0) return null
        return t('contextPulse.cache', { tokens: formatTokenCount(props.contextCacheRead) })
    }, [props.contextCacheRead, t])
    const contextDetailRows = useMemo(() => {
        const modelLabel = props.model?.trim()
            || props.agentFlavor
            || t('contextPulse.unknown')
        return [
            {
                label: t('contextPulse.detail.used'),
                value: contextPulse.usedTokens === null
                    ? t('contextPulse.unknown')
                    : formatTokenCount(contextPulse.usedTokens)
            },
            {
                label: t('contextPulse.detail.max'),
                value: contextPulse.maxTokens === null
                    ? t('contextPulse.unknown')
                    : formatTokenCount(contextPulse.maxTokens)
            },
            {
                label: t('contextPulse.detail.source'),
                value: t(`contextPulse.source.${contextPulse.source}`)
            },
            {
                label: t('contextPulse.detail.model'),
                value: modelLabel
            },
            {
                label: t('contextPulse.detail.cache'),
                value: cacheHitLabel ?? t('contextPulse.none')
            },
            {
                label: t('contextPulse.detail.reason'),
                value: t(`contextPulse.reason.${contextPulse.reason}`)
            }
        ]
    }, [cacheHitLabel, contextPulse.maxTokens, contextPulse.reason, contextPulse.source, contextPulse.usedTokens, props.agentFlavor, props.model, t])

    const permissionMode = props.permissionMode
    const displayPermissionMode = permissionMode
        && permissionMode !== 'default'
        && isPermissionModeAllowedForFlavor(permissionMode, props.agentFlavor)
        ? permissionMode
        : null

    const permissionModeLabel = displayPermissionMode ? getPermissionModeLabel(displayPermissionMode) : null
    const permissionModeTone = displayPermissionMode ? getPermissionModeTone(displayPermissionMode) : null
    const permissionModeColor = permissionModeTone ? PERMISSION_TONE_CLASSES[permissionModeTone] : 'text-[var(--app-hint)]'
    const displayCollaborationMode = props.agentFlavor === 'codex' && props.collaborationMode === 'plan'
        ? props.collaborationMode
        : null
    const collaborationModeLabel = displayCollaborationMode
        ? getCodexCollaborationModeLabel(displayCollaborationMode)
        : null
    const codexReasoningLabel = (props.agentFlavor === 'codex' || props.agentFlavor === 'opencode')
        ? formatCodexReasoningLabel(props.modelReasoningEffort, t)
        : null
    const codexFastMode = props.agentFlavor === 'codex'
        ? isCodexFastMode(props.model, props.modelReasoningEffort)
        : false
    const goalLabel = props.agentFlavor === 'codex' && props.threadGoal
        ? props.threadGoal.status === 'active'
            ? t('status.goal.active')
            : props.threadGoal.status === 'budgetLimited'
                ? t('status.goal.budgetLimited')
                : t('status.goal.status', { status: props.threadGoal.status })
        : null

    useEffect(() => {
        if (!contextDetailsOpen) return

        function closeAndRestoreFocus() {
            setContextDetailsOpen(false)
            contextButtonRef.current?.focus()
        }

        function handlePointerDown(event: PointerEvent) {
            const target = event.target as Node
            if (contextPanelRef.current?.contains(target)) return
            if (contextButtonRef.current?.contains(target)) return
            setContextDetailsOpen(false)
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key !== 'Escape') return
            event.preventDefault()
            closeAndRestoreFocus()
        }

        document.addEventListener('pointerdown', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [contextDetailsOpen])

    return (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2 pb-1">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
                <div className="flex shrink-0 items-center gap-1.5">
                    <span
                        className={`h-2 w-2 rounded-full ${connectionStatus.dotColor} ${connectionStatus.isPulsing ? 'motion-safe:animate-pulse' : ''}`}
                    />
                    <span className={`whitespace-nowrap text-xs ${connectionStatus.color}`}>
                        {connectionStatus.text}
                    </span>
                </div>
                <div className="relative min-w-0">
                    <button
                        ref={contextButtonRef}
                        type="button"
                        aria-label={t('contextPulse.detailsLabel', { label: contextPulse.label })}
                        aria-expanded={contextDetailsOpen}
                        aria-haspopup="dialog"
                        onClick={() => setContextDetailsOpen((open) => !open)}
                        className={`rounded-(--hp-radius-sm) px-1 py-0.5 text-[11px] leading-4 sm:text-[10px] ${CONTEXT_PULSE_TONE_CLASSES[contextPulse.tone]} cursor-pointer transition-colors hover:bg-(--hp-surface-2) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--hp-primary)`}
                    >
                        {contextPulse.label}
                    </button>
                    {contextDetailsOpen ? (
                        <div
                            ref={contextPanelRef}
                            role="dialog"
                            aria-label={t('contextPulse.detail.title')}
                            className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-30 rounded-(--hp-radius-md) border border-(--hp-border) bg-(--hp-surface-0) p-2 shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-[calc(100%+4px)] sm:w-[260px]"
                        >
                            <div className="mb-1 flex items-center justify-between gap-2">
                                <div className="text-[11px] font-semibold text-(--hp-text-primary)">
                                    {t('contextPulse.detail.title')}
                                </div>
                                <button
                                    type="button"
                                    aria-label={t('button.close')}
                                    onClick={() => {
                                        setContextDetailsOpen(false)
                                        contextButtonRef.current?.focus()
                                    }}
                                    className="grid h-7 w-7 shrink-0 place-items-center rounded-(--hp-radius-sm) text-[var(--app-hint)] transition-colors hover:bg-(--hp-surface-2) hover:text-(--hp-text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--hp-primary)"
                                >
                                    <CloseIcon className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] leading-4">
                                {contextDetailRows.map((row) => (
                                    <div key={row.label} className="contents">
                                        <dt className="whitespace-nowrap text-[var(--app-hint)]">
                                            {row.label}
                                        </dt>
                                        <dd className="min-w-0 break-words text-right text-(--hp-text-secondary)">
                                            {row.value}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    ) : null}
                </div>
                {cacheHitLabel ? (
                    <span className="hidden whitespace-nowrap text-[10px] text-[var(--app-hint)] sm:inline">
                        {cacheHitLabel}
                    </span>
                ) : null}
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-x-2 gap-y-1 sm:flex-initial sm:justify-end">
                {codexReasoningLabel ? (
                    <span className="min-w-0 max-w-full truncate text-xs text-[var(--app-hint)]">
                        {codexReasoningLabel}
                    </span>
                ) : null}
                {codexFastMode ? (
                    <span className="min-w-0 max-w-full truncate text-xs text-(--hp-success)">
                        {t('status.fast')}
                    </span>
                ) : null}
                {goalLabel ? (
                    <span className="min-w-0 max-w-full truncate text-xs text-[var(--app-link)]">
                        {goalLabel}
                    </span>
                ) : null}
                {collaborationModeLabel ? (
                    <span className="min-w-0 max-w-full truncate text-xs text-(--hp-info)">
                        {collaborationModeLabel}
                    </span>
                ) : null}
                {displayPermissionMode ? (
                    <span className={`min-w-0 max-w-full truncate text-xs ${permissionModeColor}`}>
                        {permissionModeLabel}
                    </span>
                ) : null}
            </div>
        </div>
    )
}
