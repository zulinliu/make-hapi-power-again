import type { ApiClient } from '@/api/client'
import type { FileEntry, DirectoryListing } from '@/components/FileManager/types'
import type { MachineDirectoryEntry } from '@hapipower/protocol/apiTypes'

function stripTrailingSlash(path: string): string {
  const normalized = path.replace(/\/+$/, '')
  return normalized || '/'
}

function joinPath(dirPath: string, name: string): string {
  const dir = stripTrailingSlash(dirPath)
  return dir === '/' ? `/${name}` : `${dir}/${name}`
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path
}

function machineEntryToFileEntry(path: string, entry: MachineDirectoryEntry): FileEntry {
  const entryPath = joinPath(path, entry.name)
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
  const normalized = stripTrailingSlash(path)
  const parentIdx = normalized.lastIndexOf('/')
  const parentPath = parentIdx > 0 ? normalized.slice(0, parentIdx) : null

  return { path: normalized, entries: filtered, parentPath }
}

export async function createFile(
  api: ApiClient,
  machineId: string,
  sessionId: string | null,
  dirPath: string,
  name: string,
): Promise<FileEntry> {
  const fullPath = joinPath(dirPath, name)
  if (sessionId) {
    const res = await api.writeSessionFile(sessionId, fullPath, '')
    if (!res.success) throw new Error(res.error ?? `Failed to create "${name}"`)
  } else {
    const res = await api.writeMachineFile(machineId, fullPath, '')
    if (!res.success) throw new Error(res.error ?? `Failed to create "${name}"`)
  }
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
  machineId: string,
  sessionId: string | null,
  dirPath: string,
  name: string,
): Promise<FileEntry> {
  const fullPath = joinPath(dirPath, name)
  const res = sessionId
    ? await api.createDirectory(sessionId, fullPath, true)
    : await api.createMachineDirectory(machineId, fullPath, true)
  if (!res.success) throw new Error(res.error ?? `Failed to create "${name}"`)
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
  machineId: string,
  sessionId: string | null,
  _dirPath: string,
  name: string,
  path: string,
  type: 'file' | 'directory',
): Promise<void> {
  const res = sessionId
    ? await api.deleteSessionFile(sessionId, path, type === 'directory')
    : await api.deleteMachineFile(machineId, path, type === 'directory')
  if (!res.success) throw new Error(res.error ?? `Failed to delete "${name}"`)
}

export async function renameEntry(
  api: ApiClient,
  machineId: string,
  sessionId: string | null,
  dirPath: string,
  oldName: string,
  newName: string,
): Promise<FileEntry> {
  const oldPath = joinPath(dirPath, oldName)
  const newPath = joinPath(dirPath, newName)
  const res = sessionId
    ? await api.renameSessionFile(sessionId, oldPath, newPath)
    : await api.renameMachineFile(machineId, oldPath, newPath)
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

export async function moveEntry(
  api: ApiClient,
  machineId: string,
  sessionId: string | null,
  sourcePath: string,
  destinationDir: string,
): Promise<void> {
  const destinationPath = joinPath(destinationDir, basename(sourcePath))
  const res = sessionId
    ? await api.moveSessionFile(sessionId, sourcePath, destinationPath)
    : await api.moveMachineFile(machineId, sourcePath, destinationPath)
  if (!res.success) throw new Error(res.error ?? `Failed to move "${basename(sourcePath)}"`)
}

export async function copyEntry(
  api: ApiClient,
  machineId: string,
  sessionId: string | null,
  sourcePath: string,
  destinationDir: string,
): Promise<void> {
  const destinationPath = joinPath(destinationDir, basename(sourcePath))
  const res = sessionId
    ? await api.copySessionFile(sessionId, sourcePath, destinationPath)
    : await api.copyMachineFile(machineId, sourcePath, destinationPath)
  if (!res.success) throw new Error(res.error ?? `Failed to copy "${basename(sourcePath)}"`)
}

export function isApiReady(api: ApiClient | null, machineId: string | null): api is ApiClient {
  return api !== null && machineId !== null && machineId !== ''
}
