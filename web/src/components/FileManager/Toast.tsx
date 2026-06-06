import { useEffect, useState } from 'react'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

let nextId = 0
const listeners = new Set<(toasts: Toast[]) => void>()
let toasts: Toast[] = []

function emit(toast: Omit<Toast, 'id'>) {
  const t: Toast = { ...toast, id: nextId++ }
  toasts = [...toasts, t]
  listeners.forEach((l) => l(toasts))
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    listeners.forEach((l) => l(toasts))
  }, 2500)
}

export function showToast(message: string, type: 'success' | 'error' = 'success') {
  emit({ message, type })
}

export function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => {
    listeners.add(setItems)
    return () => { listeners.delete(setItems) }
  }, [])

  if (items.length === 0) return null

  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
        left: 'max(12px, env(safe-area-inset-left, 0px))',
        right: 'max(12px, env(safe-area-inset-right, 0px))',
        zIndex: 'var(--hp-z-toast, 60)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className="fm-toast"
          style={{
            width: 'fit-content',
            maxWidth: 'min(520px, 100%)',
            margin: '0 auto',
            padding: '10px 16px',
            borderRadius: 'var(--hp-radius-md)',
            fontSize: 13,
            fontWeight: 500,
            color: t.type === 'error' ? 'var(--hp-danger)' : 'var(--hp-text-primary)',
            background: 'var(--hp-surface-0)',
            border: `1px solid ${t.type === 'error' ? 'var(--hp-danger)' : 'var(--hp-border)'}`,
            boxShadow: 'var(--hp-shadow-md)',
            animation: reducedMotion ? 'none' : 'fm-toast-in 0.2s ease-out',
            overflowWrap: 'anywhere',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
