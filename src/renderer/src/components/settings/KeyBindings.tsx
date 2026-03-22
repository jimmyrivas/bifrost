import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, Keyboard } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

interface KeyBinding {
  action: string
  label: string
  keys: string
}

const defaultBindings: KeyBinding[] = [
  { action: 'newTab', label: 'New Tab', keys: 'Ctrl+T' },
  { action: 'closeTab', label: 'Close Tab', keys: 'Ctrl+W' },
  { action: 'nextTab', label: 'Next Tab', keys: 'Ctrl+Tab' },
  { action: 'prevTab', label: 'Previous Tab', keys: 'Ctrl+Shift+Tab' },
  { action: 'splitH', label: 'Split Horizontal', keys: 'Ctrl+Shift+H' },
  { action: 'splitV', label: 'Split Vertical', keys: 'Ctrl+Shift+V' },
  { action: 'closePane', label: 'Close Pane', keys: 'Ctrl+Shift+W' },
  { action: 'copy', label: 'Copy', keys: 'Ctrl+Shift+C' },
  { action: 'paste', label: 'Paste', keys: 'Ctrl+Shift+V' },
  { action: 'find', label: 'Find', keys: 'Ctrl+Shift+F' },
  { action: 'zoomIn', label: 'Zoom In', keys: 'Ctrl+=' },
  { action: 'zoomOut', label: 'Zoom Out', keys: 'Ctrl+-' },
  { action: 'resetZoom', label: 'Reset Zoom', keys: 'Ctrl+0' },
  { action: 'togglePCC', label: 'Toggle PCC', keys: 'Ctrl+Shift+P' },
  { action: 'preferences', label: 'Preferences', keys: 'Ctrl+,' },
  { action: 'quickConnect', label: 'Quick Connect', keys: 'Ctrl+Shift+N' },
]

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
  const [bindings, setBindings] = useState<KeyBinding[]>(externalBindings ?? defaultBindings.map((b) => ({ ...b })))
  const [recordingAction, setRecordingAction] = useState<string | null>(null)
  const recordingRef = useRef<string | null>(null)

  const updateBindings = useCallback((next: KeyBinding[]) => {
    setBindings(next)
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

  return (
    <div className="flex flex-col gap-4 p-4">
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
        {t('keybindings.hint', 'Click a key combination to record a new binding. Press Escape to cancel.')}
      </p>

      <div className="rounded-[var(--radius)] overflow-hidden" role="grid" aria-label={t('keybindings.title', 'Key Bindings')}>
        {/* Header */}
        <div className="surface-2 flex" role="row">
          <div className={cn(headerCell, 'flex-1')} role="columnheader">{t('keybindings.action', 'ACTION')}</div>
          <div className={cn(headerCell, 'w-60')} role="columnheader">{t('keybindings.keyCombination', 'KEY COMBINATION')}</div>
        </div>

        {/* Rows */}
        {bindings.map((binding, idx) => {
          const isRecording = recordingAction === binding.action
          return (
            <div
              key={binding.action} role="row"
              className={cn(
                'flex items-center transition-colors',
                idx % 2 === 0 ? 'bg-[var(--surface-container-low)]' : 'bg-[var(--surface)]',
                'hover:bg-[var(--surface-container-high)]/50'
              )}
            >
              <div className={cn(bodyCell, 'flex-1 text-[var(--on-surface-variant)]')}>
                {t(`keybindings.actions.${binding.action}`, binding.label)}
              </div>
              <div className={cn(bodyCell, 'w-60')}>
                <button
                  type="button"
                  onClick={() => isRecording ? cancelRecording() : startRecording(binding.action)}
                  className={cn(
                    'inline-flex items-center gap-1 px-3 py-1 rounded-[var(--radius)] text-xs transition-colors font-[family-name:var(--font-mono)]',
                    isRecording
                      ? 'bg-[#6b6bff]/15 text-[#6b6bff] animate-pulse'
                      : 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]'
                  )}
                  aria-label={isRecording
                    ? t('keybindings.recording', 'Press key combination...')
                    : t('keybindings.clickToEdit', 'Click to edit {{keys}}', { keys: binding.keys })
                  }
                >
                  {isRecording ? t('keybindings.recording', 'Press key combination...') : binding.keys}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
