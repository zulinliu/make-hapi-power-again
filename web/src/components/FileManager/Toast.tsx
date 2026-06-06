import { useEffect, useState, useCallback, useRef } from 'react'

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
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    listeners.add(setItems)
    return () => { listeners.delete(setItems) }
  }, [])

  if (items.length === 0) return null

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
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
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            color: 'oklch(100% 0 0)',
            background: t.type === 'error' ? 'var(--hp-danger)' : 'oklch(55% 0.16 55)',
            boxShadow: '0 4px 16px oklch(0 0 0 / 0.2)',
            animation: 'fm-toast-in 0.2s ease-out',
            whiteSpace: 'nowrap',
          }}
        >
          {t.message}
        </div>
      ))}
      <style>{`
        @keyframes fm-toast-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}
