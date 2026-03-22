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

type NavSection = 'connections' | 'clusters' | 'scripts'

interface SidebarProps {
  onConnectSSH: (connectionId: string) => void
  onQuickConnect: (host: string, port: number, username: string) => void
  activeNav: NavSection
  onNavChange: (section: NavSection) => void
}

const NAV_ITEMS = [
  { id: 'connections', label: 'Connections', icon: Network },
  { id: 'clusters', label: 'Clusters', icon: LayoutGrid },
  { id: 'scripts', label: 'Scripts', icon: Code2 },
  { id: 'keys', label: 'Keys', icon: KeyRound },
  { id: 'logs', label: 'Logs', icon: FileText }
] as const

export function Sidebar({
  onConnectSSH,
  onQuickConnect,
  activeNav,
  onNavChange
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
              onClick={() => {
                if (item.id === 'connections' || item.id === 'clusters' || item.id === 'scripts') {
                  onNavChange(item.id)
                }
              }}
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

      {/* Connection tree */}
      <ConnectionTree onConnect={onConnectSSH} />

      {/* Quick connect toggle */}
      {showQuickConnect && (
        <div className="px-2 pb-2">
          <QuickConnect onConnect={onQuickConnect} />
        </div>
      )}

      {/* Bottom actions */}
      <div className="mt-auto px-2 pb-2 space-y-0.5">
        {/* New connection button */}
        <button
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded transition-colors',
            'text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/50'
          )}
          onClick={() => setShowQuickConnect(!showQuickConnect)}
          aria-label="New connection"
        >
          <Plus size={15} strokeWidth={1.5} />
          <span className="text-xs font-medium tracking-wide uppercase">New Connection</span>
        </button>

        {/* Settings */}
        <button
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded transition-colors',
            'text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/50'
          )}
          aria-label={t('sidebar.settings')}
        >
          <Settings size={15} strokeWidth={1.5} />
          <span>Settings</span>
        </button>

        {/* Support */}
        <button
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded transition-colors',
            'text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/50'
          )}
          aria-label="Support"
        >
          <HelpCircle size={15} strokeWidth={1.5} />
          <span>Support</span>
        </button>
      </div>
    </div>
  )
}
