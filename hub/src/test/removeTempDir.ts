import { rmSync } from 'node:fs'

const RETRYABLE_ERROR_CODES = new Set(['EBUSY', 'ENOTEMPTY', 'EPERM'])
const MAX_ATTEMPTS = process.platform === 'win32' ? 3 : 20
const RETRY_DELAY_MS = process.platform === 'win32' ? 50 : 250

export function removeTempDir(path: string): void {
    let lastError: unknown

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
            rmSync(path, { recursive: true, force: true })
            return
        } catch (error) {
            lastError = error
            if (!isRetryableFsError(error) || attempt === MAX_ATTEMPTS - 1) {
                if (process.platform === 'win32' && isRetryableFsError(error)) {
                    return
                }
                throw error
            }

            // Windows 下 Bun test 中 SQLite WAL/SHM 句柄可能要等测试栈退出后才释放。
            Bun.gc(true)
            sleepSync(RETRY_DELAY_MS)
        }
    }

    throw lastError
}

function isRetryableFsError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false
    }

    const code = (error as { code?: unknown }).code
    return typeof code === 'string' && RETRYABLE_ERROR_CODES.has(code)
}

function sleepSync(ms: number): void {
    const buffer = new SharedArrayBuffer(4)
    const view = new Int32Array(buffer)
    Atomics.wait(view, 0, 0, ms)
}
