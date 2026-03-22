import { useState, useCallback } from 'react'
import { Radio, Send } from 'lucide-react'

interface PCCBarProps {
  onBroadcast: (data: string) => void
  active: boolean
  onToggle: () => void
}

export function PCCBar({ onBroadcast, active, onToggle }: PCCBarProps): JSX.Element {
  const [input, setInput] = useState('')

  const handleSend = useCallback(() => {
    if (!input.trim()) return
    onBroadcast(input + '\r')
    setInput('')
  }, [input, onBroadcast])

  if (!active) return <></>

  return (
    <div className="flex items-center gap-2 h-8 px-3 bg-amber-950/30 border-t border-amber-800/50">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 shrink-0"
      >
        <Radio className="w-3.5 h-3.5" />
        PCC
      </button>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSend()
        }}
        placeholder="Type command to broadcast..."
        className="flex-1 bg-zinc-900/50 border border-amber-800/30 rounded px-2 py-0.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-600"
      />
      <button
        onClick={handleSend}
        className="p-1 text-amber-400 hover:text-amber-300"
        title="Send to all terminals"
      >
        <Send className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
