import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Network,
  LayoutGrid,
  Code2,
  KeyRound,
  FileText,
  Settings,
  Plus,
  HelpCircle
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { ConnectionTree } from '@renderer/components/connections/ConnectionTree'
import { QuickConnect } from '@renderer/components/connections/QuickConnect'
import type { ViewSection } from './AppShell'

interface SidebarProps {
  onConnectSSH: (connectionId: string) => void
  onQuickConnect: (host: string, port: number, username: string) => void
  activeNav: ViewSection
  onNavChange: (section: ViewSection) => void
  onNewConnection: () => void
}

const NAV_ITEMS: Array<{ id: ViewSection; label: string; icon: typeof Network }> = [
  { id: 'connections', label: 'Connections', icon: Network },
  { id: 'clusters', label: 'Clusters', icon: LayoutGrid },
  { id: 'scripts', label: 'Scripts', icon: Code2 },
  { id: 'keys', label: 'Keys', icon: KeyRound },
  { id: 'logs', label: 'Logs', icon: FileText }
]

export function Sidebar({
  onConnectSSH,
  onQuickConnect,
  activeNav,
  onNavChange,
  onNewConnection
}: SidebarProps): JSX.Element {
  const { t } = useTranslation()
  const [showQuickConnect, setShowQuickConnect] = useState(false)

  return (
    <div className="flex flex-col w-full h-full bg-[#1b1b1e] select-none">
      {/* Workspace title */}
      <div className="px-4 pt-3 pb-2">
        <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#c7c4d7]/60">
          Spectral Command
        </span>
      </div>

      {/* Navigation items */}
      <nav className="px-2 space-y-0.5" role="navigation" aria-label="Sidebar navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeNav
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded transition-colors',
                isActive
                  ? 'bg-[#2a2a2d] text-[#e6e1e5]'
                  : 'text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/50'
              )}
              onClick={() => onNavChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={15} strokeWidth={1.5} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Separator via spacing */}
      <div className="mt-3 mx-3 mb-1">
        <div className="h-[1px] bg-[#2a2a2d]/60" />
      </div>

      {/* Connection tree (only when in connections view) */}
      {activeNav === 'connections' && <ConnectionTree onConnect={onConnectSSH} />}

      {/* Placeholder content for non-connections views */}
      {activeNav !== 'connections' && (
        <div className="flex-1 px-4 py-3 text-xs text-[#c7c4d7]/40">
          {/* Could show contextual sidebar content per section */}
        </div>
      )}

      {/* Quick connect toggle */}
      {showQuickConnect && (
        <div className="px-2 pb-2">
          <QuickConnect onConnect={onQuickConnect} />
        </div>
      )}

      {/* Bottom actions */}
      <div className="mt-auto px-2 pb-2 space-y-0.5">
        <button
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded transition-colors',
            activeNav === 'new-connection'
              ? 'bg-[#2a2a2d] text-[#e6e1e5]'
              : 'text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/50'
          )}
          onClick={onNewConnection}
          aria-label="New connection"
        >
          <Plus size={15} strokeWidth={1.5} />
          <span className="text-xs font-medium tracking-wide uppercase">New Connection</span>
        </button>

        <button
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded transition-colors',
            activeNav === 'settings' || activeNav === 'preferences'
              ? 'bg-[#2a2a2d] text-[#e6e1e5]'
              : 'text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/50'
          )}
          onClick={() => onNavChange('settings')}
          aria-label={t('sidebar.settings')}
        >
          <Settings size={15} strokeWidth={1.5} />
          <span>Settings</span>
        </button>

        <button
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded transition-colors',
            'text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/50'
          )}
          onClick={() => setShowQuickConnect(!showQuickConnect)}
          aria-label="Quick connect"
        >
          <HelpCircle size={15} strokeWidth={1.5} />
          <span>Quick Connect</span>
        </button>
      </div>
    </div>
  )
}
