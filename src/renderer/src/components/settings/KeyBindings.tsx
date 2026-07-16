import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, Keyboard, AlertTriangle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

interface KeyBinding {
  action: string
  label: string
  keys: string
  category: string
}

const defaultBindings: KeyBinding[] = [
  // Tab Management
  { action: 'newTab', label: 'New Tab', keys: 'Ctrl+T', category: 'Tabs' },
  { action: 'closeTab', label: 'Close Tab', keys: 'Ctrl+W', category: 'Tabs' },
  { action: 'nextTab', label: 'Next Tab', keys: 'Ctrl+Tab', category: 'Tabs' },
  { action: 'prevTab', label: 'Previous Tab', keys: 'Ctrl+Shift+Tab', category: 'Tabs' },
  // Pane Management
  { action: 'splitH', label: 'Split Horizontal', keys: 'Ctrl+Shift+H', category: 'Panes' },
  { action: 'splitV', label: 'Split Vertical', keys: 'Ctrl+\\', category: 'Panes' },
  { action: 'closePane', label: 'Close Pane', keys: 'Ctrl+Shift+W', category: 'Panes' },
  { action: 'maxPane', label: 'Maximize Pane', keys: 'Ctrl+Shift+M', category: 'Panes' },
  // Terminal
  { action: 'copy', label: 'Copy', keys: 'Ctrl+Shift+C', category: 'Terminal' },
  { action: 'paste', label: 'Paste', keys: 'Ctrl+Shift+V', category: 'Terminal' },
  { action: 'find', label: 'Find', keys: 'Ctrl+Shift+F', category: 'Terminal' },
  { action: 'zoomIn', label: 'Zoom In', keys: 'Ctrl+=', category: 'Terminal' },
  { action: 'zoomOut', label: 'Zoom Out', keys: 'Ctrl+-', category: 'Terminal' },
  { action: 'resetZoom', label: 'Reset Zoom', keys: 'Ctrl+0', category: 'Terminal' },
  // Session
  { action: 'disconnect', label: 'Disconnect', keys: 'Ctrl+Shift+D', category: 'Session' },
  { action: 'toggleBroadcast', label: 'Toggle Broadcast', keys: 'Ctrl+Shift+B', category: 'Session' },
  { action: 'aiAssistant', label: 'AI Assistant', keys: 'Ctrl+Shift+A', category: 'Session' },
  // Navigation
  { action: 'cmdPalette', label: 'Command Palette', keys: 'Ctrl+K', category: 'Navigation' },
  { action: 'fullscreen', label: 'Fullscreen', keys: 'F11', category: 'Navigation' },
]

const STORAGE_KEY = 'bifrost:keybindings'

function loadBindings(): KeyBinding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as KeyBinding[]
      if (saved.length > 0) return saved
    }
  } catch { /* ignore */ }
  return defaultBindings.map((b) => ({ ...b }))
}

function saveBindings(bindings: KeyBinding[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings))
}

const headerCell = 'px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] text-left'
const bodyCell = 'px-4 py-2.5 text-sm'

function formatKeyEvent(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Super')
  const key = e.key
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    if (key === ' ') parts.push('Space')
    else if (key === '\\') parts.push('\\')
    else if (key.length === 1) parts.push(key.toUpperCase())
    else parts.push(key)
  }
  return parts.join('+')
}

interface KeyBindingsProps {
  bindings?: KeyBinding[]
  onChange?: (bindings: KeyBinding[]) => void
}

