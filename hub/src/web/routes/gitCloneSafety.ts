import type { GitCloneCancelRequest, GitCloneRequest } from '@hapipower/protocol/schemas'
import { CloneIdSchema, GitCloneCancelRequestSchema, GitCloneRequestSchema } from '@hapipower/protocol/schemas'

const DEFAULT_RATE_WINDOW_MS = 10 * 60_000
const DEFAULT_RATE_LIMIT = 6
const DEFAULT_CONCURRENCY_LIMIT = 1

type CloneGateState = {
    readonly acceptedAt: number[]
    readonly active: Set<string>
}

export type GitCloneGateResult =
    | { ok: true; release: () => void }
    | { ok: false; status: 409 | 429; error: string }

function readPositiveIntEnv(name: string, fallback: number): number {
    const raw = process.env[name]
    if (!raw) return fallback
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readPositiveMsEnv(name: string, fallback: number): number {
    const raw = process.env[name]
    if (!raw) return fallback
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function parseGitCloneRequest(body: unknown): { success: true; data: GitCloneRequest } | { success: false; error: unknown } {
    const parsed = GitCloneRequestSchema.safeParse(body)
    if (!parsed.success) {
        return { success: false, error: parsed.error.flatten() }
    }

    return { success: true, data: parsed.data }
}

export function parseGitCloneCancelRequest(cloneId: string | undefined, body: unknown): { success: true; data: GitCloneCancelRequest } | { success: false; error: unknown } {
    if (cloneId) {
        const parsed = CloneIdSchema.safeParse(cloneId)
        if (!parsed.success) {
            return { success: false, error: parsed.error.flatten() }
        }
        return { success: true, data: { cloneId: parsed.data } }
    }

    const parsed = GitCloneCancelRequestSchema.safeParse(body)
    if (!parsed.success) {
        return { success: false, error: parsed.error.flatten() }
    }
    return { success: true, data: parsed.data }
}

export class GitCloneGate {
    private readonly states = new Map<string, CloneGateState>()
    private readonly windowMs = readPositiveMsEnv('HAPI_POWER_GIT_CLONE_RATE_WINDOW_MS', DEFAULT_RATE_WINDOW_MS)
    private readonly rateLimit = readPositiveIntEnv('HAPI_POWER_GIT_CLONE_RATE_LIMIT', DEFAULT_RATE_LIMIT)
    private readonly concurrencyLimit = readPositiveIntEnv('HAPI_POWER_GIT_CLONE_CONCURRENCY_LIMIT', DEFAULT_CONCURRENCY_LIMIT)

    start(scopeKey: string, cloneId: string): GitCloneGateResult {
        const now = Date.now()
        const state = this.getState(scopeKey)
        this.prune(state, now)

        if (state.active.size >= this.concurrencyLimit) {
            return {
                ok: false,
                status: 409,
                error: 'Another git clone is already running for this scope'
            }
        }

        if (state.acceptedAt.length >= this.rateLimit) {
            return {
                ok: false,
                status: 429,
                error: 'Git clone rate limit exceeded. Try again later.'
            }
        }

        state.active.add(cloneId)
        state.acceptedAt.push(now)

        let released = false
        return {
            ok: true,
            release: () => {
                if (released) return
                released = true
                state.active.delete(cloneId)
                if (state.active.size === 0 && state.acceptedAt.length === 0) {
                    this.states.delete(scopeKey)
                }
            }
        }
    }

    private getState(scopeKey: string): CloneGateState {
        const existing = this.states.get(scopeKey)
        if (existing) return existing

        const state: CloneGateState = { acceptedAt: [], active: new Set() }
        this.states.set(scopeKey, state)
        return state
    }

    private prune(state: CloneGateState, now: number): void {
        const cutoff = now - this.windowMs
        while (state.acceptedAt.length > 0 && state.acceptedAt[0] < cutoff) {
            state.acceptedAt.shift()
        }
    }
}

export const gitCloneGate = new GitCloneGate()
