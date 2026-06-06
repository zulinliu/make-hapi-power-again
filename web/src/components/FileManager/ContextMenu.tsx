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

const DIVIDER = Symbol('divider')
type MenuEntry = ContextMenuItem | typeof DIVIDER

function isDivider(entry: MenuEntry): entry is typeof DIVIDER {
  return entry === DIVIDER
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

  useEffect(() => {
    if (!state.visible) return

    const el = menuRef.current
    if (!el) return

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

  useEffect(() => {
    if (!state.visible) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [state.visible, onClose])

  if (!state.visible) return null

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Context menu"
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
        animation: 'fm-menu-in 0.12s ease-out',
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
          }}
          onMouseEnter={(e) => {
            if (!item.disabled) e.currentTarget.style.background = 'var(--hp-surface-1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none'
          }}
        >
          {item.icon && (
            <span style={{ width: 18, textAlign: 'center', fontSize: 14, flexShrink: 0 }} aria-hidden="true">
              {item.icon}
            </span>
          )}
          <span style={{ flex: 1 }}>{item.label}</span>
        </button>
      ))}

      <style>{`
        @keyframes fm-menu-in {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
