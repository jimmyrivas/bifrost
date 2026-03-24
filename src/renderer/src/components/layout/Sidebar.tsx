import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Network,
  LayoutGrid,
  Code2,
  KeyRound,
  FileText,
  StickyNote,
  Settings,
  Plus,
  HelpCircle,
  Search,
  X,
  Star,
  Clock,
  ChevronDown,
  ChevronRight,
  Terminal,
  Monitor,
  Tv,
  Radio,
  Laptop,
  Zap
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { ConnectionTree } from '@renderer/components/connections/ConnectionTree'
import { QuickConnect } from '@renderer/components/connections/QuickConnect'
import { useConnectionsStore, type Connection } from '@renderer/stores/connections.store'
import { useWorkspaceStore } from '@renderer/stores/workspace.store'
import type { ViewSection } from './AppShell'

interface SidebarProps {
  onConnectSSH: (connectionId: string) => void
  onEditConnection: (connectionId: string) => void
  onQuickConnect: (host: string, port: number, username: string) => void
  activeNav: ViewSection
  onNavChange: (section: ViewSection) => void
  onNewConnection: () => void
}

const NAV_ITEMS: Array<{ id: ViewSection; label: string; icon: typeof Network }> = [
  { id: 'connections', label: 'Connections', icon: Network },
  { id: 'clusters', label: 'Clusters', icon: LayoutGrid },
  { id: 'scripts', label: 'Scripts', icon: Code2 },
  { id: 'remote-commands', label: 'Remote Cmds', icon: Zap },
  { id: 'runbooks', label: 'Runbooks', icon: FileText },
  { id: 'tunnels', label: 'Tunnels', icon: Network },
  { id: 'keys', label: 'Keys', icon: KeyRound },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'logs', label: 'Logs', icon: FileText }
]

/** Section header label */
function SectionLabel({ label, icon: Icon, count }: { label: string; icon?: typeof Clock; count?: number }): JSX.Element {
  return (
    <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
      {Icon && <Icon size={10} strokeWidth={1.5} className="text-[#c7c4d7]/40" />}
      <span className="text-[9px] font-semibold tracking-[0.14em] uppercase text-[#c7c4d7]/45">
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span className="text-[9px] text-[#c7c4d7]/20 ml-auto">{count}</span>
      )}
    </div>
  )
}

function MethodIcon({ method }: { method: string }): JSX.Element {
  const props = { size: 13, strokeWidth: 1.5, className: 'shrink-0 text-[#c7c4d7]/60' }
  switch (method) {
    case 'ssh':
      return <Terminal {...props} />
    case 'mosh':
      return <Terminal {...props} className="shrink-0 text-[#22c55e]/60" />
    case 'rdp':
      return <Monitor {...props} />
    case 'vnc':
      return <Tv {...props} />
    case 'telnet':
      return <Radio {...props} />
    case 'local':
      return <Laptop {...props} />
    default:
      return <Terminal {...props} />
  }
}

