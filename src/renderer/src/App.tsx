import { useEffect, useCallback, useRef, useMemo, useState } from 'react'
import { AppShell } from '@renderer/components/layout/AppShell'
import { DetachedTerminal } from '@renderer/components/terminal/DetachedTerminal'
import { DetachedAIAssistant } from '@renderer/components/terminal/DetachedAIAssistant'
import { MarkdownViewer } from '@renderer/components/markdown/MarkdownViewer'
import { RestoreSessionPrompt } from '@renderer/components/layout/RestoreSessionPrompt'
import { useSessionsStore } from '@renderer/stores/sessions.store'
import { useMarkdownViewerStore } from '@renderer/stores/markdownViewer.store'
import { usePreferencesStore } from '@renderer/stores/preferences.store'
import { readManifest, writeManifest, deriveManifest } from '@renderer/lib/session-manifest'

interface MarkdownOpenDetail {
  sessionId: string
  path: string
  host?: string | null
}

const CHORD_TIMEOUT = 1000

export function App(): JSX.Element {
  // Use stable selectors — avoid s.tabs which creates new array ref each time
  const createTab = useSessionsStore((s) => s.createTab)
  const closeTab = useSessionsStore((s) => s.closeTab)
  const setActiveTab = useSessionsStore((s) => s.setActiveTab)
  const splitPane = useSessionsStore((s) => s.splitPane)
  const cycleBroadcastMode = useSessionsStore((s) => s.cycleBroadcastMode)
  const toggleMaximizePane = useSessionsStore((s) => s.toggleMaximizePane)

  // This window's role: detached terminal / detached AI assistant / main window.
  // Detached windows share the same origin (localStorage), so session-restore must
  // run only in the main window — otherwise a detached window would clobber the manifest.
  const { detachTabId, aiDetach } = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return { detachTabId: params.get('detach'), aiDetach: params.get('aiDetach') === '1' }
  }, [])
  const isMainWindow = !detachTabId && !aiDetach

  // Multi-chord hotkey state (#33)
  const pendingChordRef = useRef<string | null>(null)
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Session restore: read the previous session's manifest once, before any tab is
  // created, so the restore prompt can offer it and persistence can't overwrite it first.
  const [restoreManifest] = useState(() => (isMainWindow ? readManifest() : { tabs: [], activeIndex: 0 }))
  const [restoreDecided, setRestoreDecided] = useState(false)
  const showRestorePrompt = isMainWindow && !restoreDecided && restoreManifest.tabs.length > 0

  // Create initial tab on mount (or defer to the restore prompt when there's a manifest)
  useEffect(() => {
    if (!isMainWindow) {
      if (useSessionsStore.getState().tabs.length === 0) createTab()
      return
    }
    if (restoreManifest.tabs.length === 0) {
      if (useSessionsStore.getState().tabs.length === 0) createTab()
      setRestoreDecided(true)
    }
    // else: wait for the user's choice in the restore prompt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist the open-tabs manifest (main window only, after the restore decision).
  useEffect(() => {
    if (!isMainWindow || !restoreDecided) return
    const persist = (): void => {
      const { tabs, activeTabId } = useSessionsStore.getState()
      const localMuxEnabled = usePreferencesStore.getState().localMultiplexer.preferred !== 'none'
      writeManifest(deriveManifest(tabs, activeTabId, localMuxEnabled))
    }
    persist()
    // Vanilla store subscription (not a React selector) — no re-render loop.
    return useSessionsStore.subscribe(persist)
  }, [isMainWindow, restoreDecided])

  const handleRestore = useCallback(async () => {
    for (let i = 0; i < restoreManifest.tabs.length; i++) {
      const mt = restoreManifest.tabs[i]
      if (mt.connectionId) {
        // Skip silently if the connection was deleted since last session.
        try {
          const conn = await window.bifrost.connections.get(mt.connectionId)
          if (!conn) continue
        } catch {
          continue
        }
      }
      const id = createTab(mt.title, mt.connectionId ?? undefined, mt.terminalStyle, mt.shell, mt.shellArgs)
      if (mt.lockTitle) useSessionsStore.getState().toggleLockTitle(id)
    }
    // Activate the previously-active tab when it survived restore.
    const restored = useSessionsStore.getState().tabs
    const active = restored[restoreManifest.activeIndex]
    if (active) setActiveTab(active.id)
    if (restored.length === 0) createTab()
    setRestoreDecided(true)
  }, [restoreManifest, createTab, setActiveTab])

  const handleStartFresh = useCallback(() => {
    if (useSessionsStore.getState().tabs.length === 0) createTab()
    setRestoreDecided(true)
  }, [createTab])

  // Open the internal Markdown viewer when a terminal Ctrl+Clicks a .md path.
  useEffect(() => {
    const onOpen = (e: Event): void => {
      const detail = (e as CustomEvent<MarkdownOpenDetail>).detail
      if (!detail?.sessionId || !detail?.path) return
      useMarkdownViewerStore
        .getState()
        .openFor(detail.sessionId, detail.path, detail.host ?? undefined)
    }
    document.addEventListener('markdown:open', onOpen)
    return () => document.removeEventListener('markdown:open', onOpen)
  }, [])

  const clearChord = useCallback(() => {
    pendingChordRef.current = null
    if (chordTimerRef.current) {
      clearTimeout(chordTimerRef.current)
      chordTimerRef.current = null
    }
  }, [])

  const setChord = useCallback(
    (chord: string) => {
      pendingChordRef.current = chord
      if (chordTimerRef.current) clearTimeout(chordTimerRef.current)
      chordTimerRef.current = setTimeout(clearChord, CHORD_TIMEOUT)
    },
    [clearChord]
  )

  // Global keybindings with multi-chord support (#33)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const pending = pendingChordRef.current

      // Multi-chord resolution: Ctrl+K was pressed previously
      if (pending === 'ctrl+k') {
        e.preventDefault()
        clearChord()

        if (e.ctrlKey && e.key === 's') {
          document.dispatchEvent(new CustomEvent('chord:ctrl+k:ctrl+s'))
          return
        }
        if (e.ctrlKey && e.key === 'p') {
          document.dispatchEvent(new CustomEvent('chord:ctrl+k:ctrl+p'))
          return
        }
        if (e.ctrlKey && e.key === 'w') {
          document.dispatchEvent(new CustomEvent('chord:ctrl+k:ctrl+w'))
          return
        }
        return
      }

      // Ctrl+Shift+A: Toggle AI assistant (#97)
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('toggle:ai-assistant'))
        return
      }

      // Ctrl+T: New tab
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault()
        createTab()
      }
      // Ctrl+W: Close active tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault()
        const { activeTabId } = useSessionsStore.getState()
        if (activeTabId) closeTab(activeTabId)
      }
      // Ctrl+Tab: Next tab
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        const { tabs, activeTabId } = useSessionsStore.getState()
        const idx = tabs.findIndex((t) => t.id === activeTabId)
        const next = tabs[(idx + 1) % tabs.length]
        if (next) setActiveTab(next.id)
      }
      // Ctrl+Shift+Tab: Previous tab
      if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault()
        const { tabs, activeTabId } = useSessionsStore.getState()
        const idx = tabs.findIndex((t) => t.id === activeTabId)
        const prev = tabs[(idx - 1 + tabs.length) % tabs.length]
        if (prev) setActiveTab(prev.id)
      }
      // Ctrl+Shift+H: Split horizontal
      if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        e.preventDefault()
        const { tabs, activeTabId } = useSessionsStore.getState()
        const tab = tabs.find((t) => t.id === activeTabId)
        if (tab) splitPane(tab.id, tab.rootPane.id, 'horizontal')
      }
      // Ctrl+\: Split vertical (tmux/iTerm2 convention)
      if (e.ctrlKey && e.key === '\\' && !e.shiftKey) {
        e.preventDefault()
        const { tabs, activeTabId } = useSessionsStore.getState()
        const tab = tabs.find((t) => t.id === activeTabId)
        if (tab) splitPane(tab.id, tab.rootPane.id, 'vertical')
      }
      // Ctrl+Shift+C: Copy from terminal
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        // Find active pane's terminal selection
        const { tabs, activeTabId } = useSessionsStore.getState()
        const tab = tabs.find((t) => t.id === activeTabId)
        const paneId = tab?.rootPane?.id
        if (paneId) {
          const paneEl = document.querySelector(`[data-pane-id="${paneId}"]`) as HTMLElement
          const selection = paneEl?.dataset?.terminalSelection?.trim()
          if (selection) navigator.clipboard.writeText(selection)
        }
        return
      }
      // Ctrl+Shift+V: Paste to terminal
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('terminal:paste'))
        return
      }
      // Ctrl+Shift+I: Paste image from clipboard to the connected server
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('terminal:paste-image'))
        return
      }
      // Ctrl+Shift+D: Disconnect/close session
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        const { activeTabId } = useSessionsStore.getState()
        if (activeTabId) closeTab(activeTabId)
        return
      }
      // Ctrl+Shift+B: Toggle broadcast mode (off -> panes -> all-tabs -> off)
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault()
        cycleBroadcastMode()
      }
      // Ctrl+=: Zoom in
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('terminal:zoom-in'))
      }
      // Ctrl+-: Zoom out
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('terminal:zoom-out'))
      }
      // Ctrl+0: Reset zoom
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('terminal:zoom-reset'))
      }
      // Ctrl+1-9: Jump to tab by number
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const idx = parseInt(e.key, 10) - 1
        const { tabs } = useSessionsStore.getState()
        if (idx < tabs.length) {
          setActiveTab(tabs[idx].id)
        }
        return
      }
      // Ctrl+Shift+M: Maximize pane (#4)
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        const state = useSessionsStore.getState()
        const tab = state.tabs.find((t) => t.id === state.activeTabId)
        if (tab) toggleMaximizePane(tab.rootPane.id)
      }
      // Ctrl+Shift+Arrow: Pane resize (#5)
      if (e.ctrlKey && e.shiftKey && ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('terminal:pane-resize', { detail: e.key }))
      }
      // F11: Fullscreen (#73)
      if (e.key === 'F11') {
        e.preventDefault()
        if (window.bifrost?.window) {
          window.bifrost.window.toggleFullscreen()
        }
      }

      // Ctrl+K: Begin chord (#33) - also handled by AppShell for command palette
      if (e.ctrlKey && e.key === 'k' && !e.shiftKey && !e.altKey) {
        setChord('ctrl+k')
      }
    },
    [createTab, closeTab, setActiveTab, splitPane, cycleBroadcastMode, toggleMaximizePane, clearChord, setChord]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (aiDetach) {
    return <DetachedAIAssistant />
  }

  if (detachTabId) {
    return <DetachedTerminal tabId={detachTabId} />
  }

  return (
    <>
      <AppShell />
      <MarkdownViewer />
      {showRestorePrompt && (
        <RestoreSessionPrompt
          count={restoreManifest.tabs.length}
          onRestore={handleRestore}
          onStartFresh={handleStartFresh}
        />
      )}
    </>
  )
}
