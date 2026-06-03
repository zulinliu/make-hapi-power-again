import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { initializeFontScale } from '@/hooks/useFontScale'
import { getTelegramWebApp, isTelegramEnvironment, loadTelegramSdk } from './hooks/useTelegram'
import { queryClient } from './lib/query-client'
import { createAppRouter } from './router'
import { I18nProvider } from './lib/i18n-context'
import { restoreSpaRedirect } from './lib/spaRedirect'
import { installScrollRestorationGuard } from './lib/scrollStorageGuard'

function getStartParam(): string | null {
    const query = new URLSearchParams(window.location.search)
    const fromQuery = query.get('startapp') || query.get('tgWebAppStartParam')
    if (fromQuery) return fromQuery

    return getTelegramWebApp()?.initDataUnsafe?.start_param ?? null
}

function getDeepLinkedSessionId(): string | null {
    const startParam = getStartParam()
    if (startParam?.startsWith('session_')) {
        return startParam.slice('session_'.length)
    }
    return null
}

function getInitialPath(): string {
    const sessionId = getDeepLinkedSessionId()
    return sessionId ? `/sessions/${sessionId}` : '/sessions'
}

async function bootstrap() {
    installScrollRestorationGuard()
    initializeFontScale()

    // Only load Telegram SDK in Telegram environment (with 3s timeout)
    const isTelegram = isTelegramEnvironment()
    document.documentElement.dataset.telegramApp = isTelegram ? 'true' : 'false'
    if (isTelegram) {
        await loadTelegramSdk()
    }

    // Handle GitHub Pages 404 redirect for SPA routing
    // When GitHub Pages can't find a path (e.g. /sessions/xxx), it serves 404.html
    // which stores the path in sessionStorage and redirects to /
    if (!isTelegram) {
        restoreSpaRedirect()
    }

    const updateSW = registerSW({
        onNeedRefresh() {
            // Notify the UI that an update is available, but don't force reload
            // The user can choose to update via the update banner
            window.dispatchEvent(new CustomEvent('sw-update-available', {
                detail: { updateSW }
            }))
        },
        onOfflineReady() {
            // App ready for offline use
        },
        onRegistered(registration) {
            if (registration) {
                // Only check for updates when the page becomes visible again
                // This prevents the 30-min polling interval from triggering SW updates
                // while the app is in the background on iOS Safari
                const handleVisibility = () => {
                    if (document.visibilityState === 'visible') {
                        registration.update()
                    }
                }
                document.addEventListener('visibilitychange', handleVisibility)

                // Request persistent storage to prevent cache cleanup
                if (navigator.storage?.persist) {
                    navigator.storage.persist().then(() => {
                        // Persistence granted or denied
                    }).catch(() => {
                        // Ignore persistence errors
                    })
                }
            }
        },
        onRegisterError(error) {
            console.error('SW registration error:', error)
        }
    })

    const history = isTelegram
        ? createMemoryHistory({ initialEntries: [getInitialPath()] })
        : undefined
    const router = createAppRouter(history)

    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <I18nProvider>
                <QueryClientProvider client={queryClient}>
                    <RouterProvider router={router} />
                    {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
                </QueryClientProvider>
            </I18nProvider>
        </React.StrictMode>
    )
}

bootstrap()
