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

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 transition-colors',
        active
          ? 'bg-[#ffa36b]/5'
          : 'bg-[var(--surface-container-low)]'
      )}
      role="toolbar"
      aria-label={t('pcc.title', 'Power Cluster Controller')}
    >
      {/* PCC Toggle */}
      <button
        type="button"
        onClick={() => onToggle(!active)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius)] text-[10px] font-semibold uppercase tracking-wider transition-colors shrink-0',
          active
            ? 'bg-[#ffa36b]/15 text-[#ffa36b]'
            : 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
        )}
        aria-pressed={active}
        aria-label={t('pcc.toggle', 'Toggle PCC')}
      >
        <Radio className={cn('h-3 w-3', active && 'animate-pulse')} />
        PCC BROADCAST
      </button>

      {/* Status indicators */}
      {active && (
        <div className="flex items-center gap-1 shrink-0">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-6 rounded-full bg-[#ffa36b]/60"
              style={{ opacity: 0.4 + i * 0.3 }}
              role="presentation"
            />
          ))}
        </div>
      )}

      {/* Command input */}
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
        className="flex-1 h-8 text-xs"
        aria-label={t('pcc.input', 'Broadcast command')}
      />

      {/* Mode toggle */}
      <button
        type="button"
        onClick={() => setMode((prev) => prev === 'all' ? 'cluster' : 'all')}
        disabled={!active}
        className={cn(
          'flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius)] text-[10px] font-semibold uppercase tracking-wider transition-colors shrink-0',
          !active && 'opacity-40 cursor-not-allowed',
          mode === 'all'
            ? 'bg-[#ffa36b]/15 text-[#ffa36b]'
            : 'bg-[#6bd5ff]/15 text-[#6bd5ff]'
        )}
        aria-label={mode === 'all'
          ? t('pcc.sendAll', 'Sending to all terminals')
          : t('pcc.sendCluster', 'Sending to cluster only')
        }
      >
        <Monitor className="h-3 w-3" />
        {mode === 'all' ? t('pcc.all', 'ALL') : t('pcc.cluster', 'CLUSTER')}
      </button>

      {/* Send */}
      <Button
        variant="spectral"
        size="sm"
        onClick={handleSend}
        disabled={!active || !text.trim()}
        className="shrink-0 h-8"
        aria-label={t('pcc.send', 'Send')}
      >
        <Send className="h-3 w-3" />
        {t('pcc.send', 'SEND')}
      </Button>
    </div>
  )
}
