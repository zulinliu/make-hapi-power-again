import { getCodexCollaborationModeOptions, getPermissionModeOptionsForFlavor } from '@hapipower/protocol'
import { ComposerPrimitive, useAssistantApi, useAssistantState } from '@assistant-ui/react'
import {
    type ChangeEvent as ReactChangeEvent,
    type ClipboardEvent as ReactClipboardEvent,
    type FormEvent as ReactFormEvent,
    type KeyboardEvent as ReactKeyboardEvent,
    type MutableRefObject,
    type SyntheticEvent as ReactSyntheticEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react'
import type { AgentState, CodexCollaborationMode, MessageDeliveryMode, PermissionMode, ThreadGoal } from '@/types/api'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import { useActiveWord } from '@/hooks/useActiveWord'
import { useActiveSuggestions } from '@/hooks/useActiveSuggestions'
import { applySuggestion } from '@/utils/applySuggestion'
import { usePlatform } from '@/hooks/usePlatform'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { supportsEffort, supportsModelChange } from '@hapipower/protocol'
import { markSkillUsed } from '@/lib/recent-skills'
import { useComposerDraft } from '@/hooks/useComposerDraft'
import { useComposerEnterBehavior } from '@/hooks/useComposerEnterBehavior'
import { useFollowUpBehavior } from '@/hooks/useFollowUpBehavior'
import { FloatingOverlay } from '@/components/ChatInput/FloatingOverlay'
import { Autocomplete } from '@/components/ChatInput/Autocomplete'
import { StatusBar } from '@/components/AssistantChat/StatusBar'
import { ComposerButtons } from '@/components/AssistantChat/ComposerButtons'
import type { PendingSchedule } from '@/components/AssistantChat/ScheduleTimePicker'
import { AttachmentItem } from '@/components/AssistantChat/AttachmentItem'
import { useTranslation } from '@/lib/use-translation'
import { getModelOptionsForFlavor, getNextModelForFlavor } from './modelOptions'
import { getClaudeComposerEffortOptions } from './claudeEffortOptions'
import { getCodexComposerReasoningEffortOptions } from './codexReasoningEffortOptions'

export interface TextInputState {
    text: string
    selection: { start: number; end: number }
}

const defaultSuggestionHandler = async (): Promise<Suggestion[]> => []

export function HappyComposer(props: {
    sessionId?: string
    disabled?: boolean
    permissionMode?: PermissionMode
    collaborationMode?: CodexCollaborationMode
    threadGoal?: ThreadGoal | null
    model?: string | null
    modelReasoningEffort?: string | null
    effort?: string | null
    active?: boolean
    allowSendWhenInactive?: boolean
    thinking?: boolean
    agentState?: AgentState | null
    backgroundTaskCount?: number
    contextSize?: number
    contextCacheRead?: number
    contextWindow?: number | null
    controlledByUser?: boolean
    agentFlavor?: string | null
    availableModelOptions?: Array<{ value: string | null; label: string; providerId?: string }>
    onCollaborationModeChange?: (mode: CodexCollaborationMode) => void
    onPermissionModeChange?: (mode: PermissionMode) => void
    onModelChange?: (model: string | null, providerId?: string) => void
    onModelReasoningEffortChange?: (modelReasoningEffort: string | null) => void
    onEffortChange?: (effort: string | null) => void
    onSwitchToRemote?: () => void
    onTerminal?: () => void
    terminalUnsupported?: boolean
    autocompletePrefixes?: string[]
    autocompleteSuggestions?: (query: string) => Promise<Suggestion[]>
    // Schedule props (lifted from internal state when provided)
    pendingSchedule?: PendingSchedule | null
    onSchedule?: (pending: PendingSchedule) => void
    onClearSchedule?: () => void
    deliveryModeRef?: MutableRefObject<MessageDeliveryMode>
}) {
    const { t } = useTranslation()
    const {
        sessionId,
        disabled = false,
        permissionMode: rawPermissionMode,
        collaborationMode: rawCollaborationMode,
        threadGoal,
        model: rawModel,
        modelReasoningEffort: rawModelReasoningEffort,
        effort: rawEffort,
        active = true,
        allowSendWhenInactive = false,
        thinking = false,
        agentState,
        backgroundTaskCount,
        contextSize,
        contextCacheRead,
        contextWindow,
        controlledByUser = false,
        agentFlavor,
        availableModelOptions,
        onCollaborationModeChange,
        onPermissionModeChange,
        onModelChange,
        onModelReasoningEffortChange,
        onEffortChange,
        onSwitchToRemote,
        onTerminal,
        terminalUnsupported = false,
        autocompletePrefixes = ['@', '/', '$'],
        autocompleteSuggestions = defaultSuggestionHandler,
        pendingSchedule: pendingScheduleProp,
        onSchedule: onScheduleProp,
        onClearSchedule: onClearScheduleProp,
        deliveryModeRef
    } = props

    // Use ?? so missing values fall back to default (destructuring defaults only handle undefined)
    const permissionMode = rawPermissionMode ?? 'default'
    const collaborationMode = rawCollaborationMode ?? 'default'
    const model = rawModel ?? null
    const modelReasoningEffort = rawModelReasoningEffort ?? null
    const effort = rawEffort ?? null

    const api = useAssistantApi()
    const { composerEnterBehavior } = useComposerEnterBehavior()
    const { followUpBehavior, setFollowUpBehavior } = useFollowUpBehavior()
    const composerText = useAssistantState(({ composer }) => composer.text)
    const attachments = useAssistantState(({ composer }) => composer.attachments)
    const threadIsRunning = useAssistantState(({ thread }) => thread.isRunning)
    const threadIsDisabled = useAssistantState(({ thread }) => thread.isDisabled)

    const controlsDisabled = disabled || (!active && !allowSendWhenInactive) || threadIsDisabled
    const trimmed = composerText.trim()
    const hasText = trimmed.length > 0
    const hasAttachments = attachments.length > 0
    const attachmentsReady = !hasAttachments || attachments.every((attachment) => {
        if (attachment.status.type === 'complete') {
            return true
        }
        if (attachment.status.type !== 'requires-action') {
            return false
        }
        const path = (attachment as { path?: string }).path
        return typeof path === 'string' && path.length > 0
    })
    const canSend = (hasText || hasAttachments) && attachmentsReady && !controlsDisabled

    const [inputState, setInputState] = useState<TextInputState>({
        text: '',
        selection: { start: 0, end: 0 }
    })
    const [showSettings, setShowSettings] = useState(false)
    const [isAborting, setIsAborting] = useState(false)
    const [isSwitching, setIsSwitching] = useState(false)
    const [showContinueHint, setShowContinueHint] = useState(false)
    // pendingSchedule is controlled externally when onSchedule prop is provided; otherwise local state
    const [pendingScheduleLocal, setPendingScheduleLocal] = useState<PendingSchedule | null>(null)
    const isControlled = onScheduleProp !== undefined
    const pendingSchedule = isControlled ? (pendingScheduleProp ?? null) : pendingScheduleLocal
    const setPendingSchedule = isControlled ? onScheduleProp : setPendingScheduleLocal
    const hasPendingPermission = Boolean(agentState?.requests && Object.keys(agentState.requests).length > 0)
    const guideModeAvailable = thinking && !hasPendingPermission && !hasAttachments && pendingSchedule === null
    const activeDeliveryMode: MessageDeliveryMode = guideModeAvailable && followUpBehavior === 'guide' ? 'guide' : 'queue'
    const followUpBehaviorToggleLabel = followUpBehavior === 'guide'
        ? t('composer.deliveryMode.switchToQueue')
        : t('composer.deliveryMode.switchToGuide')

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const prevControlledByUser = useRef(controlledByUser)

    useComposerDraft(sessionId, composerText, (text) => api.composer().setText(text))

    useEffect(() => {
        setInputState((prev) => {
            if (prev.text === composerText) return prev
            // When syncing from composerText, update selection to end of text
            // This ensures activeWord detection works correctly
            const newPos = composerText.length
            return { text: composerText, selection: { start: newPos, end: newPos } }
        })
    }, [composerText])

    useEffect(() => {
        if (deliveryModeRef) {
            deliveryModeRef.current = activeDeliveryMode
        }
    }, [deliveryModeRef, activeDeliveryMode])

    const handleToggleFollowUpBehavior = useCallback(() => {
        setFollowUpBehavior(followUpBehavior === 'guide' ? 'queue' : 'guide')
    }, [followUpBehavior, setFollowUpBehavior])

    // Track one-time "continue" hint after switching from local to remote.
    useEffect(() => {
        if (prevControlledByUser.current === true && controlledByUser === false) {
            setShowContinueHint(true)
        }
        if (controlledByUser) {
            setShowContinueHint(false)
        }
        prevControlledByUser.current = controlledByUser
    }, [controlledByUser])

    const { haptic: platformHaptic, isTouch } = usePlatform()
    const { isStandalone, isIOS } = usePWAInstall()
    const isIOSPWA = isIOS && isStandalone
    const bottomStyle = isIOSPWA ? { paddingBottom: 'env(safe-area-inset-bottom)' } : undefined
    const activeWord = useActiveWord(inputState.text, inputState.selection, autocompletePrefixes)
    const [suggestions, selectedIndex, moveUp, moveDown, clearSuggestions] = useActiveSuggestions(
        activeWord,
        autocompleteSuggestions,
        { clampSelection: true, wrapAround: true }
    )

    const haptic = useCallback((type: 'light' | 'success' | 'error' = 'light') => {
        if (type === 'light') {
            platformHaptic.impact('light')
        } else if (type === 'success') {
            platformHaptic.notification('success')
        } else {
            platformHaptic.notification('error')
        }
    }, [platformHaptic])

    const handleSuggestionSelect = useCallback((index: number) => {
        const suggestion = suggestions[index]
        if (!suggestion || !textareaRef.current) return
        if (suggestion.text.startsWith('$')) {
            markSkillUsed(suggestion.text.slice(1))
        }

        const result = applySuggestion(
            inputState.text,
            inputState.selection,
            suggestion.text,
            autocompletePrefixes,
            true
        )

        api.composer().setText(result.text)
        setInputState({
            text: result.text,
            selection: { start: result.cursorPosition, end: result.cursorPosition }
        })

        setTimeout(() => {
            const el = textareaRef.current
            if (!el) return
            el.setSelectionRange(result.cursorPosition, result.cursorPosition)
            try {
                el.focus({ preventScroll: true })
            } catch {
                el.focus()
            }
        }, 0)

        haptic('light')
    }, [api, suggestions, inputState, autocompletePrefixes, haptic])

    const abortDisabled = controlsDisabled || isAborting || !threadIsRunning
    const switchDisabled = controlsDisabled || isSwitching || !controlledByUser
    const showSwitchButton = Boolean(controlledByUser && onSwitchToRemote)
    const showTerminalButton = Boolean(onTerminal || terminalUnsupported)
    const terminalDisabled = controlsDisabled || terminalUnsupported
    const terminalLabel = terminalUnsupported ? t('terminal.unsupportedWindows') : t('composer.terminal')

    useEffect(() => {
        if (!isAborting) return
        if (threadIsRunning) return
        setIsAborting(false)
    }, [isAborting, threadIsRunning])

    useEffect(() => {
        if (!isSwitching) return
        if (controlledByUser) return
        setIsSwitching(false)
    }, [isSwitching, controlledByUser])

    const handleAbort = useCallback(() => {
        if (abortDisabled) return
        haptic('error')
        setIsAborting(true)
        api.thread().cancelRun()
    }, [abortDisabled, api, haptic])

    const handleSwitch = useCallback(async () => {
        if (switchDisabled || !onSwitchToRemote) return
        haptic('light')
        setIsSwitching(true)
        try {
            await onSwitchToRemote()
        } catch {
            setIsSwitching(false)
        }
    }, [switchDisabled, onSwitchToRemote, haptic])

    const permissionModeOptions = useMemo(
        () => getPermissionModeOptionsForFlavor(agentFlavor),
        [agentFlavor]
    )
    const collaborationModeOptions = useMemo(
        () => agentFlavor === 'codex' ? getCodexCollaborationModeOptions() : [],
        [agentFlavor]
    )
    const modelOptions = useMemo(
        () => getModelOptionsForFlavor(agentFlavor, model, availableModelOptions),
        [agentFlavor, model, availableModelOptions]
    )
    const codexReasoningEffortOptions = useMemo(
        () => agentFlavor === 'codex' || agentFlavor === 'opencode'
            ? getCodexComposerReasoningEffortOptions(modelReasoningEffort, agentFlavor)
            : [],
        [agentFlavor, modelReasoningEffort]
    )
    const claudeEffortOptions = useMemo(
        () => getClaudeComposerEffortOptions(effort),
        [effort]
    )
    const permissionModes = useMemo(
        () => permissionModeOptions.map((option) => option.mode),
        [permissionModeOptions]
    )

    const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        const key = e.key

        // Avoid intercepting IME composition keystrokes (Enter, arrows, etc.)
        if (e.nativeEvent.isComposing) {
            return
        }

        // Shift+Enter inserts a newline (standard behavior)
        if (key === 'Enter' && e.shiftKey) {
            return // let default textarea behavior handle newline
        }

        // Enter with suggestions visible: select the suggestion
        if (key === 'Enter' && suggestions.length > 0) {
            e.preventDefault()
            const indexToSelect = selectedIndex >= 0 ? selectedIndex : 0
            handleSuggestionSelect(indexToSelect)
            return
        }

        // Only plain Enter (no modifiers) sends; other modifier combos are ignored
        if (key === 'Enter') {
            if (composerEnterBehavior === 'newline') {
                if ((e.ctrlKey || e.metaKey) && !e.altKey && canSend) {
                    e.preventDefault()
                    api.composer().send()
                    setShowContinueHint(false)
                }
                return
            }
            e.preventDefault()
            if (!e.ctrlKey && !e.altKey && !e.metaKey && canSend) {
                api.composer().send()
                setShowContinueHint(false)
            }
            return
        }

        if (suggestions.length > 0) {
            if (key === 'ArrowUp') {
                e.preventDefault()
                moveUp()
                return
            }
            if (key === 'ArrowDown') {
                e.preventDefault()
                moveDown()
                return
            }
            if ((key === 'Tab') && !e.shiftKey) {
                e.preventDefault()
                const indexToSelect = selectedIndex >= 0 ? selectedIndex : 0
                handleSuggestionSelect(indexToSelect)
                return
            }
            if (key === 'Escape') {
                e.preventDefault()
                clearSuggestions()
                return
            }
        }

        if (key === 'Escape' && threadIsRunning) {
            e.preventDefault()
            handleAbort()
            return
        }

        if (key === 'Tab' && e.shiftKey && onPermissionModeChange && permissionModes.length > 0) {
            e.preventDefault()
            const currentIndex = permissionModes.indexOf(permissionMode)
            const nextIndex = (currentIndex + 1) % permissionModes.length
            const nextMode = permissionModes[nextIndex] ?? 'default'
            onPermissionModeChange(nextMode)
            haptic('light')
        }
    }, [
        suggestions,
        selectedIndex,
        moveUp,
        moveDown,
        clearSuggestions,
        handleSuggestionSelect,
        threadIsRunning,
        handleAbort,
        onPermissionModeChange,
        permissionMode,
        permissionModes,
        canSend,
        api,
        haptic,
        composerEnterBehavior
    ])

    useEffect(() => {
        const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'm' && (e.metaKey || e.ctrlKey) && onModelChange && supportsModelChange(agentFlavor)) {
                e.preventDefault()
                onModelChange(getNextModelForFlavor(agentFlavor, model, availableModelOptions))
                haptic('light')
            }
        }

        window.addEventListener('keydown', handleGlobalKeyDown)
        return () => window.removeEventListener('keydown', handleGlobalKeyDown)
    }, [model, onModelChange, haptic, agentFlavor, availableModelOptions])

    const handleChange = useCallback((e: ReactChangeEvent<HTMLTextAreaElement>) => {
        const selection = {
            start: e.target.selectionStart,
            end: e.target.selectionEnd
        }
        setInputState({ text: e.target.value, selection })
    }, [])

    const handleSelect = useCallback((e: ReactSyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement
        setInputState(prev => ({
            ...prev,
            selection: { start: target.selectionStart, end: target.selectionEnd }
        }))
    }, [])

    const handlePaste = useCallback(async (e: ReactClipboardEvent<HTMLTextAreaElement>) => {
        const files = Array.from(e.clipboardData?.files || [])
        const imageFiles = files.filter(file => file.type.startsWith('image/'))

        if (imageFiles.length === 0) return

        // The backend rejects scheduledAt + attachments (per-CLI upload dir is
        // torn down before a mature emit could read the files). The button-based
        // attachment flow is disabled by ComposerButtons.hasAttachments, but the
        // paste path bypasses that — guard here so a pasted image while a
        // schedule is active cannot produce a submission the hub will reject.
        if (pendingSchedule != null) {
            e.preventDefault()
            return
        }

        e.preventDefault()

        try {
            for (const file of imageFiles) {
                await api.composer().addAttachment(file)
            }
        } catch (error) {
            console.error('Error adding pasted image:', error)
        }
    }, [api, pendingSchedule])

    const handleSettingsToggle = useCallback(() => {
        haptic('light')
        setShowSettings(prev => !prev)
    }, [haptic])

    const handleSubmit = useCallback((event?: ReactFormEvent<HTMLFormElement>) => {
        event?.preventDefault()
        if (!attachmentsReady) {
            return
        }
        setShowContinueHint(false)
    }, [attachmentsReady])

    const handlePermissionChange = useCallback((mode: PermissionMode) => {
        if (!onPermissionModeChange || controlsDisabled) return
        onPermissionModeChange(mode)
        setShowSettings(false)
        haptic('light')
    }, [onPermissionModeChange, controlsDisabled, haptic])

    const handleCollaborationChange = useCallback((mode: CodexCollaborationMode) => {
        if (!onCollaborationModeChange || controlsDisabled) return
        onCollaborationModeChange(mode)
        setShowSettings(false)
        haptic('light')
    }, [onCollaborationModeChange, controlsDisabled, haptic])

    const handleModelChange = useCallback((nextModel: string | null, providerId?: string) => {
        if (!onModelChange || controlsDisabled) return
        onModelChange(nextModel, providerId)
        setShowSettings(false)
        haptic('light')
    }, [onModelChange, controlsDisabled, haptic])

    const handleModelReasoningEffortChange = useCallback((nextModelReasoningEffort: string | null) => {
        if (!onModelReasoningEffortChange || controlsDisabled) return
        onModelReasoningEffortChange(nextModelReasoningEffort)
        setShowSettings(false)
        haptic('light')
    }, [onModelReasoningEffortChange, controlsDisabled, haptic])

    const handleEffortChange = useCallback((nextEffort: string | null) => {
        if (!onEffortChange || controlsDisabled) return
        onEffortChange(nextEffort)
        setShowSettings(false)
        haptic('light')
    }, [onEffortChange, controlsDisabled, haptic])

    const showCollaborationSettings = Boolean(onCollaborationModeChange && collaborationModeOptions.length > 0)
    const showPermissionSettings = Boolean(onPermissionModeChange && permissionModeOptions.length > 0)
    const showModelSettings = Boolean(onModelChange && supportsModelChange(agentFlavor) && modelOptions.length > 0)
    const showModelReasoningEffortSettings = Boolean(onModelReasoningEffortChange && codexReasoningEffortOptions.length > 0)
    const showEffortSettings = Boolean(onEffortChange && supportsEffort(agentFlavor))
    const showSettingsButton = Boolean(
        showCollaborationSettings
        || showPermissionSettings
        || showModelSettings
        || showModelReasoningEffortSettings
        || showEffortSettings
    )
    const showAbortButton = true

    const handleSend = useCallback(() => {
        api.composer().send()
        // SessionChat owns clearing the schedule — it clears only after awaiting
        // the send hook's accepted result, which covers both pre-mutation guards
        // and async inactive-session resume failure. Clearing here unconditionally
        // would race ahead of that check and drop the user's schedule on every
        // rejected send path.
    }, [api])

    const overlays = useMemo(() => {
        if (showSettings && (showCollaborationSettings || showPermissionSettings || showModelSettings || showModelReasoningEffortSettings || showEffortSettings)) {
            return (
                <div className="absolute bottom-[100%] mb-2 w-full">
                    <FloatingOverlay maxHeight={320}>
                        {showCollaborationSettings ? (
                            <div className="py-2">
                                <div className="px-3 pb-1 text-xs font-semibold text-(--hp-text-tertiary)">
                                    {t('misc.collaborationMode')}
                                </div>
                                {collaborationModeOptions.map((option) => (
                                    <button
                                        key={option.mode}
                                        type="button"
                                        disabled={controlsDisabled}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                            controlsDisabled
                                                ? 'cursor-not-allowed opacity-50'
                                                : 'cursor-pointer hover:bg-(--hp-surface-2)'
                                        }`}
                                        onClick={() => handleCollaborationChange(option.mode)}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <div
                                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                                collaborationMode === option.mode
                                                    ? 'border-(--hp-primary)'
                                                    : 'border-(--hp-text-tertiary)'
                                            }`}
                                        >
                                            {collaborationMode === option.mode && (
                                                <div className="h-2 w-2 rounded-full bg-(--hp-primary)" />
                                            )}
                                        </div>
                                        <span className={collaborationMode === option.mode ? 'text-(--hp-primary)' : ''}>
                                            {option.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        {showCollaborationSettings && (showPermissionSettings || showModelSettings || showModelReasoningEffortSettings || showEffortSettings) ? (
                            <div className="mx-3 h-px bg-(--hp-divider)" />
                        ) : null}

                        {showPermissionSettings ? (
                            <div className="py-2">
                                <div className="px-3 pb-1 text-xs font-semibold text-(--hp-text-tertiary)">
                                    {t('misc.permissionMode')}
                                </div>
                                {permissionModeOptions.map((option) => (
                                    <button
                                        key={option.mode}
                                        type="button"
                                        disabled={controlsDisabled}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                            controlsDisabled
                                                ? 'cursor-not-allowed opacity-50'
                                                : 'cursor-pointer hover:bg-(--hp-surface-2)'
                                        }`}
                                        onClick={() => handlePermissionChange(option.mode)}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <div
                                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                                permissionMode === option.mode
                                                    ? 'border-(--hp-primary)'
                                                    : 'border-(--hp-text-tertiary)'
                                            }`}
                                        >
                                            {permissionMode === option.mode && (
                                                <div className="h-2 w-2 rounded-full bg-(--hp-primary)" />
                                            )}
                                        </div>
                                        <span className={permissionMode === option.mode ? 'text-(--hp-primary)' : ''}>
                                            {option.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        {(showCollaborationSettings || showPermissionSettings) && (showModelSettings || showModelReasoningEffortSettings || showEffortSettings) ? (
                            <div className="mx-3 h-px bg-(--hp-divider)" />
                        ) : null}

                        {showModelSettings ? (
                            <div className="py-2">
                                <div className="px-3 pb-1 text-xs font-semibold text-(--hp-text-tertiary)">
                                    {t('misc.model')}
                                </div>
                                {modelOptions.map((option) => (
                                    <button
                                        key={option.value ?? 'auto'}
                                        type="button"
                                        disabled={controlsDisabled}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                            controlsDisabled
                                                ? 'cursor-not-allowed opacity-50'
                                                : 'cursor-pointer hover:bg-(--hp-surface-2)'
                                        }`}
                                        onClick={() => handleModelChange(option.value, option.providerId)}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <div
                                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                                model === option.value
                                                    ? 'border-(--hp-primary)'
                                                    : 'border-(--hp-text-tertiary)'
                                            }`}
                                        >
                                            {model === option.value && (
                                                <div className="h-2 w-2 rounded-full bg-(--hp-primary)" />
                                            )}
                                        </div>
                                        <span className={model === option.value ? 'text-(--hp-primary)' : ''}>
                                            {option.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        {(showModelSettings || showModelReasoningEffortSettings) && showEffortSettings ? (
                            <div className="mx-3 h-px bg-(--hp-divider)" />
                        ) : null}

                        {showModelReasoningEffortSettings ? (
                            <div className="py-2">
                                <div className="px-3 pb-1 text-xs font-semibold text-(--hp-text-tertiary)">
                                    {t('misc.reasoningEffort')}
                                </div>
                                {codexReasoningEffortOptions.map((option) => (
                                    <button
                                        key={option.value ?? 'default'}
                                        type="button"
                                        disabled={controlsDisabled}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                            controlsDisabled
                                                ? 'cursor-not-allowed opacity-50'
                                                : 'cursor-pointer hover:bg-(--hp-surface-2)'
                                        }`}
                                        onClick={() => handleModelReasoningEffortChange(option.value)}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <div
                                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                                modelReasoningEffort === option.value
                                                    ? 'border-(--hp-primary)'
                                                    : 'border-(--hp-text-tertiary)'
                                            }`}
                                        >
                                            {modelReasoningEffort === option.value && (
                                                <div className="h-2 w-2 rounded-full bg-(--hp-primary)" />
                                            )}
                                        </div>
                                        <span className={modelReasoningEffort === option.value ? 'text-(--hp-primary)' : ''}>
                                            {option.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        {showModelReasoningEffortSettings && showEffortSettings ? (
                            <div className="mx-3 h-px bg-(--hp-divider)" />
                        ) : null}

                        {showEffortSettings ? (
                            <div className="py-2">
                                <div className="px-3 pb-1 text-xs font-semibold text-(--hp-text-tertiary)">
                                    {t('misc.effort')}
                                </div>
                                {claudeEffortOptions.map((option) => (
                                    <button
                                        key={option.value ?? 'auto'}
                                        type="button"
                                        disabled={controlsDisabled}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                            controlsDisabled
                                                ? 'cursor-not-allowed opacity-50'
                                                : 'cursor-pointer hover:bg-(--hp-surface-2)'
                                        }`}
                                        onClick={() => handleEffortChange(option.value)}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        <div
                                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                                effort === option.value
                                                    ? 'border-(--hp-primary)'
                                                    : 'border-(--hp-text-tertiary)'
                                            }`}
                                        >
                                            {effort === option.value && (
                                                <div className="h-2 w-2 rounded-full bg-(--hp-primary)" />
                                            )}
                                        </div>
                                        <span className={effort === option.value ? 'text-(--hp-primary)' : ''}>
                                            {option.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </FloatingOverlay>
                </div>
            )
        }

        if (suggestions.length > 0) {
            return (
                <div className="absolute bottom-[100%] mb-2 w-full">
                    <FloatingOverlay>
                        <Autocomplete
                            suggestions={suggestions}
                            selectedIndex={selectedIndex}
                            onSelect={(index) => handleSuggestionSelect(index)}
                        />
                    </FloatingOverlay>
                </div>
            )
        }

        return null
    }, [
        showSettings,
        showCollaborationSettings,
        showPermissionSettings,
        showModelSettings,
        showModelReasoningEffortSettings,
        showEffortSettings,
        modelOptions,
        codexReasoningEffortOptions,
        claudeEffortOptions,
        suggestions,
        selectedIndex,
        controlsDisabled,
        collaborationMode,
        permissionMode,
        model,
        modelReasoningEffort,
        effort,
        collaborationModeOptions,
        permissionModeOptions,
        handleCollaborationChange,
        handlePermissionChange,
        handleModelChange,
        handleModelReasoningEffortChange,
        handleEffortChange,
        handleSuggestionSelect,
        t
    ])

    return (
        <div className={`px-3 ${isIOSPWA ? '' : 'pb-3'} pt-2 bg-(--hp-surface-0)`} style={bottomStyle}>
            <div className="mx-auto w-full max-w-content">
                <ComposerPrimitive.Root className="relative" onSubmit={handleSubmit}>
                    {overlays}

                    <StatusBar
                        active={active}
                        thinking={thinking}
                        agentState={agentState}
                        backgroundTaskCount={backgroundTaskCount}
                        contextSize={contextSize}
                        contextCacheRead={contextCacheRead}
                        contextWindow={contextWindow}
                        model={model}
                        modelReasoningEffort={modelReasoningEffort}
                        permissionMode={permissionMode}
                        collaborationMode={collaborationMode}
                        threadGoal={threadGoal}
                        agentFlavor={agentFlavor}
                    />

                    {thinking ? (
                        <div className="mb-1 flex flex-wrap items-center justify-end gap-2 text-[11px] leading-4">
                            <span className="min-w-0 text-right text-[var(--app-hint)]">
                                {guideModeAvailable
                                    ? activeDeliveryMode === 'guide'
                                        ? t('composer.deliveryMode.guideActiveDescription')
                                        : t('composer.deliveryMode.queueActiveDescription')
                                    : t('composer.deliveryMode.queueOnlyDescription')}
                            </span>
                            {guideModeAvailable ? (
                                <button
                                    type="button"
                                    onClick={handleToggleFollowUpBehavior}
                                    className="min-h-8 rounded-(--hp-radius-sm) border border-(--hp-border) bg-(--hp-surface-1) px-2.5 text-xs font-medium text-(--hp-text-secondary) transition-colors hover:bg-(--hp-surface-2) hover:text-(--hp-text-primary)"
                                >
                                    {followUpBehaviorToggleLabel}
                                </button>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="overflow-hidden rounded-(--hp-radius-md) border border-(--hp-border) bg-(--hp-surface-1) focus-within:ring-2 focus-within:ring-(--hp-primary) transition-shadow">
                        {attachments.length > 0 ? (
                            <div className="flex flex-wrap gap-2 px-4 pt-3">
                                <ComposerPrimitive.Attachments components={{ Attachment: AttachmentItem }} />
                            </div>
                        ) : null}

                        <div className="flex items-center px-4 py-3">
                            <ComposerPrimitive.Input
                                ref={textareaRef}
                                autoFocus={!controlsDisabled && !isTouch}
                                placeholder={showContinueHint ? t('misc.typeMessage') : t('misc.typeAMessage')}
                                disabled={controlsDisabled}
                                maxRows={5}
                                submitOnEnter={false}
                                cancelOnEscape={false}
                                onChange={handleChange}
                                onSelect={handleSelect}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                className="flex-1 resize-none bg-transparent text-base leading-snug text-(--hp-text-primary) placeholder-(--hp-text-tertiary) focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>

                        <ComposerButtons
                            canSend={canSend}
                            controlsDisabled={controlsDisabled}
                            showSettingsButton={showSettingsButton}
                            onSettingsToggle={handleSettingsToggle}
                            showTerminalButton={showTerminalButton}
                            terminalDisabled={terminalDisabled}
                            terminalLabel={terminalLabel}
                            onTerminal={onTerminal ?? (() => {})}
                            showAbortButton={showAbortButton}
                            abortDisabled={abortDisabled}
                            isAborting={isAborting}
                            onAbort={handleAbort}
                            showSwitchButton={showSwitchButton}
                            switchDisabled={switchDisabled}
                            isSwitching={isSwitching}
                            onSwitch={handleSwitch}
                            onSend={handleSend}
                            pendingSchedule={pendingSchedule}
                            onSchedule={setPendingSchedule}
                            onClearSchedule={isControlled ? onClearScheduleProp : () => setPendingScheduleLocal(null)}
                            hasAttachments={hasAttachments}
                            deliveryMode={activeDeliveryMode}
                        />
                    </div>
                </ComposerPrimitive.Root>
            </div>
        </div>
    )
}
