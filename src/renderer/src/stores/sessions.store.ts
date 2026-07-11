import { create } from 'zustand'

export type SplitDirection = 'horizontal' | 'vertical'

export interface TerminalPane {
  id: string
  terminalId: string | null
  title: string
  // One-shot: a still-live backend session id (e.g. `ssh:<id>` or a local PTY id)
  // that this pane should ADOPT on mount instead of opening a fresh connection.
  // Set only when recreating a tab on reattach; consumed once by useTerminal.
  adoptSessionId?: string
  split?: {
    direction: SplitDirection
    panes: [TerminalPane, TerminalPane]
  }
}

export interface TerminalStyle {
  colorScheme?: string
  fontFamily?: string
  fontSize?: number
  cursorStyle?: 'block' | 'underline' | 'bar'
  backgroundColor?: string // custom tint (e.g. #1a0505 for prod)
}

export interface Tab {
  id: string
  title: string
  rootPane: TerminalPane
  isActive: boolean
  connectionId: string | null // null = local terminal, string = SSH connection ID
  lockTitle: boolean
  terminalStyle?: TerminalStyle
  shell?: string // shell path override for local terminals (e.g. /usr/bin/pwsh)
  shellArgs?: string[] // extra args for the shell (e.g. for gsudo elevation)
  aiDetected?: string // AI tool name detected in session (e.g. "claude", "ollama")
  aiCwd?: string // Working directory name detected from AI agent output
}

export type BroadcastMode = 'hidden' | 'off' | 'panes' | 'all-tabs'

interface SessionsState {
  tabs: Tab[]
  activeTabId: string | null
  broadcastMode: BroadcastMode
  reconnectAttempts: Map<string, number>
  maxReconnectAttempts: number
  maximizedPaneId: string | null

  createTab: (title?: string, connectionId?: string, terminalStyle?: TerminalStyle, shell?: string, shellArgs?: string[], adoptSessionId?: string) => string
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  renameTab: (tabId: string, title: string) => void
  setTerminalId: (tabId: string, paneId: string, terminalId: string) => void
  splitPane: (tabId: string, paneId: string, direction: SplitDirection) => void
  closeSplitPane: (tabId: string, paneId: string) => void
  setBroadcastMode: (mode: BroadcastMode) => void
  cycleBroadcastMode: () => void
  setAiDetected: (tabId: string, tool: string) => void
  setAiCwd: (tabId: string, cwd: string) => void
  toggleLockTitle: (tabId: string) => void
  toggleMaximizePane: (paneId: string) => void
  getReconnectAttempts: (sessionId: string) => number
  incrementReconnectAttempts: (sessionId: string) => number
  resetReconnectAttempts: (sessionId: string) => void
  getAllTerminalIds: () => string[]
  getActiveTabTerminalIds: () => string[]
  markTabDetaching: (tabId: string) => void
  isTabDetaching: (tabId: string) => boolean
  toggleSftp: (tabId: string) => void
  isSftpOpen: (tabId: string) => boolean
  /** #6: Explode a tab with splits into separate tabs, one per leaf pane */
  explodePanes: (tabId: string) => void
  /** #7: Combine all open tabs into one tab with vertical splits */
  combineTabs: () => void
}

let paneIdCounter = 0
function newPaneId(): string {
  return `pane-${++paneIdCounter}`
}

let tabIdCounter = 0
function newTabId(): string {
  return `tab-${++tabIdCounter}`
}

