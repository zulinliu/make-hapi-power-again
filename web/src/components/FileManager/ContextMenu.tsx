import { useState, useEffect, useRef, useCallback } from 'react'

export interface ContextMenuItem {
  label: string
  icon?: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

export interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  items: ContextMenuItem[]
}

export function useContextMenu() {
  const [state, setState] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    items: [],
  })

  const show = useCallback((x: number, y: number, items: ContextMenuItem[]) => {
    setState({ visible: true, x, y, items })
  }, [])

  const hide = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }))
  }, [])

  return { state, show, hide }
}

export interface ContextMenuProps {
  state: ContextMenuState
  onClose: () => void
}

export function ContextMenu({ state, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: state.x, y: state.y })

  const reposition = useCallback(() => {
    const el = menuRef.current
    if (!el || !state.visible) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let x = state.x
    let y = state.y
    if (x + rect.width > vw - 8) x = vw - rect.width - 8
    if (y + rect.height > vh - 8) y = vh - rect.height - 8
    if (x < 8) x = 8
    if (y < 8) y = 8
    setPosition({ x, y })
  }, [state.visible, state.x, state.y])

  useEffect(() => { reposition() }, [reposition])
  useEffect(() => {
    if (!state.visible) return
    window.addEventListener('resize', reposition)
    window.addEventListener('orientationchange', reposition)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('orientationchange', reposition)
    }
  }, [state.visible, reposition])

  // Auto-focus first menuitem + keyboard arrow navigation + Escape/click-outside
  useEffect(() => {
    if (!state.visible) return

    const el = menuRef.current
    if (!el) return

    // Focus first menuitem
    requestAnimationFrame(() => {
      const first = el.querySelector<HTMLElement>('[role="menuitem"]')
      first?.focus()
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }

      const items = el.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')
      if (!items.length) return
      const idx = Array.from(items).findIndex(i => i === document.activeElement)

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        items[(idx + 1) % items.length]?.focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        items[(idx - 1 + items.length) % items.length]?.focus()
      } else if (e.key === 'Home') {
        e.preventDefault()
        items[0]?.focus()
      } else if (e.key === 'End') {
        e.preventDefault()
        items[items.length - 1]?.focus()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (el && !el.contains(e.target as Node)) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [state.visible, onClose])

  if (!state.visible) return null

  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Context menu"
      tabIndex={-1}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 'var(--hp-z-dropdown, 50)',
        minWidth: 180,
        maxWidth: 260,
        background: 'var(--hp-surface-0)',
        border: '1px solid var(--hp-border)',
        borderRadius: 10,
        boxShadow: '0 8px 30px oklch(0 0 0 / 0.25), 0 2px 8px oklch(0 0 0 / 0.12)',
        padding: '4px 0',
        animation: reducedMotion ? 'none' : 'fm-menu-in 0.12s ease-out',
        outline: 'none',
      }}
    >
      {state.items.map((item, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            item.onClick()
            onClose()
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            height: 44,
            padding: '0 14px',
            border: 'none',
            background: 'none',
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            color: item.disabled
              ? 'var(--hp-text-tertiary)'
              : item.danger
                ? 'var(--hp-danger)'
                : 'var(--hp-text-primary)',
            fontSize: 13,
            fontWeight: 500,
            textAlign: 'left',
            opacity: item.disabled ? 0.5 : 1,
            transition: 'background 0.1s',
            outline: 'none',
          }}
          onFocus={(e) => { if (!item.disabled) e.currentTarget.style.background = 'var(--hp-surface-1)' }}
          onBlur={(e) => { e.currentTarget.style.background = 'none' }}
          onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = 'var(--hp-surface-1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
        >
          {item.icon && (
            <span style={{ width: 18, textAlign: 'center', fontSize: 14, flexShrink: 0 }} aria-hidden="true">
              {item.icon}
            </span>
          )}
          <span style={{ flex: 1 }}>{item.label}</span>
        </button>
      ))}

      {!reducedMotion && <style>{`
        @keyframes fm-menu-in {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>}
    </div>
  )
}
