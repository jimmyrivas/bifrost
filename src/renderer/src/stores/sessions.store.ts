import { create } from 'zustand'

export type SplitDirection = 'horizontal' | 'vertical'

export interface TerminalPane {
  id: string
  terminalId: string | null
  title: string
  split?: {
    direction: SplitDirection
    panes: [TerminalPane, TerminalPane]
  }
}

export interface Tab {
  id: string
  title: string
  rootPane: TerminalPane
  isActive: boolean
  connectionId: string | null // null = local terminal, string = SSH connection ID
  lockTitle: boolean
}

export type BroadcastMode = 'off' | 'panes' | 'all-tabs'

interface SessionsState {
  tabs: Tab[]
  activeTabId: string | null
  broadcastMode: BroadcastMode
  reconnectAttempts: Map<string, number>
  maxReconnectAttempts: number
  maximizedPaneId: string | null

  createTab: (title?: string, connectionId?: string) => string
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  renameTab: (tabId: string, title: string) => void
  setTerminalId: (tabId: string, paneId: string, terminalId: string) => void
  splitPane: (tabId: string, paneId: string, direction: SplitDirection) => void
  closeSplitPane: (tabId: string, paneId: string) => void
  setBroadcastMode: (mode: BroadcastMode) => void
  cycleBroadcastMode: () => void
  toggleLockTitle: (tabId: string) => void
  toggleMaximizePane: (paneId: string) => void
  getReconnectAttempts: (sessionId: string) => number
  incrementReconnectAttempts: (sessionId: string) => number
  resetReconnectAttempts: (sessionId: string) => void
  getAllTerminalIds: () => string[]
  getActiveTabTerminalIds: () => string[]
}

let paneIdCounter = 0
function newPaneId(): string {
  return `pane-${++paneIdCounter}`
}

let tabIdCounter = 0
function newTabId(): string {
  return `tab-${++tabIdCounter}`
}

function createPane(title: string): TerminalPane {
  return { id: newPaneId(), terminalId: null, title }
}

function findAndSplitPane(
  pane: TerminalPane,
  targetId: string,
  direction: SplitDirection
): TerminalPane {
  if (pane.id === targetId && !pane.split) {
    return {
      ...pane,
      split: {
        direction,
        panes: [
          { id: pane.id, terminalId: pane.terminalId, title: pane.title },
          createPane(pane.title)
        ]
      },
      terminalId: null
    }
  }
  if (pane.split) {
    return {
      ...pane,
      split: {
        ...pane.split,
        panes: [
          findAndSplitPane(pane.split.panes[0], targetId, direction),
          findAndSplitPane(pane.split.panes[1], targetId, direction)
        ]
      }
    }
  }
  return pane
}

function findAndRemovePane(pane: TerminalPane, targetId: string): TerminalPane | null {
  if (!pane.split) return pane.id === targetId ? null : pane
  const [first, second] = pane.split.panes
  if (first.id === targetId && !first.split) return second
  if (second.id === targetId && !second.split) return first
  const newFirst = findAndRemovePane(first, targetId)
  const newSecond = findAndRemovePane(second, targetId)
  if (!newFirst) return newSecond
  if (!newSecond) return newFirst
  return { ...pane, split: { ...pane.split, panes: [newFirst, newSecond] } }
}

function setTerminalInPane(
  pane: TerminalPane,
  paneId: string,
  terminalId: string
): TerminalPane {
  if (pane.id === paneId && !pane.split) {
    return { ...pane, terminalId }
  }
  if (pane.split) {
    return {
      ...pane,
      split: {
        ...pane.split,
        panes: [
          setTerminalInPane(pane.split.panes[0], paneId, terminalId),
          setTerminalInPane(pane.split.panes[1], paneId, terminalId)
        ]
      }
    }
  }
  return pane
}

