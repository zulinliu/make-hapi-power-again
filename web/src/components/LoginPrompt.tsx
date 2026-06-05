import { useCallback, useEffect, useState } from 'react'
import { ApiClient } from '@/api/client'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Spinner } from '@/components/Spinner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useTranslation } from '@/lib/use-translation'
import type { ServerUrlResult } from '@/hooks/useServerUrl'

const CURRENT_YEAR = new Date().getFullYear()

function BoltIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
    )
}

function ShieldIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    )
}

function TerminalIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
    )
}

function LogoIcon() {
    return (
        <svg viewBox="0 0 32 32" fill="none">
            <path d="M16 3 L27 20 L21 20 L16 11 L11 20 L5 20 Z" fill="currentColor" />
            <rect x="3" y="22" width="26" height="5" rx="1" fill="currentColor" />
        </svg>
    )
}

type LoginPromptProps = {
    mode?: 'login' | 'bind'
    onLogin?: (token: string) => void
    onBind?: (token: string) => Promise<void>
    baseUrl: string
    serverUrl: string | null
    setServerUrl: (input: string) => ServerUrlResult
    clearServerUrl: () => void
    requireServerUrl?: boolean
    error?: string | null
}

export function LoginPrompt(props: LoginPromptProps) {
    const { t } = useTranslation()
    const isBindMode = props.mode === 'bind'
    const [accessToken, setAccessToken] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isServerDialogOpen, setIsServerDialogOpen] = useState(false)
    const [serverInput, setServerInput] = useState(props.serverUrl ?? '')
    const [serverError, setServerError] = useState<string | null>(null)

    useEffect(() => {
        document.body.dataset.loginActive = ''
        return () => { delete document.body.dataset.loginActive }
    }, [])

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault()

        const trimmedToken = accessToken.trim()
        if (!trimmedToken) {
            setError(t('login.error.enterToken'))
            return
        }

        if (!isBindMode && props.requireServerUrl && !props.serverUrl) {
            setServerError(t('login.server.required'))
            setIsServerDialogOpen(true)
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            if (isBindMode) {
                if (!props.onBind) {
                    setError(t('login.error.bindingUnavailable'))
                    return
                }
                await props.onBind(trimmedToken)
            } else {
                const client = new ApiClient('', { baseUrl: props.baseUrl })
                await client.authenticate({ accessToken: trimmedToken })
                if (!props.onLogin) {
                    setError(t('login.error.loginUnavailable'))
                    return
                }
                props.onLogin(trimmedToken)
            }
        } catch {
            const fallbackMessage = isBindMode ? t('login.error.bindFailed') : t('login.error.authFailed')
            setError(fallbackMessage)
        } finally {
            setIsLoading(false)
        }
    }, [accessToken, props, t, isBindMode])

    useEffect(() => {
        if (!isServerDialogOpen) {
            return
        }
        setServerInput(props.serverUrl ?? '')
    }, [isServerDialogOpen, props.serverUrl])

    const handleSaveServer = useCallback((e: React.FormEvent) => {
        e.preventDefault()
        const result = props.setServerUrl(serverInput)
        if (!result.ok) {
            setServerError(result.error)
            return
        }
        setServerError(null)
        setServerInput(result.value)
        setIsServerDialogOpen(false)
    }, [props, serverInput])

    const handleClearServer = useCallback(() => {
        props.clearServerUrl()
        setServerInput('')
        setServerError(null)
        setIsServerDialogOpen(false)
    }, [props])

    const handleServerDialogOpenChange = useCallback((open: boolean) => {
        setIsServerDialogOpen(open)
        if (!open) {
            setServerError(null)
        }
    }, [])

    const displayError = error || props.error
    const serverSummary = props.serverUrl ?? `${props.baseUrl} ${t('login.server.default')}`
    const title = isBindMode ? t('login.bind.title') : t('login.title')
    const submitLabel = isBindMode ? t('login.bind.submit') : t('login.submit')
    const inputLabel = isBindMode ? t('login.bind.title') : t('login.placeholder')

    return (
        <div className="login-page" role="main">
            {/* Left Panel: Brand Showcase */}
            <div className="login-brand-panel" aria-hidden="true">
                <div className="login-brand-content">
                    <div className="login-brand-logo">
                        <LogoIcon />
                    </div>
                    <h2 className="login-brand-headline">{t('login.brand.headline')}</h2>
                    <p className="login-brand-description">{t('login.brand.description')}</p>
                    <div className="login-brand-features">
                        <div className="login-brand-feature">
                            <span className="login-brand-feature-icon"><BoltIcon /></span>
                            <span>{t('login.brand.feature1')}</span>
                        </div>
                        <div className="login-brand-feature">
                            <span className="login-brand-feature-icon"><ShieldIcon /></span>
                            <span>{t('login.brand.feature2')}</span>
                        </div>
                        <div className="login-brand-feature">
                            <span className="login-brand-feature-icon"><TerminalIcon /></span>
                            <span>{t('login.brand.feature3')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel: Login Form */}
            <div className="login-form-panel">
                <div className="login-lang">
                    <LanguageSwitcher />
                </div>

                {/* Mobile-only compact brand */}
                <div className="login-brand-mobile">
                    <div className="login-brand-mobile-logo">
                        <LogoIcon />
                    </div>
                    <h2 className="login-brand-mobile-name">{title}</h2>
                    {!isBindMode && <p className="login-brand-mobile-tagline">{t('login.subtitle')}</p>}
                </div>

                <h1 className="login-form-title">{title}</h1>
                {!isBindMode && <p className="login-form-subtitle">{t('login.subtitle')}</p>}

                <div className="login-form-container">
                    <form onSubmit={handleSubmit}>
                        <label className="login-label" htmlFor="login-token-input">
                            {inputLabel}
                        </label>
                        <input
                            id="login-token-input"
                            type="password"
                            value={accessToken}
                            onChange={(e) => setAccessToken(e.target.value)}
                            placeholder={t('login.placeholder')}
                            autoComplete="current-password"
                            disabled={isLoading}
                            className="login-input"
                        />

                        {displayError && (
                            <div className="login-error" role="alert">
                                {displayError}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || !accessToken.trim()}
                            aria-busy={isLoading}
                            className="login-btn"
                        >
                            {isLoading ? (
                                <>
                                    <Spinner size="sm" label={null} />
                                    {isBindMode ? t('login.bind.submitting') : t('login.submitting')}
                                </>
                            ) : (
                                submitLabel
                            )}
                        </button>
                    </form>

                    {!isBindMode && (
                        <div className="login-links">
                            <a
                                href={`${props.serverUrl || props.baseUrl}/docs`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="login-link"
                            >
                                {t('login.help')}
                            </a>
                            <Dialog open={isServerDialogOpen} onOpenChange={handleServerDialogOpenChange}>
                                <DialogTrigger asChild>
                                    <button type="button" className="login-link">
                                        Hub {props.serverUrl ? t('login.server.custom') : t('login.server.default')}
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="login-dialog-content">
                                    <DialogHeader>
                                        <DialogTitle>{t('login.server.title')}</DialogTitle>
                                        <DialogDescription>
                                            {t('login.server.description')}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleSaveServer} className="login-dialog-form">
                                        <div className="text-xs text-(--hp-text-tertiary)">
                                            {t('login.server.current')} {serverSummary}
                                        </div>
                                        <div className="login-dialog-field">
                                            <label className="login-label" htmlFor="login-server-input">{t('login.server.origin')}</label>
                                            <input
                                                id="login-server-input"
                                                type="url"
                                                value={serverInput}
                                                onChange={(e) => {
                                                    setServerInput(e.target.value)
                                                    setServerError(null)
                                                }}
                                                placeholder={t('login.server.placeholder')}
                                                className="login-input"
                                            />
                                            <div className="text-[11px] text-(--hp-text-tertiary)">
                                                {t('login.server.hint')}
                                            </div>
                                        </div>

                                        {serverError && (
                                            <div className="login-error" role="alert">
                                                {serverError}
                                            </div>
                                        )}

                                        <div className="login-dialog-actions">
                                            {props.serverUrl && (
                                                <button type="button" className="login-dialog-btn-secondary" onClick={handleClearServer}>
                                                    {t('login.server.useSameOrigin')}
                                                </button>
                                            )}
                                            <button type="submit" className="login-dialog-btn-primary">
                                                {t('login.server.save')}
                                            </button>
                                        </div>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}
                </div>

                <div className="login-footer">
                    {t('login.footer.copyright')} {CURRENT_YEAR} Hapi Power
                </div>
            </div>
        </div>
    )
}
