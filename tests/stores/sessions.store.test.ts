import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionsStore } from '../../src/renderer/src/stores/sessions.store'

describe('Sessions Store', () => {
  beforeEach(() => {
    useSessionsStore.setState({ tabs: [], activeTabId: null })
  })

  it('creates a new tab and sets it as active', () => {
    const { createTab } = useSessionsStore.getState()
    const tabId = createTab('Test Tab')

    const { tabs, activeTabId } = useSessionsStore.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs[0].title).toBe('Test Tab')
    expect(tabs[0].id).toBe(tabId)
    expect(activeTabId).toBe(tabId)
    expect(tabs[0].isActive).toBe(true)
  })

  it('creates tab with default title when none provided', () => {
    const { createTab } = useSessionsStore.getState()
    createTab()

    const { tabs } = useSessionsStore.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs[0].title).toMatch(/^Terminal \d+$/)
  })

  it('deactivates previous tab when creating a new one', () => {
    const { createTab } = useSessionsStore.getState()
    createTab('Tab 1')
    createTab('Tab 2')

    const { tabs } = useSessionsStore.getState()
    expect(tabs).toHaveLength(2)
    expect(tabs[0].isActive).toBe(false)
    expect(tabs[1].isActive).toBe(true)
  })

  it('closes a tab and activates the next one', () => {
    const { createTab } = useSessionsStore.getState()
    const tab1 = createTab('Tab 1')
    const tab2 = createTab('Tab 2')
    createTab('Tab 3')

    useSessionsStore.getState().setActiveTab(tab1)
    useSessionsStore.getState().closeTab(tab1)

    const { tabs, activeTabId } = useSessionsStore.getState()
    expect(tabs).toHaveLength(2)
    expect(activeTabId).toBe(tab2)
  })

  it('sets activeTabId to null when closing the last tab', () => {
    const { createTab } = useSessionsStore.getState()
    const tabId = createTab('Only Tab')

    useSessionsStore.getState().closeTab(tabId)

    const { tabs, activeTabId } = useSessionsStore.getState()
    expect(tabs).toHaveLength(0)
    expect(activeTabId).toBeNull()
  })

  it('switches active tab', () => {
    const { createTab } = useSessionsStore.getState()
    const tab1 = createTab('Tab 1')
    createTab('Tab 2')

    useSessionsStore.getState().setActiveTab(tab1)

    const { tabs, activeTabId } = useSessionsStore.getState()
    expect(activeTabId).toBe(tab1)
    expect(tabs.find((t) => t.id === tab1)?.isActive).toBe(true)
  })

  it('renames a tab', () => {
    const { createTab } = useSessionsStore.getState()
    const tabId = createTab('Old Name')

    useSessionsStore.getState().renameTab(tabId, 'New Name')

    const { tabs } = useSessionsStore.getState()
    expect(tabs[0].title).toBe('New Name')
  })

  it('splits a pane horizontally', () => {
    const { createTab } = useSessionsStore.getState()
    const tabId = createTab('Tab 1')

    const { tabs } = useSessionsStore.getState()
    const paneId = tabs[0].rootPane.id

    useSessionsStore.getState().splitPane(tabId, paneId, 'horizontal')

    const updated = useSessionsStore.getState().tabs[0]
    expect(updated.rootPane.split).toBeDefined()
    expect(updated.rootPane.split?.direction).toBe('horizontal')
    expect(updated.rootPane.split?.panes).toHaveLength(2)
  })

  it('splits a pane vertically', () => {
    const { createTab } = useSessionsStore.getState()
    const tabId = createTab('Tab 1')

    const { tabs } = useSessionsStore.getState()
    const paneId = tabs[0].rootPane.id

    useSessionsStore.getState().splitPane(tabId, paneId, 'vertical')

    const updated = useSessionsStore.getState().tabs[0]
    expect(updated.rootPane.split?.direction).toBe('vertical')
  })

  it('sets terminal id on a pane', () => {
    const { createTab } = useSessionsStore.getState()
    const tabId = createTab('Tab 1')

    const { tabs } = useSessionsStore.getState()
    const paneId = tabs[0].rootPane.id

    useSessionsStore.getState().setTerminalId(tabId, paneId, 'terminal-1')

    const updated = useSessionsStore.getState().tabs[0]
    expect(updated.rootPane.terminalId).toBe('terminal-1')
  })

  it('closes a split pane and keeps the other', () => {
    const { createTab } = useSessionsStore.getState()
    const tabId = createTab('Tab 1')

    const paneId = useSessionsStore.getState().tabs[0].rootPane.id
    useSessionsStore.getState().splitPane(tabId, paneId, 'horizontal')

    const splitPanes = useSessionsStore.getState().tabs[0].rootPane.split?.panes
    expect(splitPanes).toBeDefined()

    const secondPaneId = splitPanes![1].id
    useSessionsStore.getState().closeSplitPane(tabId, secondPaneId)

    const result = useSessionsStore.getState().tabs[0].rootPane
    expect(result.split).toBeUndefined()
  })
})
