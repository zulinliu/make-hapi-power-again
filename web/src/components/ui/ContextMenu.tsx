import { useEffect, useRef, useState, useCallback } from 'react'

export interface ContextMenuItem {
    label: string
    icon?: string
    danger?: boolean
    disabled?: boolean
    onClick: () => void
}

interface ContextMenuProps {
    x: number
    y: number
    items: ContextMenuItem[]
    onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState({ x, y })

    useEffect(() => {
        if (!menuRef.current) return
        const rect = menuRef.current.getBoundingClientRect()
        const vw = window.innerWidth
        const vh = window.innerHeight

        let adjustedX = x
        let adjustedY = y
        if (x + rect.width > vw - 8) adjustedX = vw - rect.width - 8
        if (y + rect.height > vh - 8) adjustedY = vh - rect.height - 8
        if (adjustedX < 8) adjustedX = 8
        if (adjustedY < 8) adjustedY = 8
        setPosition({ x: adjustedX, y: adjustedY })
    }, [x, y])

    const handleClickOutside = useCallback((e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
            onClose()
        }
    }, [onClose])

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('touchstart', handleClickOutside as unknown as EventListener)
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleEsc)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside as unknown as EventListener)
            document.removeEventListener('keydown', handleEsc)
        }
    }, [handleClickOutside, onClose])

    return (
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[180px] rounded-lg border py-1 shadow-lg"
            style={{
                left: position.x,
                top: position.y,
                background: 'var(--hp-surface-0)',
                borderColor: 'var(--hp-border)',
            }}
        >
            {items.map((item, index) => (
                <button
                    key={index}
                    type="button"
                    disabled={item.disabled}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors disabled:opacity-50"
                    style={{
                        color: item.danger ? 'var(--hp-danger)' : 'var(--hp-text-primary)',
                        minHeight: 44,
                    }}
                    onClick={() => {
                        item.onClick()
                        onClose()
                    }}
                    onMouseEnter={(e) => {
                        if (!item.disabled) {
                            e.currentTarget.style.background = 'var(--hp-surface-1)'
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                    }}
                >
                    {item.icon && <span className="w-4 text-center">{item.icon}</span>}
                    <span>{item.label}</span>
                </button>
            ))}
        </div>
    )
}
