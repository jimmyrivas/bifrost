import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { cn } from '@renderer/lib/utils'
import { XTerminal } from './XTerminal'
import { useSessionsStore, type TerminalPane as TerminalPaneType } from '@renderer/stores/sessions.store'

const SPECTRAL_GRADIENT =
  'linear-gradient(135deg, #ff6b6b, #ffa36b, #ffd56b, #6bff6b, #6bd5ff, #6b6bff, #d56bff)'

interface TerminalPaneProps {
  pane: TerminalPaneType
  tabId: string
  connectionId?: string | null
}

export function TerminalPane({ pane, tabId, connectionId }: TerminalPaneProps): JSX.Element {
  const setTerminalId = useSessionsStore((s) => s.setTerminalId)

  if (pane.split) {
    const { direction, panes } = pane.split
    const isHorizontal = direction === 'horizontal'

    return (
      <PanelGroup direction={direction} className="h-full">
        <Panel minSize={10}>
          <TerminalPane pane={panes[0]} tabId={tabId} connectionId={connectionId} />
        </Panel>
        <PanelResizeHandle
          className={cn(
            'transition-colors group',
            isHorizontal
              ? 'w-[2px] bg-[#1b1b1e] hover:bg-[#2a2a2d]'
              : 'h-[2px] bg-[#1b1b1e] hover:bg-[#2a2a2d]',
            'data-[resize-handle-state=drag]:bg-transparent'
          )}
        >
          <div
            className={cn(
              'w-full h-full opacity-0 group-hover:opacity-60 transition-opacity',
              'group-data-[resize-handle-state=drag]:opacity-100'
            )}
            style={{ background: SPECTRAL_GRADIENT }}
          />
        </PanelResizeHandle>
        <Panel minSize={10}>
          <TerminalPane pane={panes[1]} tabId={tabId} connectionId={connectionId} />
        </Panel>
      </PanelGroup>
    )
  }

  return (
    <XTerminal
      paneId={pane.id}
      tabId={tabId}
      connectionId={connectionId}
      onTerminalCreated={(terminalId) => setTerminalId(tabId, pane.id, terminalId)}
    />
  )
}
