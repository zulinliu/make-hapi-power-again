import React, { useEffect, useRef, useState, useCallback } from 'react'

export interface ContextMenuItem {
    label: string
    icon?: string
    danger?: boolean
    disabled?: boolean
    dividerBefore?: boolean
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
        const safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)') || '0') || 0
        const safeBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)') || '0') || 0
        const pad = 8

        let adjustedX = x
        let adjustedY = y
        if (x + rect.width > vw - pad) adjustedX = vw - rect.width - pad
        if (y + rect.height > vh - safeBottom - pad) adjustedY = vh - rect.height - safeBottom - pad
        if (adjustedX < pad) adjustedX = pad
        if (adjustedY < safeTop + pad) adjustedY = safeTop + pad
        setPosition({ x: adjustedX, y: adjustedY })
    }, [x, y])

    const handleClickOutside = useCallback((e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
            onClose()
        }
    }, [onClose])

    useEffect(() => {
        // Delay binding to avoid immediate dismissal when triggered by touch
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('touchstart', handleClickOutside as unknown as EventListener)
        }, 100)
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleEsc)
        return () => {
            clearTimeout(timer)
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside as unknown as EventListener)
            document.removeEventListener('keydown', handleEsc)
        }
    }, [handleClickOutside, onClose])

    return (
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[180px] py-1 animate-fade-in-up"
            style={{
                left: position.x,
                top: position.y,
                background: 'var(--app-bg)',
                border: '1px solid var(--app-border)',
                borderRadius: 'var(--hp-radius-md)',
                boxShadow: 'var(--hp-shadow-md)',
            }}
        >
            {items.map((item, index) => (
                <React.Fragment key={index}>
                    {item.dividerBefore && (
                        <div className="my-1 mx-2" style={{ height: 1, background: 'var(--hp-divider)' }} />
                    )}
                    <button
                        type="button"
                        disabled={item.disabled}
                        className="flex w-full items-center gap-2 px-3 text-sm text-left transition-colors disabled:opacity-50 sm:py-2 py-3"
                        style={{
                            color: item.danger ? 'var(--hp-danger)' : 'var(--app-fg)',
                            minHeight: 36,
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
                </React.Fragment>
            ))}
        </div>
    )
}
