import { useState, useEffect } from 'react'
import { useTranslation, type Locale } from '@/lib/use-translation'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { useAppContext } from '@/lib/app-context'
import { ProviderSettings } from '@/components/ProviderSettings'
import { PageScaffold } from '@/components/layout/PageScaffold'
import { Select } from '@/components/ui/Select'
import { getFontScaleOptions, useFontScale, type FontScale } from '@/hooks/useFontScale'
import { getTerminalFontSizeOptions, useTerminalFontSize, type TerminalFontSize } from '@/hooks/useTerminalFontSize'
import { getComposerEnterBehaviorOptions, useComposerEnterBehavior, type ComposerEnterBehavior } from '@/hooks/useComposerEnterBehavior'
import { getFollowUpBehaviorOptions, useFollowUpBehavior, type FollowUpBehavior } from '@/hooks/useFollowUpBehavior'
import { getTerminalToolDisplayModeOptions, useTerminalToolDisplayMode, type TerminalToolDisplayMode } from '@/hooks/useTerminalToolDisplayMode'
import { getSessionListStatusModeOptions, useSessionListStatusMode, type SessionListStatusMode } from '@/hooks/useSessionListStatusMode'
import {
    MAX_SESSION_PREVIEW_LIMIT,
    MIN_SESSION_PREVIEW_LIMIT,
    normalizeSessionPreviewLimit,
    useSessionPreviewLimit,
} from '@/hooks/useSessionPreviewLimit'
import {
    getChatSurfaceColorPickerValue,
    getChatSurfaceColorPresetOptions,
    toCustomChatSurfaceColorPreference,
    toPresetChatSurfaceColorPreference,
    useChatSurfaceColors,
    type ChatSurfaceColorPreference,
    type ChatSurfaceColorPreset,
} from '@/hooks/useChatSurfaceColors'
import { useAppearance, getAppearanceOptions, type AppearancePreference } from '@/hooks/useTheme'
import { PROTOCOL_VERSION } from '@hapipower/protocol'

const locales: { value: Locale; nativeLabel: string }[] = [
    { value: 'en', nativeLabel: 'English' },
    { value: 'zh-CN', nativeLabel: '简体中文' },
]

function BackIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <polyline points="15 18 9 12 15 6" />
        </svg>
    )
}

function MinusIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    )
}

function PlusIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    )
}

function SessionPreviewLimitControl(props: {
    label: string
    value: number
    onChange: (value: number) => void
    decreaseLabel: string
    increaseLabel: string
}) {
    const [draft, setDraft] = useState(String(props.value))

    useEffect(() => {
        setDraft(String(props.value))
    }, [props.value])

    const commitDraft = () => {
        const parsed = draft.trim() === '' ? props.value : Number(draft)
        const next = normalizeSessionPreviewLimit(parsed)
        props.onChange(next)
        setDraft(String(next))
    }

    const step = (delta: number) => {
        const next = normalizeSessionPreviewLimit(props.value + delta)
        props.onChange(next)
        setDraft(String(next))
    }

    return (
        <div className="flex w-full items-center justify-between gap-3 px-3 py-3">
            <label htmlFor="session-preview-limit" className="text-(--hp-text-primary)">
                {props.label}
            </label>
            <div className="flex h-9 shrink-0 items-center rounded-(--hp-radius-sm) border border-(--hp-border) bg-(--hp-surface-0) shadow-(--hp-shadow-xs)">
                <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={props.value <= MIN_SESSION_PREVIEW_LIMIT}
                    aria-label={props.decreaseLabel}
                    title={props.decreaseLabel}
                    className="flex h-8 w-8 items-center justify-center rounded-l-(--hp-radius-sm) text-(--hp-text-tertiary) transition-colors hover:bg-(--hp-surface-1) hover:text-(--hp-text-primary) disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <MinusIcon className="h-3.5 w-3.5" />
                </button>
                <input
                    id="session-preview-limit"
                    type="number"
                    inputMode="numeric"
                    min={MIN_SESSION_PREVIEW_LIMIT}
                    max={MAX_SESSION_PREVIEW_LIMIT}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={commitDraft}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault()
                            commitDraft()
                            event.currentTarget.blur()
                        }
                        if (event.key === 'Escape') {
                            event.preventDefault()
                            setDraft(String(props.value))
                            event.currentTarget.blur()
                        }
                    }}
                    className="h-8 w-14 border-x border-(--hp-border) bg-transparent text-center text-sm font-medium tabular-nums text-(--hp-text-primary) outline-none focus:bg-(--hp-surface-1)"
                />
                <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={props.value >= MAX_SESSION_PREVIEW_LIMIT}
                    aria-label={props.increaseLabel}
                    title={props.increaseLabel}
                    className="flex h-8 w-8 items-center justify-center rounded-r-(--hp-radius-sm) text-(--hp-text-tertiary) transition-colors hover:bg-(--hp-surface-1) hover:text-(--hp-text-primary) disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <PlusIcon className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    )
}

