/**
 * Backward-compatible environment variable access.
 * Reads HAPI_POWER_* first; falls back to legacy HAPI_* if unset.
 */
export function getEnv(newKey: string): string | undefined {
    return process.env[newKey] || process.env[newKey.replace('HAPI_POWER_', 'HAPI_')]
}

export function getEnvNumber(newKey: string, fallback: number): number {
    const raw = getEnv(newKey)
    if (!raw) return fallback
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
