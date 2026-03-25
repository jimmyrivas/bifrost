import { useCallback, useState, useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Search } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'
import { StatusBar } from './StatusBar'
import { CommandPalette } from './CommandPalette'
import { WorkspaceSelector } from './WorkspaceSelector'
import { TerminalPane } from '@renderer/components/terminal/TerminalPane'
import { AIAssistant } from '@renderer/components/terminal/AIAssistant'
import { SftpPanel } from '@renderer/components/terminal/SftpPanel'
import { ClusterManagerUI } from '@renderer/components/cluster/ClusterManagerUI'
import { PCCBar } from '@renderer/components/cluster/PCCBar'
import { TmuxManager } from '@renderer/components/terminal/TmuxManager'
import { ExpectEditor } from '@renderer/components/automation/ExpectEditor'
import { ScriptEditor } from '@renderer/components/automation/ScriptEditor'
import { RemoteCommandsEditor } from '@renderer/components/automation/RemoteCommandsEditor'
import { SnippetBrowser } from '@renderer/components/automation/SnippetBrowser'
import { RunbookEditor } from '@renderer/components/automation/RunbookEditor'
import { TunnelManager } from '@renderer/components/tunnels/TunnelManager'
import { VariableManager } from '@renderer/components/automation/VariableManager'
import { Preferences } from '@renderer/components/settings/Preferences'
import { NotesPanel } from '@renderer/components/settings/NotesPanel'
import { KeyBindings } from '@renderer/components/settings/KeyBindings'
import { ConnectionForm } from '@renderer/components/connections/ConnectionForm'
import { useSessionsStore } from '@renderer/stores/sessions.store'
import { usePreferencesStore } from '@renderer/stores/preferences.store'

export type ViewSection =
  | 'connections'
  | 'clusters'
  | 'scripts'
  | 'keys'
  | 'logs'
  | 'settings'
  | 'new-connection'
  | 'preferences'
  | 'keybindings'
  | 'remote-commands'
  | 'tunnels'
  | 'runbooks'
  | 'notes'

const SPECTRAL_GRADIENT =
  'linear-gradient(135deg, #ff6b6b, #ffa36b, #ffd56b, #6bff6b, #6bd5ff, #6b6bff, #d56bff)'

const TOP_NAV_SECTIONS = ['connections', 'clusters', 'scripts'] as const

