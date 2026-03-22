import { useState, useCallback } from 'react'
import { useTerminal } from '@renderer/hooks/useTerminal'
import { TerminalContextMenu } from './TerminalContextMenu'
import '@xterm/xterm/css/xterm.css'

interface XTerminalProps {
  paneId: string
  tabId?: string
  connectionId?: string | null
  onTerminalCreated?: (terminalId: string) => void
}

export function XTerminal({ paneId, tabId, connectionId, onTerminalCreated }: XTerminalProps): JSX.Element {
  const { containerRef } = useTerminal({ paneId, connectionId, onTerminalCreated })
  const [showSearch, setShowSearch] = useState(false)

  const handleFindToggle = useCallback(() => {
    setShowSearch((prev) => !prev)
    // Dispatch to terminal for search addon activation
    const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
    if (paneEl) {
      paneEl.dispatchEvent(new CustomEvent('terminal:toggle-search'))
    }
  }, [paneId])

  const content = (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="xterm-container w-full h-full"
        data-pane-id={paneId}
      />
      {showSearch && (
        <TerminalSearchBar paneId={paneId} onClose={() => setShowSearch(false)} />
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
        className="bg-transparent text-xs text-[#e6e1e5] placeholder-[#c7c4d7]/40 outline-none w-40 font-['Inter']"
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
