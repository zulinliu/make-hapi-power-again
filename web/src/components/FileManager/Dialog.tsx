import { useEffect, useRef } from 'react'

interface DialogProps {
  title: string
  children: React.ReactNode
  onClose: () => void
  onSubmit?: () => void
  submitLabel?: string
  submitDanger?: boolean
  loading?: boolean
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function Dialog({ title, children, onClose, onSubmit, submitLabel, submitDanger, loading }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)

  // Restore focus on unmount
  useEffect(() => {
    prevFocusRef.current = document.activeElement as HTMLElement
    return () => { prevFocusRef.current?.focus() }
  }, [])

  // Focus trap + Escape
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const focusable = el.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Auto-focus first input or confirm button
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const firstInput = el.querySelector<HTMLInputElement>('input')
    if (firstInput) { firstInput.focus(); firstInput.select() }
    else {
      const confirmBtn = el.querySelector<HTMLButtonElement>('[data-submit]')
      confirmBtn?.focus()
    }
  }, [])

  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--hp-z-modal-backdrop, 40)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'oklch(0 0 0 / 0.5)',
        animation: reducedMotion ? 'none' : 'fm-dialog-backdrop-in 0.15s ease-out',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-label={title}
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--hp-surface-0)',
          border: '1px solid var(--hp-border)',
          borderRadius: 14,
          boxShadow: '0 16px 50px oklch(0 0 0 / 0.3)',
          animation: reducedMotion ? 'none' : 'fm-dialog-in 0.2s ease-out',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px 0', fontSize: 15, fontWeight: 600, color: 'var(--hp-text-primary)' }}>
          {title}
        </div>
        <div style={{ padding: '12px 20px 16px' }}>
          {children}
        </div>
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '12px 20px',
          borderTop: '1px solid var(--hp-border)',
          background: 'var(--hp-surface-1)',
          justifyContent: 'flex-end',
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 8,
              border: '1px solid var(--hp-border)',
              background: 'var(--hp-surface-0)',
              color: 'var(--hp-text-primary)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          {onSubmit && (
            <button
              type="button"
              data-submit
              onClick={onSubmit}
              disabled={loading}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                border: 'none',
                background: submitDanger ? 'var(--hp-danger)' : 'var(--hp-primary)',
                color: 'oklch(100% 0 0)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '…' : submitLabel ?? 'Confirm'}
            </button>
          )}
        </div>
      </div>

      {!reducedMotion && <style>{`
        @keyframes fm-dialog-backdrop-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fm-dialog-in { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
      `}</style>}
    </div>
  )
}

interface InputFieldProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  onKeyDown?: (e: React.KeyboardEvent) => void
}

export function InputField({ value, onChange, placeholder, autoFocus, onKeyDown }: InputFieldProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
      style={{
        width: '100%',
        padding: '10px 12px',
        fontSize: 14,
        fontFamily: 'var(--hp-font-mono, ui-monospace, monospace)',
        border: '1px solid var(--hp-border)',
        borderRadius: 8,
        background: 'var(--hp-surface-0)',
        color: 'var(--hp-text-primary)',
        outline: 'none',
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--hp-primary)' }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--hp-border)' }}
    />
  )
}

interface ConfirmMessageProps {
  message: string
}

export function ConfirmMessage({ message }: ConfirmMessageProps) {
  return (
    <div style={{ fontSize: 13, color: 'var(--hp-text-secondary)', lineHeight: 1.5 }}>
      {message}
    </div>
  )
}
