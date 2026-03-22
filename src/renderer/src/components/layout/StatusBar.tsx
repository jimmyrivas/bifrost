import { useSessionsStore } from '@renderer/stores/sessions.store'
import { cn } from '@renderer/lib/utils'
import { Radio } from 'lucide-react'

export function StatusBar(): JSX.Element {
  const tabs = useSessionsStore((s) => s.tabs)
  const activeTabId = useSessionsStore((s) => s.activeTabId)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const broadcastMode = useSessionsStore((s) => s.broadcastMode)

  return (
    <div
      className={cn(
        'flex items-center justify-between h-6 px-3 shrink-0 select-none',
        'bg-[#131316] text-[11px] text-[#c7c4d7]/70 font-[Inter]'
      )}
      role="status"
      aria-label="Status bar"
    >
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-block w-1.5 h-1.5 rounded-full',
              activeTab ? 'bg-[#22c55e]' : 'bg-[#c7c4d7]/30'
            )}
          />
          <span className="uppercase tracking-wide text-[10px] font-medium">
            {activeTab ? 'Ready' : 'No session'}
          </span>
        </span>

        {/* Tab count */}
        <span>
          {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}
        </span>

        {/* Broadcast indicator */}
        {broadcastMode !== 'off' && (
          <span
            className={cn(
              'flex items-center gap-1.5 uppercase tracking-wide text-[10px] font-semibold',
              broadcastMode === 'panes' ? 'text-[#eab308]' : 'text-[#ef4444]'
            )}
          >
            <Radio size={11} strokeWidth={2} />
            {broadcastMode === 'panes' ? 'Broadcast: Panes' : 'Broadcast: All'}
          </span>
        )}
      </div>

      {/* Center section */}
      <div className="flex items-center gap-4">
        <span className="uppercase tracking-wide text-[10px]">Encoding: UTF-8</span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* PCC indicator */}
        <span className="flex items-center gap-1.5">
          <Radio size={11} strokeWidth={1.5} className="text-[#c7c4d7]/40" />
          <span className="uppercase tracking-wide text-[10px]">PCC</span>
        </span>

        {/* Connected session info */}
        {activeTab && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
            <span className="uppercase tracking-wide text-[10px] font-medium">
              Connected: {activeTab.title}
            </span>
          </span>
        )}

        {/* Cluster info */}
        <span className="uppercase tracking-wide text-[10px]">
          Cluster: Alpha
        </span>
      </div>
    </div>
  )
}
