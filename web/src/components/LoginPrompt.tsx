import { useCallback, useEffect, useState } from 'react'
import { ApiClient } from '@/api/client'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Spinner } from '@/components/Spinner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useTranslation } from '@/lib/use-translation'
import type { ServerUrlResult } from '@/hooks/useServerUrl'

const CURRENT_YEAR = new Date().getFullYear()

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
    const subtitle = t('login.subtitle')
    const submitLabel = isBindMode ? t('login.bind.submit') : t('login.submit')
    const inputLabel = isBindMode ? t('login.bind.title') : t('login.placeholder')

    return (
        <div className="login-page">
            <div className="login-lang">
                <LanguageSwitcher />
            </div>

            {/* Brand */}
            <div className="login-brand">
                <h1 className="login-brand-name">{title}</h1>
                {!isBindMode && <p className="login-tagline">{subtitle}</p>}
            </div>

            {/* Form */}
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
                                    <div className="text-xs text-[var(--hp-text-tertiary)]">
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
                                        <div className="text-[11px] text-[var(--hp-text-tertiary)]">
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

            {/* Footer */}
            <div className="login-footer">
                {t('login.footer.copyright')} {CURRENT_YEAR} Hapi Power
            </div>
        </div>
    )
}
