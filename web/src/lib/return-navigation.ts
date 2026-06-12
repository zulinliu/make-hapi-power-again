export type SafeReturnTarget =
    | { type: 'files'; search: { machineId?: string; path?: string } }
    | { type: 'sessions' }
    | { type: 'sessionFiles'; sessionId: string; search: { tab?: 'changes' | 'directories'; path?: string } }

function isSafeLocalPath(value: string): boolean {
    return value.startsWith('/') && !value.startsWith('//') && !value.includes('\0')
}

export function parseSafeReturnTo(value: unknown): SafeReturnTarget | null {
    if (typeof value !== 'string' || !value || !isSafeLocalPath(value)) {
        return null
    }

    let url: URL
    try {
        url = new URL(value, 'https://hapi.local')
    } catch {
        return null
    }

    if (url.pathname === '/files') {
        const search: { machineId?: string; path?: string } = {}
        const machineId = url.searchParams.get('machineId')
        const path = url.searchParams.get('path')
        if (machineId) search.machineId = machineId
        if (path) search.path = path
        return { type: 'files', search }
    }

    if (url.pathname === '/sessions') {
        return { type: 'sessions' }
    }

    const sessionFilesMatch = url.pathname.match(/^\/sessions\/([^/]+)\/files$/)
    if (sessionFilesMatch) {
        const tabValue = url.searchParams.get('tab')
        const path = url.searchParams.get('path') ?? undefined
        const tab = tabValue === 'directories'
            ? 'directories'
            : tabValue === 'changes'
                ? 'changes'
                : undefined
        return {
            type: 'sessionFiles',
            sessionId: decodeURIComponent(sessionFilesMatch[1]),
            search: { ...(tab ? { tab } : {}), ...(path ? { path } : {}) },
        }
    }

    return null
}
