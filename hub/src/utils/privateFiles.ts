import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync } from 'node:fs'
import { chmod, mkdir } from 'node:fs/promises'

function currentWindowsUser(): string | null {
    const username = process.env.USERNAME
    if (!username) {
        return null
    }

    const domain = process.env.USERDOMAIN
    return domain ? `${domain}\\${username}` : username
}

function restrictWindowsAclSync(path: string, directory: boolean): void {
    if (process.platform !== 'win32') {
        return
    }

    const user = currentWindowsUser()
    if (!user) {
        return
    }

    const grant = directory ? `${user}:(OI)(CI)F` : `${user}:F`
    spawnSync('icacls', [path, '/inheritance:r', '/grant:r', grant], {
        stdio: 'ignore',
        windowsHide: true
    })
}

export async function ensurePrivateDir(path: string): Promise<void> {
    await mkdir(path, { recursive: true, mode: 0o700 })
    await chmod(path, 0o700).catch(() => { })
    restrictWindowsAclSync(path, true)
}

export function ensurePrivateDirSync(path: string): void {
    mkdirSync(path, { recursive: true, mode: 0o700 })
    try {
        chmodSync(path, 0o700)
    } catch {
        // Best effort on filesystems that do not support POSIX modes.
    }
    restrictWindowsAclSync(path, true)
}

export async function chmodPrivateFile(path: string): Promise<void> {
    await chmod(path, 0o600).catch(() => { })
    restrictWindowsAclSync(path, false)
}

export function chmodPrivateFileSync(path: string): void {
    try {
        chmodSync(path, 0o600)
    } catch {
        // Best effort on filesystems that do not support POSIX modes.
    }
    restrictWindowsAclSync(path, false)
}
