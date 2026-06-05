import { useState, useRef, useEffect } from 'react'
import { useTranslation, type Locale } from '@/lib/use-translation'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { useAppContext } from '@/lib/app-context'
import { ProviderSettings } from '@/components/ProviderSettings'
import { getFontScaleOptions, useFontScale, type FontScale } from '@/hooks/useFontScale'
import { getTerminalFontSizeOptions, useTerminalFontSize, type TerminalFontSize } from '@/hooks/useTerminalFontSize'
import { getComposerEnterBehaviorOptions, useComposerEnterBehavior, type ComposerEnterBehavior } from '@/hooks/useComposerEnterBehavior'
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

function CheckIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <polyline points="20 6 9 17 4 12" />
        </svg>
    )
}

function ChevronDownIcon(props: { className?: string }) {
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
            <polyline points="6 9 12 15 18 9" />
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
            <label htmlFor="session-preview-limit" className="text-[--hp-text-primary]">
                {props.label}
            </label>
            <div className="flex h-9 shrink-0 items-center rounded-[--hp-radius-sm] border border-[--hp-border] bg-[--hp-surface-0] shadow-[--hp-shadow-xs]">
                <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={props.value <= MIN_SESSION_PREVIEW_LIMIT}
                    aria-label={props.decreaseLabel}
                    title={props.decreaseLabel}
                    className="flex h-8 w-8 items-center justify-center rounded-l-[--hp-radius-sm] text-[--hp-text-tertiary] transition-colors hover:bg-[--hp-surface-1] hover:text-[--hp-text-primary] disabled:cursor-not-allowed disabled:opacity-40"
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
                    className="h-8 w-14 border-x border-[--hp-border] bg-transparent text-center text-sm font-medium tabular-nums text-[--hp-text-primary] outline-none focus:bg-[--hp-surface-1]"
                />
                <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={props.value >= MAX_SESSION_PREVIEW_LIMIT}
                    aria-label={props.increaseLabel}
                    title={props.increaseLabel}
                    className="flex h-8 w-8 items-center justify-center rounded-r-[--hp-radius-sm] text-[--hp-text-tertiary] transition-colors hover:bg-[--hp-surface-1] hover:text-[--hp-text-primary] disabled:cursor-not-allowed disabled:opacity-40"
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
        <div className="border-t border-[--hp-divider] px-3 py-3">
            <div className="mb-2 text-[--hp-text-primary]">{props.label}</div>
            <div className="flex flex-wrap gap-2">
                {presetOptions.map((option) => {
                    const selected = props.preference === toPresetChatSurfaceColorPreference(option.value)
                    const swatchColor = getChatSurfaceColorPickerValue(toPresetChatSurfaceColorPreference(option.value))
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => props.onPresetChange(option.value)}
                            className={`inline-flex items-center gap-2 rounded-[--hp-radius-md] border px-3 py-1.5 text-sm transition-colors ${
                                selected
                                    ? 'border-[--hp-primary] bg-[--hp-surface-1] text-[--hp-primary]'
                                    : 'border-[--hp-border] bg-[--hp-surface-0] text-[--hp-text-primary] hover:bg-[--hp-surface-1]'
                            }`}
                        >
                            <span className="h-2.5 w-2.5 rounded-full opacity-80" style={{ backgroundColor: swatchColor }} />
                            <span>{props.t(option.labelKey)}</span>
                        </button>
                    )
                })}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm text-[--hp-text-tertiary]">{props.t('settings.chat.surfaceColor.custom')}</span>
                <label
                    className={`inline-flex items-center rounded-[--hp-radius-md] border px-2 py-1 transition-colors ${
                        isCustomSelected
                            ? 'border-[--hp-primary] bg-[--hp-surface-1]'
                            : 'border-[--hp-border] bg-[--hp-surface-0]'
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
    const [isOpen, setIsOpen] = useState(false)
    const [isAppearanceOpen, setIsAppearanceOpen] = useState(false)
    const [isFontOpen, setIsFontOpen] = useState(false)
    const [isTerminalFontOpen, setIsTerminalFontOpen] = useState(false)
    const [isChatOpen, setIsChatOpen] = useState(false)
    const [isTerminalToolDisplayOpen, setIsTerminalToolDisplayOpen] = useState(false)
    const [isSessionListStatusOpen, setIsSessionListStatusOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const appearanceContainerRef = useRef<HTMLDivElement>(null)
    const fontContainerRef = useRef<HTMLDivElement>(null)
    const terminalFontContainerRef = useRef<HTMLDivElement>(null)
    const chatContainerRef = useRef<HTMLDivElement>(null)
    const terminalToolDisplayContainerRef = useRef<HTMLDivElement>(null)
    const sessionListStatusContainerRef = useRef<HTMLDivElement>(null)
    const { fontScale, setFontScale } = useFontScale()
    const { terminalFontSize, setTerminalFontSize } = useTerminalFontSize()
    const { sessionPreviewLimit, setSessionPreviewLimit } = useSessionPreviewLimit()
    const { composerEnterBehavior, setComposerEnterBehavior } = useComposerEnterBehavior()
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
    const terminalToolDisplayModeOptions = getTerminalToolDisplayModeOptions()
    const sessionListStatusModeOptions = getSessionListStatusModeOptions()
    const appearanceOptions = getAppearanceOptions()
    const currentLocale = locales.find((loc) => loc.value === locale)
    const currentAppearanceLabel = appearanceOptions.find((opt) => opt.value === appearance)?.labelKey ?? 'settings.display.appearance.system'
    const currentFontScaleLabel = fontScaleOptions.find((opt) => opt.value === fontScale)?.label ?? '100%'
    const currentTerminalFontSizeLabel = terminalFontSizeOptions.find((opt) => opt.value === terminalFontSize)?.label ?? '13px'
    const currentComposerEnterBehaviorLabel = composerEnterBehaviorOptions.find((opt) => opt.value === composerEnterBehavior)?.labelKey ?? 'settings.chat.enterBehavior.send'
    const currentTerminalToolDisplayModeLabel = terminalToolDisplayModeOptions.find((opt) => opt.value === terminalToolDisplayMode)?.labelKey ?? 'settings.chat.terminalToolDisplay.compact'
    const currentSessionListStatusModeLabel = sessionListStatusModeOptions.find((opt) => opt.value === sessionListStatusMode)?.labelKey ?? 'settings.display.sessionListStatus.standard'

    const handleLocaleChange = (newLocale: Locale) => {
        setLocale(newLocale)
        setIsOpen(false)
    }

    const handleAppearanceChange = (pref: AppearancePreference) => {
        setAppearance(pref)
        setIsAppearanceOpen(false)
    }

    const handleFontScaleChange = (newScale: FontScale) => {
        setFontScale(newScale)
        setIsFontOpen(false)
    }

    const handleTerminalFontSizeChange = (newSize: TerminalFontSize) => {
        setTerminalFontSize(newSize)
        setIsTerminalFontOpen(false)
    }

    const handleComposerEnterBehaviorChange = (newBehavior: ComposerEnterBehavior) => {
        setComposerEnterBehavior(newBehavior)
        setIsChatOpen(false)
    }

    const handleTerminalToolDisplayModeChange = (newMode: TerminalToolDisplayMode) => {
        setTerminalToolDisplayMode(newMode)
        setIsTerminalToolDisplayOpen(false)
    }

    const handleSessionListStatusModeChange = (newMode: SessionListStatusMode) => {
        setSessionListStatusMode(newMode)
        setIsSessionListStatusOpen(false)
    }

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!isOpen && !isAppearanceOpen && !isFontOpen && !isTerminalFontOpen && !isChatOpen && !isTerminalToolDisplayOpen && !isSessionListStatusOpen) return

        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
            if (isAppearanceOpen && appearanceContainerRef.current && !appearanceContainerRef.current.contains(event.target as Node)) {
                setIsAppearanceOpen(false)
            }
            if (isFontOpen && fontContainerRef.current && !fontContainerRef.current.contains(event.target as Node)) {
                setIsFontOpen(false)
            }
            if (isTerminalFontOpen && terminalFontContainerRef.current && !terminalFontContainerRef.current.contains(event.target as Node)) {
                setIsTerminalFontOpen(false)
            }
            if (isChatOpen && chatContainerRef.current && !chatContainerRef.current.contains(event.target as Node)) {
                setIsChatOpen(false)
            }
            if (isTerminalToolDisplayOpen && terminalToolDisplayContainerRef.current && !terminalToolDisplayContainerRef.current.contains(event.target as Node)) {
                setIsTerminalToolDisplayOpen(false)
            }
            if (isSessionListStatusOpen && sessionListStatusContainerRef.current && !sessionListStatusContainerRef.current.contains(event.target as Node)) {
                setIsSessionListStatusOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen, isAppearanceOpen, isFontOpen, isTerminalFontOpen, isChatOpen, isTerminalToolDisplayOpen, isSessionListStatusOpen])

    // Close on escape key
    useEffect(() => {
        if (!isOpen && !isAppearanceOpen && !isFontOpen && !isTerminalFontOpen && !isChatOpen && !isTerminalToolDisplayOpen && !isSessionListStatusOpen) return

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false)
                setIsAppearanceOpen(false)
                setIsFontOpen(false)
                setIsTerminalFontOpen(false)
                setIsChatOpen(false)
                setIsTerminalToolDisplayOpen(false)
                setIsSessionListStatusOpen(false)
            }
        }

        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, isAppearanceOpen, isFontOpen, isTerminalFontOpen, isChatOpen, isTerminalToolDisplayOpen, isSessionListStatusOpen])

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="bg-[--hp-surface-0] pt-[env(safe-area-inset-top)]">
                <div className="mx-auto w-full max-w-content flex items-center gap-2 p-3 border-b border-[--hp-divider]">
                    <button
                        type="button"
                        onClick={goBack}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[--hp-text-secondary] transition-colors hover:bg-[--hp-surface-1] hover:text-[--hp-text-primary]"
                    >
                        <BackIcon />
                    </button>
                    <div className="flex-1 font-medium text-[--hp-text-primary]">{t('settings.title')}</div>
                </div>
            </div>

            <div className="app-scroll-y flex-1 min-h-0">
                <div className="mx-auto w-full max-w-content">
                    {/* Language section */}
                    <div className="border-b border-[--hp-divider]">
                        <div className="px-3 py-2 text-xs font-medium text-[--hp-text-tertiary] uppercase tracking-wider">
                            {t('settings.language.title')}
                        </div>
                        <div ref={containerRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setIsOpen(!isOpen)}
                                className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[--hp-surface-1]"
                                aria-expanded={isOpen}
                                aria-haspopup="listbox"
                            >
                                <span className="text-[--hp-text-primary]">{t('settings.language.label')}</span>
                                <span className="flex items-center gap-1 text-[--hp-text-tertiary]">
                                    <span>{currentLocale?.nativeLabel}</span>
                                    <ChevronDownIcon className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                </span>
                            </button>

                            {isOpen && (
                                <div
                                    className="absolute right-3 top-full mt-1 min-w-[160px] rounded-[--hp-radius-md] border border-[--hp-border] bg-[--hp-surface-0] shadow-[--hp-shadow-md] overflow-hidden z-50"
                                    role="listbox"
                                    aria-label={t('settings.language.title')}
                                >
                                    {locales.map((loc) => {
                                        const isSelected = locale === loc.value
                                        return (
                                            <button
                                                key={loc.value}
                                                type="button"
                                                role="option"
                                                aria-selected={isSelected}
                                                onClick={() => handleLocaleChange(loc.value)}
                                                className={`flex items-center justify-between w-full px-3 py-2 text-base text-left transition-colors ${
                                                    isSelected
                                                        ? 'text-[--hp-primary] bg-[--hp-surface-1]'
                                                        : 'text-[--hp-text-primary] hover:bg-[--hp-surface-1]'
                                                }`}
                                            >
                                                <span>{loc.nativeLabel}</span>
                                                {isSelected && (
                                                    <span className="ml-2 text-[--hp-primary]">
                                                        <CheckIcon />
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Display section */}
                    <div className="border-b border-[--hp-divider]">
                        <div className="px-3 py-2 text-xs font-medium text-[--hp-text-tertiary] uppercase tracking-wider">
                            {t('settings.display.title')}
                        </div>
                        <div ref={appearanceContainerRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setIsAppearanceOpen(!isAppearanceOpen)}
                                className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[--hp-surface-1]"
                                aria-expanded={isAppearanceOpen}
                                aria-haspopup="listbox"
                            >
                                <span className="text-[--hp-text-primary]">{t('settings.display.appearance')}</span>
                                <span className="flex items-center gap-1 text-[--hp-text-tertiary]">
                                    <span>{t(currentAppearanceLabel)}</span>
                                    <ChevronDownIcon className={`transition-transform ${isAppearanceOpen ? 'rotate-180' : ''}`} />
                                </span>
                            </button>

                            {isAppearanceOpen && (
                                <div
                                    className="absolute right-3 top-full mt-1 min-w-[160px] rounded-[--hp-radius-md] border border-[--hp-border] bg-[--hp-surface-0] shadow-[--hp-shadow-md] overflow-hidden z-50"
                                    role="listbox"
                                    aria-label={t('settings.display.appearance')}
                                >
                                    {appearanceOptions.map((opt) => {
                                        const isSelected = appearance === opt.value
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                role="option"
                                                aria-selected={isSelected}
                                                onClick={() => handleAppearanceChange(opt.value)}
                                                className={`flex items-center justify-between w-full px-3 py-2 text-base text-left transition-colors ${
                                                    isSelected
                                                        ? 'text-[--hp-primary] bg-[--hp-surface-1]'
                                                        : 'text-[--hp-text-primary] hover:bg-[--hp-surface-1]'
                                                }`}
                                            >
                                                <span>{t(opt.labelKey)}</span>
                                                {isSelected && (
                                                    <span className="ml-2 text-[--hp-primary]">
                                                        <CheckIcon />
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        <div ref={fontContainerRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setIsFontOpen(!isFontOpen)}
                                className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[--hp-surface-1]"
                                aria-expanded={isFontOpen}
                                aria-haspopup="listbox"
                            >
                                <span className="text-[--hp-text-primary]">{t('settings.display.fontSize')}</span>
                                <span className="flex items-center gap-1 text-[--hp-text-tertiary]">
                                    <span>{currentFontScaleLabel}</span>
                                    <ChevronDownIcon className={`transition-transform ${isFontOpen ? 'rotate-180' : ''}`} />
                                </span>
                            </button>

                            {isFontOpen && (
                                <div
                                    className="absolute right-3 top-full mt-1 min-w-[140px] rounded-[--hp-radius-md] border border-[--hp-border] bg-[--hp-surface-0] shadow-[--hp-shadow-md] overflow-hidden z-50"
                                    role="listbox"
                                    aria-label={t('settings.display.fontSize')}
                                >
                                    {fontScaleOptions.map((opt) => {
                                        const isSelected = fontScale === opt.value
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                role="option"
                                                aria-selected={isSelected}
                                                onClick={() => handleFontScaleChange(opt.value)}
                                                className={`flex items-center justify-between w-full px-3 py-2 text-base text-left transition-colors ${
                                                    isSelected
                                                        ? 'text-[--hp-primary] bg-[--hp-surface-1]'
                                                        : 'text-[--hp-text-primary] hover:bg-[--hp-surface-1]'
                                                }`}
                                            >
                                                <span>{opt.label}</span>
                                                {isSelected && (
                                                    <span className="ml-2 text-[--hp-primary]">
                                                        <CheckIcon />
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        <div ref={terminalFontContainerRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setIsTerminalFontOpen(!isTerminalFontOpen)}
                                className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[--hp-surface-1]"
                                aria-expanded={isTerminalFontOpen}
                                aria-haspopup="listbox"
                            >
                                <span className="text-[--hp-text-primary]">{t('settings.display.terminalFontSize')}</span>
                                <span className="flex items-center gap-1 text-[--hp-text-tertiary]">
                                    <span>{currentTerminalFontSizeLabel}</span>
                                    <ChevronDownIcon className={`transition-transform ${isTerminalFontOpen ? 'rotate-180' : ''}`} />
                                </span>
                            </button>

                            {isTerminalFontOpen && (
                                <div
                                    className="absolute right-3 top-full mt-1 min-w-[140px] rounded-[--hp-radius-md] border border-[--hp-border] bg-[--hp-surface-0] shadow-[--hp-shadow-md] overflow-hidden z-50"
                                    role="listbox"
                                    aria-label={t('settings.display.terminalFontSize')}
                                >
                                    {terminalFontSizeOptions.map((opt) => {
                                        const isSelected = terminalFontSize === opt.value
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                role="option"
                                                aria-selected={isSelected}
                                                onClick={() => handleTerminalFontSizeChange(opt.value)}
                                                className={`flex items-center justify-between w-full px-3 py-2 text-base text-left transition-colors ${
                                                    isSelected
                                                        ? 'text-[--hp-primary] bg-[--hp-surface-1]'
                                                        : 'text-[--hp-text-primary] hover:bg-[--hp-surface-1]'
                                                }`}
                                            >
                                                <span>{opt.label}</span>
                                                {isSelected && (
                                                    <span className="ml-2 text-[--hp-primary]">
                                                        <CheckIcon />
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        <SessionPreviewLimitControl
                            label={t('settings.display.sessionPreviewLimit')}
                            value={sessionPreviewLimit}
                            onChange={setSessionPreviewLimit}
                            decreaseLabel={t('settings.display.sessionPreviewLimit.decrease')}
                            increaseLabel={t('settings.display.sessionPreviewLimit.increase')}
                        />
                        <div ref={sessionListStatusContainerRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setIsSessionListStatusOpen(!isSessionListStatusOpen)}
                                className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[--hp-surface-1]"
                                aria-expanded={isSessionListStatusOpen}
                                aria-haspopup="listbox"
                            >
                                <span className="text-[--hp-text-primary]">{t('settings.display.sessionListStatus')}</span>
                                <span className="flex items-center gap-1 text-[--hp-text-tertiary]">
                                    <span>{t(currentSessionListStatusModeLabel)}</span>
                                    <ChevronDownIcon className={`transition-transform ${isSessionListStatusOpen ? 'rotate-180' : ''}`} />
                                </span>
                            </button>

                            {isSessionListStatusOpen && (
                                <div
                                    className="absolute right-3 top-full mt-1 min-w-[220px] rounded-[--hp-radius-md] border border-[--hp-border] bg-[--hp-surface-0] shadow-[--hp-shadow-md] overflow-hidden z-50"
                                    role="listbox"
                                    aria-label={t('settings.display.sessionListStatus')}
                                >
                                    {sessionListStatusModeOptions.map((opt) => {
                                        const isSelected = sessionListStatusMode === opt.value
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                role="option"
                                                aria-selected={isSelected}
                                                onClick={() => handleSessionListStatusModeChange(opt.value)}
                                                className={`flex items-center justify-between w-full px-3 py-2 text-base text-left transition-colors ${
                                                    isSelected
                                                        ? 'text-[--hp-primary] bg-[--hp-surface-1]'
                                                        : 'text-[--hp-text-primary] hover:bg-[--hp-surface-1]'
                                                }`}
                                            >
                                                <span>{t(opt.labelKey)}</span>
                                                {isSelected && (
                                                    <span className="ml-2 text-[--hp-primary]">
                                                        <CheckIcon />
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        {sessionListStatusMode === 'detailed' ? (
                            <div className="px-3 pb-3 text-xs text-[--hp-text-tertiary]">
                                {t('settings.display.sessionListStatus.detailedDescription')}
                            </div>
                        ) : null}
                    </div>

                    {/* Chat section */}
                    <div className="border-b border-[--hp-divider]">
                        <div className="px-3 py-2 text-xs font-medium text-[--hp-text-tertiary] uppercase tracking-wider">
                            {t('settings.chat.title')}
                        </div>
                        <div ref={chatContainerRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setIsChatOpen(!isChatOpen)}
                                className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[--hp-surface-1]"
                                aria-expanded={isChatOpen}
                                aria-haspopup="listbox"
                            >
                                <span className="text-[--hp-text-primary]">{t('settings.chat.enterBehavior')}</span>
                                <span className="flex items-center gap-1 text-[--hp-text-tertiary]">
                                    <span>{t(currentComposerEnterBehaviorLabel)}</span>
                                    <ChevronDownIcon className={`transition-transform ${isChatOpen ? 'rotate-180' : ''}`} />
                                </span>
                            </button>

                            {isChatOpen && (
                                <div
                                    className="absolute right-3 top-full mt-1 min-w-[170px] rounded-[--hp-radius-md] border border-[--hp-border] bg-[--hp-surface-0] shadow-[--hp-shadow-md] overflow-hidden z-50"
                                    role="listbox"
                                    aria-label={t('settings.chat.enterBehavior')}
                                >
                                    {composerEnterBehaviorOptions.map((opt) => {
                                        const isSelected = composerEnterBehavior === opt.value
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                role="option"
                                                aria-selected={isSelected}
                                                onClick={() => handleComposerEnterBehaviorChange(opt.value)}
                                                className={`flex items-center justify-between w-full px-3 py-2 text-base text-left transition-colors ${
                                                    isSelected
                                                        ? 'text-[--hp-primary] bg-[--hp-surface-1]'
                                                        : 'text-[--hp-text-primary] hover:bg-[--hp-surface-1]'
                                                }`}
                                            >
                                                <span>{t(opt.labelKey)}</span>
                                                {isSelected && (
                                                    <span className="ml-2 text-[--hp-primary]">
                                                        <CheckIcon />
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        <div ref={terminalToolDisplayContainerRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setIsTerminalToolDisplayOpen(!isTerminalToolDisplayOpen)}
                                className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[--hp-surface-1]"
                                aria-expanded={isTerminalToolDisplayOpen}
                                aria-haspopup="listbox"
                            >
                                <span className="text-[--hp-text-primary]">{t('settings.chat.terminalToolDisplay')}</span>
                                <span className="flex items-center gap-1 text-[--hp-text-tertiary]">
                                    <span>{t(currentTerminalToolDisplayModeLabel)}</span>
                                    <ChevronDownIcon className={`transition-transform ${isTerminalToolDisplayOpen ? 'rotate-180' : ''}`} />
                                </span>
                            </button>

                            {isTerminalToolDisplayOpen && (
                                <div
                                    className="absolute right-3 top-full mt-1 min-w-[230px] rounded-[--hp-radius-md] border border-[--hp-border] bg-[--hp-surface-0] shadow-[--hp-shadow-md] overflow-hidden z-50"
                                    role="listbox"
                                    aria-label={t('settings.chat.terminalToolDisplay')}
                                >
                                    {terminalToolDisplayModeOptions.map((opt) => {
                                        const isSelected = terminalToolDisplayMode === opt.value
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                role="option"
                                                aria-selected={isSelected}
                                                onClick={() => handleTerminalToolDisplayModeChange(opt.value)}
                                                className={`flex items-center justify-between w-full px-3 py-2 text-base text-left transition-colors ${
                                                    isSelected
                                                        ? 'text-[--hp-primary] bg-[--hp-surface-1]'
                                                        : 'text-[--hp-text-primary] hover:bg-[--hp-surface-1]'
                                                }`}
                                            >
                                                <span>{t(opt.labelKey)}</span>
                                                {isSelected && (
                                                    <span className="ml-2 text-[--hp-primary]">
                                                        <CheckIcon />
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
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
                    <div className="border-b border-[--hp-divider]">
                        <div className="px-3 py-2 text-xs font-medium text-[--hp-text-tertiary] uppercase tracking-wider">
                            {t('settings.about.title')}
                        </div>
                        <div className="flex w-full items-center justify-between px-3 py-3">
                            <span className="text-[--hp-text-primary]">{t('settings.about.website')}</span>
                            <a
                                href="https://github.com/zulinliu/make-hapi-power-again"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[--hp-primary] hover:underline"
                            >
                                GitHub
                            </a>
                        </div>
                        <div className="flex w-full items-center justify-between px-3 py-3">
                            <span className="text-[--hp-text-primary]">{t('settings.about.appVersion')}</span>
                            <span className="text-[--hp-text-tertiary]">{__APP_VERSION__}</span>
                        </div>
                        <div className="flex w-full items-center justify-between px-3 py-3">
                            <span className="text-[--hp-text-primary]">{t('settings.about.protocolVersion')}</span>
                            <span className="text-[--hp-text-tertiary]">{PROTOCOL_VERSION}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
