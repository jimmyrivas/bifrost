import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Radio, Monitor } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { highlightPccInput } from '@renderer/lib/pcc-highlight'

type SendMode = 'all' | 'cluster'

const PCC_STORAGE_KEY = 'bifrost:pcc-input'

interface PCCBarProps {
  active: boolean
  onToggle: (active: boolean) => void
  onSend: (text: string, mode: SendMode) => void
}

export function PCCBar({ active, onToggle, onSend }: PCCBarProps): JSX.Element {
  const { t } = useTranslation()
  const [text, setText] = useState(() => {
    // #70: Restore saved content
    try {
      return localStorage.getItem(PCC_STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [mode, setMode] = useState<SendMode>('all')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // #70: Auto-save to localStorage (debounced 1s)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(PCC_STORAGE_KEY, text)
      } catch {
        // Storage full or unavailable
      }
    }, 1000)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [text])

  // #71: Compute highlighted overlay content
  const highlightedHtml = useMemo(() => highlightPccInput(text), [text])

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed, mode)
    setText('')
    textareaRef.current?.focus()
  }, [text, mode, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 transition-colors',
        active ? 'bg-[#ffa36b]/5' : 'bg-[var(--surface-container-low)]'
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

      {/* Command input with syntax highlighting (#69, #71) */}
      <div className="relative flex-1 min-h-[4.5rem] max-h-24">
        <div
          className={cn(
            'absolute inset-0 rounded-[var(--radius)] px-3 py-2 overflow-hidden pointer-events-none',
            'text-xs whitespace-pre-wrap break-words leading-relaxed',
            'font-[family-name:var(--font-mono)]',
            !active && 'opacity-40'
          )}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlightedHtml + '\n' }}
        />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            active
              ? t('pcc.placeholder', 'Type command to broadcast... (Ctrl+Enter to send)')
              : t('pcc.disabled', 'Enable PCC to broadcast')
          }
          disabled={!active}
          rows={3}
          className={cn(
            'relative w-full h-full min-h-[4.5rem] max-h-24 rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-3 py-2',
            'text-xs text-transparent caret-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/40',
            'ghost-border focus-visible:outline-none resize-none',
            'font-[family-name:var(--font-mono)] leading-relaxed',
            !active && 'opacity-40 cursor-not-allowed'
          )}
          aria-label={t('pcc.input', 'Broadcast command')}
        />
      </div>

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