function collectTerminalIds(pane: TerminalPane): string[] {
  if (pane.split) {
    return [
      ...collectTerminalIds(pane.split.panes[0]),
      ...collectTerminalIds(pane.split.panes[1])
    ]
  }
  return pane.terminalId ? [pane.terminalId] : []
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  broadcastMode: 'off',
  reconnectAttempts: new Map(),
  maxReconnectAttempts: 50,
  maximizedPaneId: null,

  createTab: (title?: string, connectionId?: string) => {
    const tabId = newTabId()
    const label = title ?? `Terminal ${tabIdCounter}`
    const tab: Tab = {
      id: tabId,
      title: label,
      rootPane: createPane(label),
      isActive: true,
      connectionId: connectionId ?? null,
      lockTitle: false
    }
    set((state) => ({
      tabs: state.tabs.map((t) => ({ ...t, isActive: false })).concat(tab),
      activeTabId: tabId
    }))
    return tabId
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId } = get()
    const idx = tabs.findIndex((t) => t.id === tabId)
    if (idx === -1) return
    const newTabs = tabs.filter((t) => t.id !== tabId)
    let newActiveId = activeTabId
    if (activeTabId === tabId) {
      const nextTab = newTabs[Math.min(idx, newTabs.length - 1)]
      newActiveId = nextTab?.id ?? null
    }
    set({
      tabs: newTabs.map((t) => ({ ...t, isActive: t.id === newActiveId })),
      activeTabId: newActiveId
    })
  },

  setActiveTab: (tabId: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => ({ ...t, isActive: t.id === tabId })),
      activeTabId: tabId
    }))
  },

  renameTab: (tabId: string, title: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title } : t))
    }))
  },

  setTerminalId: (tabId: string, paneId: string, terminalId: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId
          ? { ...t, rootPane: setTerminalInPane(t.rootPane, paneId, terminalId) }
          : t
      )
    }))
  },

  splitPane: (tabId: string, paneId: string, direction: SplitDirection) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId
          ? { ...t, rootPane: findAndSplitPane(t.rootPane, paneId, direction) }
          : t
      )
    }))
  },

  closeSplitPane: (tabId: string, paneId: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.id !== tabId) return t
        const result = findAndRemovePane(t.rootPane, paneId)
        return result ? { ...t, rootPane: result } : t
      })
    }))
  },

  setBroadcastMode: (mode: BroadcastMode) => {
    set({ broadcastMode: mode })
  },

  cycleBroadcastMode: () => {
    const current = get().broadcastMode
    const next: BroadcastMode =
      current === 'off' ? 'panes' : current === 'panes' ? 'all-tabs' : 'off'
    set({ broadcastMode: next })
  },

  toggleLockTitle: (tabId: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, lockTitle: !t.lockTitle } : t
      )
    }))
  },

  toggleMaximizePane: (paneId: string) => {
    const current = get().maximizedPaneId
    set({ maximizedPaneId: current === paneId ? null : paneId })
  },

  getReconnectAttempts: (sessionId: string) => {
    return get().reconnectAttempts.get(sessionId) ?? 0
  },

  incrementReconnectAttempts: (sessionId: string) => {
    const attempts = get().reconnectAttempts
    const current = attempts.get(sessionId) ?? 0
    const next = current + 1
    const updated = new Map(attempts)
    updated.set(sessionId, next)
    set({ reconnectAttempts: updated })
    return next
  },

  resetReconnectAttempts: (sessionId: string) => {
    const attempts = new Map(get().reconnectAttempts)
    attempts.delete(sessionId)
    set({ reconnectAttempts: attempts })
  },

  getAllTerminalIds: () => {
    const { tabs } = get()
    const ids: string[] = []
    for (const tab of tabs) {
      ids.push(...collectTerminalIds(tab.rootPane))
    }
    return ids
  },

  getActiveTabTerminalIds: () => {
    const { tabs, activeTabId } = get()
    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (!activeTab) return []
    return collectTerminalIds(activeTab.rootPane)
  }
}))
