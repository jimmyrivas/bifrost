import { useState } from 'react'
import { RotateCcw } from 'lucide-react'

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
  { action: 'toggleSidebar', label: 'Toggle Sidebar', keys: 'Ctrl+B' },
  { action: 'quickConnect', label: 'Quick Connect', keys: 'Ctrl+K' },
  { action: 'settings', label: 'Settings', keys: 'Ctrl+,' },
  { action: 'quakeToggle', label: 'Quake Terminal', keys: 'F12' },
  { action: 'pccToggle', label: 'Toggle PCC', keys: 'Ctrl+Shift+P' },
  { action: 'find', label: 'Find in Terminal', keys: 'Ctrl+F' }
]

export function KeyBindings(): JSX.Element {
  const [bindings, setBindings] = useState<KeyBinding[]>([...defaultBindings])
  const [recording, setRecording] = useState<string | null>(null)

  const handleKeyRecord = (action: string, event: React.KeyboardEvent): void => {
    event.preventDefault()
    const parts: string[] = []
    if (event.ctrlKey) parts.push('Ctrl')
    if (event.shiftKey) parts.push('Shift')
    if (event.altKey) parts.push('Alt')
    if (event.metaKey) parts.push('Meta')

    const key = event.key
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      parts.push(key.length === 1 ? key.toUpperCase() : key)
      setBindings(bindings.map((b) => (b.action === action ? { ...b, keys: parts.join('+') } : b)))
      setRecording(null)
    }
  }

  const resetDefaults = (): void => {
    setBindings([...defaultBindings])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200">Key Bindings</h3>
        <button
          onClick={resetDefaults}
          className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded"
        >
          <RotateCcw className="w-3 h-3" />
          Reset Defaults
        </button>
      </div>

      <div className="border border-zinc-700 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-zinc-800">
            <tr>
              <th className="text-left px-3 py-2 text-zinc-400 font-medium">Action</th>
              <th className="text-left px-3 py-2 text-zinc-400 font-medium">Shortcut</th>
            </tr>
          </thead>
          <tbody>
            {bindings.map((binding) => (
              <tr key={binding.action} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                <td className="px-3 py-1.5 text-zinc-300">{binding.label}</td>
                <td className="px-3 py-1.5">
                  <button
                    onClick={() => setRecording(binding.action)}
                    onKeyDown={(e) => {
                      if (recording === binding.action) {
                        handleKeyRecord(binding.action, e)
                      }
                    }}
                    className={`px-2 py-0.5 rounded font-mono text-xs transition-colors ${
                      recording === binding.action
                        ? 'bg-blue-900/50 border border-blue-500 text-blue-300'
                        : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    {recording === binding.action ? 'Press keys...' : binding.keys}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Click a shortcut to record a new key combination.
      </p>
    </div>
  )
}