function createPane(title: string, adoptSessionId?: string): TerminalPane {
  return { id: newPaneId(), terminalId: null, title, adoptSessionId }
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

function collectLeafPanes(pane: TerminalPane): TerminalPane[] {
  if (pane.split) {
    return [
      ...collectLeafPanes(pane.split.panes[0]),
      ...collectLeafPanes(pane.split.panes[1])
    ]
  }
  return [pane]
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
  broadcastMode: 'hidden',
  reconnectAttempts: new Map(),
  maxReconnectAttempts: 50,
  maximizedPaneId: null,
  _detachingTabs: new Set<string>(),
  sftpOpenTabIds: [] as string[],

  createTab: (title?: string, connectionId?: string, terminalStyle?: TerminalStyle, shell?: string, shellArgs?: string[], adoptSessionId?: string) => {
    const tabId = newTabId()
    const label = title ?? `Terminal ${tabIdCounter}`
    const tab: Tab = {
      id: tabId,
      title: label,
      rootPane: createPane(label, adoptSessionId),
      isActive: true,
      connectionId: connectionId ?? null,
      lockTitle: false,
      terminalStyle,
      shell,
      shellArgs
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
      current === 'hidden' ? 'off' : current === 'off' ? 'panes' : current === 'panes' ? 'all-tabs' : 'hidden'
    set({ broadcastMode: next })
  },

  setAiDetected: (tabId: string, tool: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, aiDetected: t.aiDetected || tool } : t
      )
    }))
  },

  setAiCwd: (tabId: string, cwd: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, aiCwd: cwd } : t
      )
    }))
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

  toggleSftp: (tabId: string) => {
    const current = get().sftpOpenTabIds
    if (current.includes(tabId)) {
      set({ sftpOpenTabIds: current.filter((id) => id !== tabId) })
    } else {
      set({ sftpOpenTabIds: [...current, tabId] })
    }
  },

  isSftpOpen: (tabId: string) => {
    return get().sftpOpenTabIds.includes(tabId)
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
  },

  markTabDetaching: (tabId: string) => {
    get()._detachingTabs.add(tabId)
  },

  isTabDetaching: (tabId: string) => {
    return get()._detachingTabs.has(tabId)
  },

  explodePanes: (tabId: string) => {
    const { tabs } = get()
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab || !tab.rootPane.split) return

    const leaves = collectLeafPanes(tab.rootPane)
    if (leaves.length <= 1) return

    const newTabs: Tab[] = leaves.map((leaf, idx) => {
      const newId = newTabId()
      return {
        id: newId,
        title: leaf.title || `${tab.title} (${idx + 1})`,
        rootPane: { id: leaf.id, terminalId: leaf.terminalId, title: leaf.title },
        isActive: false,
        connectionId: tab.connectionId,
        lockTitle: false
      }
    })

    const firstNewId = newTabs[0].id
    newTabs[0].isActive = true

    set((state) => ({
      tabs: state.tabs
        .filter((t) => t.id !== tabId)
        .map((t) => ({ ...t, isActive: false }))
        .concat(newTabs),
      activeTabId: firstNewId
    }))
  },

  combineTabs: () => {
    const { tabs } = get()
    if (tabs.length <= 1) return

    const allLeaves: TerminalPane[] = []
    for (const tab of tabs) {
      allLeaves.push(...collectLeafPanes(tab.rootPane))
    }

    if (allLeaves.length === 0) return

    // Build a vertical split tree from all leaf panes
    let rootPane: TerminalPane = {
      id: allLeaves[0].id,
      terminalId: allLeaves[0].terminalId,
      title: allLeaves[0].title
    }

    for (let i = 1; i < allLeaves.length; i++) {
      const containerId = newPaneId()
      rootPane = {
        id: containerId,
        terminalId: null,
        title: '',
        split: {
          direction: 'vertical',
          panes: [
            rootPane,
            {
              id: allLeaves[i].id,
              terminalId: allLeaves[i].terminalId,
              title: allLeaves[i].title
            }
          ]
        }
      }
    }

    const combinedId = newTabId()
    const combinedTab: Tab = {
      id: combinedId,
      title: 'Combined',
      rootPane,
      isActive: true,
      connectionId: null,
      lockTitle: false
    }

    set({
      tabs: [combinedTab],
      activeTabId: combinedId
    })
  }
}))
