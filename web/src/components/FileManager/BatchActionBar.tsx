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
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    if (reducedMotion) { el.style.transform = 'translateY(0)'; return }
    el.style.transform = 'translateY(100%)'
    const raf = requestAnimationFrame(() => {
      el.style.transform = 'translateY(0)'
    })
    return () => cancelAnimationFrame(raf)
  }, [reducedMotion])

  return (
    <div
      ref={barRef}
      className="hidden md:flex"
      role="status"
      aria-live="polite"
      aria-label={`${selectedCount} items selected`}
      style={{
        position: 'relative',
        zIndex: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 48,
        padding: '0 var(--hp-space-4)',
        background: 'var(--hp-surface-0)',
        borderTop: '1px solid var(--hp-border)',
        transform: 'translateY(100%)',
        boxShadow: 'var(--hp-shadow-xs)',
        transition: 'transform var(--hp-duration-normal) var(--hp-ease-overlay)',
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
          minHeight: 40,
          padding: '0 var(--hp-space-4)',
          borderRadius: 'var(--hp-radius-md)',
          border: 'none',
          background: 'var(--hp-primary)',
          color: 'var(--hp-primary-text)',
          fontSize: 13,
          fontWeight: 650,
          cursor: 'pointer',
          transition: 'background var(--hp-duration-fast) var(--hp-ease-out), transform var(--hp-duration-instant) var(--hp-ease-out)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hp-primary-hover)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--hp-primary)' }}
      >
        Start session
      </button>

      {/* Right: count + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 24,
            minWidth: 24,
            padding: '0 7px',
            borderRadius: 'var(--hp-radius-full)',
            background: 'var(--hp-primary-subtle)',
            color: 'var(--hp-primary)',
            fontSize: 12,
            fontWeight: 650,
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
        minHeight: 40,
        padding: '0 12px',
        borderRadius: 'var(--hp-radius-md)',
        border: '1px solid var(--hp-border)',
        background: 'transparent',
        color: danger ? 'var(--hp-danger)' : 'var(--hp-text-secondary)',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background var(--hp-duration-fast) var(--hp-ease-out), border-color var(--hp-duration-fast) var(--hp-ease-out), color var(--hp-duration-fast) var(--hp-ease-out)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? 'var(--hp-danger-subtle)' : 'var(--hp-surface-2)'
        e.currentTarget.style.borderColor = danger ? 'var(--hp-danger)' : 'var(--hp-border-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'var(--hp-border)'
      }}
    >
      {label}
    </button>
  )
}
