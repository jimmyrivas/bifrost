import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Bot, Send, X, ArrowRight, Loader2, RefreshCw, PanelRightClose, ArrowLeftToLine,
  Copy, ClipboardCopy, Sheet
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { getFallbackSuggestions } from '@renderer/lib/command-suggestions'
import { rawSessionId } from '@renderer/lib/session-summary'
import { markdownToCsv, terminalToCsv } from '@renderer/lib/markdown-clip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'

interface AIAssistantProps {
  open: boolean
  onClose: () => void
  onInsertCommand: (command: string) => void
  connectionContext?: string | null
  /** When provided, show a detach button in the header (docked mode). */
  onDetach?: () => void
  /** When true, this instance is rendered in its own detached window. */
  detached?: boolean
}

/** Max height of the auto-growing prompt editor, in pixels (~6 rows). */
const PROMPT_MAX_HEIGHT_PX = 144

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

// ═══════════════════════════════════════════
// Lightweight Markdown Renderer
// ═══════════════════════════════════════════

interface MdNode {
  type: 'text' | 'code' | 'codeblock' | 'bold' | 'italic' | 'heading' | 'listitem' | 'break'
  content: string
  lang?: string
  level?: number
}

function parseMarkdown(text: string): MdNode[] {
  const nodes: MdNode[] = []
  const lines = text.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code blocks ```lang ... ```
    if (line.trimStart().startsWith('```')) {
      const lang = line.trimStart().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      nodes.push({ type: 'codeblock', content: codeLines.join('\n'), lang: lang || undefined })
      i++ // skip closing ```
      continue
    }

    // Headings (### Header)
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/)
    if (headingMatch) {
      nodes.push({ type: 'heading', content: headingMatch[2], level: headingMatch[1].length })
      i++
      continue
    }

    // List items (- item or * item or 1. item)
    const listMatch = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)/)
    if (listMatch) {
      nodes.push({ type: 'listitem', content: listMatch[1] })
      i++
      continue
    }

    // Empty line → break
    if (line.trim() === '') {
      if (nodes.length > 0 && nodes[nodes.length - 1].type !== 'break') {
        nodes.push({ type: 'break', content: '' })
      }
      i++
      continue
    }

    // Regular text with inline formatting
    nodes.push({ type: 'text', content: line })
    i++
  }

  return nodes
}

/** Render inline markdown: `code`, **bold**, *italic* */
function renderInline(
  text: string,
  onInsertCommand: (cmd: string) => void
): (JSX.Element | string)[] {
  const parts: (JSX.Element | string)[] = []
  // Match inline code, bold, or italic
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('`') && token.endsWith('`')) {
      const code = token.slice(1, -1)
      parts.push(
        <button
          key={`code-${match.index}`}
          onClick={() => onInsertCommand(code)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--surface-container-highest)] hover:bg-[#6bd5ff]/20 text-[#6bd5ff] font-[family-name:var(--font-mono)] text-[11px] transition-colors cursor-pointer"
          title="Click to insert in terminal"
        >
          {code}
        </button>
      )
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`bold-${match.index}`} className="font-semibold text-[var(--on-surface)]">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={`em-${match.index}`} className="italic text-[var(--on-surface-variant)]">
          {token.slice(1, -1)}
        </em>
      )
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

/**
 * Wraps an assistant message with a right-click menu to copy it as plain text,
 * Markdown, or CSV. The message `content` is already Markdown source. Plain
 * Copy and Copy as CSV honor a live selection; Copy as Markdown always copies
 * the message source, because the rendered selection has the Markdown syntax
 * (bold markers, backticks, headings) already stripped and would be
 * indistinguishable from plain text.
 */
