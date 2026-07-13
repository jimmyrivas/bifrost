import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { AppToastDetail } from '@renderer/lib/protocol-dispatch'

interface ToastEntry extends AppToastDetail {
  id: number
}

let toastCounter = 0
const AUTO_DISMISS_MS = 8000

/**
 * Global toast host (#2.2). Listens for `app:toast` CustomEvents on `document`
 * and renders stacked, auto-dismissing toasts bottom-right. Used for launcher
 * availability errors (missing xfreerdp/lftp/aws) with an install hint.
 *
 * Styling mirrors ActivityCenter's inline toast (Spectral Command: tonal
 * surfaces, no 1px borders, --radius rounding).
 */
export function ToastHost(): React.JSX.Element | null {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const onToast = (e: Event): void => {
      const detail = (e as CustomEvent<AppToastDetail>).detail
      if (!detail?.message) return
      const entry: ToastEntry = { id: ++toastCounter, ...detail }
      setToasts((prev) => [...prev.slice(-3), entry])
      timers.push(
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== entry.id))
        }, AUTO_DISMISS_MS)
      )
    }
    document.addEventListener('app:toast', onToast)
    return () => {
      document.removeEventListener('app:toast', onToast)
      timers.forEach(clearTimeout)
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-12 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="p-3 rounded-[var(--radius)] bg-[var(--surface-bright)] text-xs text-[var(--on-surface)] shadow-lg backdrop-blur-[12px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <p className={toast.variant === 'error' ? 'text-[#ff6b6b] flex-1' : 'flex-1'}>
              {toast.message}
            </p>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-[#c7c4d7]/60 hover:text-[#c7c4d7] shrink-0"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
          {toast.hint && (
            <p className="font-mono text-[10px] text-[#c7c4d7]/70 mt-1">{toast.hint}</p>
          )}
        </div>
      ))}
    </div>
  )
}
