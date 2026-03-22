import { useEffect, useCallback, useRef } from 'react'
import { AppShell } from '@renderer/components/layout/AppShell'
import { useSessionsStore } from '@renderer/stores/sessions.store'

const CHORD_TIMEOUT = 1000

export function App(): JSX.Element {
  // Use stable selectors — avoid s.tabs which creates new array ref each time
  const createTab = useSessionsStore((s) => s.createTab)
  const closeTab = useSessionsStore((s) => s.closeTab)
  const setActiveTab = useSessionsStore((s) => s.setActiveTab)
  const splitPane = useSessionsStore((s) => s.splitPane)
  const cycleBroadcastMode = useSessionsStore((s) => s.cycleBroadcastMode)
  const toggleMaximizePane = useSessionsStore((s) => s.toggleMaximizePane)

  // Multi-chord hotkey state (#33)
  const pendingChordRef = useRef<string | null>(null)
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Create initial tab on mount
  useEffect(() => {
    const { tabs } = useSessionsStore.getState()
    if (tabs.length === 0) {
      createTab()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Ctrl+Shift+V: Split vertical
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault()
        const { tabs, activeTabId } = useSessionsStore.getState()
        const tab = tabs.find((t) => t.id === activeTabId)
        if (tab) splitPane(tab.id, tab.rootPane.id, 'vertical')
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

  return <AppShell />
}