function formatTimestamp(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function FavoritesSection({
  onConnect,
  onEdit
}: {
  onConnect: (id: string) => void
  onEdit: (id: string) => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const favorites = useConnectionsStore((s) => s.favorites)
  const connections = useConnectionsStore((s) => s.connections)
  const addRecent = useConnectionsStore((s) => s.addRecent)

  const favoriteConns = connections.filter((c) => favorites.includes(c.id))

  if (favoriteConns.length === 0) return <></>

  const handleConnect = (id: string): void => {
    addRecent(id)
    onConnect(id)
  }

  return (
    <div>
      <button
        className="w-full flex items-center gap-1.5 px-3 py-1 text-[#c7c4d7]/50 hover:text-[#c7c4d7]/70 transition-colors"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown size={10} strokeWidth={1.5} className="shrink-0" />
        ) : (
          <ChevronRight size={10} strokeWidth={1.5} className="shrink-0" />
        )}
        <Star size={10} strokeWidth={1.5} className="shrink-0 text-[#ffd56b]/60" />
        <span className="text-[9px] font-semibold tracking-[0.12em] uppercase">Favorites</span>
        <span className="text-[9px] text-[#c7c4d7]/25 ml-auto">{favoriteConns.length}</span>
      </button>
      {expanded && (
        <div className="py-0.5">
          {favoriteConns.map((conn) => (
            <button
              key={conn.id}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-[12px] text-[#c7c4d7] hover:bg-[#2a2a2d]/50 hover:text-[#e6e1e5] transition-colors"
              onClick={() => onEdit(conn.id)}
              onDoubleClick={() => handleConnect(conn.id)}
            >
              <MethodIcon method={conn.method} />
              <div className="flex flex-col min-w-0">
                <span className="truncate font-[var(--font-ui)]">{conn.name}</span>
                {conn.host && (
                  <span className="truncate text-[9px] text-[#c7c4d7]/40 leading-tight">
                    {conn.username ? `${conn.username}@` : ''}{conn.host}
                  </span>
                )}
              </div>
              <Star size={8} strokeWidth={0} fill="#ffd56b" className="shrink-0 ml-auto" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Recent section — collapsed by default, shows count; expands on click */
function RecentSection({
  onConnect,
  onEdit
}: {
  onConnect: (id: string) => void
  onEdit: (id: string) => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const recentConnections = useConnectionsStore((s) => s.recentConnections)
  const connections = useConnectionsStore((s) => s.connections)
  const addRecent = useConnectionsStore((s) => s.addRecent)

  const recentConns = recentConnections
    .map((r) => {
      const conn = connections.find((c) => c.id === r.id)
      return conn ? { ...conn, timestamp: r.timestamp } : null
    })
    .filter((c): c is Connection & { timestamp: number } => c != null)

  if (recentConns.length === 0) return <></>

  const handleConnect = (id: string): void => {
    addRecent(id)
    onConnect(id)
  }

  return (
    <div>
      <button
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[#c7c4d7]/50 hover:text-[#c7c4d7]/70 transition-colors"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown size={10} strokeWidth={1.5} className="shrink-0" />
        ) : (
          <ChevronRight size={10} strokeWidth={1.5} className="shrink-0" />
        )}
        <Clock size={10} strokeWidth={1.5} className="shrink-0 text-[#c7c4d7]/40" />
        <span className="text-[9px] font-semibold tracking-[0.12em] uppercase">Recent</span>
        <span className="text-[9px] text-[#c7c4d7]/30 ml-auto">{recentConns.length}</span>
      </button>
      {expanded && (
        <div className="py-0.5">
          {recentConns.map((conn) => (
            <button
              key={conn.id}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-[12px] text-[#c7c4d7] hover:bg-[#2a2a2d]/50 hover:text-[#e6e1e5] transition-colors"
              onClick={() => onEdit(conn.id)}
              onDoubleClick={() => handleConnect(conn.id)}
            >
              <MethodIcon method={conn.method} />
              <div className="flex flex-col min-w-0">
                <span className="truncate font-[var(--font-ui)]">{conn.name}</span>
                {conn.host && (
                  <span className="truncate text-[9px] text-[#c7c4d7]/40 leading-tight">
                    {conn.username ? `${conn.username}@` : ''}{conn.host}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[#c7c4d7]/25 ml-auto shrink-0">
                {formatTimestamp(conn.timestamp)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar({
  onConnectSSH,
  onEditConnection,
  onQuickConnect,
  activeNav,
  onNavChange,
  onNewConnection
}: SidebarProps): JSX.Element {
  const { t } = useTranslation()
  const [showQuickConnect, setShowQuickConnect] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const workspaceFilter = activeWorkspaceId
    ? useWorkspaceStore.getState().getActiveConnectionFilter()
    : null

  const handleClearSearch = useCallback(() => {
    setSearchFilter('')
  }, [])

  return (
    <div className="flex flex-col w-full h-full bg-[#1b1b1e] select-none">
      {/* Brand header */}
      <div className="px-4 pt-3 pb-1.5">
        <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#c7c4d7]/40">
          Spectral Command
        </span>
      </div>

      {/* Navigation items — raised card */}
      <nav
        className="mx-2 px-1 py-1.5 rounded-[var(--radius)] bg-[#222225] space-y-0.5"
        role="navigation"
        aria-label="Sidebar navigation"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeNav
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-[var(--radius)] transition-colors',
                isActive
                  ? 'bg-[#2e2e32] text-[#e6e1e5] shadow-[inset_0_0_0_1px_rgba(199,196,215,0.08)]'
                  : 'text-[#c7c4d7]/80 hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/50'
              )}
              onClick={() => onNavChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                size={15}
                strokeWidth={1.5}
                className={isActive ? 'text-[#6bd5ff]' : ''}
              />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Connection search + tree (connections view or editing a connection) */}
      {(activeNav === 'connections' || activeNav === 'new-connection') && (
        <>
          {/* Search */}
          <div className="px-2 pt-3 pb-1">
            <div className="relative flex items-center">
              <Search
                size={12}
                strokeWidth={1.5}
                className="absolute left-2.5 text-[#c7c4d7]/40 pointer-events-none"
              />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter connections..."
                className={cn(
                  'w-full pl-7 pr-7 py-1.5 text-xs text-[#e6e1e5] placeholder-[#c7c4d7]/30',
                  'bg-[#131316] rounded-[0.25rem] outline-none',
                  "border border-[#39393c]/15 focus:border-[#6bd5ff]/30 transition-colors font-[var(--font-ui)]"
                )}
                aria-label="Filter connections"
              />
              {searchFilter && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2 text-[#c7c4d7]/40 hover:text-[#e6e1e5] transition-colors"
                  aria-label="Clear filter"
                >
                  <X size={12} strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>

          {/* Favorites */}
          <FavoritesSection onConnect={onConnectSSH} onEdit={onEditConnection} />

          {/* Recent — distinct background, collapsible */}
          <div className="mx-2 mt-2 rounded-[var(--radius)] bg-[#222225] overflow-hidden">
            <RecentSection onConnect={onConnectSSH} onEdit={onEditConnection} />
          </div>

          {/* All connections */}
          <SectionLabel label="All Connections" icon={Network} />
          <ConnectionTree
            onConnect={onConnectSSH}
            onEdit={onEditConnection}
            onNewConnection={onNewConnection}
            searchFilter={searchFilter}
            workspaceFilter={workspaceFilter}
          />
        </>
      )}

      {/* Placeholder content for non-connections views */}
      {activeNav !== 'connections' && activeNav !== 'new-connection' && (
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

      {/* Bottom actions — distinct elevated area */}
      <div className="mt-auto">
        <div className="mx-2 mb-2 px-1 py-1.5 rounded-[var(--radius)] bg-[#222225] space-y-0.5">
          <button
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-[var(--radius)] transition-colors',
              activeNav === 'new-connection'
                ? 'bg-[#2e2e32] text-[#e6e1e5]'
                : 'text-[#c7c4d7]/80 hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/50'
            )}
            onClick={onNewConnection}
            aria-label="New connection"
          >
            <Plus size={15} strokeWidth={1.5} className="text-[#22c55e]" />
            <span className="text-xs font-medium tracking-wide uppercase">New Connection</span>
          </button>

          <button
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-[var(--radius)] transition-colors',
              activeNav === 'settings' || activeNav === 'preferences'
                ? 'bg-[#2e2e32] text-[#e6e1e5]'
                : 'text-[#c7c4d7]/80 hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/50'
            )}
            onClick={() => onNavChange('settings')}
            aria-label={t('sidebar.settings')}
          >
            <Settings size={15} strokeWidth={1.5} />
            <span>Settings</span>
          </button>

          <button
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-[var(--radius)] transition-colors',
              'text-[#c7c4d7]/80 hover:text-[#e6e1e5] hover:bg-[#2a2a2d]/50'
            )}
            onClick={() => setShowQuickConnect(!showQuickConnect)}
            aria-label="Quick connect"
          >
            <HelpCircle size={15} strokeWidth={1.5} />
            <span>Quick Connect</span>
          </button>
        </div>
      </div>
    </div>
  )
}
