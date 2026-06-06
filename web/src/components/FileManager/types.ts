export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modified: string
  isGitRepo?: boolean
  isHidden?: boolean
  isSymlink?: boolean
  permissions?: string
}

export interface DirectoryListing {
  path: string
  entries: FileEntry[]
  parentPath: string | null
}

export type SortField = 'name' | 'size' | 'modified'
export type SortDirection = 'asc' | 'desc'

export interface SortOption {
  field: SortField
  direction: SortDirection
}

export interface BreadcrumbSegment {
  name: string
  path: string
}

export interface ClipboardItem {
  path: string
  type: 'file' | 'directory'
  operation: 'cut' | 'copy'
}