export function KeyBindings({ bindings: externalBindings, onChange }: KeyBindingsProps): JSX.Element {
  const { t } = useTranslation()
  const [bindings, setBindings] = useState<KeyBinding[]>(externalBindings ?? loadBindings())
  const [recordingAction, setRecordingAction] = useState<string | null>(null)
  const recordingRef = useRef<string | null>(null)

  const updateBindings = useCallback((next: KeyBinding[]) => {
    setBindings(next)
    saveBindings(next)
    onChange?.(next)
  }, [onChange])

  const startRecording = useCallback((action: string) => {
    setRecordingAction(action)
    recordingRef.current = action
  }, [])

  const cancelRecording = useCallback(() => {
    setRecordingAction(null)
    recordingRef.current = null
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!recordingRef.current) return
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') { cancelRecording(); return }
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return
      const combo = formatKeyEvent(e)
      if (!combo) return
      const action = recordingRef.current
      updateBindings(bindings.map((b) => b.action === action ? { ...b, keys: combo } : b))
      setRecordingAction(null)
      recordingRef.current = null
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [bindings, cancelRecording, updateBindings])

  const resetDefaults = useCallback(() => {
    updateBindings(defaultBindings.map((b) => ({ ...b })))
    cancelRecording()
  }, [updateBindings, cancelRecording])

  // Detect conflicts (same key combo on multiple actions)
  const comboCounts = new Map<string, number>()
  for (const b of bindings) {
    comboCounts.set(b.keys, (comboCounts.get(b.keys) ?? 0) + 1)
  }

  // Group by category
  const categories = [...new Set(bindings.map((b) => b.category))]

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="rounded-[var(--radius)] bg-[var(--warning)]/10 p-2.5">
        <p className="text-[11px] text-[var(--warning)]">
          Heads up: custom remapping isn&apos;t applied yet — the app still uses the built-in shortcuts
          below. This is a reference of the current bindings; saving a new combo does not change behavior.
        </p>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--on-surface)] flex items-center gap-2">
          <Keyboard className="h-4 w-4" />
          {t('keybindings.title', 'Key Bindings')}
        </h3>
        <Button variant="outline" size="sm" onClick={resetDefaults}>
          <RotateCcw className="h-3 w-3" /> {t('keybindings.reset', 'RESET DEFAULTS')}
        </Button>
      </div>

      <p className="text-xs text-[var(--on-surface-variant)]">
        Click a key combination to record a new binding. Press Escape to cancel.
      </p>

      <div className="text-[9px] text-[#c7c4d7]/40 px-1">
        <strong>Note:</strong> Shell shortcuts (Ctrl+R history search, Ctrl+D EOF, Ctrl+L clear) pass directly to the terminal and are not configurable here.
      </div>

      {categories.map((category) => (
        <div key={category}>
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#c7c4d7]/40 px-4 pb-1 pt-2">
            {category}
          </div>
          <div className="rounded-[var(--radius)] overflow-hidden">
            {bindings
              .filter((b) => b.category === category)
              .map((binding, idx) => {
                const isRecording = recordingAction === binding.action
                const hasConflict = (comboCounts.get(binding.keys) ?? 0) > 1
                return (
                  <div
                    key={binding.action}
                    className={cn(
                      'flex items-center transition-colors',
                      idx % 2 === 0 ? 'bg-[var(--surface-container-low)]' : 'bg-[var(--surface)]',
                      'hover:bg-[var(--surface-container-high)]/50'
                    )}
                  >
                    <div className={cn(bodyCell, 'flex-1 text-[var(--on-surface-variant)] text-xs')}>
                      {binding.label}
                    </div>
                    <div className={cn(bodyCell, 'w-64 flex items-center gap-2')}>
                      <button
                        type="button"
                        onClick={() => isRecording ? cancelRecording() : startRecording(binding.action)}
                        className={cn(
                          'inline-flex items-center gap-1 px-3 py-1 rounded-[var(--radius)] text-xs transition-colors font-[family-name:var(--font-mono)]',
                          isRecording
                            ? 'bg-[#6b6bff]/15 text-[#6b6bff] animate-pulse'
                            : hasConflict
                              ? 'bg-[var(--warning)]/10 text-[var(--warning)] hover:bg-[var(--warning)]/20'
                              : 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]'
                        )}
                      >
                        {isRecording ? 'Press key combination...' : binding.keys}
                      </button>
                      {hasConflict && !isRecording && (
                        <AlertTriangle size={12} className="text-[var(--warning)]" title="Conflict: same binding used by another action" />
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
