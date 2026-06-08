import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { GitPortal } from '@/components/GitPortal/GitPortal'
import { useAppContext } from '@/lib/app-context'
import { encodeBase64 } from '@/lib/utils'
import { useSession } from '@/hooks/queries/useSession'

interface GitCloneDialogProps {
    isOpen: boolean
    onClose: () => void
    sessionId: string
    onCloneComplete?: () => void
}

export function GitCloneDialog({ isOpen, onClose, sessionId, onCloneComplete }: GitCloneDialogProps) {
    const { api } = useAppContext()
    const navigate = useNavigate()
    const { session } = useSession(api, sessionId)

    const handleCloneComplete = useCallback(() => {
        onCloneComplete?.()
    }, [onCloneComplete])

    const handleOpenDirectory = useCallback((path: string) => {
        onClose()
        navigate({
            to: '/sessions/$sessionId/files',
            params: { sessionId },
            search: { tab: 'directories', path: encodeBase64(path) }
        })
    }, [navigate, onClose, sessionId])

    const handleStartSession = useCallback((path: string) => {
        onClose()
        navigate({
            to: '/sessions/new',
            search: {
                directory: path,
                ...(session?.metadata?.machineId ? { machineId: session.metadata.machineId } : {}),
                returnTo: `/sessions/${encodeURIComponent(sessionId)}/files?tab=directories&path=${encodeURIComponent(encodeBase64(path))}`
            }
        })
    }, [navigate, onClose, session?.metadata?.machineId, sessionId])

    return (
        <GitPortal
            isOpen={isOpen}
            onClose={onClose}
            api={api ?? null}
            machineId={null}
            sessionId={sessionId}
            currentPath={session?.metadata?.path ?? ''}
            onCloneComplete={handleCloneComplete}
            onOpenDirectory={handleOpenDirectory}
            onStartSession={handleStartSession}
        />
    )
}
