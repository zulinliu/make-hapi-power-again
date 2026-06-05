import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { useBinaryUpload } from '@/hooks/useBinaryUpload'
import { isImageMimeType } from '@/lib/fileAttachments'

const MAX_IMAGE_BYTES = 50 * 1024 * 1024

interface ImagePasteDropProps {
    sessionId: string
    onImageUploaded: (file: File, path: string) => void
    children: ReactNode
}

export function ImagePasteDrop({ sessionId, onImageUploaded, children }: ImagePasteDropProps) {
    const { uploadBinaryFile } = useBinaryUpload()
    const dragCounterRef = useRef(0)
    const [isDragging, setIsDragging] = useState(false)

    const handleFiles = useCallback(async (files: FileList | File[]) => {
        for (const file of Array.from(files)) {
            if (!isImageMimeType(file.type)) continue
            if (file.size > MAX_IMAGE_BYTES) continue

            const result = await uploadBinaryFile(sessionId, file)
            if (result.success && result.path) {
                onImageUploaded(file, result.path)
            }
        }
    }, [sessionId, uploadBinaryFile, onImageUploaded])

    const handlePaste = useCallback((e: ClipboardEvent) => {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

        const items = e.clipboardData?.items
        if (!items) return

        const imageFiles: File[] = []
        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile()
                if (file) imageFiles.push(file)
            }
        }

        if (imageFiles.length > 0) {
            e.preventDefault()
            handleFiles(imageFiles)
        }
    }, [handleFiles])

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        dragCounterRef.current = 0
        setIsDragging(false)

        const files = e.dataTransfer?.files
        if (files && files.length > 0) {
            handleFiles(files)
        }
    }, [handleFiles])

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
    }, [])

    const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        dragCounterRef.current++
        if (dragCounterRef.current === 1) {
            setIsDragging(true)
        }
    }, [])

    const handleDragLeave = useCallback(() => {
        dragCounterRef.current--
        if (dragCounterRef.current === 0) {
            setIsDragging(false)
        }
    }, [])

    useEffect(() => {
        document.addEventListener('paste', handlePaste)
        return () => document.removeEventListener('paste', handlePaste)
    }, [handlePaste])

    return (
        <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            className="relative flex flex-1 min-h-0"
        >
            {children}
            {isDragging && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--app-bg)]/80 backdrop-blur-sm border-2 border-dashed border-[var(--hp-primary)] rounded-lg">
                    <div className="text-center">
                        <div className="text-3xl mb-2 opacity-50">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-[var(--hp-primary)]"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                        </div>
                        <div className="text-sm text-[var(--hp-primary)] font-medium">松开以上传图片</div>
                    </div>
                </div>
            )}
        </div>
    )
}