function ChatSurfaceColorControl(props: {
    label: string
    preference: ChatSurfaceColorPreference
    onPresetChange: (preset: ChatSurfaceColorPreset) => void
    onCustomChange: (value: string) => void
    t: (key: string) => string
}) {
    const presetOptions = getChatSurfaceColorPresetOptions()
    const pickerValue = getChatSurfaceColorPickerValue(props.preference)
    const isCustomSelected = props.preference.startsWith('custom:')

    return (
        <div className="border-t border-(--hp-divider) px-3 py-3">
            <div className="mb-2 text-(--hp-text-primary)">{props.label}</div>
            <div className="flex flex-wrap gap-2">
                {presetOptions.map((option) => {
                    const selected = props.preference === toPresetChatSurfaceColorPreference(option.value)
                    const swatchColor = getChatSurfaceColorPickerValue(toPresetChatSurfaceColorPreference(option.value))
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => props.onPresetChange(option.value)}
                            className={`inline-flex items-center gap-2 rounded-(--hp-radius-md) border px-3 py-1.5 text-sm transition-colors ${
                                selected
                                    ? 'border-(--hp-primary) bg-(--hp-surface-1) text-(--hp-primary)'
                                    : 'border-(--hp-border) bg-(--hp-surface-0) text-(--hp-text-primary) hover:bg-(--hp-surface-1)'
                            }`}
                        >
                            <span className="h-2.5 w-2.5 rounded-full opacity-80" style={{ backgroundColor: swatchColor }} />
                            <span>{props.t(option.labelKey)}</span>
                        </button>
                    )
                })}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm text-(--hp-text-tertiary)">{props.t('settings.chat.surfaceColor.custom')}</span>
                <label
                    className={`inline-flex items-center rounded-(--hp-radius-md) border px-2 py-1 transition-colors ${
                        isCustomSelected
                            ? 'border-(--hp-primary) bg-(--hp-surface-1)'
                            : 'border-(--hp-border) bg-(--hp-surface-0)'
                    }`}
                >
                    <input
                        aria-label={props.t('settings.chat.surfaceColor.custom')}
                        type="color"
                        value={pickerValue}
                        onChange={(event) => props.onCustomChange(event.target.value)}
                        className="h-8 w-11 cursor-pointer appearance-none border-0 bg-transparent p-0"
                    />
                </label>
            </div>
        </div>
    )
}

