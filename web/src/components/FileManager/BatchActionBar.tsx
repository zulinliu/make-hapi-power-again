import { useEffect, useRef } from 'react'

export interface BatchActionBarProps {
  selectedCount: number
  onDelete: () => void
  onMove: () => void
  onCopy: () => void
  onStartSession: () => void
}

export function BatchActionBar({
  selectedCount,
  onDelete,
  onMove,
  onCopy,
  onStartSession,
}: BatchActionBarProps) {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    el.style.transform = 'translateY(100%)'
    const raf = requestAnimationFrame(() => {
      el.style.transform = 'translateY(0)'
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      ref={barRef}
      className="hidden md:flex"
      style={{
        position: 'relative',
        zIndex: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 40,
        padding: '0 12px',
        background: 'var(--hp-surface-1)',
        borderTop: '1px solid var(--hp-border)',
        transform: 'translateY(100%)',
        transition: 'transform 200ms ease-out',
        flexShrink: 0,
      }}
    >
      {/* Left: CTA */}
      <button
        type="button"
        onClick={onStartSession}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          height: 32,
          padding: '0 14px',
          borderRadius: 8,
          border: 'none',
          background: 'var(--hp-primary)',
          color: 'oklch(100% 0 0)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
      >
        启动会话
      </button>

      {/* Right: count + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 22,
            minWidth: 22,
            padding: '0 6px',
            borderRadius: 11,
            background: 'var(--hp-primary-subtle)',
            color: 'var(--hp-primary)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {selectedCount}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ActionBtn label="Move" onClick={onMove} />
          <ActionBtn label="Copy" onClick={onCopy} />
          <ActionBtn label="Delete" onClick={onDelete} danger />
        </div>
      </div>
    </div>
  )
}

function ActionBtn({
  label,
  onClick,
  danger,
}: {
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 32,
        padding: '0 12px',
        borderRadius: 8,
        border: '1px solid var(--hp-border)',
        background: 'transparent',
        color: danger ? 'var(--hp-danger)' : 'var(--hp-text-secondary)',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--hp-surface-2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {label}
    </button>
  )
}
