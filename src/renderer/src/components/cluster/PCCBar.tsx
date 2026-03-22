import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Radio, Monitor } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'

type SendMode = 'all' | 'cluster'

interface PCCBarProps {
  active: boolean
  onToggle: (active: boolean) => void
  onSend: (text: string, mode: SendMode) => void
}

export function PCCBar({ active, onToggle, onSend }: PCCBarProps): JSX.Element {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<SendMode>('all')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed, mode)
    setText('')
    inputRef.current?.focus()
  }, [text, mode, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const toggleMode = useCallback(() => {
    setMode((prev) => prev === 'all' ? 'cluster' : 'all')
  }, [])

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 border-t transition-colors',
        active
          ? 'bg-zinc-800/80 border-blue-600/50'
          : 'bg-zinc-900/50 border-zinc-800'
      )}
      role="toolbar"
      aria-label={t('pcc.title', 'Power Cluster Controller')}
    >
      <button
        type="button"
        onClick={() => onToggle(!active)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors shrink-0',
          active
            ? 'bg-blue-600/20 text-blue-400 border border-blue-600/40'
            : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300'
        )}
        aria-pressed={active}
        aria-label={t('pcc.toggle', 'Toggle PCC')}
      >
        <Radio className={cn('h-3 w-3', active && 'animate-pulse')} />
        PCC
      </button>

      {active && (
        <div
          className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0"
          role="status"
          aria-label={t('pcc.active', 'PCC active')}
        />
      )}

      <Input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          active
            ? t('pcc.placeholder', 'Type command to broadcast...')
            : t('pcc.disabled', 'Enable PCC to broadcast')
        }
        disabled={!active}
        className="flex-1 h-8 text-xs font-mono"
        aria-label={t('pcc.input', 'Broadcast command')}
      />

      <button
        type="button"
        onClick={toggleMode}
        disabled={!active}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors shrink-0 border',
          !active && 'opacity-50 cursor-not-allowed',
          mode === 'all'
            ? 'border-amber-600/40 text-amber-400 bg-amber-950/20'
            : 'border-cyan-600/40 text-cyan-400 bg-cyan-950/20'
        )}
        aria-label={mode === 'all'
          ? t('pcc.sendAll', 'Sending to all terminals')
          : t('pcc.sendCluster', 'Sending to cluster only')
        }
      >
        <Monitor className="h-3 w-3" />
        {mode === 'all'
          ? t('pcc.all', 'All')
          : t('pcc.cluster', 'Cluster')
        }
      </button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleSend}
        disabled={!active || !text.trim()}
        className="shrink-0 h-8"
        aria-label={t('pcc.send', 'Send')}
      >
        <Send className="h-3 w-3" />
        {t('pcc.send', 'Send')}
      </Button>
    </div>
  )
}
