import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { useSessionDirectory } from '@/hooks/queries/useSessionDirectory'
import { formatDirectoryError } from '@/lib/files-i18n'

interface InputDialogProps {
    isOpen: boolean
    onClose: () => void
    title: string
    placeholder: string
    initialValue?: string
    onSubmit: (value: string) => Promise<void>
    submitLabel: string
}

export function FileInputDialog({
    isOpen,
    onClose,
    title,
    placeholder,
    initialValue = '',
    onSubmit,
    submitLabel,
}: InputDialogProps) {
    const { t } = useTranslation()
    const [value, setValue] = useState(initialValue)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue)
            setSubmitting(false)
            setError('')
        }
    }, [isOpen, initialValue])

    async function handleSubmit() {
        if (!value.trim()) return
        setSubmitting(true)
        setError('')
        try {
            await onSubmit(value.trim())
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && !submitting && onClose()}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={placeholder}
                        disabled={submitting}
                        autoFocus
                        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2"
                        style={{
                            borderColor: 'var(--hp-border)',
                            color: 'var(--hp-text-primary)',
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && value.trim() && !submitting) {
                                handleSubmit()
                            }
                        }}
                    />
                    {error && (
                        <p className="text-sm" style={{ color: 'var(--hp-danger)' }}>{error}</p>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose} disabled={submitting}>
                            {t('button.cancel')}
                        </Button>
                        <Button onClick={handleSubmit} disabled={!value.trim() || submitting}>
                            {submitLabel}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

interface MoveDialogProps {
    isOpen: boolean
    onClose: () => void
    sessionId: string
    sourcePath: string
    mode: 'move' | 'copy'
    onSubmit: (destinationPath: string) => Promise<void>
}

function PickerChevronIcon(props: { collapsed: boolean }) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform duration-150 ${props.collapsed ? '' : 'rotate-90'}`}>
            <polyline points="9 18 15 12 9 6" />
        </svg>
    )
}

function PickerFolderIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            className="text-[var(--app-link)] shrink-0">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
    )
}

function DirectoryPickerNode(props: {
    api: Parameters<typeof useSessionDirectory>[0]
    sessionId: string
    path: string
    label: string
    depth: number
    selectedPath: string
    onSelect: (path: string) => void
    expanded: Set<string>
    onToggle: (path: string) => void
}) {
    const { t } = useTranslation()
    const isExpanded = props.expanded.has(props.path)
    const isSelected = props.selectedPath === props.path
    const { entries, error, isLoading } = useSessionDirectory(props.api, props.sessionId, props.path, {
        enabled: isExpanded
    })

    const directories = useMemo(() => entries.filter((entry) => entry.type === 'directory'), [entries])
    const childDepth = props.depth + 1
    const indent = 8 + props.depth * 16

    return (
        <div>
            <div
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                    isSelected
                        ? 'bg-[var(--app-subtle-bg)] text-[var(--app-fg)]'
                        : 'hover:bg-[var(--app-subtle-bg)] text-[var(--app-fg)]'
                }`}
                style={{ paddingLeft: indent }}
                onClick={() => props.onSelect(props.path)}
            >
                <span
                    className="shrink-0 cursor-pointer p-0.5 rounded hover:bg-[var(--app-subtle-bg)]"
                    onClick={(e) => { e.stopPropagation(); props.onToggle(props.path) }}
                >
                    <PickerChevronIcon collapsed={!isExpanded} />
                </span>
                <PickerFolderIcon />
                <span className="truncate">{props.label}</span>
            </div>

            {isExpanded ? (
                isLoading ? (
                    <div className="px-2 py-3" style={{ paddingLeft: 8 + childDepth * 16 }}>
                        <div className="h-3 w-32 rounded bg-[var(--app-subtle-bg)] animate-pulse" />
                    </div>
                ) : error ? (
                    <div className="px-2 py-1.5 text-xs text-amber-500" style={{ paddingLeft: 8 + childDepth * 16 }}>
                        {formatDirectoryError(error, t)}
                    </div>
                ) : (
                    directories.map((entry) => {
                        const childPath = props.path ? `${props.path}/${entry.name}` : entry.name
                        return (
                            <DirectoryPickerNode
                                key={childPath}
                                api={props.api}
                                sessionId={props.sessionId}
                                path={childPath}
                                label={entry.name}
                                depth={childDepth}
                                selectedPath={props.selectedPath}
                                onSelect={props.onSelect}
                                expanded={props.expanded}
                                onToggle={props.onToggle}
                            />
                        )
                    })
                )
            ) : null}
        </div>
    )
}

export function FileMoveDialog({
    isOpen,
    onClose,
    sessionId,
    sourcePath,
    mode,
    onSubmit,
}: MoveDialogProps) {
    const { api } = useAppContext()
    const { t } = useTranslation()
    const sourceFileName = sourcePath.split('/').pop() || sourcePath
    const [selectedDir, setSelectedDir] = useState('')
    const [destPath, setDestPath] = useState('')
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['']))
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (isOpen) {
            setSelectedDir('')
            setDestPath(sourcePath)
            setExpanded(new Set(['']))
            setSubmitting(false)
            setError('')
        }
    }, [isOpen, sourcePath])

    const handleSelectDir = useCallback((path: string) => {
        setSelectedDir(path)
        const newPath = path ? `${path}/${sourceFileName}` : sourceFileName
        setDestPath(newPath)
    }, [sourceFileName])

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

    async function handleSubmit() {
        if (!destPath.trim() || !api) return
        setSubmitting(true)
        setError('')
        try {
            await onSubmit(destPath.trim())
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && !submitting && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{mode === 'move' ? t('file.move.title') : t('file.copy.title')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="text-xs" style={{ color: 'var(--hp-text-tertiary)' }}>
                        {t('file.move.source')}: <span className="font-mono">{sourcePath}</span>
                    </div>

                    <div className="text-xs font-medium" style={{ color: 'var(--hp-text-tertiary)' }}>
                        {t('file.move.selectDestination')}
                    </div>

                    <div className="max-h-56 overflow-y-auto rounded-md border p-1.5"
                        style={{ borderColor: 'var(--app-border)' }}>
                        <DirectoryPickerNode
                            api={api}
                            sessionId={sessionId}
                            path=""
                            label={t('file.move.rootLabel')}
                            depth={0}
                            selectedPath={selectedDir}
                            onSelect={handleSelectDir}
                            expanded={expanded}
                            onToggle={handleToggle}
                        />
                    </div>

                    {selectedDir !== '' && (
                        <div className="text-xs" style={{ color: 'var(--hp-text-tertiary)' }}>
                            {t('file.move.selectedPath')}: <span className="font-mono">{selectedDir}</span>
                        </div>
                    )}

                    <input
                        type="text"
                        value={destPath}
                        onChange={(e) => setDestPath(e.target.value)}
                        placeholder={t('file.move.destinationPlaceholder')}
                        disabled={submitting}
                        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2"
                        style={{
                            borderColor: 'var(--hp-border)',
                            color: 'var(--hp-text-primary)',
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && destPath.trim() && !submitting) {
                                handleSubmit()
                            }
                        }}
                    />
                    <div className="text-xs" style={{ color: 'var(--hp-text-tertiary)' }}>
                        {t('file.move.pathHint')}
                    </div>
                    {error && (
                        <p className="text-sm" style={{ color: 'var(--hp-danger)' }}>{error}</p>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose} disabled={submitting}>
                            {t('button.cancel')}
                        </Button>
                        <Button onClick={handleSubmit} disabled={!destPath.trim() || submitting}>
                            {mode === 'move' ? t('file.move.submit') : t('file.copy.submit')}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
