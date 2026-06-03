import { useId, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import type { Session } from '@/types/api'
import type { ApiClient } from '@/api/client'
import { isTelegramApp } from '@/hooks/useTelegram'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'
import { SessionActionMenu } from '@/components/SessionActionMenu'
import { RenameSessionDialog } from '@/components/RenameSessionDialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { getSessionModelLabel } from '@/lib/sessionModelLabel'
import { useTranslation } from '@/lib/use-translation'
import { AgentFlavorIcon } from '@/components/AgentFlavorIcon'

function getSessionTitle(session: Session): string {
    if (session.metadata?.name) {
        return session.metadata.name
    }
    if (session.metadata?.summary?.text) {
        return session.metadata.summary.text
    }
    if (session.metadata?.path) {
        const parts = session.metadata.path.split('/').filter(Boolean)
        return parts.length > 0 ? parts[parts.length - 1] : session.id.slice(0, 8)
    }
    return session.id.slice(0, 8)
}

function FilesIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
        </svg>
    )
}

function OutlineIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <path d="M8 6h13" />
            <path d="M8 12h13" />
            <path d="M8 18h13" />
            <path d="M3 6h.01" />
            <path d="M3 12h.01" />
            <path d="M3 18h.01" />
        </svg>
    )
}

function MoreVerticalIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={props.className}
        >
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
        </svg>
    )
}

