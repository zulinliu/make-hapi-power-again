import { useCallback, useEffect, useRef, useState } from 'react'
import {
    cancelMachineClone,
    cancelSessionClone,
    getCloneErrorMessage,
    mapProgressPhase,
    startMachineClone,
    startSessionClone,
    type CloneAuth,
    type ClonePhase,
    type CloneProgressEvent,
    type CloneRequest
} from '../../lib/git-portal-api'
import { addHistory, getGitUrlScheme, parseRepoUrl, sanitizeGitUrl } from '../../lib/git-portal-storage'
import { subscribeCloneProgressEvents, type CloneProgressSyncEvent } from '../../lib/git-portal-events'
import type { ApiClient } from '../../api/client'
import { useTranslation } from '@/lib/use-translation'
import { randomId } from '@/lib/randomId'

export interface CloneState {
    phase: ClonePhase
    url: string
    parsedRepo: ReturnType<typeof parseRepoUrl>
    config: {
        /** UI-level parent directory. The request sends parent + repoName as final destination. */
        targetDir: string
        branch: string
        depth: number | null
    }
    auth: CloneAuth | null
    isCancelling: boolean
    progress: {
        bytesReceived: number
        bytesTotal?: number
        message: string
        percent: number
    }
    result: {
        clonedPath: string
        repoInfo?: { name: string; branch: string; sizeBytes: number; historyId?: string }
    } | null
    error: string | null
    notice: string | null
}

const INITIAL_STATE: CloneState = {
    phase: 'input',
    url: '',
    parsedRepo: null,
    config: { targetDir: '', branch: '', depth: null },
    auth: null,
    isCancelling: false,
    progress: { bytesReceived: 0, message: '', percent: 0 },
    result: null,
    error: null,
    notice: null
}

interface UseGitCloneOptions {
    api: ApiClient | null
    machineId: string | null
    sessionId?: string | null
    currentPath?: string
    onCloneComplete?: (clonedPath: string) => void
}

function joinCloneDestination(parentDir: string, repoName: string): string {
    const parent = parentDir.trim().replace(/\/+$/, '')
    if (!parent) return repoName
    return `${parent}/${repoName}`
}

function clampPercent(value: number | undefined, fallback: number): number {
    if (value === undefined || Number.isNaN(value)) return fallback
    return Math.max(0, Math.min(100, Math.round(value)))
}

function isActiveClonePhase(phase: ClonePhase): boolean {
    return phase === 'connecting' || phase === 'transferring' || phase === 'unpacking'
}

