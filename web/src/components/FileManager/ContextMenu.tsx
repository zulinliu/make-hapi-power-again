import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from '@/lib/use-translation'

export interface ContextMenuItem {
  label: string
  icon?: 'file' | 'folder' | 'rename' | 'copyPath' | 'move' | 'copy' | 'download' | 'delete'
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

function MenuIcon({ icon, danger }: { icon: ContextMenuItem['icon']; danger?: boolean }) {
  if (!icon) return null
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const color = danger ? 'var(--hp-danger)' : 'var(--hp-text-secondary)'
  return (
    <span style={{ width: 18, height: 18, display: 'grid', placeItems: 'center', color, flexShrink: 0 }}>
      <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...common}>
        {icon === 'file' && <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>}
        {icon === 'folder' && <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />}
        {icon === 'rename' && <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>}
        {icon === 'copyPath' && <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>}
        {icon === 'move' && <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 10v6" /><path d="m9 13 3-3 3 3" /></>}
        {icon === 'copy' && <><path d="M8 7h9a2 2 0 0 1 2 2v9" /><rect x="5" y="4" width="11" height="11" rx="2" /></>}
        {icon === 'download' && <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>}
        {icon === 'delete' && <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5" /><path d="M14 11v5" /></>}
      </svg>
    </span>
  )
}

export function ContextMenu({ state, onClose }: ContextMenuProps) {
  const { t } = useTranslation()
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
      aria-label={t('fm.contextMenu.label')}
      tabIndex={-1}
      className="fm-context-menu"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 'var(--hp-z-dropdown, 50)',
        minWidth: 180,
        maxWidth: 260,
        background: 'var(--hp-surface-0)',
        border: '1px solid var(--hp-border)',
        borderRadius: 'var(--hp-radius-md)',
        boxShadow: 'var(--hp-shadow-lg)',
        padding: 'var(--hp-space-1) 0',
        animation: reducedMotion ? 'none' : 'fm-menu-in var(--hp-duration-fast) var(--hp-ease-overlay)',
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
          className="fm-context-menu-item"
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
            transition: 'background var(--hp-duration-fast) var(--hp-ease-out), color var(--hp-duration-fast) var(--hp-ease-out)',
            outline: 'none',
          }}
          onFocus={(e) => { if (!item.disabled) e.currentTarget.style.background = 'var(--hp-surface-1)' }}
          onBlur={(e) => { e.currentTarget.style.background = 'none' }}
          onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = 'var(--hp-surface-1)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
        >
          <MenuIcon icon={item.icon} danger={item.danger} />
          <span style={{ flex: 1 }}>{item.label}</span>
        </button>
      ))}
    </div>
  )
}
