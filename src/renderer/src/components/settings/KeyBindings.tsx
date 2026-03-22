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

const headerClass = 'px-4 py-2 text-xs font-medium text-zinc-400 text-left'
const cellClass = 'px-4 py-2.5 text-sm'

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

      if (e.key === 'Escape') {
        cancelRecording()
        return
      }

      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return

      const combo = formatKeyEvent(e)
      if (!combo) return

      const action = recordingRef.current
      updateBindings(
        bindings.map((b) => b.action === action ? { ...b, keys: combo } : b)
      )
      setRecordingAction(null)
      recordingRef.current = null
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [bindings, cancelRecording, updateBindings])

  const resetDefaults = useCallback(() => {
    const reset = defaultBindings.map((b) => ({ ...b }))
    updateBindings(reset)
    cancelRecording()
  }, [updateBindings, cancelRecording])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Keyboard className="h-4 w-4" />
          {t('keybindings.title', 'Key Bindings')}
        </h3>
        <Button variant="outline" size="sm" onClick={resetDefaults}>
          <RotateCcw className="h-3 w-3" /> {t('keybindings.reset', 'Reset to Defaults')}
        </Button>
      </div>

      <p className="text-xs text-zinc-500">
        {t('keybindings.hint', 'Click a key combination to record a new binding. Press Escape to cancel.')}
      </p>

      <div className="border border-zinc-700 rounded-md overflow-hidden">
        <table className="w-full" role="grid" aria-label={t('keybindings.title', 'Key Bindings')}>
          <thead className="bg-zinc-800/50">
            <tr>
              <th className={headerClass}>{t('keybindings.action', 'Action')}</th>
              <th className={cn(headerClass, 'w-60')}>{t('keybindings.keyCombination', 'Key Combination')}</th>
            </tr>
          </thead>
          <tbody>
            {bindings.map((binding) => {
              const isRecording = recordingAction === binding.action

              return (
                <tr key={binding.action} className="border-t border-zinc-700/50 hover:bg-zinc-800/30">
                  <td className={cn(cellClass, 'text-zinc-300')}>
                    {t(`keybindings.actions.${binding.action}`, binding.label)}
                  </td>
                  <td className={cellClass}>
                    <button
                      type="button"
                      onClick={() => isRecording ? cancelRecording() : startRecording(binding.action)}
                      className={cn(
                        'inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-mono transition-colors border',
                        isRecording
                          ? 'border-blue-500 bg-blue-950/30 text-blue-400 animate-pulse'
                          : 'border-zinc-600 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100'
                      )}
                      aria-label={isRecording
                        ? t('keybindings.recording', 'Press key combination...')
                        : t('keybindings.clickToEdit', 'Click to edit {{keys}}', { keys: binding.keys })
                      }
                    >
                      {isRecording
                        ? t('keybindings.recording', 'Press key combination...')
                        : binding.keys
                      }
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
