/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope & {
    __WB_MANIFEST: Array<string | { url: string; revision?: string }>
}

type PushPayload = {
    title: string
    body?: string
    icon?: string
    badge?: string
    tag?: string
    data?: {
        type?: string
        sessionId?: string
        url?: string
    }
}

// Only skip waiting when explicitly requested by the client (via postMessage)
// Do NOT auto-skipWaiting on install — that causes page reload when user switches apps
self.addEventListener('install', () => {
    // Wait for old SW to be replaced naturally or via user action
})

self.addEventListener('activate', () => {
    // Only claim clients when explicitly activated (user triggered update)
})

// Allow client to trigger skipWaiting + clients.claim via postMessage (user-initiated update)
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting()
        self.addEventListener('activate', () => self.clients.claim())
    }
})

precacheAndRoute(self.__WB_MANIFEST)

// Navigation fallback: serve index.html for SPA routes, offline.html when offline
const navigationHandler = createHandlerBoundToURL('/index.html')
const navigationRoute = new NavigationRoute(async (params) => {
    try {
        return await navigationHandler(params)
    } catch {
        return caches.match('/offline.html') as Promise<Response>
    }
}, {
    denylist: [/^\/api\//, /^\/socket\.io/],
})
registerRoute(navigationRoute)

registerRoute(
    ({ url }) => url.pathname === '/api/sessions',
    new NetworkFirst({
        cacheName: 'api-sessions',
        networkTimeoutSeconds: 10,
        plugins: [
            new ExpirationPlugin({
                maxEntries: 10,
                maxAgeSeconds: 60 * 5
            })
        ]
    })
)

registerRoute(
    ({ url }) => /^\/api\/sessions\/[^/]+$/.test(url.pathname),
    new NetworkFirst({
        cacheName: 'api-session-detail',
        networkTimeoutSeconds: 10,
        plugins: [
            new ExpirationPlugin({
                maxEntries: 20,
                maxAgeSeconds: 60 * 5
            })
        ]
    })
)

registerRoute(
    ({ url }) => url.pathname === '/api/machines',
    new NetworkFirst({
        cacheName: 'api-machines',
        networkTimeoutSeconds: 10,
        plugins: [
            new ExpirationPlugin({
                maxEntries: 5,
                maxAgeSeconds: 60 * 10
            })
        ]
    })
)

registerRoute(
    /^https:\/\/cdn\.socket\.io\/.*/,
    new CacheFirst({
        cacheName: 'cdn-socketio',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 30
            })
        ]
    })
)

registerRoute(
    /^https:\/\/telegram\.org\/.*/,
    new CacheFirst({
        cacheName: 'cdn-telegram',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 7
            })
        ]
    })
)

self.addEventListener('push', (event) => {
    const payload = event.data?.json() as PushPayload | undefined
    if (!payload) {
        return
    }

    const title = payload.title || 'Hapi Power'
    const body = payload.body ?? ''
    const icon = payload.icon ?? '/pwa-192x192.png'
    const badge = payload.badge ?? '/pwa-64x64.png'
    const data = payload.data
    const tag = payload.tag

    // Determine notification actions based on type
    const actions: Array<{ action: string; title: string }> = []
    if (data?.url) {
        actions.push({ action: 'open', title: 'Open' })
    }
    actions.push({ action: 'dismiss', title: 'Dismiss' })

    const options: NotificationOptions = {
        body,
        icon,
        data,
        tag,
    }
    // actions is not in NotificationOptions type but is supported in browsers
    ;(options as Record<string, unknown>).actions = actions
    ;(options as Record<string, unknown>).badge = badge

    event.waitUntil(
        self.registration.showNotification(title, options)
    )
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    if (event.action === 'dismiss') {
        return
    }

    const data = event.notification.data as { url?: string } | undefined
    const url = data?.url ?? '/'
    event.waitUntil(self.clients.openWindow(url))
})
