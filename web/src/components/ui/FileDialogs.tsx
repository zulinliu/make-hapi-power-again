import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'

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
    const [destPath, setDestPath] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (isOpen) {
            const fileName = sourcePath.split('/').pop() || ''
            setDestPath(fileName)
            setSubmitting(false)
            setError('')
        }
    }, [isOpen, sourcePath])

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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{mode === 'move' ? t('file.move.title') : t('file.copy.title')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="text-xs" style={{ color: 'var(--hp-text-tertiary)' }}>
                        {t('file.move.source')}: <span className="font-mono">{sourcePath}</span>
                    </div>
                    <input
                        type="text"
                        value={destPath}
                        onChange={(e) => setDestPath(e.target.value)}
                        placeholder={t('file.move.destinationPlaceholder')}
                        disabled={submitting}
                        autoFocus
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
