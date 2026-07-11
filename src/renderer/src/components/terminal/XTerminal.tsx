import { useState, useCallback, useEffect, useRef } from 'react'
import { Radio, AlertTriangle, Clock, Bot, X as XIcon, Loader2, ImageUp, ChevronUp } from 'lucide-react'
import { useTerminal } from '@renderer/hooks/useTerminal'
import { useSessionsStore, type TerminalStyle } from '@renderer/stores/sessions.store'
import { TerminalContextMenu } from './TerminalContextMenu'
import { PasteWarning } from './PasteWarning'
import { MultiplexerPicker } from './MultiplexerPicker'
import { cn } from '@renderer/lib/utils'
import { rawSessionId, hasMeaningfulContent } from '@renderer/lib/session-summary'

// Idle session-summary timing (module-scope constants → stable across renders).
const IDLE_THRESHOLD = 5 * 60 * 1000 // idle before offering a summary (5 min)
const IDLE_CHECK_MS = 20 * 1000      // how often we poll for idleness
const COLLAPSE_MS = 6 * 1000         // expanded pill auto-collapses after this
import '@xterm/xterm/css/xterm.css'

interface XTerminalProps {
  paneId: string
  tabId?: string
  connectionId?: string | null
  terminalStyle?: TerminalStyle
  shell?: string
  shellArgs?: string[]
  adoptSessionId?: string
  onTerminalCreated?: (terminalId: string) => void
}

