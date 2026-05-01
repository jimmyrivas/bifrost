import { useState, useCallback, useEffect, useRef } from 'react'
import { Radio, AlertTriangle, Clock, Bot, X as XIcon, Loader2 } from 'lucide-react'
import { useTerminal } from '@renderer/hooks/useTerminal'
import { useSessionsStore, type TerminalStyle } from '@renderer/stores/sessions.store'
import { TerminalContextMenu } from './TerminalContextMenu'
import { PasteWarning } from './PasteWarning'
import { MultiplexerPicker } from './MultiplexerPicker'
import { cn } from '@renderer/lib/utils'
import '@xterm/xterm/css/xterm.css'

interface XTerminalProps {
  paneId: string
  tabId?: string
  connectionId?: string | null
  terminalStyle?: TerminalStyle
  shell?: string
  shellArgs?: string[]
  onTerminalCreated?: (terminalId: string) => void
}

export function XTerminal({ paneId, tabId, connectionId, terminalStyle, shell, shellArgs, onTerminalCreated }: XTerminalProps): JSX.Element {
  const {
    containerRef,
    terminalIdRef,
    pendingPaste,
    confirmPaste,
    cancelPaste,
    pendingMuxPick,
    resolveMuxPick,
    dynamicTitle,
    detectedErrors
  } = useTerminal({
    paneId,
    tabId,
    connectionId,
    terminalStyle,
    shell,
    shellArgs,
    onTerminalCreated
  })

  // Update tab title from OSC sequences (#8)
  // Also extract working directory for AI-detected tabs
  const renameTab = useSessionsStore((s) => s.renameTab)
  useEffect(() => {
    if (!tabId || !dynamicTitle) return
    const store = useSessionsStore.getState()
    const tab = store.tabs.find((t) => t.id === tabId)
    if (tab?.lockTitle) return
    renameTab(tabId, dynamicTitle)

    // Extract cwd from OSC title for AI tabs
    // Shells set title to patterns like: "user@host:~/project", "~/project", "/home/user/project"
    // Claude Code may set: "claude:~/Devel/bifrost" or include cwd in various formats
    if (tab?.aiDetected && dynamicTitle) {
      const cwdPatterns = [
        /[:]\s*([~/][^\s:]+)/,          // "user@host:~/path" or "claude:~/path"
        /([~/][\w./-]+)\s*[-—]/,         // "~/path — something"
        /([~/][\w./-]+)$/,               // ends with a path
        /(\/(?:home|root|Users)\/[\w./-]+)/,  // absolute path starting from home dirs
      ]
      for (const pattern of cwdPatterns) {
        const m = dynamicTitle.match(pattern)
        if (m?.[1]) {
          const full = m[1].replace(/\/+$/, '')
          const dirName = full.split('/').pop() || full
          if (dirName && dirName.length > 1 && dirName !== tab.aiCwd) {
            store.setAiCwd(tabId, dirName)
          }
          break
        }
      }
    }
  }, [dynamicTitle, tabId, renameTab])
  const broadcastMode = useSessionsStore((s) => s.broadcastMode)
  const [showSearch, setShowSearch] = useState(false)

  const handleFindToggle = useCallback(() => {
    setShowSearch((prev) => !prev)
    // Dispatch to terminal for search addon activation
    const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
    if (paneEl) {
      paneEl.dispatchEvent(new CustomEvent('terminal:toggle-search'))
    }
  }, [paneId])

  // Session resume: idle detection
  const IDLE_THRESHOLD = 5 * 60 * 1000 // 5 minutes
  const lastActivityRef = useRef(Date.now())
  const [idleBanner, setIdleBanner] = useState<{ duration: string } | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Track activity: any data from terminal = active
  useEffect(() => {
    const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
    if (!paneEl) return
    const observer = new MutationObserver(() => { lastActivityRef.current = Date.now() })
    observer.observe(paneEl, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [paneId])

  // Track user interaction (keypress, click)
  useEffect(() => {
    const markActive = (): void => {
      const idleTime = Date.now() - lastActivityRef.current
      if (idleTime > IDLE_THRESHOLD) {
        const mins = Math.floor(idleTime / 60000)
        const display = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
        setIdleBanner({ duration: display })
      }
      lastActivityRef.current = Date.now()
    }
    const container = document.querySelector(`[data-pane-id="${paneId}"]`)
    container?.addEventListener('mousedown', markActive)
    container?.addEventListener('keydown', markActive)
    return () => {
      container?.removeEventListener('mousedown', markActive)
      container?.removeEventListener('keydown', markActive)
    }
  }, [paneId])

  const dismissIdleBanner = useCallback(() => {
    setIdleBanner(null)
    setAiSummary(null)
  }, [])

  const requestAiSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const termId = terminalIdRef.current
      if (!termId) { setSummaryLoading(false); return }
      const buffer = await window.bifrost.terminal.getBuffer(termId)
      if (!buffer) { setAiSummary('No terminal output available.'); setSummaryLoading(false); return }

      const lastLines = buffer.split('\n').filter((l: string) => l.trim()).slice(-40).join('\n')
      const available = await window.bifrost.ai.checkAvailable()
      if (!available) {
        setAiSummary('AI provider not available. Recent output:\n\n' + lastLines.slice(-500))
        setSummaryLoading(false)
        return
      }

      const result = await window.bifrost.ai.generate(
        'Summarize what happened in this terminal session concisely. Focus on: commands executed, results, errors, and current state. Be brief (3-5 bullet points).',
        'Terminal output:\n' + lastLines.slice(-1500)
      )
      setAiSummary(result || 'Could not generate summary.')
    } catch {
      setAiSummary('Failed to generate summary.')
    }
    setSummaryLoading(false)
  }, [])

  // Save summary as note
  const saveSummaryAsNote = useCallback(async () => {
    if (!aiSummary) return
    const { tabs, activeTabId } = useSessionsStore.getState()
    const tab = tabs.find((t) => t.id === (tabId || activeTabId))
    try {
      let connName = ''
      let host = ''
      let user = ''
      if (connectionId) {
        const conn = await window.bifrost.connections.get(connectionId)
        if (conn) { connName = conn.name ?? ''; host = conn.host ?? ''; user = conn.username ?? '' }
      }
      await window.bifrost.notes.create({
        content: aiSummary,
        connectionId: connectionId ?? undefined,
        connectionName: connName,
        host,
        user,
        tag: 'session-summary',
        tabTitle: tab?.title ?? ''
      })
    } catch { /* ignore */ }
    dismissIdleBanner()
  }, [aiSummary, tabId, connectionId, dismissIdleBanner])

  const content = (
    <div className="relative w-full h-full">
      {/* Idle resume banner */}
      {idleBanner && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-[#1b1b1e] border-b border-[rgba(199,196,215,0.08)]">
          <div className="flex items-center gap-3 px-3 py-2">
            <Clock size={14} className="text-[#ffa36b] shrink-0" />
            <span className="text-[11px] text-[#c7c4d7]">
              Idle for <strong className="text-[#ffa36b]">{idleBanner.duration}</strong>
            </span>
            {!aiSummary && !summaryLoading && (
              <button
                onClick={requestAiSummary}
                className="flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius)] text-[10px] font-semibold bg-[#6bd5ff]/10 text-[#6bd5ff] hover:bg-[#6bd5ff]/20 transition-colors"
              >
                <Bot size={10} /> AI Summary
              </button>
            )}
            {summaryLoading && (
              <span className="flex items-center gap-1 text-[10px] text-[#6bd5ff]">
                <Loader2 size={10} className="animate-spin" /> Summarizing...
              </span>
            )}
            <button
              onClick={dismissIdleBanner}
              className="ml-auto p-0.5 text-[#c7c4d7]/40 hover:text-[#c7c4d7] transition-colors"
            >
              <XIcon size={12} />
            </button>
          </div>
          {aiSummary && (
            <div className="px-3 pb-2">
              <pre className="text-[10px] text-[#c7c4d7]/80 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                {aiSummary}
              </pre>
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={saveSummaryAsNote}
                  className="text-[9px] text-[#22c55e] hover:text-[#22c55e]/80 font-semibold uppercase tracking-wider"
                >
                  Save as Note
                </button>
                <button
                  onClick={dismissIdleBanner}
                  className="text-[9px] text-[#c7c4d7]/40 hover:text-[#c7c4d7] font-semibold uppercase tracking-wider"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Broadcast banner */}
      {(broadcastMode === 'panes' || broadcastMode === 'all-tabs') && (
        <div
          className={cn(
            'absolute top-0 left-0 right-0 z-10 flex items-center justify-center gap-2',
            'py-1 px-3 text-[10px] font-semibold uppercase tracking-[0.1em]',
            'select-none pointer-events-none',
            broadcastMode === 'panes'
              ? 'bg-[#eab308]/15 text-[#eab308]'
              : 'bg-[#ef4444]/15 text-[#ef4444]'
          )}
          role="status"
          aria-live="polite"
        >
          <Radio size={12} strokeWidth={2} />
          {broadcastMode === 'panes'
            ? 'Broadcasting to all panes'
            : 'Broadcasting to all tabs'}
        </div>
      )}

      <div
        ref={containerRef}
        className="xterm-container w-full h-full"
        data-pane-id={paneId}
        data-terminal-id={terminalIdRef.current ?? ''}
      />
      {showSearch && (
        <TerminalSearchBar paneId={paneId} onClose={() => setShowSearch(false)} />
      )}

      {/* Error indicator (#99) */}
      {detectedErrors.length > 0 && (
        <div
          className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 bg-[var(--error)]/15 text-[var(--error)] px-2 py-1 rounded-[var(--radius)] text-[10px] font-semibold cursor-help"
          title={detectedErrors[detectedErrors.length - 1]?.pattern.suggestion}
          role="status"
        >
          <AlertTriangle size={11} />
          {detectedErrors[detectedErrors.length - 1]?.pattern.label}
        </div>
      )}

      {/* Paste warning dialog */}
      {pendingPaste && (
        <PasteWarning
          text={pendingPaste.text}
          onConfirm={confirmPaste}
          onCancel={cancelPaste}
        />
      )}

      {/* Multiplexer picker */}
      {pendingMuxPick && (
        <MultiplexerPicker
          hostLabel={pendingMuxPick.hostLabel}
          defaultPrefix={pendingMuxPick.defaultPrefix}
          probe={pendingMuxPick.probe}
          onResolve={resolveMuxPick}
          onKillSession={async (kind, target) => {
            await window.bifrost.multiplexer.killSession(pendingMuxPick.transport, kind, target)
          }}
          onCleanStale={async (kind) => {
            return window.bifrost.multiplexer.cleanStale(
              pendingMuxPick.transport,
              kind,
              pendingMuxPick.socketDir
            )
          }}
        />
      )}
    </div>
  )

  if (!tabId) {
    return content
  }

  return (
    <TerminalContextMenu
      tabId={tabId}
      paneId={paneId}
      connectionId={connectionId}
      onFindToggle={handleFindToggle}
    >
      {content}
    </TerminalContextMenu>
  )
}

function TerminalSearchBar({
  paneId,
  onClose
}: {
  paneId: string
  onClose: () => void
}): JSX.Element {
  const [query, setQuery] = useState('')

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value)
      const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
      if (paneEl) {
        paneEl.dispatchEvent(new CustomEvent('terminal:search', { detail: value }))
      }
    },
    [paneId]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter') {
        const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
        if (paneEl) {
          paneEl.dispatchEvent(
            new CustomEvent('terminal:search-next', { detail: e.shiftKey ? 'prev' : 'next' })
          )
        }
      }
    },
    [paneId, onClose]
  )

  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-[#2a2a2d] rounded-[0.25rem] px-2 py-1 shadow-lg">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find..."
        className="bg-transparent text-xs text-[#e6e1e5] placeholder-[#c7c4d7]/40 outline-none w-40 font-[var(--font-ui)]"
        autoFocus
      />
      <button
        onClick={onClose}
        className="text-[#c7c4d7]/50 hover:text-[#e6e1e5] transition-colors p-0.5"
        aria-label="Close search"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
