import { memo, ReactNode } from 'react'

interface FloatingOverlayProps {
    children: ReactNode
    maxHeight?: number
}

/**
 * A floating panel container with shadow and rounded corners
 * Used for autocomplete suggestions and settings panels
 */
export const FloatingOverlay = memo(function FloatingOverlay(props: FloatingOverlayProps) {
    const { children, maxHeight = 240 } = props

    return (
        <div
            className="overflow-hidden rounded-(--hp-radius-md) border border-(--hp-border) bg-(--hp-surface-0) shadow-(--hp-shadow-lg)"
            style={{ maxHeight }}
        >
            <div className="overflow-y-auto" style={{ maxHeight }}>
                {children}
            </div>
        </div>
    )
})
