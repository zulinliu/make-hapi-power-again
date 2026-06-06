import type { ApiClient } from '@/api/client'
import type { FileEntry, DirectoryListing } from '@/components/FileManager/types'
import type { MachineDirectoryEntry } from '@hapipower/protocol/apiTypes'

function machineEntryToFileEntry(path: string, entry: MachineDirectoryEntry): FileEntry {
  const entryPath = `${path.replace(/\/+$/, '')}/${entry.name}`
  return {
    name: entry.name,
    path: entryPath,
    type: entry.type === 'directory' ? 'directory' : 'file',
    size: entry.size ?? 0,
    modified: entry.modified ? new Date(entry.modified).toISOString() : new Date().toISOString(),
    isGitRepo: entry.isGitRepo,
    isHidden: entry.name.startsWith('.'),
  }
}

export async function listDirectory(
  api: ApiClient,
  machineId: string,
  path: string,
  showHidden: boolean,
): Promise<DirectoryListing> {
  const res = await api.listMachineDirectory(machineId, path, showHidden)
  if (!res.success || !res.entries) {
    throw new Error(res.error ?? 'Failed to list directory')
  }
  const entries = res.entries
    .filter((e) => e.type === 'file' || e.type === 'directory')
    .map((e) => machineEntryToFileEntry(path, e))

  const filtered = showHidden ? entries : entries.filter((e) => !e.isHidden)
  const normalized = path.replace(/\/+$/, '')
  const parentIdx = normalized.lastIndexOf('/')
  const parentPath = parentIdx > 0 ? normalized.slice(0, parentIdx) : null

  return { path: normalized, entries: filtered, parentPath }
}

export async function createFile(
  api: ApiClient,
  _machineId: string,
  sessionId: string,
  dirPath: string,
  name: string,
): Promise<FileEntry> {
  const fullPath = `${dirPath.replace(/\/+$/, '')}/${name}`
  await api.writeSessionFile(sessionId, fullPath, '')
  return {
    name,
    path: fullPath,
    type: 'file',
    size: 0,
    modified: new Date().toISOString(),
    isHidden: name.startsWith('.'),
  }
}

export async function createFolder(
  api: ApiClient,
  _machineId: string,
  sessionId: string,
  dirPath: string,
  name: string,
): Promise<FileEntry> {
  const fullPath = `${dirPath.replace(/\/+$/, '')}/${name}`
  await api.createDirectory(sessionId, fullPath, true)
  return {
    name,
    path: fullPath,
    type: 'directory',
    size: 0,
    modified: new Date().toISOString(),
    isHidden: name.startsWith('.'),
  }
}

export async function deleteEntry(
  api: ApiClient,
  _machineId: string,
  sessionId: string,
  _dirPath: string,
  name: string,
  path: string,
  type: 'file' | 'directory',
): Promise<void> {
  const res = await api.deleteSessionFile(sessionId, path, type === 'directory')
  if (!res.success) throw new Error(res.error ?? `Failed to delete "${name}"`)
}

export async function renameEntry(
  api: ApiClient,
  _machineId: string,
  sessionId: string,
  dirPath: string,
  oldName: string,
  newName: string,
): Promise<FileEntry> {
  const oldPath = `${dirPath.replace(/\/+$/, '')}/${oldName}`
  const newPath = `${dirPath.replace(/\/+$/, '')}/${newName}`
  const res = await api.renameSessionFile(sessionId, oldPath, newPath)
  if (!res.success) throw new Error(res.error ?? `Failed to rename "${oldName}"`)
  return {
    name: newName,
    path: newPath,
    type: 'file',
    size: 0,
    modified: new Date().toISOString(),
    isHidden: newName.startsWith('.'),
  }
}

export function isApiReady(api: ApiClient | null, machineId: string | null): api is ApiClient {
  return api !== null && machineId !== null && machineId !== ''
}