export function AppShell(): JSX.Element {
  const tabs = useSessionsStore((s) => s.tabs)
  const activeTabId = useSessionsStore((s) => s.activeTabId)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const createTab = useSessionsStore((s) => s.createTab)
  const [activeView, setActiveView] = useState<ViewSection>('connections')
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false)
  const sftpOpenTabIds = useSessionsStore((s) => s.sftpOpenTabIds)
  const broadcastMode = useSessionsStore((s) => s.broadcastMode)
  const cycleBroadcastMode = useSessionsStore((s) => s.cycleBroadcastMode)

  // Global Ctrl+K shortcut for command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // AI assistant toggle (#97)
  useEffect(() => {
    const handler = (): void => setAiAssistantOpen((prev) => !prev)
    document.addEventListener('toggle:ai-assistant', handler)
    return () => document.removeEventListener('toggle:ai-assistant', handler)
  }, [])

  const handleInsertCommand = useCallback((command: string) => {
    // Write to the active terminal pane
    const tab = tabs.find((t) => t.id === activeTabId)
    if (!tab) return
    const termId = tab.rootPane.terminalId
    if (!termId) return
    if (termId.startsWith('ssh:')) {
      window.bifrost?.ssh?.write(termId.slice(4), command)
    } else {
      window.bifrost?.terminal?.write(termId, command)
    }
  }, [tabs, activeTabId])

  const handleConnectSSH = useCallback(
    async (connectionId: string) => {
      setActiveView('connections')
      try {
        const conn = await window.bifrost.connections.get(connectionId)
        let label = conn?.name ?? `SSH: ${connectionId.slice(0, 8)}`

        // Resolve tab title template if configured (per-connection or global default)
        const template = conn?.tabTitle || usePreferencesStore.getState().terminal.tabTitleTemplate
        if (template && conn) {
          try {
            label = await window.bifrost.connections.resolveTabTitle(template, connectionId)
          } catch { /* fallback to connection name */ }
        }

        // Parse per-connection terminal style overrides from terminalConfig JSON
        let terminalStyle: import('@renderer/stores/sessions.store').TerminalStyle | undefined
        if (conn?.terminalConfig) {
          try {
            const tc = JSON.parse(conn.terminalConfig)
            terminalStyle = {
              colorScheme: tc.colorScheme || undefined,
              fontFamily: tc.fontFamily || undefined,
              fontSize: tc.fontSize || undefined,
              cursorStyle: tc.cursorStyle || undefined,
              backgroundColor: tc.backgroundColor || undefined
            }
          } catch { /* ignore malformed JSON */ }
        }
        createTab(label, connectionId, terminalStyle)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('Failed to get connection:', msg)
        createTab(`Connection ${connectionId.slice(0, 8)}`, connectionId)
      }
    },
    [createTab]
  )

  const handleQuickConnect = useCallback(
    (host: string, _port: number, username: string) => {
      const label = username ? `${username}@${host}` : host
      createTab(label)
      setActiveView('connections')
    },
    [createTab]
  )

  const handleNewConnection = useCallback(() => {
    setEditingConnectionId(null)
    setActiveView('new-connection')
  }, [])

  const handleEditConnection = useCallback((connectionId: string) => {
    setEditingConnectionId(connectionId)
    setActiveView('new-connection')
  }, [])

  const handleConnectionSaved = useCallback(() => {
    setEditingConnectionId(null)
    setActiveView('connections')
  }, [])

  // Build overlay content for non-terminal views
  const renderOverlay = (): JSX.Element | null => {
    switch (activeView) {
      case 'clusters':
        return (
          <div className="flex flex-col gap-6 h-full overflow-y-auto">
            <ClusterManagerUI />
            <div className="px-6 pb-6">
              <TmuxManager
                onSendCommand={(cmd) => {
                  const tab = tabs.find((t) => t.id === activeTabId)
                  const termId = tab?.rootPane.terminalId
                  if (!termId) return
                  if (termId.startsWith('ssh:')) {
                    window.bifrost?.ssh?.write(termId.slice(4), cmd + '\n')
                  } else {
                    window.bifrost?.terminal?.write(termId, cmd + '\n')
                  }
                }}
                isSSH={!!tabs.find((t) => t.id === activeTabId)?.connectionId}
              />
            </div>
          </div>
        )
      case 'scripts':
        return (
          <div className="flex gap-4 p-6 h-full overflow-hidden">
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-w-0">
              <ScriptEditor />
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] mb-3">
                  EXPECT RULES & MACROS
                </p>
                <ExpectEditor rules={[]} onChange={() => {}} />
              </div>
            </div>
            <div className="w-72 shrink-0 overflow-y-auto">
              <SnippetBrowser />
            </div>
          </div>
        )
      case 'remote-commands':
        return (
          <div className="flex flex-col gap-4 p-6 h-full overflow-y-auto">
            <RemoteCommandsEditor />
          </div>
        )
      case 'tunnels':
        return (
          <div className="flex flex-col gap-4 p-6 h-full overflow-y-auto">
            <TunnelManager />
          </div>
        )
      case 'runbooks':
        return (
          <div className="flex flex-col gap-4 p-6 h-full overflow-y-auto">
            <RunbookEditor />
          </div>
        )
      case 'keys':
        return (
          <div className="p-6 h-full overflow-y-auto">
            <VariableManager variables={[]} onChange={() => {}} />
          </div>
        )
      case 'notes':
        return (
          <div className="p-6 h-full overflow-y-auto">
            <NotesPanel />
          </div>
        )
      case 'logs':
        return (
          <div className="flex items-center justify-center h-full text-[#c7c4d7]/60 text-sm">
            Session logs will appear here
          </div>
        )
      case 'settings':
      case 'preferences':
        return (
          <div className="p-6 h-full overflow-y-auto">
            <Preferences />
          </div>
        )
      case 'keybindings':
        return (
          <div className="p-6 h-full overflow-y-auto">
            <KeyBindings />
          </div>
        )
      case 'new-connection':
        return (
          <div className="p-6 h-full overflow-y-auto">
            <ConnectionForm
              connectionId={editingConnectionId ?? undefined}
              onClose={handleConnectionSaved}
            />
          </div>
        )
      default:
        return null
    }
  }

  const overlay = renderOverlay()

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#131316]">
      <div className="h-[2px] w-full shrink-0" style={{ background: SPECTRAL_GRADIENT }} />

      {/* Top navbar */}
      <div className="flex items-center h-10 shrink-0 bg-[#131316] px-4 select-none">
        <span
          className="text-sm font-semibold bg-clip-text text-transparent mr-6"
          style={{ backgroundImage: SPECTRAL_GRADIENT }}
        >
          Bifrost
        </span>
        <nav className="flex items-center gap-1" role="navigation" aria-label="Main navigation">
          {TOP_NAV_SECTIONS.map((section) => (
            <button
              key={section}
              className={cn(
                'px-3 py-1.5 text-sm rounded transition-colors capitalize',
                activeView === section
                  ? 'text-[#e6e1e5] bg-[#2a2a2d]'
                  : 'text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#1b1b1e]'
              )}
              onClick={() => setActiveView(section)}
            >
              {section}
            </button>
          ))}
        </nav>
        <div className="mx-3">
          <WorkspaceSelector />
        </div>
        <div className="flex-1" />
        <button
          className="flex items-center gap-2 px-2 py-1 rounded bg-[#1b1b1e] hover:bg-[#2a2a2d]/50 transition-colors cursor-pointer"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Open command palette"
        >
          <Search size={14} className="text-[#c7c4d7]" />
          <span className="text-sm text-[#c7c4d7]/50 font-[var(--font-ui)] w-40 text-left">
            Search connections...
          </span>
          <kbd className="text-[10px] text-[#c7c4d7]/60 font-mono">Ctrl+K</kbd>
        </button>
      </div>

      {/* Main area */}
      <PanelGroup direction="horizontal" className="flex-1 min-h-0">
        <Panel defaultSize={18} minSize={12} maxSize={30} collapsible>
          <Sidebar
            onConnectSSH={handleConnectSSH}
            onEditConnection={handleEditConnection}
            onQuickConnect={handleQuickConnect}
            activeNav={activeView}
            onNavChange={setActiveView}
            onNewConnection={handleNewConnection}
          />
        </Panel>
        <PanelResizeHandle
          className={cn(
            'w-[2px] shrink-0 transition-colors',
            'bg-[#1b1b1e] hover:bg-[#2a2a2d]',
            'data-[resize-handle-state=drag]:bg-[#2a2a2d]'
          )}
        />
        <Panel>
          <div className="relative h-full bg-[#131316] flex">
            <div className="relative flex-1 min-w-0">
              {/*
                Terminal layer -- ALL tabs always mounted so PTY sessions persist.
                Only the active tab is visible; others use visibility:hidden.
              */}
              <div
                className="absolute inset-0 flex flex-col"
                style={{ visibility: overlay ? 'hidden' : 'visible' }}
              >
                <TabBar />
                {broadcastMode !== 'hidden' && (
                  <PCCBar
                    active={broadcastMode === 'panes' || broadcastMode === 'all-tabs'}
                    onToggle={() => cycleBroadcastMode()}
                    onSend={(text, mode) => {
                      // Send text to all terminals based on mode
                      const ids = mode === 'all'
                        ? useSessionsStore.getState().getAllTerminalIds()
                        : useSessionsStore.getState().getActiveTabTerminalIds()
                      for (const id of ids) {
                        if (id.startsWith('ssh:')) {
                          window.bifrost?.ssh?.write(id.slice(4), text)
                        } else {
                          window.bifrost?.terminal?.write(id, text)
                        }
                      }
                    }}
                  />
                )}
                <div className="relative flex-1 overflow-hidden">
                  {tabs.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <p
                          className="text-4xl font-semibold bg-clip-text text-transparent mb-2"
                          style={{ backgroundImage: SPECTRAL_GRADIENT }}
                        >
                          Bifrost
                        </p>
                        <p className="text-sm text-[#c7c4d7]">Ctrl+T to open a new terminal</p>
                      </div>
                    </div>
                  )}
                  {/* Render ALL tabs, show only active */}
                  {tabs.map((tab) => {
                    const sftpOpen = sftpOpenTabIds.includes(tab.id)
                    // Extract SSH session ID from the first terminal pane
                    const termId = tab.rootPane.terminalId
                    const sshSessionId = termId?.startsWith('ssh:') ? termId.slice(4) : null
                    return (
                      <div
                        key={tab.id}
                        className="absolute inset-0 flex"
                        style={{
                          visibility: tab.id === activeTabId && !overlay ? 'visible' : 'hidden',
                          zIndex: tab.id === activeTabId ? 1 : 0
                        }}
                      >
                        <div className="flex-1 min-w-0 h-full relative">
                          <TerminalPane
                            pane={tab.rootPane}
                            tabId={tab.id}
                            connectionId={tab.connectionId}
                            terminalStyle={tab.terminalStyle}
                            shell={tab.shell}
                            shellArgs={tab.shellArgs}
                          />
                        </div>
                        {sftpOpen && tab.connectionId && (
                          <div
                            className="shrink-0 h-full border-l border-[#1b1b1e] overflow-hidden"
                            style={{ width: 320, resize: 'horizontal', direction: 'rtl', minWidth: 200, maxWidth: 600 }}
                          >
                            <div style={{ direction: 'ltr' }} className="h-full">
                              <SftpPanel
                                sshSessionId={sshSessionId}
                                onClose={() => useSessionsStore.getState().toggleSftp(tab.id)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Overlay layer -- covers terminal area when navigating to other views */}
              {overlay && (
                <div className="absolute inset-0 z-10 bg-[#131316]">
                  {overlay}
                </div>
              )}
            </div>

            {/* AI Assistant side panel (#97) */}
            {aiAssistantOpen && (
              <div className="w-72 shrink-0 border-l border-[#1b1b1e]">
                <AIAssistant
                  open={aiAssistantOpen}
                  onClose={() => setAiAssistantOpen(false)}
                  onInsertCommand={handleInsertCommand}
                  connectionContext={activeTab?.connectionId}
                />
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>

      <StatusBar />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onConnect={handleConnectSSH}
      />
    </div>
  )
}
