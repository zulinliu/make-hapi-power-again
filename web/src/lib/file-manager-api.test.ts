import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api/client'
import { copyEntry, createFile, moveEntry } from './file-manager-api'

describe('file-manager-api', () => {
  it('moves session entries into the selected destination folder', async () => {
    const moveSessionFile = vi.fn(async () => ({ success: true }))
    const api = { moveSessionFile } as unknown as ApiClient

    await moveEntry(api, 'machine-1', 'session-1', '/repo/src/a.ts', '/repo/archive')

    expect(moveSessionFile).toHaveBeenCalledWith('session-1', '/repo/src/a.ts', '/repo/archive/a.ts')
  })

  it('copies machine entries into the selected destination folder', async () => {
    const copyMachineFile = vi.fn(async () => ({ success: true }))
    const api = { copyMachineFile } as unknown as ApiClient

    await copyEntry(api, 'machine-1', null, '/repo/src/a.ts', '/repo/archive/')

    expect(copyMachineFile).toHaveBeenCalledWith('machine-1', '/repo/src/a.ts', '/repo/archive/a.ts')
  })

  it('surfaces session create-file failures', async () => {
    const writeSessionFile = vi.fn(async () => ({ success: false, error: 'exists' }))
    const api = { writeSessionFile } as unknown as ApiClient

    await expect(createFile(api, 'machine-1', 'session-1', '/repo', 'a.ts')).rejects.toThrow('exists')
  })
})
