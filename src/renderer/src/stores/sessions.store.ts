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
}

interface SessionsState {
  tabs: Tab[]
  activeTabId: string | null

  createTab: (title?: string) => string
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  renameTab: (tabId: string, title: string) => void
  setTerminalId: (tabId: string, paneId: string, terminalId: string) => void
  splitPane: (tabId: string, paneId: string, direction: SplitDirection) => void
  closeSplitPane: (tabId: string, paneId: string) => void
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

export const useSessionsStore = create<SessionsState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  createTab: (title?: string) => {
    const tabId = newTabId()
    const label = title ?? `Terminal ${tabIdCounter}`
    const tab: Tab = {
      id: tabId,
      title: label,
      rootPane: createPane(label),
      isActive: true
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
  }
}))
