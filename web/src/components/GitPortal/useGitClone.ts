import { useCallback, useRef, useState } from 'react'
import { mapProgressPhase, startMachineClone, startSessionClone, type CloneAuth, type ClonePhase, type CloneProgressEvent, type CloneRequest } from '../../lib/git-portal-api'
import { addHistory, parseRepoUrl, sanitizeGitUrl } from '../../lib/git-portal-storage'
import type { ApiClient } from '../../api/client'

export interface CloneState {
    phase: ClonePhase
    url: string
    parsedRepo: ReturnType<typeof parseRepoUrl>
    config: {
        targetDir: string
        branch: string
        depth: number | null
    }
    auth: CloneAuth | null
    progress: {
        bytesReceived: number
        bytesTotal?: number
        message: string
        percent: number
    }
    result: {
        clonedPath: string
        repoInfo?: { name: string; branch: string; sizeBytes: number }
    } | null
    error: string | null
}

const INITIAL_STATE: CloneState = {
    phase: 'input',
    url: '',
    parsedRepo: null,
    config: { targetDir: '', branch: '', depth: null },
    auth: null,
    progress: { bytesReceived: 0, message: '', percent: 0 },
    result: null,
    error: null
}

interface UseGitCloneOptions {
    api: ApiClient | null
    machineId: string | null
    sessionId?: string | null
    currentPath?: string
    onCloneComplete?: (clonedPath: string) => void
}

export function useGitClone({ api, machineId, sessionId, currentPath, onCloneComplete }: UseGitCloneOptions) {
    const [state, setState] = useState<CloneState>({
        ...INITIAL_STATE,
        config: { ...INITIAL_STATE.config, targetDir: currentPath ?? '' }
    })

    const cloneIdRef = useRef<string>('')
    const abortRef = useRef(false)
    const onCloneCompleteRef = useRef(onCloneComplete)
    onCloneCompleteRef.current = onCloneComplete

    // Call this from the parent's SSE onEvent handler when clone-progress events arrive
    const handleProgressEvent = useCallback((event: { type: string; data?: CloneProgressEvent }) => {
        if (event.type !== 'clone-progress' || !event.data) return
        if (event.data.cloneId !== cloneIdRef.current) return

        const clonePhase = mapProgressPhase(event.data.phase)

        setState(prev => {
            if (abortRef.current) return prev

            if (clonePhase === 'done') {
                const repoName = prev.parsedRepo?.repoName ?? ''
                const owner = prev.parsedRepo?.owner ?? ''
                if (prev.url && repoName) {
                    addHistory({
                        url: sanitizeGitUrl(prev.url),
                        platform: prev.parsedRepo?.platform ?? 'other',
                        repoName,
                        owner,
                        targetDir: prev.config.targetDir,
                        branch: prev.config.branch || undefined
                    })
                }

                const clonedPath = prev.config.targetDir
                    ? `${prev.config.targetDir}/${repoName}`
                    : repoName

                setTimeout(() => onCloneCompleteRef.current?.(clonedPath), 0)

                return {
                    ...prev,
                    phase: 'done',
                    auth: null,
                    result: {
                        clonedPath,
                        repoInfo: {
                            name: repoName,
                            branch: prev.config.branch || 'main',
                            sizeBytes: prev.progress.bytesReceived
                        }
                    }
                }
            }

            if (clonePhase === 'error') {
                return {
                    ...prev,
                    phase: 'error',
                    auth: null,
                    error: event.data!.message ?? 'Clone failed'
                }
            }

            return {
                ...prev,
                phase: clonePhase,
                progress: {
                    bytesReceived: event.data!.bytesReceived ?? prev.progress.bytesReceived,
                    bytesTotal: event.data!.bytesTotal,
                    message: event.data!.message ?? prev.progress.message,
                    percent: event.data!.progress ?? prev.progress.percent
                }
            }
        })
    }, [])

    const setUrl = useCallback((url: string) => {
        setState(prev => ({
            ...prev,
            url,
            parsedRepo: url ? parseRepoUrl(url) : null,
            error: null
        }))
    }, [])

    const setConfig = useCallback((config: Partial<CloneState['config']>) => {
        setState(prev => ({ ...prev, config: { ...prev.config, ...config } }))
    }, [])

    const setAuth = useCallback((auth: CloneAuth | null) => {
        setState(prev => ({ ...prev, auth }))
    }, [])

    const startClone = useCallback(async () => {
        if (!api || !state.url) return

        const cloneId = crypto.randomUUID()
        cloneIdRef.current = cloneId
        abortRef.current = false

        const request: CloneRequest = {
            url: state.url,
            targetDir: state.config.targetDir || undefined,
            branch: state.config.branch || undefined,
            depth: state.config.depth ?? undefined,
            cloneId,
            auth: state.auth ?? undefined
        }

        setState(prev => ({
            ...prev,
            phase: 'connecting',
            progress: { bytesReceived: 0, message: '', percent: 0 },
            error: null,
            result: null
        }))

        try {
            const result = machineId
                ? await startMachineClone(api, machineId, request)
                : sessionId
                    ? await startSessionClone(api, sessionId, request)
                    : { success: false as const, error: 'No machine or session specified' }

            // SSE handles success/failure via handleProgressEvent.
            // This is the fallback when SSE is disconnected.
            if (!result.success && !abortRef.current) {
                setState(prev => {
                    if (prev.phase === 'done') return prev
                    return {
                        ...prev,
                        phase: 'error',
                        auth: null,
                        error: result.error ?? result.stderr ?? 'Clone failed'
                    }
                })
            }
        } catch (err) {
            setState(prev => ({
                ...prev,
                phase: 'error',
                auth: null,
                error: err instanceof Error ? err.message : String(err)
            }))
        }
    }, [api, machineId, sessionId, state.url, state.config, state.auth])

    const reset = useCallback(() => {
        abortRef.current = true
        cloneIdRef.current = ''
        setState({
            ...INITIAL_STATE,
            config: { targetDir: currentPath ?? '', branch: '', depth: null }
        })
    }, [currentPath])

    const cancel = useCallback(() => {
        abortRef.current = true
        setState(prev => ({
            ...prev,
            phase: 'input',
            auth: null,
            progress: { bytesReceived: 0, message: '', percent: 0 },
            result: null,
            error: null
        }))
    }, [])

    return { state, setUrl, setConfig, setAuth, startClone, reset, cancel, handleProgressEvent }
}
