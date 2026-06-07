export type SafeReturnTarget =
    | { type: 'browse'; search: { machineId?: string; path?: string } }
    | { type: 'sessions' }
    | { type: 'sessionFiles'; sessionId: string; search: { tab?: 'changes' | 'directories' } }

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

    if (url.pathname === '/browse') {
        const search: { machineId?: string; path?: string } = {}
        const machineId = url.searchParams.get('machineId')
        const path = url.searchParams.get('path')
        if (machineId) search.machineId = machineId
        if (path) search.path = path
        return { type: 'browse', search }
    }

    if (url.pathname === '/sessions') {
        return { type: 'sessions' }
    }

    const sessionFilesMatch = url.pathname.match(/^\/sessions\/([^/]+)\/files$/)
    if (sessionFilesMatch) {
        const tabValue = url.searchParams.get('tab')
        const tab = tabValue === 'directories'
            ? 'directories'
            : tabValue === 'changes'
                ? 'changes'
                : undefined
        return {
            type: 'sessionFiles',
            sessionId: decodeURIComponent(sessionFilesMatch[1]),
            search: tab ? { tab } : {},
        }
    }

    return null
}