export function SessionHeader(props: {
    session: Session
    onBack: () => void
    api: ApiClient | null
    sessionId: string
    isSubPage: boolean
    onSessionDeleted?: () => void
    onToggleOutline?: () => void
}) {
    const { t } = useTranslation()
    const { session, api, onSessionDeleted } = props
    const title = useMemo(() => getSessionTitle(session), [session])
    const worktreeBranch = session.metadata?.worktree?.branch
    const modelLabel = getSessionModelLabel(session)
    const navigate = useNavigate()
    const pathname = useLocation().pathname
    const basePath = `/sessions/${props.sessionId}`

    const [menuOpen, setMenuOpen] = useState(false)
    const [menuAnchorPoint, setMenuAnchorPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
    const menuId = useId()
    const menuAnchorRef = useRef<HTMLButtonElement | null>(null)
    const [renameOpen, setRenameOpen] = useState(false)
    const [archiveOpen, setArchiveOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    const { archiveSession, renameSession, deleteSession, isPending } = useSessionActions(
        api,
        session.id,
        session.metadata?.flavor ?? null
    )

    const handleDelete = async () => {
        await deleteSession()
        onSessionDeleted?.()
    }

    const handleMenuToggle = () => {
        if (!menuOpen && menuAnchorRef.current) {
            const rect = menuAnchorRef.current.getBoundingClientRect()
            setMenuAnchorPoint({ x: rect.right, y: rect.bottom })
        }
        setMenuOpen((open) => !open)
    }

    // Route-aware active state detection
    const isFilesActive = pathname.includes('/files') || pathname.includes('/file')
    const isGitActive = pathname.includes('/git')
    const isExtensionsActive = pathname.includes('/extensions')

    // Toggle navigation: active icon -> chat, inactive icon -> that tool
    const handleFilesClick = () => {
        if (isFilesActive) {
            navigate({ to: basePath })
        } else {
            navigate({ to: `${basePath}/files` })
        }
    }
    const handleGitClick = () => {
        if (isGitActive) {
            navigate({ to: basePath })
        } else {
            navigate({ to: `${basePath}/git` })
        }
    }
    const handleExtensionsClick = () => {
        if (isExtensionsActive) {
            navigate({ to: basePath })
        } else {
            navigate({ to: `${basePath}/extensions` })
        }
    }

    // Mobile menu navigation callbacks
    const handleMenuGit = () => { setMenuOpen(false); navigate({ to: `${basePath}/git` }) }
    const handleMenuExtensions = () => { setMenuOpen(false); navigate({ to: `${basePath}/extensions` }) }
    const handleMenuOutline = () => { setMenuOpen(false); props.onToggleOutline?.() }

    const iconBtnClass = 'flex h-10 w-10 items-center justify-center rounded-full transition-colors sm:h-8 sm:w-8'

    // In Telegram, don't render header (Telegram provides its own)
    if (isTelegramApp()) {
        return null
    }

    return (
        <>
            <div className={`bg-[var(--app-bg)] pt-[env(safe-area-inset-top)] ${props.isSubPage ? 'border-b border-[var(--app-border)]' : ''}`}>
                <div className="mx-auto w-full max-w-content flex items-center gap-2 p-3">
                    {/* Back button */}
                    <button
                        type="button"
                        onClick={props.onBack}
                        className={`${iconBtnClass} text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </button>

                    {/* Session info */}
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold leading-tight sm:text-base">
                            {title}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] leading-tight text-[var(--app-hint)] sm:text-xs sm:gap-3">
                            <span className="inline-flex shrink-0 items-center gap-1">
                                <AgentFlavorIcon flavor={session.metadata?.flavor} className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                <span className="max-w-[4rem] truncate">{session.metadata?.flavor?.trim() || 'unknown'}</span>
                            </span>
                            {modelLabel ? (
                                <span className="truncate">
                                    {t(modelLabel.key)}: {modelLabel.value}
                                </span>
                            ) : null}
                            {worktreeBranch ? (
                                <span className="hidden truncate sm:inline-flex">
                                    {worktreeBranch}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    {/* Files icon — always visible */}
                    <button
                        type="button"
                        onClick={handleFilesClick}
                        className={`${iconBtnClass} ${isFilesActive ? 'text-[var(--app-link)]' : 'text-[var(--app-hint)]'} hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]`}
                        title={t('session.title')}
                    >
                        <FilesIcon />
                    </button>

                    {/* Git icon — desktop only */}
                    <button
                        type="button"
                        onClick={handleGitClick}
                        className={`${iconBtnClass} ${isGitActive ? 'text-[var(--app-link)]' : 'text-[var(--app-hint)]'} hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)] hidden lg:flex`}
                        title="Git"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><path d="M6 9v12" />
                        </svg>
                    </button>

                    {/* Extensions icon — desktop only */}
                    <button
                        type="button"
                        onClick={handleExtensionsClick}
                        className={`${iconBtnClass} ${isExtensionsActive ? 'text-[var(--app-link)]' : 'text-[var(--app-hint)]'} hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)] hidden lg:flex`}
                        title={t('session.extensions') ?? 'Extensions'}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        </svg>
                    </button>

                    {/* Outline icon — desktop only, overlay toggle */}
                    {props.onToggleOutline ? (
                        <button
                            type="button"
                            onClick={props.onToggleOutline}
                            className={`${iconBtnClass} text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)] hidden lg:flex`}
                            title={t('session.outline.open')}
                            aria-label={t('session.outline.open')}
                        >
                            <OutlineIcon />
                        </button>
                    ) : null}

                    {/* More menu — always visible */}
                    <button
                        type="button"
                        onClick={handleMenuToggle}
                        onPointerDown={(e) => e.stopPropagation()}
                        ref={menuAnchorRef}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        aria-controls={menuOpen ? menuId : undefined}
                        className={`${iconBtnClass} text-[var(--app-hint)] hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]`}
                        title={t('session.more')}
                    >
                        <MoreVerticalIcon />
                    </button>
                </div>
            </div>

            <SessionActionMenu
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                sessionActive={session.active}
                onRename={() => { setMenuOpen(false); setRenameOpen(true) }}
                onArchive={() => { setMenuOpen(false); setArchiveOpen(true) }}
                onDelete={() => { setMenuOpen(false); setDeleteOpen(true) }}
                onViewGit={handleMenuGit}
                onViewExtensions={handleMenuExtensions}
                onOpenOutline={handleMenuOutline}
                anchorPoint={menuAnchorPoint}
                menuId={menuId}
            />

            <RenameSessionDialog
                isOpen={renameOpen}
                onClose={() => setRenameOpen(false)}
                currentName={title}
                onRename={renameSession}
                isPending={isPending}
            />

            <ConfirmDialog
                isOpen={archiveOpen}
                onClose={() => setArchiveOpen(false)}
                title={t('dialog.archive.title')}
                description={t('dialog.archive.description', { name: title })}
                confirmLabel={t('dialog.archive.confirm')}
                confirmingLabel={t('dialog.archive.confirming')}
                onConfirm={archiveSession}
                isPending={isPending}
                destructive
            />

            <ConfirmDialog
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                title={t('dialog.delete.title')}
                description={t('dialog.delete.description', { name: title })}
                confirmLabel={t('dialog.delete.confirm')}
                confirmingLabel={t('dialog.delete.confirming')}
                onConfirm={handleDelete}
                isPending={isPending}
                destructive
            />
        </>
    )
}
