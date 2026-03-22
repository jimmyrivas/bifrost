import { useEffect, useCallback } from 'react'
import { AppShell } from '@renderer/components/layout/AppShell'
import { useSessionsStore } from '@renderer/stores/sessions.store'

export function App(): JSX.Element {
  const createTab = useSessionsStore((s) => s.createTab)
  const closeTab = useSessionsStore((s) => s.closeTab)
  const activeTabId = useSessionsStore((s) => s.activeTabId)
  const tabs = useSessionsStore((s) => s.tabs)
  const setActiveTab = useSessionsStore((s) => s.setActiveTab)
  const splitPane = useSessionsStore((s) => s.splitPane)

  // Create initial tab on mount
  useEffect(() => {
    if (tabs.length === 0) {
      createTab()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Global keybindings
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl+T: New tab
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault()
        createTab()
      }
      // Ctrl+W: Close active tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault()
        if (activeTabId) closeTab(activeTabId)
      }
      // Ctrl+Tab: Next tab
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        const idx = tabs.findIndex((t) => t.id === activeTabId)
        const next = tabs[(idx + 1) % tabs.length]
        if (next) setActiveTab(next.id)
      }
      // Ctrl+Shift+Tab: Previous tab
      if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault()
        const idx = tabs.findIndex((t) => t.id === activeTabId)
        const prev = tabs[(idx - 1 + tabs.length) % tabs.length]
        if (prev) setActiveTab(prev.id)
      }
      // Ctrl+Shift+H: Split horizontal
      if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        e.preventDefault()
        const tab = tabs.find((t) => t.id === activeTabId)
        if (tab) splitPane(tab.id, tab.rootPane.id, 'horizontal')
      }
      // Ctrl+Shift+V: Split vertical
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault()
        const tab = tabs.find((t) => t.id === activeTabId)
        if (tab) splitPane(tab.id, tab.rootPane.id, 'vertical')
      }
    },
    [activeTabId, tabs, createTab, closeTab, setActiveTab, splitPane]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return <AppShell />
}
