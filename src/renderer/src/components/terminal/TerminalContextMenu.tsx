import { useCallback } from 'react'
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
  Eraser
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
    if (connectionId) {
      const tabs = useSessionsStore.getState().tabs
      const tab = tabs.find((t) => t.id === tabId)
      createTab(tab?.title ?? 'Terminal', connectionId)
    }
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
        <ContextMenuItem onClick={handleCloseSplit} className="gap-2">
          <X size={14} strokeWidth={1.5} />
          Close Split Pane
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleDisconnect} className="gap-2">
          <Unplug size={14} strokeWidth={1.5} />
          Disconnect
        </ContextMenuItem>
        {connectionId && (
          <ContextMenuItem onClick={handleDuplicate} className="gap-2">
            <Copy size={14} strokeWidth={1.5} />
            Duplicate Connection
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={handleSaveLog} className="gap-2">
          <Save size={14} strokeWidth={1.5} />
          Save Session Log
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
    </ContextMenu>
  )
}