function CopyableMessage({
  content,
  children
}: {
  content: string
  children: React.ReactNode
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<string | null>(null)

  const captureSelection = (): void => {
    selectionRef.current = null
    const el = ref.current
    const sel = window.getSelection()
    if (!el || !sel || sel.isCollapsed || sel.rangeCount === 0) return
    if (!el.contains(sel.getRangeAt(0).commonAncestorContainer)) return
    selectionRef.current = sel.toString()
  }

  const write = (text: string): void => {
    if (text.trim()) navigator.clipboard.writeText(text).catch(() => { /* denied */ })
  }

  const copyPlain = (): void => write(selectionRef.current ?? ref.current?.innerText ?? content)
  // Always the source: a rendered selection has the Markdown markup stripped.
  const copyMarkdown = (): void => write(content)
  const copyCsv = (): void => {
    const src = selectionRef.current ?? content
    // markdownToCsv needs a header + separator pair; a selection of bare table
    // rows (`| a | b |` lines) is handled by terminalToCsv, which also covers
    // the whitespace-aligned fallback.
    write(markdownToCsv(src) ?? terminalToCsv(selectionRef.current ?? ref.current?.innerText ?? ''))
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div ref={ref} onContextMenuCapture={captureSelection}>
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[13rem]">
        <ContextMenuLabel>Copy response</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={copyPlain}>
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copy
        </ContextMenuItem>
        <ContextMenuItem onSelect={copyMarkdown}>
          <ClipboardCopy className="mr-2 h-3.5 w-3.5" />
          Copy message as Markdown
        </ContextMenuItem>
        <ContextMenuItem onSelect={copyCsv}>
          <Sheet className="mr-2 h-3.5 w-3.5" />
          Copy as CSV
          <ContextMenuShortcut>tables</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function MarkdownContent({
  content,
  onInsertCommand
}: {
  content: string
  onInsertCommand: (cmd: string) => void
}): JSX.Element {
  const nodes = useMemo(() => parseMarkdown(content), [content])

  return (
    <div className="text-xs text-[var(--on-surface)] leading-relaxed space-y-1.5">
      {nodes.map((node, i) => {
        switch (node.type) {
          case 'codeblock':
            return (
              <div key={i} className="relative group">
                {node.lang && (
                  <span className="text-[9px] text-[var(--on-surface-variant)]/60 uppercase tracking-wider">
                    {node.lang}
                  </span>
                )}
                <pre className="bg-[var(--surface-container-highest)] rounded-[var(--radius)] px-3 py-2 overflow-x-auto font-[family-name:var(--font-mono)] text-[11px] text-[#6bd5ff] leading-relaxed">
                  {node.content}
                </pre>
                <button
                  onClick={() => onInsertCommand(node.content)}
                  className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded bg-[var(--surface-bright)]/60 hover:bg-[#6bd5ff]/20 transition-opacity"
                  title="Insert in terminal"
                  aria-label="Insert code block in terminal"
                >
                  <ArrowRight size={10} className="text-[var(--success)]" />
                </button>
              </div>
            )
          case 'heading':
            return (
              <div
                key={i}
                className={cn(
                  'font-semibold text-[var(--on-surface)]',
                  node.level === 1 && 'text-sm',
                  node.level === 2 && 'text-xs',
                  (node.level ?? 3) >= 3 && 'text-[11px]'
                )}
              >
                {renderInline(node.content, onInsertCommand)}
              </div>
            )
          case 'listitem':
            return (
              <div key={i} className="flex gap-2 pl-1">
                <span className="text-[var(--on-surface-variant)]/50 shrink-0 mt-px">-</span>
                <span>{renderInline(node.content, onInsertCommand)}</span>
              </div>
            )
          case 'break':
            return <div key={i} className="h-1" />
          case 'text':
          default:
            return (
              <p key={i}>{renderInline(node.content, onInsertCommand)}</p>
            )
        }
      })}
    </div>
  )
}

// ═══════════════════════════════════════════
// Context builder — enriches AI prompts
// ═══════════════════════════════════════════

async function buildRichContext(connectionId?: string | null): Promise<string> {
  const parts: string[] = []

  if (!connectionId) {
    parts.push('Local terminal session')
    return parts.join('\n')
  }

  try {
    const conn = await window.bifrost.connections.get(connectionId)
    if (conn) {
      const host = conn.host ?? 'unknown'
      const user = conn.username ?? ''
      const method = conn.method ?? 'ssh'
      const port = conn.port ?? 22
      parts.push(`Connected via ${method.toUpperCase()} to ${user ? user + '@' : ''}${host}:${port}`)
      if (conn.name) parts.push(`Connection name: ${conn.name}`)
    }
  } catch { /* skip */ }

  // Get last lines of terminal output for context
  try {
    const tabs = useSessionsStore.getState().tabs
    const activeTabId = useSessionsStore.getState().activeTabId
    const tab = tabs.find((t) => t.id === activeTabId)
    const termId = rawSessionId(tab?.rootPane?.terminalId)
    if (termId) {
      const buffer = await window.bifrost.terminal.getBuffer(termId)
      if (buffer) {
        // Get last 20 meaningful lines
        const lines = buffer.split('\n').filter((l: string) => l.trim().length > 0)
        const recent = lines.slice(-20).join('\n')
        if (recent.length > 0) {
          parts.push(`\nRecent terminal output:\n${recent.slice(-1200)}`)
        }
      }
    }
  } catch { /* skip */ }

  return parts.join('\n')
}

// ═══════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════

// Import sessions store for context building
import { useSessionsStore } from '@renderer/stores/sessions.store'

export function AIAssistant({
  open,
  onClose,
  onInsertCommand,
  connectionContext,
  onDetach,
  detached = false
}: AIAssistantProps): JSX.Element | null {
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState('')
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    window.bifrost?.ai?.checkAvailable().then(setAiAvailable).catch(() => setAiAvailable(false))
  }, [open])

  // Auto-grow the prompt editor to fit its content, up to a max, then scroll.
  const autoSizePrompt = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, PROMPT_MAX_HEIGHT_PX)}px`
  }, [])

  useEffect(() => {
    autoSizePrompt()
  }, [query, autoSizePrompt])

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

    if (aiAvailable && window.bifrost?.ai) {
      let removeChunkListener: (() => void) | null = null
      let accumulated = ''

      try {
        // Build rich context from connection + terminal
        const richContext = await buildRichContext(connectionContext)

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

        await window.bifrost.ai.generate(trimmed, richContext)
      } catch {
        if (accumulated) {
          const commands = extractCommands(accumulated)
          setMessages((prev) => [...prev, { role: 'assistant', content: accumulated, commands }])
        } else {
          showFallbackSuggestions(trimmed)
        }
        setStreaming('')
        setLoading(false)
      } finally {
        removeChunkListener?.()
      }
    } else {
      showFallbackSuggestions(trimmed)
      setLoading(false)
    }
  }, [query, loading, aiAvailable, connectionContext])

  const showFallbackSuggestions = (prompt: string): void => {
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

  const handleClear = useCallback(() => {
    setMessages([])
    setStreaming('')
  }, [])

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
          {aiAvailable === false && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-[var(--radius)] bg-[var(--warning)]/15 text-[var(--warning)]">
              Offline
            </span>
          )}
          {aiAvailable === true && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-[var(--radius)] bg-[var(--success)]/15 text-[var(--success)]">
              Online
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="p-1 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50"
              aria-label="Clear conversation"
              title="Clear conversation"
            >
              <RefreshCw size={12} />
            </button>
          )}
          {onDetach && !detached && (
            <button
              onClick={onDetach}
              className="p-1 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50"
              aria-label="Detach AI assistant to its own window"
              title="Detach to window"
            >
              <PanelRightClose size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-[var(--radius)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]/50"
            aria-label={detached ? 'Re-attach AI assistant to main window' : 'Close AI assistant'}
            title={detached ? 'Re-attach to main window' : 'Close'}
          >
            {detached ? <ArrowLeftToLine size={14} /> : <X size={14} />}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <div className="text-xs text-[var(--on-surface-variant)] text-center py-8 space-y-2">
            <Bot size={24} className="mx-auto text-[#6bd5ff]/40" />
            <p>Ask about commands, troubleshooting, or DevOps tasks.</p>
            <p className="text-[10px] text-[var(--on-surface-variant)]/50">
              Click any <span className="text-[#6bd5ff]">`command`</span> to insert it in the terminal.
            </p>
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
          <CopyableMessage content={streaming}>
            <div className="rounded-[var(--radius)] bg-[var(--surface-container-high)] p-3">
              <MarkdownContent content={streaming} onInsertCommand={onInsertCommand} />
            </div>
          </CopyableMessage>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 surface-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter submits; Shift+Enter inserts a newline.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            rows={1}
            placeholder="What command do I need to... (Shift+Enter for newline)"
            className={cn(
              'flex-1 resize-none bg-[var(--surface-container-highest)] rounded-[var(--radius)] px-3 py-2',
              'text-xs text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/50 leading-relaxed',
              'outline-none ghost-border focus:border-[#6bd5ff]/30',
              'overflow-y-auto'
            )}
            style={{ maxHeight: PROMPT_MAX_HEIGHT_PX }}
            disabled={loading}
            aria-label="Ask AI assistant"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !query.trim()}
            className="p-2 mb-px rounded-[var(--radius)] text-[#6bd5ff] hover:bg-[var(--surface-container-highest)]/50 disabled:opacity-40"
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
    <CopyableMessage content={message.content}>
      <div className="rounded-[var(--radius)] bg-[var(--surface-container-high)] p-3">
        <MarkdownContent content={message.content} onInsertCommand={onInsertCommand} />
      </div>
    </CopyableMessage>
  )
}
