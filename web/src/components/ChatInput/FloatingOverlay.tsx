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
            className="overflow-hidden rounded-[var(--hp-radius-md)] border border-[var(--hp-border)] bg-[var(--hp-surface-0)] shadow-[var(--hp-shadow-lg)]"
            style={{ maxHeight }}
        >
            <div className="overflow-y-auto" style={{ maxHeight }}>
                {children}
            </div>
        </div>
    )
})
