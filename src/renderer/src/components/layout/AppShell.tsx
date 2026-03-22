import { useCallback, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Search } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'
import { StatusBar } from './StatusBar'
import { TerminalPane } from '@renderer/components/terminal/TerminalPane'
import { useSessionsStore } from '@renderer/stores/sessions.store'

type NavSection = 'connections' | 'clusters' | 'scripts'

const SPECTRAL_GRADIENT =
  'linear-gradient(135deg, #ff6b6b, #ffa36b, #ffd56b, #6bff6b, #6bd5ff, #6b6bff, #d56bff)'

export function AppShell(): JSX.Element {
  const tabs = useSessionsStore((s) => s.tabs)
  const activeTabId = useSessionsStore((s) => s.activeTabId)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const createTab = useSessionsStore((s) => s.createTab)
  const [activeNav, setActiveNav] = useState<NavSection>('connections')

  const handleConnectSSH = useCallback(
    (connectionId: string) => {
      createTab(`SSH: ${connectionId.slice(0, 8)}`)
    },
    [createTab]
  )

  const handleQuickConnect = useCallback(
    (host: string, _port: number, username: string) => {
      const label = username ? `${username}@${host}` : host
      createTab(label)
    },
    [createTab]
  )

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#131316]">
      {/* Spectral gradient top line */}
      <div
        className="h-[2px] w-full shrink-0"
        style={{ background: SPECTRAL_GRADIENT }}
      />

      {/* Top navbar */}
      <div className="flex items-center h-10 shrink-0 bg-[#131316] px-4 select-none">
        {/* Brand */}
        <span
          className="text-sm font-semibold bg-clip-text text-transparent mr-6"
          style={{ backgroundImage: SPECTRAL_GRADIENT }}
        >
          Bifrost
        </span>

        {/* Nav tabs */}
        <nav className="flex items-center gap-1" role="navigation" aria-label="Main navigation">
          {(['connections', 'clusters', 'scripts'] as const).map((section) => (
            <button
              key={section}
              className={cn(
                'px-3 py-1.5 text-sm rounded transition-colors capitalize',
                activeNav === section
                  ? 'text-[#e6e1e5] bg-[#2a2a2d]'
                  : 'text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#1b1b1e]'
              )}
              onClick={() => setActiveNav(section)}
              aria-current={activeNav === section ? 'page' : undefined}
            >
              {section}
            </button>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#1b1b1e]">
          <Search size={14} className="text-[#c7c4d7]" />
          <input
            type="text"
            placeholder="Search sessions..."
            className="bg-transparent text-sm text-[#e6e1e5] placeholder-[#c7c4d7]/50 outline-none w-40 font-['Inter']"
            aria-label="Search sessions"
          />
          <kbd className="text-[10px] text-[#c7c4d7]/60 font-mono">Ctrl+K</kbd>
        </div>
      </div>

      {/* Main area: sidebar + terminal */}
      <PanelGroup direction="horizontal" className="flex-1 min-h-0">
        <Panel defaultSize={18} minSize={12} maxSize={30} collapsible>
          <Sidebar
            onConnectSSH={handleConnectSSH}
            onQuickConnect={handleQuickConnect}
            activeNav={activeNav}
            onNavChange={setActiveNav}
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
          <div className="flex flex-col h-full bg-[#131316]">
            <TabBar />
            <div className="flex-1 overflow-hidden">
              {activeTab ? (
                <TerminalPane pane={activeTab.rootPane} tabId={activeTab.id} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p
                      className="text-4xl font-semibold bg-clip-text text-transparent mb-2"
                      style={{ backgroundImage: SPECTRAL_GRADIENT }}
                    >
                      Bifrost
                    </p>
                    <p className="text-sm text-[#c7c4d7]">
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
