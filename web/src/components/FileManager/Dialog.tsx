import { useEffect, useId, useRef } from 'react'
import { useTranslation } from '@/lib/use-translation'

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
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

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
      className="fm-dialog-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--hp-z-modal-backdrop, 40)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--app-overlay-bg, oklch(0 0 0 / 0.5))',
        animation: reducedMotion ? 'none' : 'fm-dialog-backdrop-in 0.15s ease-out',
        padding: 'max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px))',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        className="fm-dialog-panel"
        aria-labelledby={titleId}
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--hp-surface-0)',
          border: '1px solid var(--hp-border)',
          borderRadius: 'var(--hp-radius-lg)',
          boxShadow: 'var(--hp-shadow-xl)',
          animation: reducedMotion ? 'none' : 'fm-dialog-in 0.2s ease-out',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div id={titleId} style={{ padding: '18px 20px 0', fontSize: 15, fontWeight: 650, color: 'var(--hp-text-primary)' }}>
          {title}
        </div>
        <div style={{ padding: '12px 20px 18px' }}>
          {children}
        </div>
        <div className="fm-dialog-footer" style={{
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
            className="fm-dialog-button"
            style={{
              minHeight: 44,
              padding: '0 16px',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 'var(--hp-radius-md)',
              border: '1px solid var(--hp-border)',
              background: 'var(--hp-surface-0)',
              color: 'var(--hp-text-primary)',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {t('fm.dialog.cancel')}
          </button>
          {onSubmit && (
            <button
              type="button"
              data-submit
              onClick={onSubmit}
              disabled={loading}
              className="fm-dialog-button"
              style={{
                minHeight: 44,
                padding: '0 16px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 'var(--hp-radius-md)',
                border: 'none',
                background: submitDanger ? 'var(--hp-danger)' : 'var(--hp-primary)',
                color: 'var(--hp-text-inverse)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '…' : submitLabel ?? t('fm.dialog.confirm')}
            </button>
          )}
        </div>
      </div>
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
        borderRadius: 'var(--hp-radius-md)',
        background: 'var(--hp-surface-0)',
        color: 'var(--hp-text-primary)',
        outline: 'none',
      }}
      className="fm-dialog-input"
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
    <div style={{ fontSize: 13, color: 'var(--hp-text-secondary)', lineHeight: 1.55, overflowWrap: 'anywhere' }}>
      {message}
    </div>
  )
}
