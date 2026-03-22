import { useState, useCallback } from 'react'
import {
  ClipboardCopy,
  ClipboardPaste,
  Search,
  SplitSquareHorizontal,
  SplitSquareVertical,
  X,
  Unplug,
  Copy,
  Save,
  RotateCcw,
  Eraser,
  Bookmark,
  Maximize2,
  Bot,
  Camera,
  ExternalLink
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut
} from '@renderer/components/ui/context-menu'
import { useSessionsStore } from '@renderer/stores/sessions.store'

interface TerminalContextMenuProps {
  children: React.ReactNode
  tabId: string
  paneId: string
  connectionId?: string | null
  onFindToggle?: () => void
}

export function TerminalContextMenu({
  children,
  tabId,
  paneId,
  connectionId,
  onFindToggle
}: TerminalContextMenuProps): JSX.Element {
  const splitPane = useSessionsStore((s) => s.splitPane)
  const closeSplitPane = useSessionsStore((s) => s.closeSplitPane)
  const closeTab = useSessionsStore((s) => s.closeTab)
  const createTab = useSessionsStore((s) => s.createTab)
  const toggleMaximizePane = useSessionsStore((s) => s.toggleMaximizePane)

  const handleCopy = useCallback(async () => {
    const selection = document.getSelection()?.toString()
    if (selection) {
      await navigator.clipboard.writeText(selection)
    }
  }, [])

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      // Find the xterm instance for this pane and write to it
      const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
      if (paneEl) {
        // Dispatch a custom event that the terminal can listen for
        paneEl.dispatchEvent(new CustomEvent('terminal:paste', { detail: text }))
      }
    } catch (err) {
      console.error('Paste failed:', err)
    }
  }, [paneId])

  const handleSplitHorizontal = useCallback(() => {
    splitPane(tabId, paneId, 'horizontal')
  }, [splitPane, tabId, paneId])

  const handleSplitVertical = useCallback(() => {
    splitPane(tabId, paneId, 'vertical')
  }, [splitPane, tabId, paneId])

  const handleCloseSplit = useCallback(() => {
    closeSplitPane(tabId, paneId)
  }, [closeSplitPane, tabId, paneId])

  const handleDisconnect = useCallback(() => {
    closeTab(tabId)
  }, [closeTab, tabId])

  const handleDuplicate = useCallback(() => {
    const { tabs } = useSessionsStore.getState()
    const tab = tabs.find((t) => t.id === tabId)
    const title = tab?.title ? `${tab.title} (copy)` : 'Terminal'
    // Duplicate with same connectionId (null for local, string for SSH)
    createTab(title, connectionId ?? undefined)
  }, [connectionId, tabId, createTab])

  const handleSaveLog = useCallback(async () => {
    try {
      const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
      if (paneEl) {
        paneEl.dispatchEvent(new CustomEvent('terminal:save-log'))
      }
    } catch (err) {
      console.error('Save log failed:', err)
    }
  }, [paneId])

  const handleClearTerminal = useCallback(() => {
    const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
    if (paneEl) {
      paneEl.dispatchEvent(new CustomEvent('terminal:clear'))
    }
  }, [paneId])

  const handleResetTerminal = useCallback(() => {
    const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
    if (paneEl) {
      paneEl.dispatchEvent(new CustomEvent('terminal:reset'))
    }
  }, [paneId])

  const handleSaveAsConnection = useCallback(async () => {
    if (!connectionId) return
    try {
      const conn = await window.bifrost.connections.get(connectionId)
      if (conn) {
        const name = `Copy of ${conn.name ?? 'Connection'}`
        await window.bifrost.connections.create({ ...conn, name } as Parameters<typeof window.bifrost.connections.create>[0])
      }
    } catch (err) {
      console.error('Save as connection failed:', err)
    }
  }, [connectionId])

  const handleMaximize = useCallback(() => {
    toggleMaximizePane(paneId)
  }, [toggleMaximizePane, paneId])

  // #98 Explain Command
  const [explanation, setExplanation] = useState<string | null>(null)
  const handleExplainCommand = useCallback(async () => {
    const selection = document.getSelection()?.toString()?.trim()
    if (!selection) {
      setExplanation('Select a command first, then right-click and choose Explain Command.')
      setTimeout(() => setExplanation(null), 3000)
      return
    }
    try {
      setExplanation('Analyzing...')
      const result = await window.bifrost?.ai?.explain(selection)
      setExplanation(result ?? 'No explanation available')
      setTimeout(() => setExplanation(null), 10000)
    } catch {
      setExplanation('Could not explain command')
      setTimeout(() => setExplanation(null), 3000)
    }
  }, [])

  // #61 Terminal Screenshot
  const handleScreenshot = useCallback(async () => {
    const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
    if (!paneEl) return
    const canvas = paneEl.querySelector('canvas')
    if (!canvas) return
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `bifrost-screenshot-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Screenshot failed:', err)
    }
  }, [paneId])

  // #72 Detach to Window — opens a new Electron window with just the terminal
  const handleDetach = useCallback(async () => {
    try {
      const { tabs } = useSessionsStore.getState()
      const tab = tabs.find((t) => t.id === tabId)
      const title = tab?.title ?? 'Terminal'
      if (window.bifrost?.window?.detachTab) {
        await window.bifrost.window.detachTab(tabId, title)
        // Hide the tab from main window (it's now in a separate window)
        closeTab(tabId)
      }
    } catch (err) {
      console.error('Detach failed:', err)
    }
  }, [tabId, closeTab])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleCopy} className="gap-2">
          <ClipboardCopy size={14} strokeWidth={1.5} />
          Copy
          <ContextMenuShortcut>Ctrl+Shift+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handlePaste} className="gap-2">
          <ClipboardPaste size={14} strokeWidth={1.5} />
          Paste
          <ContextMenuShortcut>Ctrl+Shift+V</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onFindToggle} className="gap-2">
          <Search size={14} strokeWidth={1.5} />
          Find in Terminal
          <ContextMenuShortcut>Ctrl+F</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleSplitHorizontal} className="gap-2">
          <SplitSquareHorizontal size={14} strokeWidth={1.5} />
          Split Horizontal
        </ContextMenuItem>
        <ContextMenuItem onClick={handleSplitVertical} className="gap-2">
          <SplitSquareVertical size={14} strokeWidth={1.5} />
          Split Vertical
        </ContextMenuItem>
        <ContextMenuItem onClick={handleMaximize} className="gap-2">
          <Maximize2 size={14} strokeWidth={1.5} />
          Maximize Pane
          <ContextMenuShortcut>Ctrl+Shift+M</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCloseSplit} className="gap-2">
          <X size={14} strokeWidth={1.5} />
          Close Split Pane
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleDisconnect} className="gap-2">
          <Unplug size={14} strokeWidth={1.5} />
          Disconnect
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDuplicate} className="gap-2">
          <Copy size={14} strokeWidth={1.5} />
          {connectionId ? 'Duplicate Connection' : 'Duplicate Terminal'}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleSaveLog} className="gap-2">
          <Save size={14} strokeWidth={1.5} />
          Save Session Log
        </ContextMenuItem>
        {connectionId && (
          <ContextMenuItem onClick={handleSaveAsConnection} className="gap-2">
            <Bookmark size={14} strokeWidth={1.5} />
            Save as Connection
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleExplainCommand} className="gap-2">
          <Bot size={14} strokeWidth={1.5} />
          Explain Command
        </ContextMenuItem>
        <ContextMenuItem onClick={handleScreenshot} className="gap-2">
          <Camera size={14} strokeWidth={1.5} />
          Take Screenshot
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDetach} className="gap-2">
          <ExternalLink size={14} strokeWidth={1.5} />
          Detach to Window
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleClearTerminal} className="gap-2">
          <Eraser size={14} strokeWidth={1.5} />
          Clear Terminal
        </ContextMenuItem>
        <ContextMenuItem onClick={handleResetTerminal} className="gap-2">
          <RotateCcw size={14} strokeWidth={1.5} />
          Reset Terminal
        </ContextMenuItem>
      </ContextMenuContent>

      {/* Explanation tooltip (#98) */}
      {explanation && (
        <div
          className="fixed bottom-12 right-4 z-50 max-w-sm p-3 rounded-[var(--radius)] bg-[var(--surface-bright)] text-xs text-[var(--on-surface)] shadow-lg backdrop-blur-[12px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <Bot size={14} className="text-[#6bd5ff] shrink-0 mt-0.5" />
            <p className="whitespace-pre-wrap">{explanation}</p>
          </div>
        </div>
      )}
    </ContextMenu>
  )
}
