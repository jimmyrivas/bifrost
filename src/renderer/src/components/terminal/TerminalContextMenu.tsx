import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ClipboardCopy,
  ClipboardPaste,
  ImageUp,
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
  ExternalLink,
  ScrollText,
  Play,
  Lock,
  LockOpen,
  PenLine,
  Zap,
  FolderOpen,
  Layers,
  Merge,
  Radio,
  FileText,
  FolderTree,
  StickyNote,
  Sheet,
  LayoutGrid,
  Wand2,
  Video,
  Square,
  Settings2,
  Clapperboard
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent
} from '@renderer/components/ui/context-menu'
import { useSessionsStore } from '@renderer/stores/sessions.store'
import { useCaptureStore } from '@renderer/stores/capture.store'
import { CaptureFilesBrowser, type CaptureTab } from './CaptureFilesBrowser'
import { terminalToCsv, terminalToMarkdown } from '@renderer/lib/markdown-clip'
import type { ScriptContext } from '@renderer/lib/script-runner'
import { hasParams, promptForParams } from '@renderer/lib/workflow-params'
import { OSC7_CWD_SETUP } from '@renderer/lib/shell-integration'
import { parseSessionId, writeToSession } from '@renderer/lib/session-id'

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
  const toggleLockTitle = useSessionsStore((s) => s.toggleLockTitle)
  const renameTab = useSessionsStore((s) => s.renameTab)
  const toggleSftp = useSessionsStore((s) => s.toggleSftp)
  const explodePanes = useSessionsStore((s) => s.explodePanes)
  const combineTabs = useSessionsStore((s) => s.combineTabs)

  // Capture state (recording / logging) — object identity is stable between
  // mutations, so these re-render the menu only when a capture starts/stops.
  const recordings = useCaptureStore((s) => s.recordings)
  const logs = useCaptureStore((s) => s.logs)
  const [captureBrowserTab, setCaptureBrowserTab] = useState<CaptureTab | null>(null)

  // Bumped every time the context menu OPENS. Everything dynamic in the menu
  // (data-terminal-id reads, store getState() labels, scripts/remote-commands/
  // runbooks lists) is re-evaluated against this tick, so the menu reflects
  // the state at open time — not at component-mount time. Without it, items
  // like "Record Session" or "Remote Commands" could be missing or stale.
  const [openTick, setOpenTick] = useState(0)

  /** Get xterm selection from data attribute (canvas doesn't support document.getSelection) */
  const getTerminalSelection = useCallback((): string => {
    const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
    return (paneEl as HTMLElement)?.dataset?.terminalSelection?.trim() ?? ''
  }, [paneId])

  const [copyFlash, setCopyFlash] = useState<string | null>(null)
  const copyFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashCopy = useCallback((label: string) => {
    setCopyFlash(label)
    // Cancel the previous timer so a rapid second copy keeps its toast.
    if (copyFlashTimer.current) clearTimeout(copyFlashTimer.current)
    copyFlashTimer.current = setTimeout(() => setCopyFlash(null), 1500)
  }, [])

  const handleCopy = useCallback(async () => {
    const selection = getTerminalSelection()
    if (selection) {
      await navigator.clipboard.writeText(selection)
    }
  }, [getTerminalSelection])

  const handleCopyAsMarkdown = useCallback(async () => {
    const selection = getTerminalSelection()
    if (!selection) {
      flashCopy('Select text first')
      return
    }
    await navigator.clipboard.writeText(terminalToMarkdown(selection))
    flashCopy('Copied as Markdown')
  }, [getTerminalSelection, flashCopy])

  const handleCopyAsCsv = useCallback(async () => {
    const selection = getTerminalSelection()
    if (!selection) {
      flashCopy('Select text first')
      return
    }
    await navigator.clipboard.writeText(terminalToCsv(selection))
    flashCopy('Copied as CSV')
  }, [getTerminalSelection, flashCopy])

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

  // ── Capture: recording + session logging ──────────────────────────────
  // Resolve the current pane's RAW backend session id (no ssh:/mosh: prefix).
  const sessionOf = useCallback((): { raw: string; isSSH: boolean } | null => {
    const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
    const termId = paneEl?.getAttribute('data-terminal-id') ?? ''
    if (!termId) return null
    const { protocol, raw } = parseSessionId(termId)
    return { raw, isSSH: protocol === 'ssh' }
  }, [paneId])

  // Toast with an optional file path (offers Reveal / Copy path actions).
  const [captureToast, setCaptureToast] = useState<{ message: string; filePath?: string } | null>(null)
  const captureToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showCaptureToast = useCallback((message: string, filePath?: string) => {
    setCaptureToast({ message, filePath })
    if (captureToastTimer.current) clearTimeout(captureToastTimer.current)
    captureToastTimer.current = setTimeout(() => setCaptureToast(null), 7000)
  }, [])

  const handleToggleRecording = useCallback(async () => {
    const s = sessionOf()
    if (!s) return
    if (!s.isSSH) {
      showCaptureToast('Recording is available for SSH sessions only')
      return
    }
    const store = useCaptureStore.getState()
    try {
      if (s.raw in store.recordings) {
        const filePath = await window.bifrost.ssh.stopRecording(s.raw)
        store.clearRecording(s.raw)
        showCaptureToast('Recording saved', filePath ?? undefined)
      } else {
        const { tabs } = useSessionsStore.getState()
        const tab = tabs.find((t) => t.id === tabId)
        await window.bifrost.ssh.startRecording(s.raw, { title: tab?.title ?? `Session ${s.raw}` })
        store.setRecording(s.raw, Date.now())
        showCaptureToast('● Recording started — asciicast .cast in the recordings folder')
      }
    } catch {
      showCaptureToast('Recording action failed')
    }
  }, [sessionOf, tabId, showCaptureToast])

  const handleToggleLog = useCallback(async () => {
    const s = sessionOf()
    if (!s) return
    const store = useCaptureStore.getState()
    try {
      if (s.raw in store.logs) {
        await window.bifrost.system.stopLogging(s.raw)
        store.clearLogging(s.raw)
        showCaptureToast('Session logging stopped')
        return
      }
      let pattern = 'local_%Y%M%D_%H%m%s'
      let context: { name?: string; host?: string; user?: string } = {}
      if (connectionId) {
        const conn = await window.bifrost.connections.get(connectionId).catch(() => null)
        pattern = conn?.logPattern || '%N_%Y%M%D_%H%m%s'
        context = {
          name: conn?.name ?? undefined,
          host: conn?.host ?? undefined,
          user: conn?.username ?? undefined
        }
      }
      const filePath = await window.bifrost.system.startLogging(s.raw, pattern, context)
      store.setLogging(s.raw, filePath)
      showCaptureToast('Logging session to file', filePath)
    } catch {
      showCaptureToast('Logging action failed')
    }
  }, [sessionOf, connectionId, showCaptureToast])

  const openRecordingsFolder = useCallback(() => {
    window.bifrost.system.getRecordingsDir()
      .then((d) => window.bifrost.system.openPath(d))
      .catch(() => showCaptureToast('Could not open recordings folder'))
  }, [showCaptureToast])

  const openLogsFolder = useCallback(() => {
    window.bifrost.system.getLogDir()
      .then((d) => window.bifrost.system.openPath(d))
      .catch(() => showCaptureToast('Could not open logs folder'))
  }, [showCaptureToast])

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

  const handleToggleLockTitle = useCallback(() => {
    toggleLockTitle(tabId)
  }, [toggleLockTitle, tabId])

  const [renamingTab, setRenamingTab] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const handleRenameTab = useCallback(() => {
    const { tabs } = useSessionsStore.getState()
    const tab = tabs.find((t) => t.id === tabId)
    setRenameValue(tab?.title ?? '')
    setRenamingTab(true)
  }, [tabId])

  const commitTabRename = useCallback(() => {
    if (renameValue.trim()) {
      renameTab(tabId, renameValue.trim())
      const { tabs } = useSessionsStore.getState()
      const tab = tabs.find((t) => t.id === tabId)
      if (tab && !tab.lockTitle) {
        toggleLockTitle(tabId)
      }
    }
    setRenamingTab(false)
  }, [tabId, renameValue, renameTab, toggleLockTitle])

  // Scripts menu (#3)
  interface ScriptEntry { id: string; name: string; description?: string; code: string }
  const [scripts, setScripts] = useState<ScriptEntry[]>([])
  const [scriptStatus, setScriptStatus] = useState<string | null>(null)

  useEffect(() => {
    window.bifrost?.scripts?.list()
      .then((list: ScriptEntry[]) => setScripts(list ?? []))
      .catch(() => {})
  }, [openTick])

  const handleRunScript = useCallback(async (script: ScriptEntry) => {
    const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
    const termId = paneEl?.getAttribute('data-terminal-id') ?? ''
    if (!termId) return

    const writeToTerminal = (text: string): void => {
      writeToSession(termId, text)
    }

    // Listen for worker output messages (send/log) from the isolated worker
    const removeListener = window.bifrost.scripts.onOutput((msg) => {
      if (msg.type === 'send' && msg.text) {
        writeToTerminal(msg.text)
      } else if (msg.type === 'log' && msg.text) {
        writeToTerminal(`\x1b[36m[bifrost]\x1b[0m ${msg.text}\r\n`)
      }
    })

    try {
      setScriptStatus(`Running: ${script.name}...`)
      await window.bifrost.scripts.execute(script.code)
      setScriptStatus(`Completed: ${script.name}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setScriptStatus(`Failed: ${msg}`)
      writeToTerminal(`\r\n\x1b[31m[bifrost] Script error: ${msg}\x1b[0m\r\n`)
    } finally {
      removeListener()
    }
    setTimeout(() => setScriptStatus(null), 3000)
  }, [paneId])

  // Runbooks from localStorage
  interface RunbookEntry { id: string; name: string; content: string }
  const [runbooks, setRunbooks] = useState<RunbookEntry[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('bifrost:runbooks')
      if (raw) setRunbooks(JSON.parse(raw) ?? [])
    } catch { /* ignore */ }
  }, [openTick])

  const handleEnableShellIntegration = useCallback(() => {
    const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
    const termId = paneEl?.getAttribute('data-terminal-id') ?? ''
    if (!termId.startsWith('ssh:')) return
    // Write the OSC 7 setup so the shell reports its cwd on every prompt.
    window.bifrost.ssh.write(termId.slice(4), OSC7_CWD_SETUP + '\n')
  }, [paneId])

  const handleRunRunbook = useCallback((rb: RunbookEntry) => {
    const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
    const termId = paneEl?.getAttribute('data-terminal-id') ?? ''
    if (!termId) return

    const writeCmd = (cmd: string): void => {
      writeToSession(termId, cmd + '\n')
    }

    // Parse code blocks and execute non-commented lines
    const lines = rb.content.split('\n')
    let inCode = false
    const commands: string[] = []
    for (const line of lines) {
      if (line.startsWith('```') && !inCode) { inCode = true; continue }
      if (line.startsWith('```') && inCode) { inCode = false; continue }
      if (inCode && line.trim() && !line.trimStart().startsWith('#')) {
        commands.push(line)
      }
    }

    if (commands.length === 0) return

    // Execute with delay between commands
    let i = 0
    const next = (): void => {
      if (i < commands.length) {
        writeCmd(commands[i])
        i++
        setTimeout(next, 800)
      }
    }
    next()
  }, [paneId])

  // Remote Commands (Asbru-style)
  interface RemoteCmd { id: string; command: string; description: string; cmdGroup?: string; confirm?: boolean; sendIntro?: boolean; keybinding?: string; connectionId?: string | null }
  const [remoteCmds, setRemoteCmds] = useState<RemoteCmd[]>([])

  useEffect(() => {
    window.bifrost?.remoteCommands?.list(connectionId ?? undefined)
      .then((list: RemoteCmd[]) => setRemoteCmds(list ?? []))
      .catch(() => {})
  }, [connectionId, openTick])

  const handleRunRemoteCommand = useCallback(async (cmd: RemoteCmd) => {
    if (cmd.confirm) {
      const ok = window.confirm(`Execute: ${cmd.command}?`)
      if (!ok) return
    }

    const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
    const termId = paneEl?.getAttribute('data-terminal-id') ?? ''
    if (!termId) return

    // Resolve variables if the command contains variable placeholders
    let resolved = cmd.command
    if (resolved.includes('<') && connectionId) {
      try {
        resolved = await window.bifrost.connections.resolveTabTitle(resolved, connectionId)
      } catch { /* use raw command */ }
    }

    // Resolve {{param}} placeholders
    if (hasParams(resolved)) {
      const paramResolved = promptForParams(resolved)
      if (!paramResolved) return // cancelled
      resolved = paramResolved
    }

    const payload = cmd.sendIntro !== false ? resolved + '\n' : resolved
    writeToSession(termId, payload)
  }, [paneId, connectionId])

  // #98 Explain Command
  const [explanation, setExplanation] = useState<string | null>(null)
  const handleExplainCommand = useCallback(async () => {
    const selection = getTerminalSelection()
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

  // Save as Note
  const [noteSaved, setNoteSaved] = useState<string | null>(null)
  const handleSaveAsNote = useCallback(async (tag: string) => {
    const selection = getTerminalSelection()
    if (!selection) {
      setNoteSaved('Select text first')
      setTimeout(() => setNoteSaved(null), 2000)
      return
    }

    // Gather context
    const { tabs, activeTabId } = useSessionsStore.getState()
    const tab = tabs.find((t) => t.id === (tabId || activeTabId))
    let connName = ''
    let host = ''
    let user = ''
    if (connectionId) {
      try {
        const conn = await window.bifrost.connections.get(connectionId)
        if (conn) {
          connName = conn.name ?? ''
          host = conn.host ?? ''
          user = conn.username ?? ''
        }
      } catch { /* skip */ }
    }

    try {
      await window.bifrost.notes.create({
        content: selection,
        connectionId: connectionId ?? undefined,
        connectionName: connName,
        host,
        user,
        tag,
        tabTitle: tab?.title ?? ''
      })
      setNoteSaved('Saved!')
      setTimeout(() => setNoteSaved(null), 2000)
    } catch {
      setNoteSaved('Failed to save')
      setTimeout(() => setNoteSaved(null), 2000)
    }
  }, [tabId, connectionId])

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

  // #72 Detach to Window — transfers existing PTY/SSH session to new window
  const handleDetach = useCallback(async () => {
    try {
      const { tabs } = useSessionsStore.getState()
      const tab = tabs.find((t) => t.id === tabId)
      const title = tab?.title ?? 'Terminal'
      const connId = tab?.connectionId ?? ''
      const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`)
      const termId = paneEl?.getAttribute('data-terminal-id') ?? ''
      if (window.bifrost?.window?.detachTab) {
        // Mark tab as detaching so useTerminal cleanup won't kill the PTY
        useSessionsStore.getState().markTabDetaching(tabId)
        await window.bifrost.window.detachTab(tabId, title, connId, termId)
        closeTab(tabId)
      }
    } catch (err) {
      console.error('Detach failed:', err)
    }
  }, [tabId, paneId, closeTab])

  return (
    <ContextMenu onOpenChange={(open) => { if (open) setOpenTick((t) => t + 1) }}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        {/* ── Clipboard ── */}
        <ContextMenuItem onClick={handleCopy} className="gap-2">
          <ClipboardCopy size={14} strokeWidth={1.5} />
          Copy
          <ContextMenuShortcut>Ctrl+Shift+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <Copy size={14} strokeWidth={1.5} />
            Copy as
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-44">
            <ContextMenuItem onClick={handleCopyAsMarkdown} className="gap-2">
              <FileText size={14} strokeWidth={1.5} />
              Markdown
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyAsCsv} className="gap-2">
              <Sheet size={14} strokeWidth={1.5} />
              CSV
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onClick={handlePaste} className="gap-2">
          <ClipboardPaste size={14} strokeWidth={1.5} />
          Paste
          <ContextMenuShortcut>Ctrl+Shift+V</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onFindToggle} className="gap-2">
          <Search size={14} strokeWidth={1.5} />
          Find in Terminal
          <ContextMenuShortcut>Ctrl+Shift+F</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* ── Layout ── */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <LayoutGrid size={14} strokeWidth={1.5} />
            Layout
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-52">
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
            {useSessionsStore.getState().tabs.find((t) => t.id === tabId)?.rootPane.split && (
              <ContextMenuItem onClick={() => explodePanes(tabId)} className="gap-2">
                <Layers size={14} strokeWidth={1.5} />
                Explode to Tabs
              </ContextMenuItem>
            )}
            {useSessionsStore.getState().tabs.length > 1 && (
              <ContextMenuItem onClick={() => combineTabs()} className="gap-2">
                <Merge size={14} strokeWidth={1.5} />
                Combine All Tabs
              </ContextMenuItem>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* ── Automation ── */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <Wand2 size={14} strokeWidth={1.5} />
            Automation
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuSub>
              <ContextMenuSubTrigger className="gap-2">
                <ScrollText size={14} strokeWidth={1.5} />
                Scripts
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-52">
                {scripts.length === 0 && (
                  <ContextMenuItem disabled className="gap-2 text-xs">
                    No scripts yet — create one in the Scripts view
                  </ContextMenuItem>
                )}
                {scripts.map((script) => (
                  <ContextMenuItem
                    key={script.id}
                    onClick={() => handleRunScript(script)}
                    className="gap-2 flex-col items-start"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Play size={12} strokeWidth={1.5} />
                      <span className="truncate">{script.name}</span>
                    </div>
                    {script.description && (
                      <span className="text-[10px] text-[var(--on-surface-variant)] pl-5 truncate w-full">
                        {script.description}
                      </span>
                    )}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSub>
              <ContextMenuSubTrigger className="gap-2">
                <Zap size={14} strokeWidth={1.5} />
                Remote Commands
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-56">
                {remoteCmds.length === 0 && (
                  <ContextMenuItem disabled className="gap-2 text-xs">
                    No commands defined — add them in Remote Cmds
                  </ContextMenuItem>
                )}
                {remoteCmds.length > 0 &&
                  (() => {
                    // Group commands by cmdGroup
                    const grouped = new Map<string, RemoteCmd[]>()
                    const ungrouped: RemoteCmd[] = []
                    for (const cmd of remoteCmds) {
                      const g = cmd.cmdGroup?.trim()
                      if (g) {
                        const list = grouped.get(g) ?? []
                        list.push(cmd)
                        grouped.set(g, list)
                      } else {
                        ungrouped.push(cmd)
                      }
                    }

                    const items: JSX.Element[] = []

                    // Grouped commands first
                    for (const [group, cmds] of Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
                      items.push(
                        <ContextMenuSub key={`grp-${group}`}>
                          <ContextMenuSubTrigger className="text-xs">{group}</ContextMenuSubTrigger>
                          <ContextMenuSubContent className="w-52">
                            {cmds.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((cmd) => (
                              <ContextMenuItem
                                key={cmd.id}
                                onClick={() => handleRunRemoteCommand(cmd)}
                                className="gap-2 flex-col items-start"
                              >
                                <span className="text-xs truncate w-full">{cmd.description || cmd.command}</span>
                                {cmd.keybinding && (
                                  <ContextMenuShortcut>{cmd.keybinding}</ContextMenuShortcut>
                                )}
                              </ContextMenuItem>
                            ))}
                          </ContextMenuSubContent>
                        </ContextMenuSub>
                      )
                    }

                    // Ungrouped commands
                    if (grouped.size > 0 && ungrouped.length > 0) {
                      items.push(<ContextMenuSeparator key="rc-sep" />)
                    }
                    for (const cmd of ungrouped.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
                      items.push(
                        <ContextMenuItem
                          key={cmd.id}
                          onClick={() => handleRunRemoteCommand(cmd)}
                          className="gap-2"
                        >
                          <Zap size={12} strokeWidth={1.5} />
                          <span className="truncate text-xs">{cmd.description || cmd.command}</span>
                          {cmd.keybinding && (
                            <ContextMenuShortcut>{cmd.keybinding}</ContextMenuShortcut>
                          )}
                        </ContextMenuItem>
                      )
                    }

                    return items
                  })()}
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSub>
              <ContextMenuSubTrigger className="gap-2">
                <FileText size={14} strokeWidth={1.5} />
                Runbooks
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-52">
                {runbooks.length === 0 && (
                  <ContextMenuItem disabled className="gap-2 text-xs">
                    No runbooks yet — create one in the Runbooks view
                  </ContextMenuItem>
                )}
                {runbooks.map((rb) => (
                  <ContextMenuItem
                    key={rb.id}
                    onClick={() => handleRunRunbook(rb)}
                    className="gap-2"
                  >
                    <Play size={12} strokeWidth={1.5} />
                    <span className="truncate text-xs">{rb.name}</span>
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSeparator />

            <ContextMenuItem onClick={handleExplainCommand} className="gap-2">
              <Bot size={14} strokeWidth={1.5} />
              Explain Command
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => document.dispatchEvent(new CustomEvent('toggle:ai-assistant'))}
              className="gap-2"
            >
              <Bot size={14} strokeWidth={1.5} className="text-[#6bd5ff]" />
              AI Assistant
              <ContextMenuShortcut>Ctrl+Shift+A</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => useSessionsStore.getState().cycleBroadcastMode()}
              className="gap-2"
            >
              {(() => {
                const mode = useSessionsStore.getState().broadcastMode
                const color = mode === 'hidden' || mode === 'off' ? '' : mode === 'panes' ? 'text-[#eab308]' : 'text-[#ef4444]'
                const label = mode === 'hidden' ? 'Broadcast: Hidden' : mode === 'off' ? 'Broadcast: Off' : mode === 'panes' ? 'Broadcast: Panes' : 'Broadcast: All'
                return (
                  <>
                    <Radio size={14} strokeWidth={1.5} className={color} />
                    <span className={color}>{label}</span>
                  </>
                )
              })()}
            </ContextMenuItem>
            {connectionId && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => document.dispatchEvent(new CustomEvent('terminal:paste-image'))}
                  className="gap-2"
                >
                  <ImageUp size={14} strokeWidth={1.5} />
                  Paste Image to Server
                  <ContextMenuShortcut>Ctrl+Shift+I</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={handleEnableShellIntegration} className="gap-2">
                  <FolderTree size={14} strokeWidth={1.5} />
                  Enable cwd tracking (relative .md links)
                </ContextMenuItem>
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* ── Capture ── */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <Video size={14} strokeWidth={1.5} />
            Capture
            {(() => {
              const s = sessionOf()
              return s && s.raw in recordings ? (
                <span className="ml-1 w-2 h-2 rounded-full bg-[var(--error)] animate-pulse" />
              ) : null
            })()}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            {(() => {
              const s = sessionOf()
              const isRec = !!s && s.raw in recordings
              const isLog = !!s && s.raw in logs
              // Recording works on SSH sessions. Keep the item visible (but
              // disabled, with a hint) on local/mosh panes so the feature is
              // discoverable instead of silently absent.
              const canRecord = !s || s.isSSH
              return (
                <>
                  <ContextMenuItem
                    onClick={handleToggleRecording}
                    disabled={!canRecord}
                    className="gap-2"
                  >
                    {isRec ? (
                      <><Square size={14} strokeWidth={1.5} className="text-[var(--error)]" />Stop Recording</>
                    ) : (
                      <>
                        <Video size={14} strokeWidth={1.5} className="text-[var(--error)]" />
                        Record Session
                        {!canRecord && (
                          <span className="ml-auto text-[10px] text-[var(--on-surface-variant)]/60">SSH only</span>
                        )}
                      </>
                    )}
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handleToggleLog} className="gap-2">
                    {isLog ? (
                      <><Square size={14} strokeWidth={1.5} />Stop Session Log</>
                    ) : (
                      <><Save size={14} strokeWidth={1.5} />Save Session Log</>
                    )}
                  </ContextMenuItem>
                </>
              )
            })()}
            <ContextMenuItem onClick={handleScreenshot} className="gap-2">
              <Camera size={14} strokeWidth={1.5} />
              Take Screenshot
            </ContextMenuItem>

            <ContextMenuSub>
              <ContextMenuSubTrigger className="gap-2">
                <StickyNote size={14} strokeWidth={1.5} />
                Save as Note
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-44">
                <ContextMenuItem onClick={() => handleSaveAsNote('note')} className="gap-2 text-xs">
                  <StickyNote size={12} /> Note
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleSaveAsNote('evidence')} className="gap-2 text-xs">
                  <Camera size={12} /> Evidence
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleSaveAsNote('command')} className="gap-2 text-xs">
                  <Play size={12} /> Command
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleSaveAsNote('error')} className="gap-2 text-xs">
                  <X size={12} className="text-[var(--error)]" /> Error
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleSaveAsNote('prompt')} className="gap-2 text-xs">
                  <Bot size={12} /> AI Prompt
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSeparator />

            <ContextMenuItem onClick={() => setCaptureBrowserTab('recordings')} className="gap-2">
              <Clapperboard size={14} strokeWidth={1.5} />
              Recordings…
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setCaptureBrowserTab('logs')} className="gap-2">
              <FileText size={14} strokeWidth={1.5} />
              Session Logs…
            </ContextMenuItem>
            <ContextMenuItem onClick={openRecordingsFolder} className="gap-2">
              <FolderOpen size={14} strokeWidth={1.5} />
              Open Recordings Folder
            </ContextMenuItem>
            <ContextMenuItem onClick={openLogsFolder} className="gap-2">
              <FolderOpen size={14} strokeWidth={1.5} />
              Open Logs Folder
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* ── Session ── */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <Settings2 size={14} strokeWidth={1.5} />
            Session
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-52">
            <ContextMenuItem onClick={handleRenameTab} className="gap-2">
              <PenLine size={14} strokeWidth={1.5} />
              Rename Tab
            </ContextMenuItem>
            <ContextMenuItem onClick={handleToggleLockTitle} className="gap-2">
              {useSessionsStore.getState().tabs.find((t) => t.id === tabId)?.lockTitle
                ? <><LockOpen size={14} strokeWidth={1.5} />Unlock Title</>
                : <><Lock size={14} strokeWidth={1.5} />Lock Title</>
              }
            </ContextMenuItem>
            <ContextMenuItem onClick={handleDuplicate} className="gap-2">
              <Copy size={14} strokeWidth={1.5} />
              {connectionId ? 'Duplicate Connection' : 'Duplicate Terminal'}
            </ContextMenuItem>
            {connectionId && (
              <ContextMenuItem onClick={handleSaveAsConnection} className="gap-2">
                <Bookmark size={14} strokeWidth={1.5} />
                Save as Connection
              </ContextMenuItem>
            )}
            {connectionId && (
              <ContextMenuItem onClick={() => toggleSftp(tabId)} className="gap-2">
                <FolderOpen size={14} strokeWidth={1.5} />
                {useSessionsStore.getState().isSftpOpen(tabId) ? 'Close SFTP' : 'Open SFTP'}
              </ContextMenuItem>
            )}
            <ContextMenuItem onClick={handleDetach} className="gap-2">
              <ExternalLink size={14} strokeWidth={1.5} />
              Detach to Window
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleClearTerminal} className="gap-2">
          <Eraser size={14} strokeWidth={1.5} />
          Clear Terminal
        </ContextMenuItem>
        <ContextMenuItem onClick={handleResetTerminal} className="gap-2">
          <RotateCcw size={14} strokeWidth={1.5} />
          Reset Terminal
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleDisconnect} className="gap-2">
          <Unplug size={14} strokeWidth={1.5} />
          Disconnect
        </ContextMenuItem>
      </ContextMenuContent>

      {/* Script status notification */}
      {scriptStatus && (
        <div
          className="fixed bottom-24 right-4 z-50 max-w-sm p-3 rounded-[var(--radius)] bg-[var(--surface-bright)] text-xs text-[var(--on-surface)] shadow-lg backdrop-blur-[12px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <ScrollText size={14} className="text-[#6bd5ff] shrink-0" />
            <p>{scriptStatus}</p>
          </div>
        </div>
      )}

      {/* Copy-format confirmation */}
      {copyFlash && (
        <div
          className="fixed bottom-48 right-4 z-50 p-3 rounded-[var(--radius)] bg-[var(--surface-bright)] text-xs text-[var(--on-surface)] shadow-lg backdrop-blur-[12px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <ClipboardCopy size={14} className="text-[#6bd5ff] shrink-0" />
            <p>{copyFlash}</p>
          </div>
        </div>
      )}

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
      {/* Note saved notification */}
      {noteSaved && (
        <div
          className="fixed bottom-36 right-4 z-50 p-3 rounded-[var(--radius)] bg-[var(--surface-bright)] text-xs text-[var(--on-surface)] shadow-lg backdrop-blur-[12px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <StickyNote size={14} className="text-[#22c55e] shrink-0" />
            <p>{noteSaved}</p>
          </div>
        </div>
      )}
      {/* Rename tab overlay */}
      {renamingTab && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20" onClick={() => setRenamingTab(false)}>
          <div
            className="bg-[var(--surface-bright)] rounded-[var(--radius)] shadow-lg shadow-black/40 p-3 w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c7c4d7]/50 mb-2">Rename Tab</p>
            <div className="flex gap-2">
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTabRename()
                  if (e.key === 'Escape') setRenamingTab(false)
                }}
                className="flex-1 bg-[var(--surface-container-highest)] rounded-[var(--radius)] px-3 py-1.5 text-xs text-[var(--on-surface)] outline-none ghost-border focus:border-[#6bd5ff]/30"
                autoFocus
                maxLength={60}
              />
              <button
                onClick={commitTabRename}
                disabled={!renameValue.trim()}
                className="px-3 py-1.5 rounded-[var(--radius)] text-xs font-semibold bg-[#6bd5ff]/15 text-[#6bd5ff] hover:bg-[#6bd5ff]/25 disabled:opacity-40"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Capture (recording / logging) toast with path actions */}
      {captureToast && (
        <div
          className="fixed bottom-60 right-4 z-50 max-w-sm p-3 rounded-[var(--radius)] bg-[var(--surface-bright)] text-xs text-[var(--on-surface)] shadow-lg backdrop-blur-[12px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <Video size={14} className="text-[var(--error)] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p>{captureToast.message}</p>
              {captureToast.filePath && (
                <>
                  <p className="font-mono text-[10px] text-[#c7c4d7]/70 truncate mt-1" title={captureToast.filePath}>
                    {captureToast.filePath}
                  </p>
                  <div className="flex gap-3 mt-1.5">
                    <button
                      onClick={() => window.bifrost.system.revealPath(captureToast.filePath!)}
                      className="text-[10px] text-[#6bd5ff] hover:underline"
                    >
                      Reveal in folder
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(captureToast.filePath!)}
                      className="text-[10px] text-[#6bd5ff] hover:underline"
                    >
                      Copy path
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <CaptureFilesBrowser
        open={captureBrowserTab !== null}
        defaultTab={captureBrowserTab ?? 'recordings'}
        onClose={() => setCaptureBrowserTab(null)}
      />
    </ContextMenu>
  )
}
