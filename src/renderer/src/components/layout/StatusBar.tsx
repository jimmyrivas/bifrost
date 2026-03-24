import { useSessionsStore } from '@renderer/stores/sessions.store'
import { useWorkspaceStore } from '@renderer/stores/workspace.store'
import { cn } from '@renderer/lib/utils'
import { Radio, Bot, Layers } from 'lucide-react'

export function StatusBar(): JSX.Element {
  const tabs = useSessionsStore((s) => s.tabs)
  const activeTabId = useSessionsStore((s) => s.activeTabId)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const broadcastMode = useSessionsStore((s) => s.broadcastMode)
  const cycleBroadcast = useSessionsStore((s) => s.cycleBroadcastMode)

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)

  const toggleAi = (): void => {
    document.dispatchEvent(new CustomEvent('toggle:ai-assistant'))
  }

  const broadcastLabel =
    broadcastMode === 'hidden' ? 'Hidden' : broadcastMode === 'off' ? 'Off' : broadcastMode === 'panes' ? 'Panes' : 'All'
  const broadcastColor =
    broadcastMode === 'hidden' || broadcastMode === 'off'
      ? 'text-[#c7c4d7]/40'
      : broadcastMode === 'panes'
        ? 'text-[#eab308]'
        : 'text-[#ef4444]'

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

        {/* Workspace indicator */}
        {activeWorkspace && (
          <span className="flex items-center gap-1.5">
            <Layers size={10} strokeWidth={1.5} className="text-[#6bd5ff]/60" />
            <span className="text-[10px] text-[#6bd5ff]/80 font-medium tracking-wide">
              {activeWorkspace.name}
            </span>
          </span>
        )}
      </div>

      {/* Center section */}
      <div className="flex items-center gap-4">
        <span className="uppercase tracking-wide text-[10px]">Encoding: UTF-8</span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* AI Assistant toggle */}
        <button
          onClick={toggleAi}
          className="flex items-center gap-1.5 hover:text-[#6bd5ff] transition-colors"
          title="Toggle AI Assistant (Ctrl+Shift+A)"
          aria-label="Toggle AI Assistant"
        >
          <Bot size={12} strokeWidth={1.5} />
          <span className="uppercase tracking-wide text-[10px]">AI</span>
        </button>

        {/* PCC Broadcast toggle */}
        <button
          onClick={cycleBroadcast}
          className={cn(
            'flex items-center gap-1.5 transition-colors',
            broadcastMode === 'hidden' || broadcastMode === 'off'
              ? 'hover:text-[#eab308]'
              : 'hover:text-[var(--on-surface)]'
          )}
          title={`Broadcast: ${broadcastLabel} (click to cycle)`}
          aria-label={`Toggle broadcast mode, currently ${broadcastLabel}`}
        >
          <Radio
            size={11}
            strokeWidth={broadcastMode === 'hidden' || broadcastMode === 'off' ? 1.5 : 2}
            className={broadcastColor}
          />
          <span className={cn('uppercase tracking-wide text-[10px] font-medium', broadcastColor)}>
            PCC{broadcastMode !== 'hidden' && broadcastMode !== 'off' ? `: ${broadcastLabel}` : ''}
          </span>
        </button>

        {/* Connected session info */}
        {activeTab && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
            <span className="uppercase tracking-wide text-[10px] font-medium truncate max-w-[200px]">
              {activeTab.title}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