export default function SettingsPage() {
    const { t, locale, setLocale } = useTranslation()
    const { api } = useAppContext()
    const goBack = useAppGoBack()
    const { fontScale, setFontScale } = useFontScale()
    const { terminalFontSize, setTerminalFontSize } = useTerminalFontSize()
    const { sessionPreviewLimit, setSessionPreviewLimit } = useSessionPreviewLimit()
    const { composerEnterBehavior, setComposerEnterBehavior } = useComposerEnterBehavior()
    const { followUpBehavior, setFollowUpBehavior } = useFollowUpBehavior()
    const { terminalToolDisplayMode, setTerminalToolDisplayMode } = useTerminalToolDisplayMode()
    const { sessionListStatusMode, setSessionListStatusMode } = useSessionListStatusMode()
    const {
        toolGroupBackground,
        userMessageBackground,
        setToolGroupBackground,
        setUserMessageBackground,
    } = useChatSurfaceColors()
    const { appearance, setAppearance } = useAppearance()

    const fontScaleOptions = getFontScaleOptions()
    const terminalFontSizeOptions = getTerminalFontSizeOptions()
    const composerEnterBehaviorOptions = getComposerEnterBehaviorOptions()
    const followUpBehaviorOptions = getFollowUpBehaviorOptions()
    const terminalToolDisplayModeOptions = getTerminalToolDisplayModeOptions()
    const sessionListStatusModeOptions = getSessionListStatusModeOptions()
    const appearanceOptions = getAppearanceOptions()

    const handleLocaleChange = (newLocale: Locale) => {
        setLocale(newLocale)
    }

    const handleAppearanceChange = (pref: AppearancePreference) => {
        setAppearance(pref)
    }

    const handleFontScaleChange = (newScale: FontScale) => {
        setFontScale(newScale)
    }

    const handleTerminalFontSizeChange = (newSize: TerminalFontSize) => {
        setTerminalFontSize(newSize)
    }

    const handleComposerEnterBehaviorChange = (newBehavior: ComposerEnterBehavior) => {
        setComposerEnterBehavior(newBehavior)
    }

    const handleFollowUpBehaviorChange = (newBehavior: FollowUpBehavior) => {
        setFollowUpBehavior(newBehavior)
    }

    const handleTerminalToolDisplayModeChange = (newMode: TerminalToolDisplayMode) => {
        setTerminalToolDisplayMode(newMode)
    }

    const handleSessionListStatusModeChange = (newMode: SessionListStatusMode) => {
        setSessionListStatusMode(newMode)
    }

    return (
        <PageScaffold
            title={t('settings.title')}
            actions={
                <button
                    type="button"
                    onClick={goBack}
                    className="flex h-8 w-8 items-center justify-center rounded-(--hp-radius-md) text-(--hp-text-secondary) transition-colors hover:bg-(--hp-surface-1) hover:text-(--hp-text-primary)"
                    aria-label={t('common.back')}
                >
                    <BackIcon />
                </button>
            }
        >
            <div className="mx-auto w-full max-w-content">
                    {/* Language section */}
                    <div className="border-b border-(--hp-divider)">
                        <div className="px-3 py-2 text-xs font-medium text-(--hp-text-tertiary) uppercase tracking-wider">
                            {t('settings.language.title')}
                        </div>
                        <div className="px-3 py-3">
                            <Select
                                label={t('settings.language.label')}
                                value={locale}
                                onChange={handleLocaleChange}
                                options={locales.map((loc) => ({ value: loc.value, label: loc.nativeLabel }))}
                            />
                        </div>
                    </div>

                    {/* Display section */}
                    <div className="border-b border-(--hp-divider)">
                        <div className="px-3 py-2 text-xs font-medium text-(--hp-text-tertiary) uppercase tracking-wider">
                            {t('settings.display.title')}
                        </div>
                        <div className="px-3 py-3">
                            <Select
                                label={t('settings.display.appearance')}
                                value={appearance}
                                onChange={handleAppearanceChange}
                                options={appearanceOptions.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
                            />
                        </div>
                        <div className="px-3 py-3">
                            <Select
                                label={t('settings.display.fontSize')}
                                value={fontScale}
                                onChange={handleFontScaleChange}
                                options={fontScaleOptions}
                            />
                        </div>
                        <div className="px-3 py-3">
                            <Select
                                label={t('settings.display.terminalFontSize')}
                                value={terminalFontSize}
                                onChange={handleTerminalFontSizeChange}
                                options={terminalFontSizeOptions}
                            />
                        </div>
                        <SessionPreviewLimitControl
                            label={t('settings.display.sessionPreviewLimit')}
                            value={sessionPreviewLimit}
                            onChange={setSessionPreviewLimit}
                            decreaseLabel={t('settings.display.sessionPreviewLimit.decrease')}
                            increaseLabel={t('settings.display.sessionPreviewLimit.increase')}
                        />
                        <div className="px-3 py-3">
                            <Select
                                label={t('settings.display.sessionListStatus')}
                                value={sessionListStatusMode}
                                onChange={handleSessionListStatusModeChange}
                                options={sessionListStatusModeOptions.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
                            />
                        </div>
                        {sessionListStatusMode === 'detailed' ? (
                            <div className="px-3 pb-3 text-xs text-(--hp-text-tertiary)">
                                {t('settings.display.sessionListStatus.detailedDescription')}
                            </div>
                        ) : null}
                    </div>

                    {/* Chat section */}
                    <div className="border-b border-(--hp-divider)">
                        <div className="px-3 py-2 text-xs font-medium text-(--hp-text-tertiary) uppercase tracking-wider">
                            {t('settings.chat.title')}
                        </div>
                        <div className="px-3 py-3">
                            <Select
                                label={t('settings.chat.enterBehavior')}
                                value={composerEnterBehavior}
                                onChange={handleComposerEnterBehaviorChange}
                                options={composerEnterBehaviorOptions.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
                            />
                        </div>
                        <div className="px-3 py-3">
                            <Select
                                label={t('settings.chat.followUpBehavior')}
                                value={followUpBehavior}
                                onChange={handleFollowUpBehaviorChange}
                                options={followUpBehaviorOptions.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
                            />
                        </div>
                        <div className="px-3 pb-3 text-xs leading-5 text-(--hp-text-tertiary)">
                            {t('settings.chat.followUpBehavior.description')}
                        </div>
                        <div className="px-3 py-3">
                            <Select
                                label={t('settings.chat.terminalToolDisplay')}
                                value={terminalToolDisplayMode}
                                onChange={handleTerminalToolDisplayModeChange}
                                options={terminalToolDisplayModeOptions.map((opt) => ({ value: opt.value, label: t(opt.labelKey) }))}
                            />
                        </div>
                        <ChatSurfaceColorControl
                            label={t('settings.chat.groupedToolBackground')}
                            preference={toolGroupBackground}
                            onPresetChange={(preset) => setToolGroupBackground(toPresetChatSurfaceColorPreference(preset))}
                            onCustomChange={(value) => setToolGroupBackground(toCustomChatSurfaceColorPreference(value))}
                            t={t}
                        />
                        <ChatSurfaceColorControl
                            label={t('settings.chat.userMessageBackground')}
                            preference={userMessageBackground}
                            onPresetChange={(preset) => setUserMessageBackground(toPresetChatSurfaceColorPreference(preset))}
                            onCustomChange={(value) => setUserMessageBackground(toCustomChatSurfaceColorPreference(value))}
                            t={t}
                        />
                    </div>

                    {/* API Providers section */}
                    <ProviderSettings />

                    {/* About section */}
                    <div className="border-b border-(--hp-divider)">
                        <div className="px-3 py-2 text-xs font-medium text-(--hp-text-tertiary) uppercase tracking-wider">
                            {t('settings.about.title')}
                        </div>
                        <div className="flex w-full items-center justify-between px-3 py-3">
                            <span className="text-(--hp-text-primary)">{t('settings.about.website')}</span>
                            <a
                                href="https://github.com/zulinliu/make-hapi-power-again"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-(--hp-primary) hover:underline"
                            >
                                GitHub
                            </a>
                        </div>
                        <div className="flex w-full items-center justify-between px-3 py-3">
                            <span className="text-(--hp-text-primary)">{t('settings.about.appVersion')}</span>
                            <span className="text-(--hp-text-tertiary)">{__APP_VERSION__}</span>
                        </div>
                        <div className="flex w-full items-center justify-between px-3 py-3">
                            <span className="text-(--hp-text-primary)">{t('settings.about.protocolVersion')}</span>
                            <span className="text-(--hp-text-tertiary)">{PROTOCOL_VERSION}</span>
                        </div>
                    </div>
            </div>
        </PageScaffold>
    )
}
