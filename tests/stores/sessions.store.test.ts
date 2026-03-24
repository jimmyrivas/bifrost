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

  it('explodes a split tab into separate tabs', () => {
    const { createTab } = useSessionsStore.getState()
    const tabId = createTab('Split Tab')

    const paneId = useSessionsStore.getState().tabs[0].rootPane.id
    useSessionsStore.getState().splitPane(tabId, paneId, 'horizontal')

    useSessionsStore.getState().explodePanes(tabId)

    const { tabs } = useSessionsStore.getState()
    expect(tabs.length).toBe(2)
    expect(tabs[0].rootPane.split).toBeUndefined()
    expect(tabs[1].rootPane.split).toBeUndefined()
  })

  it('does nothing when exploding a tab without splits', () => {
    const { createTab } = useSessionsStore.getState()
    createTab('No Split')

    useSessionsStore.getState().explodePanes(useSessionsStore.getState().tabs[0].id)

    expect(useSessionsStore.getState().tabs.length).toBe(1)
  })

  it('combines multiple tabs into one with splits', () => {
    const { createTab } = useSessionsStore.getState()
    createTab('Tab 1')
    createTab('Tab 2')
    createTab('Tab 3')

    useSessionsStore.getState().combineTabs()

    const { tabs } = useSessionsStore.getState()
    expect(tabs.length).toBe(1)
    expect(tabs[0].title).toBe('Combined')
    expect(tabs[0].rootPane.split).toBeDefined()
  })

  it('does nothing when combining with only one tab', () => {
    const { createTab } = useSessionsStore.getState()
    createTab('Only Tab')

    useSessionsStore.getState().combineTabs()

    expect(useSessionsStore.getState().tabs.length).toBe(1)
    expect(useSessionsStore.getState().tabs[0].title).toBe('Only Tab')
  })

  it('toggles SFTP open state for a tab', () => {
    const { createTab, toggleSftp, isSftpOpen } = useSessionsStore.getState()
    const tabId = createTab('SSH Tab')

    expect(isSftpOpen(tabId)).toBe(false)

    toggleSftp(tabId)
    expect(useSessionsStore.getState().isSftpOpen(tabId)).toBe(true)

    useSessionsStore.getState().toggleSftp(tabId)
    expect(useSessionsStore.getState().isSftpOpen(tabId)).toBe(false)
  })

  it('toggles lock title on a tab', () => {
    const { createTab } = useSessionsStore.getState()
    const tabId = createTab('Tab')

    expect(useSessionsStore.getState().tabs[0].lockTitle).toBe(false)

    useSessionsStore.getState().toggleLockTitle(tabId)
    expect(useSessionsStore.getState().tabs[0].lockTitle).toBe(true)

    useSessionsStore.getState().toggleLockTitle(tabId)
    expect(useSessionsStore.getState().tabs[0].lockTitle).toBe(false)
  })
})