export function XTerminal({ paneId, tabId, connectionId, terminalStyle, shell, shellArgs, adoptSessionId, onTerminalCreated }: XTerminalProps): JSX.Element {
  // State mirror of the live terminal id. terminalIdRef alone can't drive the
  // data-terminal-id DOM attribute reliably — a ref update doesn't re-render,
  // so consumers reading the attribute (context menu, scripts, recording)
  // could see a stale empty value depending on render timing.
  const [liveTerminalId, setLiveTerminalId] = useState<string | null>(null)
  const handleTerminalCreated = useCallback(
    (terminalId: string) => {
      setLiveTerminalId(terminalId)
      onTerminalCreated?.(terminalId)
    },
    [onTerminalCreated]
  )

  const {
    containerRef,
    terminalIdRef,
    pendingPaste,
    confirmPaste,
    cancelPaste,
    pendingMuxPick,
    resolveMuxPick,
    dynamicTitle,
    detectedErrors,
    imagePasteStatus
  } = useTerminal({
    paneId,
    tabId,
    connectionId,
    terminalStyle,
    shell,
    shellArgs,
    adoptSessionId,
    onTerminalCreated: handleTerminalCreated
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

  // Error badge auto-hide + dismissable
  const [errorBadgeVisible, setErrorBadgeVisible] = useState(false)
  const lastSeenErrorTsRef = useRef<number>(0)
  useEffect(() => {
    const latest = detectedErrors[detectedErrors.length - 1]
    if (!latest) return
    if (latest.timestamp <= lastSeenErrorTsRef.current) return
    lastSeenErrorTsRef.current = latest.timestamp
    setErrorBadgeVisible(true)
    const t = setTimeout(() => setErrorBadgeVisible(false), 8000)
    return () => clearTimeout(t)
  }, [detectedErrors])

  const handleFindToggle = useCallback(() => {
    setShowSearch((prev) => !prev)
    // Dispatch to terminal for search addon activation
    const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
    if (paneEl) {
      paneEl.dispatchEvent(new CustomEvent('terminal:toggle-search'))
    }
  }, [paneId])

  // Ctrl+Shift+F opens Find in the FOCUSED pane. Plain Ctrl+F is left for the
  // shell (readline forward-char), matching terminal-emulator convention.
  // Document-level listener gated on focus containment so split panes don't
  // all open their search bars at once.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!e.ctrlKey || !e.shiftKey || e.key.toLowerCase() !== 'f') return
      const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
      if (paneEl && document.activeElement && paneEl.contains(document.activeElement)) {
        e.preventDefault()
        handleFindToggle()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [paneId, handleFindToggle])

  // ── Idle session summary ──────────────────────────────────────────────────
  // Surfaces only when an idle session has meaningful output; shows briefly then
  // collapses to a corner icon. The AI summary is generated on demand (on expand).
  const lastActivityRef = useRef(Date.now())
  const lastBufferLenRef = useRef(0)
  const dismissedRef = useRef(false)
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorCountRef = useRef(0)
  const [idle, setIdle] = useState<{ duration: string } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Mirror the live error count for the polling closure.
  useEffect(() => { errorCountRef.current = detectedErrors.length }, [detectedErrors])

  // User interaction counts as activity (resets the idle timer).
  useEffect(() => {
    const markActive = (): void => { lastActivityRef.current = Date.now() }
    const container = document.querySelector(`[data-pane-id="${paneId}"]`)
    container?.addEventListener('mousedown', markActive)
    container?.addEventListener('keydown', markActive)
    return () => {
      container?.removeEventListener('mousedown', markActive)
      container?.removeEventListener('keydown', markActive)
    }
  }, [paneId])

  const formatIdle = (ms: number): string => {
    const mins = Math.floor(ms / 60000)
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
  }

  // Poll the output buffer: growth = activity. This is reliable, unlike a DOM
  // MutationObserver, because xterm paints output to a WebGL canvas, not the DOM.
  // After IDLE_THRESHOLD with no new output, surface the affordance — but only when
  // there is something worth summarizing.
  useEffect(() => {
    const tick = async (): Promise<void> => {
      const raw = rawSessionId(terminalIdRef.current)
      if (!raw) return
      let buffer = ''
      try { buffer = await window.bifrost.terminal.getBuffer(raw) } catch { return }

      if (buffer.length > lastBufferLenRef.current) {
        // New output → active; reset idle and allow a fresh affordance next idle period.
        lastBufferLenRef.current = buffer.length
        lastActivityRef.current = Date.now()
        dismissedRef.current = false
        return
      }
      if (idle || dismissedRef.current) return
      if (Date.now() - lastActivityRef.current < IDLE_THRESHOLD) return
      if (!hasMeaningfulContent(buffer, errorCountRef.current)) return

      setIdle({ duration: formatIdle(Date.now() - lastActivityRef.current) })
      setExpanded(true)
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
      collapseTimerRef.current = setTimeout(() => setExpanded(false), COLLAPSE_MS)
    }
    const interval = setInterval(tick, IDLE_CHECK_MS)
    return () => {
      clearInterval(interval)
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
    }
  }, [idle])

  const dismissIdle = useCallback(() => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
    dismissedRef.current = true
    setIdle(null)
    setExpanded(false)
    setAiSummary(null)
  }, [])

  const requestAiSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const termId = rawSessionId(terminalIdRef.current)
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

  // Expand the affordance and lazily generate the summary on first open.
  const expandIdle = useCallback(() => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current)
    setExpanded(true)
    if (!aiSummary && !summaryLoading) requestAiSummary()
  }, [aiSummary, summaryLoading, requestAiSummary])

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
    dismissIdle()
  }, [aiSummary, tabId, connectionId, dismissIdle])

  const content = (
    <div className="relative w-full h-full">
      {/* Idle session summary — collapsed corner icon, or an expanded panel. */}
      {idle && !expanded && (
        <button
          onClick={expandIdle}
          title={`Idle ${idle.duration} — session summary`}
          aria-label={`Idle for ${idle.duration}. Open session summary.`}
          className="absolute top-1.5 right-1.5 z-20 flex items-center justify-center w-6 h-6 rounded-full bg-[#1b1b1e]/90 border border-[rgba(199,196,215,0.12)] text-[#6bd5ff] hover:bg-[#2a2a2d] transition-colors shadow-sm"
        >
          <Bot size={13} />
          {(aiSummary || detectedErrors.length > 0) && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#ffa36b] border border-[#131316]" />
          )}
        </button>
      )}
      {idle && expanded && (
        <div className="absolute top-1.5 right-1.5 z-20 w-72 max-w-[calc(100%-0.75rem)] rounded-[var(--radius)] bg-[#1b1b1e] border border-[rgba(199,196,215,0.12)] shadow-lg">
          <div className="flex items-center gap-2 px-3 py-2">
            <Clock size={13} className="text-[#ffa36b] shrink-0" />
            <span className="text-[11px] text-[#c7c4d7]">
              Idle for <strong className="text-[#ffa36b]">{idle.duration}</strong>
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
              onClick={() => setExpanded(false)}
              title="Collapse"
              aria-label="Collapse session summary"
              className="ml-auto p-0.5 text-[#c7c4d7]/40 hover:text-[#c7c4d7] transition-colors"
            >
              <ChevronUp size={13} />
            </button>
            <button
              onClick={dismissIdle}
              title="Dismiss"
              aria-label="Dismiss session summary"
              className="p-0.5 text-[#c7c4d7]/40 hover:text-[#c7c4d7] transition-colors"
            >
              <XIcon size={12} />
            </button>
          </div>
          {aiSummary && (
            <div className="px-3 pb-2">
              <pre className="text-[10px] text-[#c7c4d7]/80 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
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
                  onClick={dismissIdle}
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
        data-terminal-id={liveTerminalId ?? terminalIdRef.current ?? ''}
      />
      {showSearch && (
        <TerminalSearchBar paneId={paneId} onClose={() => setShowSearch(false)} />
      )}

      {/* Image-paste-to-server status */}
      {imagePasteStatus && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 max-w-[90%] bg-[var(--surface-bright)] text-[var(--on-surface)] px-3 py-1.5 rounded-[var(--radius)] text-[11px] shadow-lg backdrop-blur-[12px]"
          role="status"
          aria-live="polite"
        >
          {imagePasteStatus.startsWith('Uploading')
            ? <Loader2 size={13} className="text-[#6bd5ff] animate-spin shrink-0" />
            : <ImageUp size={13} className="text-[#6bd5ff] shrink-0" />}
          <span className="truncate font-mono">{imagePasteStatus}</span>
        </div>
      )}

      {/* Error indicator (#99) */}
      {errorBadgeVisible && detectedErrors.length > 0 && (
        <div
          className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 bg-[var(--error)]/15 text-[var(--error)] pl-2 pr-1 py-1 rounded-[var(--radius)] text-[10px] font-semibold"
          title={detectedErrors[detectedErrors.length - 1]?.pattern.suggestion}
          role="status"
        >
          <AlertTriangle size={11} />
          <span className="cursor-help">{detectedErrors[detectedErrors.length - 1]?.pattern.label}</span>
          <button
            type="button"
            onClick={() => setErrorBadgeVisible(false)}
            className="ml-0.5 -mr-0.5 p-0.5 rounded hover:bg-[var(--error)]/20 cursor-pointer"
            aria-label="Dismiss error"
          >
            <XIcon size={11} />
          </button>
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

  // Closing the bar also clears the addon's match decorations (empty query).
  const handleClose = useCallback(() => {
    const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
    paneEl?.dispatchEvent(new CustomEvent('terminal:search', { detail: '' }))
    onClose()
  }, [paneId, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'Enter') {
        const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
        if (paneEl) {
          paneEl.dispatchEvent(
            new CustomEvent('terminal:search-next', { detail: e.shiftKey ? 'prev' : 'next' })
          )
        }
      }
    },
    [paneId, handleClose]
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
        onClick={handleClose}
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
