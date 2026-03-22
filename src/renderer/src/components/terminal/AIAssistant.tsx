import { useState, useEffect, useCallback, useRef } from 'react'
import { Bot, Send, X, ArrowRight, Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { getFallbackSuggestions } from '@renderer/lib/command-suggestions'

interface AIAssistantProps {
  open: boolean
  onClose: () => void
  onInsertCommand: (command: string) => void
  connectionContext?: string | null
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  commands?: string[]
}

function extractCommands(text: string): string[] {
  const backtickMatches = text.match(/`([^`]+)`/g)
  if (backtickMatches) {
    return backtickMatches.map((m) => m.slice(1, -1)).filter((c) => c.length > 2)
  }
  return []
}

export function AIAssistant({
  open,
  onClose,
  onInsertCommand,
  connectionContext
}: AIAssistantProps): JSX.Element | null {
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState('')
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    window.bifrost?.ai?.checkAvailable().then(setOllamaAvailable).catch(() => setOllamaAvailable(false))
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const handleSubmit = useCallback(async () => {
    const trimmed = query.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setQuery('')
    setLoading(true)
    setStreaming('')

    if (ollamaAvailable && window.bifrost?.ai) {
      let removeChunkListener: (() => void) | null = null
      let accumulated = ''

      try {
        removeChunkListener = window.bifrost.ai.onChunk((text, done) => {
          accumulated += text
          setStreaming(accumulated)
          if (done) {
            const commands = extractCommands(accumulated)
            setMessages((prev) => [...prev, { role: 'assistant', content: accumulated, commands }])
            setStreaming('')
            setLoading(false)
          }
        })

        await window.bifrost.ai.generate(trimmed, connectionContext ?? undefined)
      } catch {
        // If streaming didn't complete, use accumulated
        if (accumulated) {
          const commands = extractCommands(accumulated)
          setMessages((prev) => [...prev, { role: 'assistant', content: accumulated, commands }])
        } else {
          useFallback(trimmed)
        }
        setStreaming('')
        setLoading(false)
      } finally {
        removeChunkListener?.()
      }
    } else {
      useFallback(trimmed)
      setLoading(false)
    }
  }, [query, loading, ollamaAvailable, connectionContext])

  const useFallback = (prompt: string): void => {
    const suggestions = getFallbackSuggestions(prompt)
    if (suggestions.length > 0) {
      const content = suggestions
        .map((s) => `\`${s.command}\` - ${s.description}`)
        .join('\n\n')
      const commands = suggestions.map((s) => s.command)
      setMessages((prev) => [...prev, { role: 'assistant', content, commands }])
    } else {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'No suggestions found for that query. Try being more specific.' }
      ])
    }
  }

  if (!open) return null

  return (
    <div className="flex flex-col h-full surface-1" role="complementary" aria-label="AI Assistant">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 surface-2">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-[#6bd5ff]" />
          <span className="text-xs font-semibold text-[var(--on-surface)] uppercase tracking-wider">
            AI Assistant
          </span>
          {ollamaAvailable === false && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-[var(--radius)] bg-[var(--warning)]/15 text-[var(--warning)]">
              Offline Mode
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50"
          aria-label="Close AI assistant"
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="text-xs text-[var(--on-surface-variant)] text-center py-8">
            Ask a question like &quot;How do I find large files?&quot;
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            onInsertCommand={onInsertCommand}
          />
        ))}
        {streaming && (
          <div className="rounded-[var(--radius)] bg-[var(--surface-container-high)] p-3">
            <p className="text-xs text-[var(--on-surface)] whitespace-pre-wrap font-[family-name:var(--font-mono)] leading-relaxed">
              {streaming}
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 surface-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            placeholder="What command do I need to..."
            className={cn(
              'flex-1 bg-[var(--surface-container-highest)] rounded-[var(--radius)] px-3 py-2',
              'text-xs text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/50',
              'outline-none ghost-border focus:border-[#6bd5ff]/30'
            )}
            disabled={loading}
            aria-label="Ask AI assistant"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !query.trim()}
            className="p-2 rounded-[var(--radius)] text-[#6bd5ff] hover:bg-[var(--surface-container-highest)]/50 disabled:opacity-40"
            aria-label="Send question"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  onInsertCommand
}: {
  message: Message
  onInsertCommand: (cmd: string) => void
}): JSX.Element {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="rounded-[var(--radius)] bg-[#6bd5ff]/10 px-3 py-2 max-w-[85%]">
          <p className="text-xs text-[var(--on-surface)]">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius)] bg-[var(--surface-container-high)] p-3">
      <p className="text-xs text-[var(--on-surface)] whitespace-pre-wrap font-[family-name:var(--font-mono)] leading-relaxed">
        {message.content}
      </p>
      {message.commands && message.commands.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {message.commands.map((cmd, i) => (
            <button
              key={i}
              onClick={() => onInsertCommand(cmd)}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius)] text-left',
                'bg-[var(--surface-container-highest)] hover:bg-[var(--surface-bright)]/20 transition-colors'
              )}
              aria-label={`Insert command: ${cmd}`}
            >
              <ArrowRight size={10} className="text-[var(--success)] shrink-0" />
              <span className="text-[11px] font-[family-name:var(--font-mono)] text-[var(--on-surface)] truncate">
                {cmd}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