export function useGitClone({ api, machineId, sessionId, currentPath, onCloneComplete }: UseGitCloneOptions) {
    const { t } = useTranslation()
    const [state, setState] = useState<CloneState>({
        ...INITIAL_STATE,
        config: { ...INITIAL_STATE.config, targetDir: currentPath ?? '' }
    })

    const cloneIdRef = useRef<string>('')
    const abortRef = useRef(false)
    const completedCloneIdRef = useRef<string>('')
    const onCloneCompleteRef = useRef(onCloneComplete)
    onCloneCompleteRef.current = onCloneComplete
    const stateRef = useRef(state)
    stateRef.current = state
    const completeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    const emitCompletionOnce = useCallback((cloneId: string, clonedPath: string) => {
        if (completedCloneIdRef.current === cloneId) return
        completedCloneIdRef.current = cloneId
        completeTimerRef.current = setTimeout(() => {
            if (!abortRef.current) onCloneCompleteRef.current?.(clonedPath)
        }, 0)
    }, [])

    const completeClone = useCallback((eventData?: CloneProgressEvent) => {
        const activeCloneId = eventData?.cloneId ?? cloneIdRef.current
        setState(prev => {
            if (abortRef.current || prev.phase === 'done') return prev
            const repoName = prev.parsedRepo?.repoName ?? ''
            if (!repoName) {
                return {
                    ...prev,
                    phase: 'error',
                    auth: null,
                    isCancelling: false,
                    error: t('gitPortal.error.repoNameMissing')
                }
            }

            const parentDir = prev.config.targetDir || currentPath || ''
            const clonedPath = joinCloneDestination(parentDir, repoName)
            const historyEntry = prev.url
                ? addHistory({
                    url: sanitizeGitUrl(prev.url),
                    platform: prev.parsedRepo?.platform ?? 'other',
                    repoName,
                    owner: prev.parsedRepo?.owner ?? '',
                    targetDir: parentDir,
                    branch: prev.config.branch || undefined
                })
                : null

            emitCompletionOnce(activeCloneId, clonedPath)

            return {
                ...prev,
                phase: 'done',
                auth: null,
                isCancelling: false,
                progress: {
                    bytesReceived: eventData?.bytesReceived ?? prev.progress.bytesReceived,
                    bytesTotal: eventData?.bytesTotal ?? prev.progress.bytesTotal,
                    message: eventData?.message ?? prev.progress.message,
                    percent: 100
                },
                result: {
                    clonedPath,
                    repoInfo: {
                        name: repoName,
                        branch: prev.config.branch || 'main',
                        sizeBytes: eventData?.bytesReceived ?? prev.progress.bytesReceived,
                        historyId: historyEntry?.id
                    }
                },
                error: null,
                notice: null
            }
        })
    }, [currentPath, emitCompletionOnce, t])

    const handleProgressEvent = useCallback((event: CloneProgressSyncEvent | { type: string; data?: CloneProgressEvent }) => {
        if (event.type !== 'clone-progress' || !event.data) return
        if (event.data.cloneId !== cloneIdRef.current) return

        const clonePhase = mapProgressPhase(event.data.phase)
        if (clonePhase === 'done') {
            completeClone(event.data)
            return
        }

        setState(prev => {
            if (abortRef.current) return prev

            if (clonePhase === 'error') {
                return {
                    ...prev,
                    phase: 'error',
                    auth: null,
                    isCancelling: false,
                    error: event.data?.message ?? 'Clone failed'
                }
            }

            return {
                ...prev,
                phase: clonePhase,
                progress: {
                    bytesReceived: event.data?.bytesReceived ?? prev.progress.bytesReceived,
                    bytesTotal: event.data?.bytesTotal ?? prev.progress.bytesTotal,
                    message: event.data?.message ?? prev.progress.message,
                    percent: clampPercent(event.data?.progress, prev.progress.percent)
                }
            }
        })
    }, [completeClone])

    useEffect(() => {
        return subscribeCloneProgressEvents(handleProgressEvent)
    }, [handleProgressEvent])

    const setUrl = useCallback((url: string) => {
        setState(prev => {
            const previousScheme = getGitUrlScheme(prev.url)
            const nextScheme = getGitUrlScheme(url)
            const shouldClearAuth = previousScheme !== nextScheme || nextScheme !== 'https'
            return {
                ...prev,
                url,
                parsedRepo: url ? parseRepoUrl(url) : null,
                auth: shouldClearAuth ? null : prev.auth,
                error: null,
                notice: null
            }
        })
    }, [])

    const setConfig = useCallback((config: Partial<CloneState['config']>) => {
        setState(prev => ({ ...prev, config: { ...prev.config, ...config } }))
    }, [])

    const setAuth = useCallback((auth: CloneAuth | null) => {
        setState(prev => ({ ...prev, auth }))
    }, [])

    const startClone = useCallback(async () => {
        const current = stateRef.current
        if (!api || !current.url) return

        const repoName = current.parsedRepo?.repoName
        if (!repoName) {
            setState(prev => ({ ...prev, phase: 'error', auth: null, error: t('gitPortal.error.invalidUrl') }))
            return
        }

        const cloneId = randomId()
        cloneIdRef.current = cloneId
        completedCloneIdRef.current = ''
        abortRef.current = false

        const parentDir = current.config.targetDir || currentPath || ''
        const request: CloneRequest = {
            url: current.url.trim(),
            targetDir: parentDir || undefined,
            targetName: repoName,
            branch: current.config.branch || undefined,
            depth: current.config.depth ?? undefined,
            cloneId,
            auth: current.auth ?? undefined
        }

        setState(prev => ({
            ...prev,
            phase: 'connecting',
            isCancelling: false,
            progress: { bytesReceived: 0, message: '', percent: 0 },
            error: null,
            notice: null,
            result: null
        }))

        try {
            const result = machineId
                ? await startMachineClone(api, machineId, request)
                : sessionId
                    ? await startSessionClone(api, sessionId, request)
                    : { success: false as const, error: t('gitPortal.error.noTarget') }

            if (abortRef.current) return

            if (result.success) {
                completeClone({
                    cloneId,
                    machineId: machineId ?? undefined,
                    sessionId: sessionId ?? undefined,
                    phase: 'done',
                    progress: 100,
                    message: result.stdout || 'Clone completed successfully'
                })
                return
            }

            setState(prev => {
                if (prev.phase === 'done') return prev
                return {
                    ...prev,
                    phase: 'error',
                    auth: null,
                    isCancelling: false,
                    error: getCloneErrorMessage(result)
                }
            })
        } catch (err) {
            if (abortRef.current) return
            setState(prev => ({
                ...prev,
                phase: 'error',
                auth: null,
                isCancelling: false,
                error: err instanceof Error ? err.message : String(err)
            }))
        }
    }, [api, completeClone, currentPath, machineId, sessionId, t])

    const reset = useCallback(() => {
        abortRef.current = true
        cloneIdRef.current = ''
        completedCloneIdRef.current = ''
        if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
        setState({
            ...INITIAL_STATE,
            config: { targetDir: currentPath ?? '', branch: '', depth: null }
        })
    }, [currentPath])

    const resetWithNotice = useCallback((notice: string) => {
        abortRef.current = true
        cloneIdRef.current = ''
        completedCloneIdRef.current = ''
        if (completeTimerRef.current) clearTimeout(completeTimerRef.current)
        setState({
            ...INITIAL_STATE,
            config: { targetDir: currentPath ?? '', branch: '', depth: null },
            notice
        })
    }, [currentPath])

    const retryFromError = useCallback(() => {
        abortRef.current = false
        cloneIdRef.current = ''
        completedCloneIdRef.current = ''
        setState(prev => ({
            ...prev,
            phase: 'input',
            auth: null,
            isCancelling: false,
            progress: { bytesReceived: 0, message: '', percent: 0 },
            result: null,
            error: null,
            notice: null
        }))
    }, [])

    const switchToTokenAuth = useCallback(() => {
        abortRef.current = false
        cloneIdRef.current = ''
        completedCloneIdRef.current = ''
        setState(prev => ({
            ...prev,
            phase: 'input',
            auth: { type: 'token', password: '' },
            isCancelling: false,
            progress: { bytesReceived: 0, message: '', percent: 0 },
            result: null,
            error: null,
            notice: null
        }))
    }, [])

    const cancel = useCallback(async () => {
        const cloneId = cloneIdRef.current
        const current = stateRef.current
        if (!isActiveClonePhase(current.phase) || !cloneId) {
            reset()
            return
        }

        if (!api) {
            setState(prev => ({
                ...prev,
                phase: 'error',
                auth: null,
                isCancelling: false,
                error: t('gitPortal.error.noApi')
            }))
            return
        }

        setState(prev => ({ ...prev, isCancelling: true }))

        try {
            const result = machineId
                ? await cancelMachineClone(api, machineId, cloneId)
                : sessionId
                    ? await cancelSessionClone(api, sessionId, cloneId)
                    : { success: false, error: t('gitPortal.error.noTarget') }

            if (result.success) {
                resetWithNotice(t('gitPortal.status.cancelled'))
                return
            }

            setState(prev => ({
                ...prev,
                phase: 'error',
                auth: null,
                isCancelling: false,
                error: getCloneErrorMessage(result)
            }))
        } catch (err) {
            setState(prev => ({
                ...prev,
                phase: 'error',
                auth: null,
                isCancelling: false,
                error: err instanceof Error ? err.message : String(err)
            }))
        }
    }, [api, machineId, reset, resetWithNotice, sessionId, t])

    return {
        state,
        setUrl,
        setConfig,
        setAuth,
        startClone,
        reset,
        cancel,
        retryFromError,
        switchToTokenAuth,
        handleProgressEvent
    }
}
