import { useCallback, useMemo, useRef, useState } from 'react'
import type { ApiClient } from '@/api/client'
import { FileIcon } from '@/components/FileIcon'
import { useSessionDirectory } from '@/hooks/queries/useSessionDirectory'
import { formatDirectoryError } from '@/lib/files-i18n'
import { useTranslation } from '@/lib/use-translation'

function ChevronIcon(props: { className?: string; collapsed: boolean }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`${props.className ?? ''} transition-transform duration-200 ${props.collapsed ? '' : 'rotate-90'}`}>
            <polyline points="9 18 15 12 9 6" />
        </svg>
    )
}

function FolderIcon(props: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            className={props.className}>
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
    )
}

function MoreIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
        </svg>
    )
}

function DirectorySkeleton(props: { depth: number; rows?: number }) {
    const rows = props.rows ?? 4
    const indent = 12 + props.depth * 14
    return (
        <div className="animate-pulse">
            {Array.from({ length: rows }).map((_, index) => (
                <div key={`dir-skel-${props.depth}-${index}`}
                    className="flex items-center gap-3 px-3 py-2"
                    style={{ paddingLeft: indent }}>
                    <div className="h-5 w-5 rounded bg-[--hp-surface-1]" />
                    <div className="h-3 w-40 rounded bg-[--hp-surface-1]" />
                </div>
            ))}
        </div>
    )
}

function DirectoryErrorRow(props: { depth: number; message: string }) {
    const indent = 12 + props.depth * 14
    return (
        <div className="px-3 py-2 text-xs text-[--hp-text-secondary] bg-[--hp-warning-subtle]"
            style={{ paddingLeft: indent }}>
            {props.message}
        </div>
    )
}

interface FileNodeProps {
    filePath: string
    fileName: string
    depth: number
    onOpenFile: (path: string) => void
    onContextMenu: (path: string, type: 'file' | 'directory', point: { x: number; y: number }) => void
}

function FileNode({ filePath, fileName, depth, onOpenFile, onContextMenu }: FileNodeProps) {
    const indent = 12 + depth * 14
    const moreRef = useRef<HTMLButtonElement>(null)

    return (
        <div
            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[--hp-surface-1] transition-colors cursor-pointer"
            style={{ paddingLeft: indent, minHeight: 44 }}
            onClick={() => onOpenFile(filePath)}
        >
            <span className="h-4 w-4 shrink-0" />
            <FileIcon fileName={fileName} size={22} />
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-[--hp-text-primary]">{fileName}</div>
            </div>
            <button
                ref={moreRef}
                type="button"
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-[--hp-text-tertiary] hover:bg-[--hp-surface-1] hover:text-[--hp-text-primary] transition-colors"
                onClick={(e) => {
                    e.stopPropagation()
                    const rect = moreRef.current?.getBoundingClientRect()
                    if (rect) {
                        onContextMenu(filePath, 'file', { x: rect.left, y: rect.bottom + 4 })
                    }
                }}
            >
                <MoreIcon />
            </button>
        </div>
    )
}

function DirectoryNode(props: {
    api: ApiClient | null
    sessionId: string
    path: string
    label: string
    depth: number
    onOpenFile: (path: string) => void
    onContextMenu: (path: string, type: 'file' | 'directory', point: { x: number; y: number }) => void
    expanded: Set<string>
    onToggle: (path: string) => void
}) {
    const { t } = useTranslation()
    const isExpanded = props.expanded.has(props.path)
    const { entries, error, isLoading } = useSessionDirectory(props.api, props.sessionId, props.path, {
        enabled: isExpanded
    })
    const moreRef = useRef<HTMLButtonElement>(null)

    const directories = useMemo(() => entries.filter((entry) => entry.type === 'directory'), [entries])
    const files = useMemo(() => entries.filter((entry) => entry.type === 'file'), [entries])
    const childDepth = props.depth + 1
    const indent = 12 + props.depth * 14
    const childIndent = 12 + childDepth * 14

    return (
        <div>
            <div
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[--hp-surface-1] transition-colors cursor-pointer"
                style={{ paddingLeft: indent, minHeight: 44 }}
                onClick={() => props.onToggle(props.path)}
            >
                <ChevronIcon collapsed={!isExpanded} className="text-[--hp-text-tertiary] shrink-0" />
                <FolderIcon className="text-[--hp-primary] shrink-0" />
                <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-[--hp-text-primary]">{props.label}</div>
                </div>
                <button
                    ref={moreRef}
                    type="button"
                    className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-[--hp-text-tertiary] hover:bg-[--hp-surface-1] hover:text-[--hp-text-primary] transition-colors"
                    onClick={(e) => {
                        e.stopPropagation()
                        const rect = moreRef.current?.getBoundingClientRect()
                        if (rect) {
                            props.onContextMenu(props.path, 'directory', { x: rect.left, y: rect.bottom + 4 })
                        }
                    }}
                >
                    <MoreIcon />
                </button>
            </div>

            {isExpanded ? (
                isLoading ? (
                    <DirectorySkeleton depth={childDepth} />
                ) : error ? (
                    <DirectoryErrorRow depth={childDepth} message={formatDirectoryError(error, t)} />
                ) : (
                    <div>
                        {directories.map((entry) => {
                            const childPath = props.path ? `${props.path}/${entry.name}` : entry.name
                            return (
                                <DirectoryNode
                                    key={childPath}
                                    api={props.api}
                                    sessionId={props.sessionId}
                                    path={childPath}
                                    label={entry.name}
                                    depth={childDepth}
                                    onOpenFile={props.onOpenFile}
                                    onContextMenu={props.onContextMenu}
                                    expanded={props.expanded}
                                    onToggle={props.onToggle}
                                />
                            )
                        })}

                        {files.map((entry) => {
                            const filePath = props.path ? `${props.path}/${entry.name}` : entry.name
                            return (
                                <FileNode
                                    key={filePath}
                                    filePath={filePath}
                                    fileName={entry.name}
                                    depth={childDepth}
                                    onOpenFile={props.onOpenFile}
                                    onContextMenu={props.onContextMenu}
                                />
                            )
                        })}

                        {directories.length === 0 && files.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-[--hp-text-tertiary]"
                                style={{ paddingLeft: childIndent }}>
                                {t('files.directories.empty')}
                            </div>
                        ) : null}
                    </div>
                )
            ) : null}
        </div>
    )
}

export function DirectoryTree(props: {
    api: ApiClient | null
    sessionId: string
    rootLabel: string
    onOpenFile: (path: string) => void
    onContextMenu?: (path: string, type: 'file' | 'directory', point: { x: number; y: number }) => void
}) {
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['']))

    const handleToggle = useCallback((path: string) => {
        setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(path)) {
                next.delete(path)
            } else {
                next.add(path)
            }
            return next
        })
    }, [])

    const handleContextMenu = props.onContextMenu ?? (() => {})

    return (
        <div className="border-t border-[--hp-divider]">
            <DirectoryNode
                api={props.api}
                sessionId={props.sessionId}
                path=""
                label={props.rootLabel}
                depth={0}
                onOpenFile={props.onOpenFile}
                onContextMenu={handleContextMenu}
                expanded={expanded}
                onToggle={handleToggle}
            />
        </div>
    )
}
