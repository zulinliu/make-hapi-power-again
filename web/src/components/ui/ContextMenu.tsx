import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'

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
    const [focusedIndex, setFocusedIndex] = useState(-1)
    const enabledIndices = useMemo(() => items.reduce<number[]>((acc, item, i) => {
        if (!item.disabled) acc.push(i)
        return acc
    }, []), [items])

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

    // Auto-focus first enabled item on mount
    useEffect(() => {
        if (enabledIndices.length > 0) {
            setFocusedIndex(enabledIndices[0])
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (focusedIndex < 0) return
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
        items?.[focusedIndex]?.focus()
    }, [focusedIndex])

    const handleClickOutside = useCallback((e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
            onClose()
        }
    }, [onClose])

    useEffect(() => {
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('touchstart', handleClickOutside as unknown as EventListener)
        }, 100)
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
                return
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                const currentPos = enabledIndices.indexOf(focusedIndex)
                const nextPos = currentPos < enabledIndices.length - 1 ? currentPos + 1 : 0
                setFocusedIndex(enabledIndices[nextPos])
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                const currentPos = enabledIndices.indexOf(focusedIndex)
                const prevPos = currentPos > 0 ? currentPos - 1 : enabledIndices.length - 1
                setFocusedIndex(enabledIndices[prevPos])
                return
            }
            if (e.key === 'Home') {
                e.preventDefault()
                setFocusedIndex(enabledIndices[0])
                return
            }
            if (e.key === 'End') {
                e.preventDefault()
                setFocusedIndex(enabledIndices[enabledIndices.length - 1])
                return
            }
            if (e.key === 'Tab') {
                e.preventDefault()
                onClose()
                return
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            clearTimeout(timer)
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside as unknown as EventListener)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [handleClickOutside, onClose, focusedIndex, enabledIndices])

    return (
        <div
            ref={menuRef}
            role="menu"
            aria-label="Context menu"
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
                        <div role="separator" className="my-1 mx-2" style={{ height: 1, background: 'var(--hp-divider)' }} />
                    )}
                    <button
                        type="button"
                        role="menuitem"
                        tabIndex={focusedIndex === index ? 0 : -1}
                        disabled={item.disabled}
                        aria-disabled={item.disabled || undefined}
                        className="flex w-full items-center gap-2 px-3 text-sm text-left transition-colors disabled:opacity-50 sm:py-2 py-3"
                        style={{
                            color: item.danger ? 'var(--hp-danger)' : 'var(--app-fg)',
                            minHeight: 44,
                            background: focusedIndex === index && !item.disabled ? 'var(--hp-surface-1)' : 'transparent',
                        }}
                        onClick={() => {
                            item.onClick()
                            onClose()
                        }}
                        onMouseEnter={() => {
                            if (!item.disabled) setFocusedIndex(index)
                        }}
                        onMouseLeave={() => {
                            setFocusedIndex(-1)
                        }}
                    >
                        {item.icon && <span className="w-4 text-center" aria-hidden="true">{item.icon}</span>}
                        <span>{item.label}</span>
                    </button>
                </React.Fragment>
            ))}
        </div>
    )
}
