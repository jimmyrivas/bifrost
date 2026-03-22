import { useCallback } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'
import { StatusBar } from './StatusBar'
import { TerminalPane } from '@renderer/components/terminal/TerminalPane'
import { useSessionsStore } from '@renderer/stores/sessions.store'

export function AppShell(): JSX.Element {
  const tabs = useSessionsStore((s) => s.tabs)
  const activeTabId = useSessionsStore((s) => s.activeTabId)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const createTab = useSessionsStore((s) => s.createTab)

  const handleConnectSSH = useCallback(
    (connectionId: string) => {
      // Create a new tab for this SSH connection
      createTab(`SSH: ${connectionId.slice(0, 8)}`)
      // TODO: In Phase 3+, auto-connect the tab to the SSH session
    },
    [createTab]
  )

  const handleQuickConnect = useCallback(
    (host: string, _port: number, username: string) => {
      const label = username ? `${username}@${host}` : host
      createTab(label)
      // TODO: In Phase 3+, create ephemeral connection and auto-connect
    },
    [createTab]
  )

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950">
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={15} minSize={10} maxSize={30} collapsible>
          <Sidebar onConnectSSH={handleConnectSSH} onQuickConnect={handleQuickConnect} />
        </Panel>
        <PanelResizeHandle className="w-[2px] bg-zinc-800 hover:bg-blue-500 transition-colors data-[resize-handle-state=drag]:bg-blue-400" />
        <Panel>
          <div className="flex flex-col h-full">
            <TabBar />
            <div className="flex-1 overflow-hidden">
              {activeTab ? (
                <TerminalPane pane={activeTab.rootPane} tabId={activeTab.id} />
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600">
                  <div className="text-center">
                    <p
                      className="text-4xl font-bold bg-clip-text text-transparent mb-2"
                      style={{
                        backgroundImage: 'linear-gradient(135deg, #ff6b6b, #ffa36b, #ffd56b, #6bff6b, #6bd5ff, #6b6bff, #d56bff)'
                      }}
                    >
                      Bifrost
                    </p>
                    <p className="text-sm text-zinc-500">
                      Ctrl+T to open a new terminal
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
      <StatusBar />
    </div>
  )
}
